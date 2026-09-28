const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog } = require('../src/models');
const authService = require('../src/services/auth.service');
const googleAuthService = require('../src/services/googleAuth.service');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
} = require('../src/utils/jwt');
const mfaUtil = require('../src/utils/mfa');
const { authenticate } = require('../src/middleware/auth.middleware');
const { authorize } = require('../src/middleware/role.middleware');
const authController = require('../src/controllers/auth.controller');
const env = require('../src/config/env');

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

describe('Phase 9A: Authentication Token Lifecycle Hardening & Security Audit', () => {
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

  // =========================================================================
  // 1. REFRESH TOKEN LIFECYCLE & VALIDATION
  // =========================================================================
  describe('1. Refresh Token Endpoint & Validation Matrix', () => {
    it('1.1 Valid refresh token -> issues new short-lived access token and rotated refresh token', async () => {
      studentUser.status = 'active';
      studentUser.isActive = true;
      studentUser.tokenVersion = 0;
      await studentUser.save();

      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      assert.ok(loginRes.refreshToken, 'Login must yield refresh token');
      const oldRefreshToken = loginRes.refreshToken;

      const refreshRes = await authService.refreshAccessToken({
        refreshToken: oldRefreshToken,
        ipAddress: '127.0.0.1',
      });

      assert.ok(refreshRes.accessToken, 'Must issue new access token');
      assert.ok(refreshRes.refreshToken, 'Must issue rotated refresh token');
      assert.strictEqual(refreshRes.user.email, 'student@uap.edu');
      assert.strictEqual(refreshRes.user.role, 'student');

      // Verify access token type claim
      const decodedAccess = verifyAccessToken(refreshRes.accessToken);
      assert.strictEqual(decodedAccess.type, 'access');
      assert.strictEqual(decodedAccess.id, studentUser._id.toString());

      // Verify refresh token type claim
      const decodedRefresh = verifyRefreshToken(refreshRes.refreshToken);
      assert.strictEqual(decodedRefresh.type, 'refresh');
      assert.strictEqual(decodedRefresh.id, studentUser._id.toString());
    });

    it('1.2 Controller /api/auth/refresh accepts token from body and authorization header', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      // Via body.refreshToken
      const reqBody = {
        body: { refreshToken: loginRes.refreshToken },
        headers: {},
        ip: '127.0.0.1',
      };
      const resBody = mockResponse();
      let nextCalledBody = false;
      await authController.refresh(reqBody, resBody, (err) => {
        if (err) nextCalledBody = true;
      });

      assert.strictEqual(nextCalledBody, false);
      assert.strictEqual(resBody.statusCode, 200);
      assert.ok(resBody.responseData.data.accessToken);

      // Via Authorization Bearer header
      const reqHeader = {
        body: {},
        headers: { authorization: `Bearer ${loginRes.refreshToken}` },
        ip: '127.0.0.1',
      };
      const resHeader = mockResponse();
      let nextCalledHeader = false;
      await authController.refresh(reqHeader, resHeader, (err) => {
        if (err) nextCalledHeader = true;
      });

      assert.strictEqual(nextCalledHeader, false);
      assert.strictEqual(resHeader.statusCode, 200);
      assert.ok(resHeader.responseData.data.accessToken);
    });

    it('1.3 Expired refresh token -> rejected with HTTP 401', async () => {
      const expiredRefreshToken = jwt.sign(
        {
          id: studentUser._id.toString(),
          role: studentUser.role,
          email: studentUser.email,
          tokenVersion: studentUser.tokenVersion,
          type: 'refresh',
        },
        env.JWT_REFRESH_SECRET,
        { expiresIn: '-10s' }
      );

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: expiredRefreshToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.toLowerCase().includes('expired'));
          return true;
        }
      );
    });

    it('1.4 Malformed token -> rejected with HTTP 401', async () => {
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: 'not.a.valid.jwt.payload' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Invalid refresh token'));
          return true;
        }
      );
    });

    it('1.5 Invalid signature -> rejected with HTTP 401', async () => {
      const tamperedSecretToken = jwt.sign(
        {
          id: studentUser._id.toString(),
          role: 'student',
          email: studentUser.email,
          tokenVersion: 0,
          type: 'refresh',
        },
        'untrusted_attacker_secret_key_1234567890'
      );

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: tamperedSecretToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Invalid refresh token'));
          return true;
        }
      );
    });

    it('1.6 Access token submitted to refresh endpoint -> rejected with HTTP 401', async () => {
      const validAccessToken = generateAccessToken({
        id: studentUser._id.toString(),
        role: studentUser.role,
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: validAccessToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Access token cannot be used as a refresh token'));
          return true;
        }
      );
    });

    it('1.7 MFA challenge submitted to refresh endpoint -> rejected with HTTP 401', async () => {
      const challenge = await authService._createMfaChallenge(studentUser._id);
      const mfaChallengeToken = challenge.mfaToken;

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: mfaChallengeToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(
            err.message.includes('MFA challenge token cannot be used') ||
            err.message.includes('Invalid')
          );
          return true;
        }
      );
    });

    it('1.8 Revoked user -> refresh rejected with HTTP 401', async () => {
      const user = await User.create({
        name: 'Revoked User',
        email: 'revoked_refresh@uap.edu',
        password: 'Password@123',
        role: 'student',
        status: 'revoked',
        isActive: false,
        tokenVersion: 0,
      });

      const token = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 0,
      });

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: token });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('revoked'));
          return true;
        }
      );
    });

    it('1.9 Rejected user -> refresh rejected with HTTP 401', async () => {
      const user = await User.create({
        name: 'Rejected User',
        email: 'rejected_refresh@uap.edu',
        password: 'Password@123',
        role: 'student',
        status: 'rejected',
        isActive: false,
        tokenVersion: 0,
      });

      const token = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 0,
      });

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: token });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('rejected'));
          return true;
        }
      );
    });

    it('1.10 Inactive user -> refresh rejected with HTTP 401', async () => {
      const user = await User.create({
        name: 'Inactive User',
        email: 'inactive_refresh@uap.edu',
        password: 'Password@123',
        role: 'student',
        status: 'pending',
        isActive: false,
        tokenVersion: 0,
      });

      const token = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 0,
      });

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: token });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Access denied'));
          return true;
        }
      );
    });

    it('1.11 tokenVersion mismatch -> refresh rejected with HTTP 401', async () => {
      const user = await User.create({
        name: 'Token Version User',
        email: 'token_version_user@uap.edu',
        password: 'Password@123',
        role: 'student',
        status: 'active',
        isActive: true,
        tokenVersion: 5,
      });

      // Refresh token issued with old tokenVersion = 4
      const oldRefreshToken = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 4,
      });

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: oldRefreshToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Session has expired or been invalidated'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 2. ACCESS TOKEN LIFETIME & BEHAVIOR
  // =========================================================================
  describe('2. Access Token Lifetime & Behavior', () => {
    it('2.1 New access token has short expiration configured (15m to 1h)', async () => {
      const token = generateAccessToken({
        id: studentUser._id.toString(),
        role: studentUser.role,
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      const decoded = jwt.decode(token);
      assert.ok(decoded.exp > decoded.iat, 'Token must have valid expiration');
      const lifetimeSeconds = decoded.exp - decoded.iat;

      // 15m = 900s, max 1h = 3600s
      assert.ok(
        lifetimeSeconds <= 3600,
        `Access token lifetime (${lifetimeSeconds}s) must not exceed 1 hour`
      );
      assert.ok(
        lifetimeSeconds >= 60,
        `Access token lifetime (${lifetimeSeconds}s) must be at least 1 minute`
      );
      // In default config, 15m is exactly 900 seconds
      assert.strictEqual(lifetimeSeconds, 900, 'Default lifetime must be 15 minutes (900s)');
    });

    it('2.2 Access token works normally before expiration against protected route', async () => {
      const token = generateAccessToken({
        id: studentUser._id.toString(),
        role: studentUser.role,
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true, 'Valid access token must pass authenticate middleware');
      assert.strictEqual(req.user.email, studentUser.email);
    });

    it('2.3 Expired access token is rejected by auth middleware with 401', async () => {
      const expiredToken = jwt.sign(
        {
          id: studentUser._id.toString(),
          role: studentUser.role,
          email: studentUser.email,
          tokenVersion: studentUser.tokenVersion,
          type: 'access',
        },
        env.JWT_SECRET,
        { expiresIn: '-5s' }
      );

      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.responseData.message, 'Token has expired');
    });

    it('2.4 Refresh restores authenticated access after access token expires', async () => {
      // 1. Initial login gives access + refresh tokens
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      // 2. Simulate access token expiration by crafting expired access token
      const expiredAccessToken = jwt.sign(
        {
          id: studentUser._id.toString(),
          role: studentUser.role,
          email: studentUser.email,
          tokenVersion: studentUser.tokenVersion,
          type: 'access',
        },
        env.JWT_SECRET,
        { expiresIn: '-5s' }
      );

      // Access with expired token fails
      const reqExpired = { headers: { authorization: `Bearer ${expiredAccessToken}` } };
      const resExpired = mockResponse();
      let nextExpired = false;
      await authenticate(reqExpired, resExpired, () => {
        nextExpired = true;
      });
      assert.strictEqual(nextExpired, false);
      assert.strictEqual(resExpired.statusCode, 401);

      // 3. Client exchanges refresh token
      const refreshResult = await authService.refreshAccessToken({
        refreshToken: loginRes.refreshToken,
      });

      // 4. Client accesses protected route with new access token
      const reqRestored = { headers: { authorization: `Bearer ${refreshResult.accessToken}` } };
      const resRestored = mockResponse();
      let nextRestored = false;
      await authenticate(reqRestored, resRestored, () => {
        nextRestored = true;
      });
      assert.strictEqual(nextRestored, true, 'New access token must successfully authenticate user');
    });
  });

  // =========================================================================
  // 3. DEDICATED MFA CHALLENGE SECRET & SEPARATION
  // =========================================================================
  describe('3. Dedicated MFA Challenge Secret & Token Separation', () => {
    it('3.1 MFA challenge token is signed with MFA_CHALLENGE_SECRET, NOT JWT_SECRET', async () => {
      const challenge = await authService._createMfaChallenge(studentUser._id);
      const token = challenge.mfaToken;

      // Verifying with MFA_CHALLENGE_SECRET must succeed
      const decodedMfa = jwt.verify(token, env.MFA_CHALLENGE_SECRET);
      assert.strictEqual(decodedMfa.sub, studentUser._id.toString());
      assert.strictEqual(decodedMfa.type, 'mfa_challenge');

      // Verifying with JWT_SECRET must FAIL
      assert.throws(
        () => jwt.verify(token, env.JWT_SECRET),
        (err) => {
          assert.strictEqual(err.name, 'JsonWebTokenError');
          assert.strictEqual(err.message, 'invalid signature');
          return true;
        }
      );
    });

    it('3.2 MFA challenge token cannot access protected routes via auth middleware', async () => {
      const challenge = await authService._createMfaChallenge(studentUser._id);
      const req = { headers: { authorization: `Bearer ${challenge.mfaToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('MFA challenge token cannot be used to access protected APIs'));
    });

    it('3.3 MFA challenge token cannot be exchanged at refresh endpoint', async () => {
      const challenge = await authService._createMfaChallenge(studentUser._id);
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: challenge.mfaToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );
    });

    it('3.4 Refresh token cannot access protected APIs as an access token', async () => {
      const refreshToken = generateRefreshToken({
        id: studentUser._id.toString(),
        role: studentUser.role,
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      const req = { headers: { authorization: `Bearer ${refreshToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('Refresh token cannot be used to access protected APIs'));
    });

    it('3.5 Access token cannot be used to verify MFA challenge', async () => {
      const accessToken = generateAccessToken({
        id: studentUser._id.toString(),
        role: studentUser.role,
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken: accessToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. SESSION INVALIDATION & TOKEN VERSION CONTROLS
  // =========================================================================
  describe('4. Session Invalidation & tokenVersion Interaction', () => {
    it('4.1 Password change increments tokenVersion and invalidates outstanding refresh tokens', async () => {
      const user = await User.create({
        name: 'Pass Change User',
        email: 'pass_change_uap@uap.edu',
        password: await require('../src/utils/password').hashPassword('OldPassword@123'),
        role: 'student',
        status: 'active',
        isActive: true,
        tokenVersion: 0,
      });

      const refreshToken = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 0,
      });

      // User changes password
      await authService.changePassword(user._id, 'OldPassword@123', 'NewPassword@123');

      // Refresh token issued before password change MUST be rejected
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Session has expired or been invalidated'));
          return true;
        }
      );
    });

    it('4.2 MFA enrollment confirmation invalidates prior refresh tokens via tokenVersion', async () => {
      const user = await User.create({
        name: 'MFA Enable User',
        email: 'mfa_enable_uap@uap.edu',
        password: await require('../src/utils/password').hashPassword('Password@123'),
        role: 'student',
        status: 'active',
        isActive: true,
        tokenVersion: 0,
      });

      const preMfaRefreshToken = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 0,
      });

      // Initiate and confirm MFA
      const setup = await authService.initiateMfaSetup(user._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      await authService.confirmMfaSetup(user._id, code);

      // Pre-MFA refresh token must be rejected
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: preMfaRefreshToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Session has expired or been invalidated'));
          return true;
        }
      );
    });

    it('4.3 MFA disablement invalidates existing refresh tokens via tokenVersion', async () => {
      const secret = mfaUtil.generateTotpSecret();
      const user = await User.create({
        name: 'MFA Disable User',
        email: 'mfa_disable_uap@uap.edu',
        password: await require('../src/utils/password').hashPassword('Password@123'),
        role: 'student',
        status: 'active',
        isActive: true,
        mfaEnabled: true,
        mfaSecret: mfaUtil.encryptSecret(secret),
        tokenVersion: 2,
      });

      const activeRefreshToken = generateRefreshToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: 2,
      });

      const totpCode = mfaUtil.generateTotpCode(secret);
      await authService.disableMfa({
        userId: user._id,
        password: 'Password@123',
        code: totpCode,
      });

      // Prior refresh token must be rejected
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: activeRefreshToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Session has expired or been invalidated'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. REGRESSION & RBAC VERIFICATION
  // =========================================================================
  describe('5. Regression Suite: Login, Google SSO, RBAC & Roles', () => {
    it('5.1 Standard password login issues access token and refresh token', async () => {
      const res = await authService.login({
        email: 'instructor@uap.edu',
        password: 'Instructor@123',
      });

      assert.ok(res.accessToken);
      assert.ok(res.refreshToken);
      assert.strictEqual(res.user.role, 'instructor');
      assert.strictEqual(res.user.email, 'instructor@uap.edu');
    });

    it('5.2 Google SSO login issues access token and refresh token', async () => {
      googleAuthService.setMockVerificationHandler(async () => ({
        sub: 'google-sub-lifecycle-audit-9a',
        email: 'student@uap.edu',
        email_verified: true,
        name: 'Student User',
      }));

      const res = await authService.googleLogin({
        code: 'valid-google-code',
        state: googleAuthService.generateStateToken(),
      });

      assert.ok(res.accessToken);
      assert.ok(res.refreshToken);
      assert.strictEqual(res.user.email, 'student@uap.edu');

      googleAuthService.clearMockVerificationHandler();
    });

    it('5.3 MFA enabled password login requires MFA challenge verification before tokens', async () => {
      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaEnabled = true;
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      await studentUser.save();

      // Step 1: Login gives challenge
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      assert.strictEqual(loginRes.mfaRequired, true);
      assert.ok(loginRes.mfaToken);
      assert.strictEqual(loginRes.accessToken, undefined);

      // Step 2: Verification completes and gives tokens
      const totp = mfaUtil.generateTotpCode(secret);
      const verifyRes = await authService.verifyMfaChallenge({
        mfaToken: loginRes.mfaToken,
        code: totp,
      });

      assert.ok(verifyRes.accessToken);
      assert.ok(verifyRes.refreshToken);

      // Clean up
      studentUser.mfaEnabled = false;
      studentUser.mfaSecret = null;
      await studentUser.save();
    });

    it('5.4 Role-based access control enforces student, instructor, and admin boundaries', async () => {
      const studentToken = generateAccessToken({
        id: studentUser._id.toString(),
        role: 'student',
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      const instructorToken = generateAccessToken({
        id: instructorUser._id.toString(),
        role: 'instructor',
        email: instructorUser.email,
        tokenVersion: instructorUser.tokenVersion,
      });

      const adminToken = generateAccessToken({
        id: adminUser._id.toString(),
        role: 'admin',
        email: adminUser.email,
        tokenVersion: adminUser.tokenVersion,
      });

      // Student accessing instructor endpoint -> 403
      const reqStudent = { headers: { authorization: `Bearer ${studentToken}` } };
      const resStudent = mockResponse();
      let nextStudent = false;
      await authenticate(reqStudent, resStudent, () => {
        const instAuth = authorize('instructor');
        instAuth(reqStudent, resStudent, () => {
          nextStudent = true;
        });
      });
      assert.strictEqual(nextStudent, false);
      assert.strictEqual(resStudent.statusCode, 403);

      // Instructor accessing admin endpoint -> 403
      const reqInst = { headers: { authorization: `Bearer ${instructorToken}` } };
      const resInst = mockResponse();
      let nextInst = false;
      await authenticate(reqInst, resInst, () => {
        const adminAuth = authorize('admin');
        adminAuth(reqInst, resInst, () => {
          nextInst = true;
        });
      });
      assert.strictEqual(nextInst, false);
      assert.strictEqual(resInst.statusCode, 403);

      // Admin accessing admin endpoint -> 200 / next() called
      const reqAdmin = { headers: { authorization: `Bearer ${adminToken}` } };
      const resAdmin = mockResponse();
      let nextAdmin = false;
      await authenticate(reqAdmin, resAdmin, () => {
        const adminAuth = authorize('admin');
        adminAuth(reqAdmin, resAdmin, () => {
          nextAdmin = true;
        });
      });
      assert.strictEqual(nextAdmin, true);
    });
  });
});
