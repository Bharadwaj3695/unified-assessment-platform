const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const googleFormsService = require('../src/services/googleForms.service');
const googleAuthService = require('../src/services/googleAuth.service');
const authService = require('../src/services/auth.service');
const { User, Session, AuditLog } = require('../src/models');

describe('Google Authentication, Token Flow & Google Forms Security Suite', () => {
  before(async () => {
    await connectDB();
    await seedDatabase();
  });

  after(async () => {
    await disconnectDB();
  });

  // 1. Google Forms API Token Guarding & Error Prevention
  it('1.1 fetchForm should reject with HTTP 401 when OAuth 2 access token is missing', async () => {
    const url = 'https://docs.google.com/forms/d/1FAIpQLSc7zabcdef1234567890/edit';
    await assert.rejects(
      async () => {
        await googleFormsService.fetchForm(url, {});
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert(err.message.includes('Google Forms import requires a valid Google OAuth 2 access token'));
        assert(err.message.includes('forms.body.readonly'));
        return true;
      }
    );
  });

  it('1.2 fetchForm should reject malformed Form URL or Form ID with HTTP 400', async () => {
    await assert.rejects(
      async () => {
        await googleFormsService.fetchForm('invalid', { accessToken: 'mock_token' });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert(err.message.includes('Invalid Google Forms URL or Form ID'));
        return true;
      }
    );
  });

  it('1.3 fetchForm should support pre-parsed structured formData objects without outbound requests', async () => {
    const mockPayload = {
      info: { title: 'Pre-parsed Exam' },
      items: [
        {
          title: 'Sample Question',
          questionItem: {
            question: {
              questionId: 'q1',
              choiceQuestion: {
                type: 'RADIO',
                options: [{ value: 'A' }, { value: 'B' }],
              },
            },
          },
        },
      ],
    };

    const result = await googleFormsService.fetchForm(mockPayload);
    assert.deepStrictEqual(result, mockPayload);
    const questions = await googleFormsService.parseGoogleFormResponse(result);
    assert.strictEqual(questions.length, 1);
    assert.strictEqual(questions[0].type, 'mcq');
  });

  // 2. Google SSO Credential Flow, ID Token Disambiguation & RBAC Preservation
  it('2.1 verifyGoogleIdentity rejects requests without code or idToken with HTTP 400', async () => {
      await assert.rejects(
        async () => {
          await googleAuthService.verifyGoogleIdentity({});
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert(err.message.includes('Either Google authorization code or ID token is required'));
          return true;
        }
      );
    });

    it('2.2 googleLogin preserves pending account approval gate (HTTP 403 Forbidden)', async () => {
      // Create a pending applicant user
      const pendingEmail = 'pending_applicant_security_check@uap.edu';
      await User.deleteOne({ email: pendingEmail });
      await User.create({
        name: 'Pending Applicant',
        email: pendingEmail,
        googleId: 'google_sub_999888777',
        role: 'student',
        status: 'pending',
        isActive: false,
        authProvider: 'google',
        studentId: 'STU-SEC-001',
      });

      // Mock googleAuthService to return identity for this user
      googleAuthService.setMockVerificationHandler(async () => ({
        sub: 'google_sub_999888777',
        email: pendingEmail,
        email_verified: true,
        name: 'Pending Applicant',
        picture: null,
      }));

      try {
        await assert.rejects(
          async () => {
            await authService.googleLogin({ code: 'valid_mock_code' });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 403);
            assert.strictEqual(err.message, 'Your account is pending administrator approval.');
            return true;
          }
        );
      } finally {
        googleAuthService.clearMockVerificationHandler();
        await User.deleteOne({ email: pendingEmail });
      }
    });

    it('2.3 googleLogin links active user without resetting existing role or issuing revoked tokens', async () => {
      const activeAdmin = await User.findOne({ email: 'admin@uap.edu' });
      assert(activeAdmin, 'Admin user should exist in database');

      // Mock googleAuthService to return identity matching admin email
      googleAuthService.setMockVerificationHandler(async () => ({
        sub: 'google_admin_sub_123456',
        email: 'admin@uap.edu',
        email_verified: true,
        name: activeAdmin.name,
        picture: null,
      }));

      try {
        const result = await authService.googleLogin({ code: 'valid_mock_admin_code' });
        assert.strictEqual(result.status, 'active');
        assert.strictEqual(result.user.role, 'admin');
        assert(result.accessToken, 'Access token must be issued for active admin');
        assert(result.refreshToken, 'Refresh token must be issued for active admin');

        // Confirm database preserved role
        const updatedAdmin = await User.findOne({ email: 'admin@uap.edu' });
        assert.strictEqual(updatedAdmin.role, 'admin');
        assert.strictEqual(updatedAdmin.status, 'active');
      } finally {
        googleAuthService.clearMockVerificationHandler();
      }
    });
});
