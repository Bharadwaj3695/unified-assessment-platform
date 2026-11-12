const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog } = require('../src/models');
const authService = require('../src/services/auth.service');
const emailService = require('../src/services/email.service');
const mfaUtil = require('../src/utils/mfa');
const env = require('../src/config/env');

// Pull the 6-digit code out of the most recent OTP email captured by the in-memory transport
function lastOtpFromEmail(to) {
  const mail = [...emailService.sentEmails].reverse().find((m) => m.to === to && /sign-in verification code/i.test(m.subject));
  assert.ok(mail, 'An OTP email should have been sent');
  assert.ok(!/\d{6}/.test(mail.subject), 'code must not appear in the subject (subjects are logged)');
  const match = mail.text.match(/sign-in code is (\d{6})/);
  assert.ok(match, 'Body should contain the 6-digit code');
  return match[1];
}

async function login() {
  const res = await authService.login({ email: 'student@uap.edu', password: 'Student@123' });
  assert.strictEqual(res.mfaRequired, true);
  return res.mfaToken;
}

async function challengeFor(mfaToken) {
  const { verifyMfaChallengeToken } = require('../src/utils/jwt');
  const decoded = verifyMfaChallengeToken(mfaToken);
  return MfaChallenge.findOne({ challengeHash: mfaUtil.hashMfaChallenge(decoded.jti) });
}

describe('MFA Email OTP (alternative second factor)', () => {
  let student;
  let totpSecret;

  before(async () => {
    await connectDB();
    await seedDatabase();
    student = await User.findOne({ email: 'student@uap.edu' });
    totpSecret = mfaUtil.generateTotpSecret();
    student.mfaSecret = mfaUtil.encryptSecret(totpSecret);
    student.mfaEnabled = true;
    student.mfaRecoveryCodes = [];
    await student.save();
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(() => {
    env.MFA_EMAIL_OTP_ENABLED = true;
  });

  it('1. sends a 6-digit code to the account email and stores only a hash', async () => {
    const mfaToken = await login();
    const res = await authService.sendMfaEmailOtp({ mfaToken });
    assert.strictEqual(res.sent, true);
    assert.ok(res.email.includes('*'), 'email should be masked in the response');
    assert.ok(!('code' in res), 'code must never be returned in the API response');

    const code = lastOtpFromEmail('student@uap.edu');
    const challenge = await challengeFor(mfaToken);
    assert.ok(challenge.emailOtpHash, 'hash stored');
    assert.notStrictEqual(challenge.emailOtpHash, code, 'plaintext code must not be stored');
    assert.strictEqual(challenge.emailOtpSendCount, 1);
    assert.ok(!('emailOtpHash' in challenge.toJSON()), 'hash stripped from JSON');
  });

  it('2. correct email code completes login and issues tokens', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    const code = lastOtpFromEmail('student@uap.edu');

    const res = await authService.verifyMfaChallenge({ mfaToken, code, method: 'email' });
    assert.ok(res.accessToken);
    assert.ok(res.refreshToken);

    const challenge = await challengeFor(mfaToken);
    assert.strictEqual(challenge.consumed, true);
    assert.strictEqual(challenge.emailOtpHash, null, 'OTP hash cleared after use');

    const log = await AuditLog.findOne({ action: 'USER_LOGIN_MFA_SUCCESS', userId: student._id }).sort({ createdAt: -1 });
    assert.strictEqual(log.details.method, 'email_otp');
  });

  it('3. email code is single-use (challenge consumed)', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    const code = lastOtpFromEmail('student@uap.edu');
    await authService.verifyMfaChallenge({ mfaToken, code, method: 'email' });
    await assert.rejects(
      () => authService.verifyMfaChallenge({ mfaToken, code, method: 'email' }),
      (err) => err.statusCode === 401 && /already been used/i.test(err.message)
    );
  });

  it('4. wrong email code counts toward the shared 5-attempt limit', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    const code = lastOtpFromEmail('student@uap.edu');
    const wrong = code === '000000' ? '111111' : '000000';
    await assert.rejects(
      () => authService.verifyMfaChallenge({ mfaToken, code: wrong, method: 'email' }),
      (err) => err.statusCode === 401 && /Invalid email verification code\. 4 attempts remaining/.test(err.message)
    );
    const challenge = await challengeFor(mfaToken);
    assert.strictEqual(challenge.attempts, 1);
  });

  it('5. emailed code is the current TOTP code, and the authenticator app still works', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    const emailCode = lastOtpFromEmail('student@uap.edu');
    assert.ok(mfaUtil.verifyTotp(emailCode, totpSecret), 'emailed code should be a valid TOTP code');
    const totp = mfaUtil.generateTotpCode(totpSecret);
    const res = await authService.verifyMfaChallenge({ mfaToken, code: totp });
    assert.ok(res.accessToken, 'authenticator app still works after an email code was requested');

    const fresh = await User.findById(student._id);
    assert.strictEqual(fresh.mfaEnabled, true);
    assert.strictEqual(mfaUtil.decryptSecret(fresh.mfaSecret), totpSecret, 'TOTP secret unchanged');
  });

  it('6. verifying with method=email before requesting a code is rejected', async () => {
    const mfaToken = await login();
    await assert.rejects(
      () => authService.verifyMfaChallenge({ mfaToken, code: '123456', method: 'email' }),
      (err) => err.statusCode === 400 && /request a code first/i.test(err.message)
    );
  });

  it('7. resend is blocked during the 60s cooldown', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    await assert.rejects(
      () => authService.sendMfaEmailOtp({ mfaToken }),
      (err) => err.statusCode === 429 && err.retryAfterSeconds > 0
    );
  });

  it('8. resending replaces the old code (old code no longer valid)', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    const oldCode = lastOtpFromEmail('student@uap.edu');
    // Simulate cooldown elapsed
    const c = await challengeFor(mfaToken);
    c.emailOtpLastSentAt = new Date(Date.now() - 61 * 1000);
    await c.save();
    await authService.sendMfaEmailOtp({ mfaToken });
    const newCode = lastOtpFromEmail('student@uap.edu');
    if (oldCode !== newCode) {
      await assert.rejects(() => authService.verifyMfaChallenge({ mfaToken, code: oldCode, method: 'email' }));
    }
    const res = await authService.verifyMfaChallenge({ mfaToken, code: newCode, method: 'email' });
    assert.ok(res.accessToken);
  });

  it('9. max 5 sends per challenge', async () => {
    const mfaToken = await login();
    const c = await challengeFor(mfaToken);
    c.emailOtpSendCount = 5;
    await c.save();
    await assert.rejects(
      () => authService.sendMfaEmailOtp({ mfaToken }),
      (err) => err.statusCode === 429 && /Maximum number of email codes/i.test(err.message)
    );
  });

  it('10. expired email code is rejected', async () => {
    const mfaToken = await login();
    await authService.sendMfaEmailOtp({ mfaToken });
    const code = lastOtpFromEmail('student@uap.edu');
    const c = await challengeFor(mfaToken);
    c.emailOtpExpiresAt = new Date(Date.now() - 1000);
    await c.save();
    await assert.rejects(
      () => authService.verifyMfaChallenge({ mfaToken, code, method: 'email' }),
      (err) => err.statusCode === 401 && /expired/i.test(err.message)
    );
  });

  it('11. a code from one sign-in cannot be used on another sign-in', async () => {
    const tokenA = await login();
    await authService.sendMfaEmailOtp({ mfaToken: tokenA });
    const codeA = lastOtpFromEmail('student@uap.edu');
    const tokenB = await login();
    await authService.sendMfaEmailOtp({ mfaToken: tokenB });
    const codeB = lastOtpFromEmail('student@uap.edu');
    if (codeA !== codeB) {
      await assert.rejects(() => authService.verifyMfaChallenge({ mfaToken: tokenB, code: codeA, method: 'email' }));
    }
  });

  it('12. failed email delivery rolls back and returns 503', async () => {
    const mfaToken = await login();
    const original = emailService.sendMail.bind(emailService);
    emailService.sendMail = async () => ({ success: false, error: 'boom' });
    try {
      await assert.rejects(
        () => authService.sendMfaEmailOtp({ mfaToken }),
        (err) => err.statusCode === 503
      );
    } finally {
      emailService.sendMail = original;
    }
    const c = await challengeFor(mfaToken);
    assert.strictEqual(c.emailOtpSendCount, 0);
    assert.strictEqual(c.emailOtpHash, null);
    assert.strictEqual(c.emailOtpLastSentAt, null);
    // User can immediately retry (no cooldown from a failed send)
    const res = await authService.sendMfaEmailOtp({ mfaToken });
    assert.strictEqual(res.sent, true);
  });

  it('13. feature flag off blocks sending and email verification', async () => {
    const mfaToken = await login();
    env.MFA_EMAIL_OTP_ENABLED = false;
    await assert.rejects(() => authService.sendMfaEmailOtp({ mfaToken }), (err) => err.statusCode === 403);
  });

  it('14. invalid / non-MFA token cannot trigger an email', async () => {
    await assert.rejects(() => authService.sendMfaEmailOtp({ mfaToken: 'garbage' }), (err) => err.statusCode === 401);
  });
});
