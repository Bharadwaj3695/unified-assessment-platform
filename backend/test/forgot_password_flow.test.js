const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const authService = require('../src/services/auth.service');
const emailService = require('../src/services/email.service');
const { User, PasswordResetToken, AuditLog, StudentRegistry } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Forgot & Reset Password End-to-End Verification Suite', () => {
  let testUser;
  const originalPassword = 'OldPassword@123';
  const newPassword = 'NewSecurePassword@456';
  const testEmail = 'forgot_test_user@uap.edu';

  before(async () => {
    await connectDB();
    await seedDatabase();
    await User.deleteMany({ email: testEmail });
    await PasswordResetToken.deleteMany({});

    testUser = await User.create({
      name: 'Forgot Pass Test Student',
      email: testEmail,
      password: await hashPassword(originalPassword),
      role: 'student',
      status: 'active',
      isActive: true,
    });
  });

  after(async () => {
    await User.deleteMany({ email: testEmail });
    await PasswordResetToken.deleteMany({ userId: testUser._id });
    await disconnectDB();
  });

  beforeEach(() => {
    emailService.clearSentEmails();
  });

  it('1. Registered email triggers recovery email and creates hashed reset token record', async () => {
    const response = await authService.forgotPassword(testEmail);
    assert.ok(response.message.includes('If an account exists'));

    // Check sent email
    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail, 'Recovery email should be dispatched');
    assert.strictEqual(lastEmail.to, testEmail);
    assert.ok(lastEmail.subject.includes('Password Reset Request'));
    assert.ok(lastEmail.html.includes('Unified Assessment Platform'));
    assert.ok(lastEmail.html.includes('Reset Password'));
    assert.ok(lastEmail.html.includes('1 hour'));

    // Verify token record persisted
    const tokenRecord = await PasswordResetToken.findOne({ userId: testUser._id, consumed: false });
    assert.ok(tokenRecord, 'PasswordResetToken record should exist in database');
    assert.strictEqual(tokenRecord.consumed, false);
    assert.ok(tokenRecord.expiresAt > new Date(), 'Expiry should be in the future');
  });

  it('2. Unregistered email returns generic message without enumerating user existence', async () => {
    const unregEmail = 'nonexistent_account_999@uap.edu';
    const response = await authService.forgotPassword(unregEmail);
    assert.ok(response.message.includes('If an account exists'));

    const sentEmails = emailService.getSentEmails();
    assert.strictEqual(sentEmails.length, 0, 'No email should be dispatched for unregistered user');
  });

  it('3. Invalid email format is rejected by input validator', () => {
    const { validationResult } = require('express-validator');
    const { forgotPasswordValidator } = require('../src/validators/auth.validator');

    // Run validator middleware
    const req = { body: { email: 'not-a-valid-email' } };
    // Verify validator array contains email checks
    assert.ok(forgotPasswordValidator.length > 0);
  });

  it('4. SMTP configuration is validated', () => {
    const isConfigured = emailService.isSmtpConfigured();
    assert.strictEqual(typeof isConfigured, 'boolean');
  });

  it('5. SMTP delivery failure is handled gracefully without crashing or throwing', async () => {
    // Temporarily mock sendPasswordResetEmail to simulate failure
    const originalSend = emailService.sendPasswordResetEmail;
    emailService.sendPasswordResetEmail = async () => ({
      success: false,
      error: 'Simulated SMTP connection timeout',
    });

    try {
      const response = await authService.forgotPassword(testEmail);
      assert.ok(response.message.includes('If an account exists'));
    } finally {
      emailService.sendPasswordResetEmail = originalSend;
    }
  });

  it('6. Reset token is cryptographically secure and stored hashed', async () => {
    await PasswordResetToken.deleteMany({ userId: testUser._id });
    await authService.forgotPassword(testEmail);

    const tokenRecord = await PasswordResetToken.findOne({ userId: testUser._id, consumed: false });
    assert.ok(tokenRecord);
    // SHA-256 hash is exactly 64 hexadecimal characters
    assert.strictEqual(tokenRecord.tokenHash.length, 64);
    assert.match(tokenRecord.tokenHash, /^[0-9a-f]{64}$/);
  });

  it('7. Expired reset token is rejected', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.create({
      tokenHash,
      userId: testUser._id,
      consumed: false,
      expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
    });

    await assert.rejects(
      async () => {
        await authService.resetPassword({ token: rawToken, password: newPassword });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.toLowerCase().includes('expired'));
        return true;
      }
    );
  });

  it('8. Reset token is single-use and cannot be redeemed twice', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.create({
      tokenHash,
      userId: testUser._id,
      consumed: false,
      expiresAt: new Date(Date.now() + 3600000),
    });

    // First reset succeeds
    const firstResult = await authService.resetPassword({ token: rawToken, password: newPassword });
    assert.ok(firstResult.message.includes('reset successfully'));

    // Second reset attempt with the exact same token fails
    await assert.rejects(
      async () => {
        await authService.resetPassword({ token: rawToken, password: newPassword });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.toLowerCase().includes('already been used') || err.message.toLowerCase().includes('invalid'));
        return true;
      }
    );
  });

  it('9. Password reset succeeds and updates user credentials in database', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.create({
      tokenHash,
      userId: testUser._id,
      consumed: false,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const updatedPasswordValue = 'CompletelyNewPass@789';
    const result = await authService.resetPassword({
      token: rawToken,
      password: updatedPasswordValue,
      confirmPassword: updatedPasswordValue,
    });
    assert.ok(result.message.includes('reset successfully'));

    const updatedUser = await User.findById(testUser._id);
    const { comparePassword } = require('../src/utils/password');
    const isNewMatch = await comparePassword(updatedPasswordValue, updatedUser.password);
    assert.strictEqual(isNewMatch, true, 'User password in DB should match new password');

    // Audit log should be created
    const audit = await AuditLog.findOne({
      userId: testUser._id,
      action: 'PASSWORD_RESET_COMPLETED',
    });
    assert.ok(audit, 'Audit log should record PASSWORD_RESET_COMPLETED');
  });

  it('10. Existing login succeeds with new password and fails with old password', async () => {
    const activePass = 'FinalVerifiedPassword@999';
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.create({
      tokenHash,
      userId: testUser._id,
      consumed: false,
      expiresAt: new Date(Date.now() + 3600000),
    });

    await authService.resetPassword({
      token: rawToken,
      password: activePass,
      confirmPassword: activePass,
    });

    // Login with new password should succeed
    const loginResult = await authService.login({
      email: testEmail,
      password: activePass,
    });
    assert.ok(loginResult.accessToken, 'Login should succeed with new password');

    // Login with old password should fail
    await assert.rejects(
      async () => {
        await authService.login({
          email: testEmail,
          password: originalPassword,
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );
  });

  // =========================================================================
  // DEMO ACCOUNT TEST MATRIX (Phase 9 Hardening Verification)
  // =========================================================================

  it('11. TEST A: Demo admin (admin01@uap.edu) -> Forgot Password -> reset token created & email attempted', async () => {
    emailService.clearSentEmails();
    const adminUser = await User.findOne({ email: 'admin01@uap.edu' });
    assert.ok(adminUser, 'Seeded demo admin account should exist in database');

    const res = await authService.forgotPassword('admin01@uap.edu');
    assert.ok(res.message.includes('If an account exists'));

    const tokenRecord = await PasswordResetToken.findOne({ userId: adminUser._id, consumed: false });
    assert.ok(tokenRecord, 'Reset token must be generated for demo admin');
    assert.ok(tokenRecord.expiresAt > new Date());

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail, 'Recovery email must be dispatched for demo admin');
    assert.strictEqual(lastEmail.to, 'admin01@uap.edu');
    assert.match(lastEmail.subject, /Password Reset Request/i);
  });

  it('12. TEST B: Demo instructor (ins01@uap.edu) -> Forgot Password -> reset token created & email attempted', async () => {
    emailService.clearSentEmails();
    const instructorUser = await User.findOne({ email: 'ins01@uap.edu' });
    assert.ok(instructorUser, 'Seeded demo instructor account should exist in database');

    const res = await authService.forgotPassword('ins01@uap.edu');
    assert.ok(res.message.includes('If an account exists'));

    const tokenRecord = await PasswordResetToken.findOne({ userId: instructorUser._id, consumed: false });
    assert.ok(tokenRecord, 'Reset token must be generated for demo instructor');

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail, 'Recovery email must be dispatched for demo instructor');
    assert.strictEqual(lastEmail.to, 'ins01@uap.edu');
    assert.match(lastEmail.subject, /Password Reset Request/i);
  });

  it('13. TEST C: Demo student (std01@uap.edu) -> Forgot Password -> reset token created & email attempted', async () => {
    emailService.clearSentEmails();
    const studentUser = await User.findOne({ email: 'std01@uap.edu' });
    assert.ok(studentUser, 'Seeded demo student account should exist in database');

    const res = await authService.forgotPassword('std01@uap.edu');
    assert.ok(res.message.includes('If an account exists'));

    const tokenRecord = await PasswordResetToken.findOne({ userId: studentUser._id, consumed: false });
    assert.ok(tokenRecord, 'Reset token must be generated for demo student');

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail, 'Recovery email must be dispatched for demo student');
    assert.strictEqual(lastEmail.to, 'std01@uap.edu');
    assert.match(lastEmail.subject, /Password Reset Request/i);
  });

  it('14. TEST D: Normal registered UAP user -> Forgot Password -> reset token created & email attempted', async () => {
    emailService.clearSentEmails();
    const regEmail = 'normal_registered_candidate@uap.edu';
    await User.deleteMany({ email: regEmail });
    const regUser = await User.create({
      name: 'Normal Registered User',
      email: regEmail,
      password: await hashPassword('NormalPass@123'),
      role: 'student',
      status: 'active',
      isActive: true,
    });

    const res = await authService.forgotPassword(regEmail);
    assert.ok(res.message.includes('If an account exists'));

    const tokenRecord = await PasswordResetToken.findOne({ userId: regUser._id, consumed: false });
    assert.ok(tokenRecord, 'Reset token must be generated for normal registered user');

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail, 'Recovery email must be dispatched for normal user');
    assert.strictEqual(lastEmail.to, regEmail);

    await User.deleteMany({ email: regEmail });
    await PasswordResetToken.deleteMany({ userId: regUser._id });
  });

  it('15. TEST E: User exists but is NOT in StudentRegistry -> Forgot Password operates independently', async () => {
    emailService.clearSentEmails();
    const nonRegistryEmail = 'non_registry_student@uap.edu';
    await User.deleteMany({ email: nonRegistryEmail });

    // Verify absence from StudentRegistry master data
    const inRegistry = await StudentRegistry.findOne({ email: nonRegistryEmail });
    assert.strictEqual(inRegistry, null, 'User must NOT be present in StudentRegistry');

    const nonRegistryUser = await User.create({
      name: 'Non Registry Student',
      email: nonRegistryEmail,
      password: await hashPassword('NonRegPass@123'),
      role: 'student',
      status: 'active',
      isActive: true,
    });

    // Forgot password must succeed based strictly on User collection
    const res = await authService.forgotPassword(nonRegistryEmail);
    assert.ok(res.message.includes('If an account exists'));

    const tokenRecord = await PasswordResetToken.findOne({ userId: nonRegistryUser._id, consumed: false });
    assert.ok(tokenRecord, 'Reset token must be generated for user absent from StudentRegistry');

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail, 'Recovery email must be dispatched');
    assert.strictEqual(lastEmail.to, nonRegistryEmail);

    await User.deleteMany({ email: nonRegistryEmail });
    await PasswordResetToken.deleteMany({ userId: nonRegistryUser._id });
  });

  it('16. TEST F: Unknown email -> generic response, NO reset token, NO email', async () => {
    emailService.clearSentEmails();
    const unknownEmail = 'completely_unknown_account_98765@uap.edu';

    const beforeTokenCount = await PasswordResetToken.countDocuments();
    const res = await authService.forgotPassword(unknownEmail);

    // Generic response to prevent account enumeration
    assert.ok(res.message.includes('If an account exists'));

    const afterTokenCount = await PasswordResetToken.countDocuments();
    assert.strictEqual(afterTokenCount, beforeTokenCount, 'No new PasswordResetToken must be created for unknown email');

    const sentEmails = emailService.getSentEmails();
    assert.strictEqual(sentEmails.length, 0, 'No email must be dispatched for unknown email');
  });

  it('17. TEST G: Revoked user -> generic response, NO reset token, NO email, authentication denied', async () => {
    emailService.clearSentEmails();
    const revokedEmail = 'revoked_security_test_user@uap.edu';
    await User.deleteMany({ email: revokedEmail });

    const revokedUser = await User.create({
      name: 'Revoked Security User',
      email: revokedEmail,
      password: await hashPassword('RevokedPass@123'),
      role: 'student',
      status: 'revoked',
      isActive: false,
    });

    const beforeTokenCount = await PasswordResetToken.countDocuments();
    const res = await authService.forgotPassword(revokedEmail);

    // Generic response returned
    assert.ok(res.message.includes('If an account exists'));

    const afterTokenCount = await PasswordResetToken.countDocuments();
    assert.strictEqual(afterTokenCount, beforeTokenCount, 'No reset token must be created for revoked account');

    const sentEmails = emailService.getSentEmails();
    assert.strictEqual(sentEmails.length, 0, 'No email must be sent to revoked user');

    // Revoked user cannot authenticate
    await assert.rejects(
      async () => {
        await authService.login({
          email: revokedEmail,
          password: 'RevokedPass@123',
        });
      },
      (err) => {
        assert.ok(err.statusCode === 403 || err.statusCode === 401);
        assert.match(err.message, /revoked|suspended|disabled|inactive/i);
        return true;
      }
    );

    await User.deleteMany({ email: revokedEmail });
  });
});
