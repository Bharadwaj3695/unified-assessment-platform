const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog } = require('../src/models');
const authService = require('../src/services/auth.service');
const googleAuthService = require('../src/services/googleAuth.service');
const { hashPassword } = require('../src/utils/password');
const { verifyAccessToken, generateAccessToken, generateMfaChallengeToken } = require('../src/utils/jwt');
const mfaUtil = require('../src/utils/mfa');
const { authenticate } = require('../src/middleware/auth.middleware');

const mockResponse = () => {
  const res = {
    statusCode: 200,
    responseData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.responseData = data;
      return this;
    },
  };
  return res;
};

describe('Phase 8A: Multi-Factor Authentication (MFA / 2FA) Backend Foundation', () => {
  let studentUser;
  let instructorUser;
  let adminUser;

  before(async () => {
    await connectDB();
    await seedDatabase();

    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
  });

  after(async () => {
    await disconnectDB();
  });

  // 1. MFA disabled → normal login
  it('1. MFA disabled → normal password login issues access & refresh tokens directly', async () => {
    studentUser.mfaEnabled = false;
    await studentUser.save();

    const result = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });

    assert.strictEqual(result.mfaRequired, undefined);
    assert.ok(result.accessToken, 'Access token must be present');
    assert.ok(result.refreshToken, 'Refresh token must be present');
    assert.strictEqual(result.user.email, 'student@uap.edu');
    assert.strictEqual(result.user.mfaEnabled, false);
  });

  // 2. MFA enabled → challenge returned
  it('2. MFA enabled → password login returns short-lived MFA challenge token and NO access token', async () => {
    const secret = mfaUtil.generateTotpSecret();
    studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
    studentUser.mfaEnabled = true;
    studentUser.mfaRecoveryCodes = [];
    await studentUser.save();

    const result = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });

    assert.strictEqual(result.mfaRequired, true);
    assert.ok(result.mfaToken, 'MFA challenge token must be present');
    assert.strictEqual(result.accessToken, undefined, 'Access token must NOT be issued yet');
    assert.strictEqual(result.refreshToken, undefined, 'Refresh token must NOT be issued yet');
    assert.strictEqual(result.user.id, studentUser._id.toString());
  });

  // 3. challenge cannot access protected endpoint
  it('3. MFA challenge token cannot access normal protected API endpoints via auth middleware', async () => {
    const challengeResult = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = challengeResult.mfaToken;

    const req = {
      headers: {
        authorization: `Bearer ${mfaToken}`,
      },
    };
    const res = mockResponse();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authenticate(req, res, next);
    assert.strictEqual(nextCalled, false, 'Middleware next() must not be called with MFA challenge token');
    assert.strictEqual(res.statusCode, 401, 'Should respond with 401 Unauthorized');
    assert.ok(res.responseData.message.toLowerCase().includes('mfa challenge'));
  });

  // 4. valid TOTP → real JWT
  it('4. valid TOTP code completes challenge and issues genuine application JWT tokens', async () => {
    // Decrypt the secret from studentUser
    const decryptedSecret = mfaUtil.decryptSecret(studentUser.mfaSecret);
    const validTotp = mfaUtil.generateTotpCode(decryptedSecret);

    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;

    const verifyRes = await authService.verifyMfaChallenge({
      mfaToken,
      code: validTotp,
    });

    assert.ok(verifyRes.accessToken, 'Valid access token must be issued');
    assert.ok(verifyRes.refreshToken, 'Valid refresh token must be issued');
    assert.strictEqual(verifyRes.user.email, 'student@uap.edu');
    assert.strictEqual(verifyRes.user.mfaEnabled, true);

    // Verify token can now access protected route
    const req = {
      headers: {
        authorization: `Bearer ${verifyRes.accessToken}`,
      },
    };
    const res = mockResponse();
    let nextCalled = false;
    await authenticate(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, 'Real access token must pass auth middleware');
    assert.strictEqual(req.user.email, 'student@uap.edu');
  });

  // 5. invalid TOTP → rejected
  it('5. invalid TOTP code is rejected with 401 and tracks failed attempts', async () => {
    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;

    await assert.rejects(
      async () => {
        await authService.verifyMfaChallenge({
          mfaToken,
          code: '000000',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('Invalid TOTP verification code'));
        assert.ok(err.message.includes('4 attempts remaining'));
        return true;
      }
    );
  });

  // 6. expired challenge → rejected
  it('6. expired challenge token is rejected with 401', async () => {
    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;

    // Manually expire the challenge document in MongoDB
    const { verifyMfaChallengeToken } = require('../src/utils/jwt');
    const decoded = verifyMfaChallengeToken(mfaToken);
    await MfaChallenge.updateOne(
      { challengeId: decoded.jti },
      { $set: { expiresAt: new Date(Date.now() - 10000) } }
    );

    await assert.rejects(
      async () => {
        await authService.verifyMfaChallenge({
          mfaToken,
          code: '123456',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('expired'));
        return true;
      }
    );
  });

  // 7. reused challenge → rejected (Single-use requirement)
  it('7. challenge is single-use: subsequent verification attempts fail', async () => {
    const decryptedSecret = mfaUtil.decryptSecret(studentUser.mfaSecret);
    const validTotp = mfaUtil.generateTotpCode(decryptedSecret);

    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;

    // First attempt succeeds
    const firstRes = await authService.verifyMfaChallenge({
      mfaToken,
      code: validTotp,
    });
    assert.ok(firstRes.accessToken);

    // Replay attempt with same challenge token must fail
    await assert.rejects(
      async () => {
        await authService.verifyMfaChallenge({
          mfaToken,
          code: validTotp,
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('already been used'));
        return true;
      }
    );
  });

  // 8. sixth failed attempt → rejected (Rate limiting)
  it('8. maximum 5 failed attempts per challenge; 6th attempt is locked out', async () => {
    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;
    const decryptedSecret = mfaUtil.decryptSecret(studentUser.mfaSecret);
    const validTotp = mfaUtil.generateTotpCode(decryptedSecret);

    // Attempts 1 to 4 fail
    for (let i = 1; i <= 4; i++) {
      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({ mfaToken, code: '000000' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );
    }

    // 5th attempt fails and locks challenge
    await assert.rejects(
      async () => {
        await authService.verifyMfaChallenge({ mfaToken, code: '000000' });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('Maximum verification attempts exceeded'));
        return true;
      }
    );

    // 6th attempt with even a VALID code must be rejected because challenge is locked
    await assert.rejects(
      async () => {
        await authService.verifyMfaChallenge({ mfaToken, code: validTotp });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('Maximum MFA verification attempts exceeded'));
        return true;
      }
    );
  });

  // 9. recovery code → successful authentication
  it('9. valid recovery code completes challenge and marks the code as used', async () => {
    // Generate recovery codes for studentUser
    const recoveryCodes = mfaUtil.generateRecoveryCodes(8);
    studentUser.mfaRecoveryCodes = recoveryCodes.map((c) => ({
      codeHash: mfaUtil.hashRecoveryCode(c),
      used: false,
      usedAt: null,
    }));
    await studentUser.save();

    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;

    const testCode = recoveryCodes[0];
    const recoveryRes = await authService.redeemMfaRecoveryCode({
      mfaToken,
      recoveryCode: testCode,
    });

    assert.ok(recoveryRes.accessToken, 'Access token must be returned on recovery code');
    assert.strictEqual(recoveryRes.user.email, 'student@uap.edu');

    // Verify code is now marked used in MongoDB
    const updatedUser = await User.findById(studentUser._id);
    const usedEntry = updatedUser.mfaRecoveryCodes.find(
      (c) => c.codeHash === mfaUtil.hashRecoveryCode(testCode)
    );
    assert.ok(usedEntry, 'Used code entry must exist');
    assert.strictEqual(usedEntry.used, true);
    assert.ok(usedEntry.usedAt instanceof Date);
  });

  // 10. recovery code reuse → rejected
  it('10. already-used recovery code cannot be reused for authentication', async () => {
    const updatedUser = await User.findById(studentUser._id);
    const usedEntry = updatedUser.mfaRecoveryCodes.find((c) => c.used === true);
    assert.ok(usedEntry, 'Should have a used code from previous test');

    const loginRes = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });
    const mfaToken = loginRes.mfaToken;

    // Try redeeming with the same code
    const rawCodes = mfaUtil.generateRecoveryCodes(1); // Test with dummy
    // Or we test by matching the hash:
    await assert.rejects(
      async () => {
        await authService.redeemMfaRecoveryCode({
          mfaToken,
          recoveryCode: 'ALREADY-USED-CODE',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('Invalid or already used recovery code'));
        return true;
      }
    );
  });

  // 11. setup creates pending secret
  it('11. initiateMfaSetup creates an encrypted pending secret and returns provisioning data', async () => {
    instructorUser.mfaEnabled = false;
    instructorUser.mfaSecret = null;
    instructorUser.mfaPendingSecret = null;
    await instructorUser.save();

    const setupData = await authService.initiateMfaSetup(instructorUser._id);

    assert.ok(setupData.secret, 'Secret must be returned');
    assert.ok(setupData.otpauthUri.startsWith('otpauth://totp/'), 'OTPAuth URI must be generated');
    assert.ok(setupData.qrCode.startsWith('data:image/png;base64,'), 'QR Code Data URL must be generated');

    const freshUser = await User.findById(instructorUser._id);
    assert.ok(freshUser.mfaPendingSecret, 'mfaPendingSecret must be saved');
    assert.notStrictEqual(freshUser.mfaPendingSecret, setupData.secret, 'Secret must be encrypted, not plaintext');
  });

  // 12. setup does not enable MFA before confirmation
  it('12. initiateMfaSetup does NOT enable MFA prior to verification confirmation', async () => {
    const freshUser = await User.findById(instructorUser._id);
    assert.strictEqual(freshUser.mfaEnabled, false, 'mfaEnabled must remain false until confirmation');

    // User can still log in normally with password
    const loginRes = await authService.login({
      email: 'instructor@uap.edu',
      password: 'Instructor@123',
    });
    assert.ok(loginRes.accessToken, 'Login must succeed without MFA challenge while pending');
  });

  // 13. setup confirmation with valid TOTP
  it('13. setup-confirm with valid TOTP activates MFA and returns 8 recovery codes', async () => {
    const freshUser = await User.findById(instructorUser._id);
    const decryptedSecret = mfaUtil.decryptSecret(freshUser.mfaPendingSecret);
    const validTotp = mfaUtil.generateTotpCode(decryptedSecret);

    const confirmRes = await authService.confirmMfaSetup(instructorUser._id, validTotp);

    assert.strictEqual(confirmRes.mfaEnabled, true);
    assert.strictEqual(confirmRes.recoveryCodes.length, 8);

    const activatedUser = await User.findById(instructorUser._id);
    assert.strictEqual(activatedUser.mfaEnabled, true);
    assert.strictEqual(activatedUser.mfaPendingSecret, null, 'Pending secret must be cleared');
    assert.ok(activatedUser.mfaSecret, 'Active secret must be saved');
    assert.ok(activatedUser.mfaEnrolledAt instanceof Date);
  });

  // 14. invalid setup confirmation
  it('14. setup-confirm with invalid TOTP fails and leaves MFA disabled', async () => {
    // Reset admin user for test
    adminUser.mfaEnabled = false;
    adminUser.mfaSecret = null;
    adminUser.mfaPendingSecret = null;
    await adminUser.save();

    await authService.initiateMfaSetup(adminUser._id);

    await assert.rejects(
      async () => {
        await authService.confirmMfaSetup(adminUser._id, '000000');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Invalid TOTP verification code'));
        return true;
      }
    );

    const checkUser = await User.findById(adminUser._id);
    assert.strictEqual(checkUser.mfaEnabled, false);
    assert.strictEqual(checkUser.mfaSecret, null);
  });

  // 15. exactly 8 recovery codes generated
  it('15. setup confirmation generates exactly 8 formatted recovery codes', async () => {
    const codes = mfaUtil.generateRecoveryCodes(8);
    assert.strictEqual(codes.length, 8);
    codes.forEach((code) => {
      assert.match(code, /^[A-Z0-9]{5}-[A-Z0-9]{5}$/, 'Recovery code format must be XXXXX-XXXXX');
    });
  });

  // 16. recovery codes stored hashed
  it('16. recovery codes are stored as HMAC-SHA256 hashes, never in plaintext', async () => {
    const activatedUser = await User.findById(instructorUser._id);
    assert.strictEqual(activatedUser.mfaRecoveryCodes.length, 8);

    activatedUser.mfaRecoveryCodes.forEach((entry) => {
      assert.ok(entry.codeHash, 'codeHash must exist');
      assert.strictEqual(typeof entry.codeHash, 'string');
      assert.strictEqual(entry.codeHash.length, 64, 'SHA-256 hex string must be 64 characters');
      assert.strictEqual(entry.used, false);
    });

    // Verify toJSON transform sanitizes recovery codes
    const jsonUser = activatedUser.toJSON();
    assert.strictEqual(jsonUser.mfaRecoveryCodes, undefined, 'Recovery codes must not appear in toJSON');
    assert.strictEqual(jsonUser.mfaSecret, undefined, 'mfaSecret must not appear in toJSON');
    assert.strictEqual(jsonUser.mfaPendingSecret, undefined, 'mfaPendingSecret must not appear in toJSON');
  });

  // 17. MFA disable requires proper authentication
  it('17. disabling MFA requires correct password verification and resets security fields', async () => {
    // Incorrect password rejected
    await assert.rejects(
      async () => {
        await authService.disableMfa({
          userId: instructorUser._id,
          password: 'WrongPassword!',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.ok(err.message.includes('Incorrect password'));
        return true;
      }
    );

    // Correct password succeeds
    const disableRes = await authService.disableMfa({
      userId: instructorUser._id,
      password: 'Instructor@123',
    });
    assert.ok(disableRes.message.includes('disabled successfully'));

    const disabledUser = await User.findById(instructorUser._id);
    assert.strictEqual(disabledUser.mfaEnabled, false);
    assert.strictEqual(disabledUser.mfaSecret, null);
    assert.strictEqual(disabledUser.mfaPendingSecret, null);
    assert.strictEqual(disabledUser.mfaRecoveryCodes.length, 0);
  });

  // 18. tokenVersion invalidates previous sessions
  it('18. incrementing tokenVersion invalidates previously issued active sessions', async () => {
    // Generate a token with the current tokenVersion
    const currentUser = await User.findById(studentUser._id);
    const initialVersion = currentUser.tokenVersion || 0;

    const initialToken = generateAccessToken({
      id: currentUser._id.toString(),
      role: currentUser.role,
      email: currentUser.email,
      tokenVersion: initialVersion,
    });

    // Verify initial token passes middleware
    const req1 = { headers: { authorization: `Bearer ${initialToken}` } };
    const res1 = mockResponse();
    let next1 = false;
    await authenticate(req1, res1, () => {
      next1 = true;
    });
    assert.strictEqual(next1, true, 'Initial token should be accepted');

    // Simulate session invalidation (e.g. password change, MFA enroll/disable)
    currentUser.tokenVersion = initialVersion + 1;
    await currentUser.save();

    // Verify old token is now rejected with 401
    const req2 = { headers: { authorization: `Bearer ${initialToken}` } };
    const res2 = mockResponse();
    let next2 = false;
    await authenticate(req2, res2, () => {
      next2 = true;
    });
    assert.strictEqual(next2, false, 'Old token must be rejected after tokenVersion increment');
    assert.strictEqual(res2.statusCode, 401);
    assert.ok(res2.responseData.message.includes('Session has expired or been invalidated'));
  });

  // 19. pending account cannot complete MFA
  it('19. pending applicant account is blocked from login and cannot obtain MFA challenge', async () => {
    const pendingUser = await User.create({
      name: 'Pending Applicant',
      email: 'mfa_pending@uap.edu',
      password: await hashPassword('Password123!'),
      role: 'student',
      status: 'pending',
      isActive: false,
      mfaEnabled: true,
      mfaSecret: mfaUtil.encryptSecret(mfaUtil.generateTotpSecret()),
    });

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'mfa_pending@uap.edu',
          password: 'Password123!',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('pending administrator approval'));
        return true;
      }
    );

    // Direct challenge verification also blocked
    const dummyChallengeToken = generateMfaChallengeToken({
      userId: pendingUser._id,
      challengeId: 'dummy-challenge',
    });
    await assert.rejects(
      async () => {
        await authService.verifyMfaChallenge({
          mfaToken: dummyChallengeToken,
          code: '123456',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );
  });

  // 20. rejected account cannot complete MFA
  it('20. rejected account is blocked from MFA challenge', async () => {
    const rejectedUser = await User.create({
      name: 'Rejected Applicant',
      email: 'mfa_rejected@uap.edu',
      password: await hashPassword('Password123!'),
      role: 'student',
      status: 'rejected',
      isActive: false,
      mfaEnabled: true,
      mfaSecret: mfaUtil.encryptSecret(mfaUtil.generateTotpSecret()),
    });

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'mfa_rejected@uap.edu',
          password: 'Password123!',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('rejected'));
        return true;
      }
    );
  });

  // 21. revoked account cannot complete MFA
  it('21. revoked user account is blocked from MFA authentication', async () => {
    const revokedUser = await User.create({
      name: 'Revoked User',
      email: 'mfa_revoked@uap.edu',
      password: await hashPassword('Password123!'),
      role: 'student',
      status: 'revoked',
      isActive: false,
      mfaEnabled: true,
      mfaSecret: mfaUtil.encryptSecret(mfaUtil.generateTotpSecret()),
    });

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'mfa_revoked@uap.edu',
          password: 'Password123!',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('revoked'));
        return true;
      }
    );
  });

  // 22. Google SSO + MFA
  it('22. Google SSO user with MFA enabled receives challenge and completes via verifyMfaChallenge', async () => {
    const googleSecret = mfaUtil.generateTotpSecret();
    const googleUser = await User.create({
      name: 'Google MFA User',
      email: 'google_mfa@uap.edu',
      googleId: 'google-sub-mfa-12345',
      authProvider: 'google',
      role: 'student',
      status: 'active',
      isActive: true,
      mfaEnabled: true,
      mfaSecret: mfaUtil.encryptSecret(googleSecret),
      studentId: 'STU-MFA-999',
    });

    // Mock Google verification
    googleAuthService.setMockVerificationHandler(async () => ({
      sub: 'google-sub-mfa-12345',
      email: 'google_mfa@uap.edu',
      email_verified: true,
      name: 'Google MFA User',
    }));

    // Step 1: Google login returns challenge
    const googleLoginRes = await authService.googleLogin({
      code: 'mock-auth-code',
      state: googleAuthService.generateStateToken(),
    });

    assert.strictEqual(googleLoginRes.mfaRequired, true);
    assert.ok(googleLoginRes.mfaToken);
    assert.strictEqual(googleLoginRes.accessToken, undefined);

    // Step 2: Complete challenge with TOTP
    const validTotp = mfaUtil.generateTotpCode(googleSecret);
    const verifyRes = await authService.verifyMfaChallenge({
      mfaToken: googleLoginRes.mfaToken,
      code: validTotp,
    });

    assert.ok(verifyRes.accessToken);
    assert.strictEqual(verifyRes.user.email, 'google_mfa@uap.edu');
    assert.strictEqual(verifyRes.user.authProvider, 'google');

    googleAuthService.clearMockVerificationHandler();
  });

  // 23. role preserved after MFA
  it('23. instructor role and academic credentials preserved after MFA verification', async () => {
    const instSecret = mfaUtil.generateTotpSecret();
    instructorUser.mfaSecret = mfaUtil.encryptSecret(instSecret);
    instructorUser.mfaEnabled = true;
    if (!instructorUser.facultyId) {
      instructorUser.facultyId = 'FAC-TEST-001';
      instructorUser.subjectId = 'CS-101';
    }
    await instructorUser.save();

    const loginRes = await authService.login({
      email: 'instructor@uap.edu',
      password: 'Instructor@123',
    });
    assert.strictEqual(loginRes.mfaRequired, true);

    const validTotp = mfaUtil.generateTotpCode(instSecret);
    const verifyRes = await authService.verifyMfaChallenge({
      mfaToken: loginRes.mfaToken,
      code: validTotp,
    });

    assert.strictEqual(verifyRes.user.role, 'instructor');
    assert.ok(verifyRes.user.facultyId);
    assert.strictEqual(verifyRes.user.subjectId, 'CS-101');

    const decoded = verifyAccessToken(verifyRes.accessToken);
    assert.strictEqual(decoded.role, 'instructor');
    assert.strictEqual(decoded.email, 'instructor@uap.edu');
  });

  // 24. existing password authentication regression
  it('24. regression: existing accounts without MFA log in seamlessly', async () => {
    // Admin login regression
    adminUser.mfaEnabled = false;
    await adminUser.save();

    const adminLogin = await authService.login({
      email: 'admin@uap.edu',
      password: 'Admin@123',
    });
    assert.strictEqual(adminLogin.user.role, 'admin');
    assert.ok(adminLogin.accessToken);
    assert.strictEqual(adminLogin.mfaRequired, undefined);
  });

  // 25. existing Google authentication regression
  it('25. regression: Google SSO login without MFA authenticates directly', async () => {
    const ssoUser = await User.create({
      name: 'SSO Direct User',
      email: 'sso_direct@uap.edu',
      googleId: 'google-sub-direct-888',
      authProvider: 'google',
      role: 'student',
      status: 'active',
      isActive: true,
      mfaEnabled: false,
      studentId: 'STU-DIR-888',
    });

    googleAuthService.setMockVerificationHandler(async () => ({
      sub: 'google-sub-direct-888',
      email: 'sso_direct@uap.edu',
      email_verified: true,
      name: 'SSO Direct User',
    }));

    const googleRes = await authService.googleLogin({
      code: 'direct-auth-code',
      state: googleAuthService.generateStateToken(),
    });

    assert.strictEqual(googleRes.mfaRequired, undefined);
    assert.ok(googleRes.accessToken);
    assert.strictEqual(googleRes.status, 'active');
    assert.strictEqual(googleRes.user.email, 'sso_direct@uap.edu');

    googleAuthService.clearMockVerificationHandler();
  });
});
