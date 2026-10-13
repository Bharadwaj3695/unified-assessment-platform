const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const emailService = require('../src/services/email.service');
const adminController = require('../src/controllers/admin.controller');
const authController = require('../src/controllers/auth.controller');
const authService = require('../src/services/auth.service');
const { User, Notification, AuditLog, MfaChallenge } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const mfaUtil = require('../src/utils/mfa');
const { generateMfaChallengeToken } = require('../src/utils/jwt');

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

describe('Bulk Reject, Mandatory Student MFA & MFA Challenge Security Suite', () => {
  let adminUser;
  let instructorUser;
  let studentUser;
  let defaultPassword;

  before(async () => {
    await connectDB();
    await seedDatabase();

    defaultPassword = await hashPassword('Password123!');
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    studentUser = await User.findOne({ email: 'student@uap.edu' });
  });

  after(async () => {
    await User.deleteMany({
      email: { $regex: /@bulk-reject-test-uap\.edu$/i },
    });
    await disconnectDB();
  });

  beforeEach(async () => {
    emailService.clearSentEmails();
  });

  // =========================================================================
  // 1. Bulk Reject Functionality
  // =========================================================================
  describe('Bulk Reject Selected Users', () => {
    it('1.1 Bulk rejects selected pending students', async () => {
      const student1 = await User.create({
        name: 'Pending Student 1',
        email: 'p_stu1@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const student2 = await User.create({
        name: 'Pending Student 2',
        email: 'p_stu2@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: {
          userIds: [student1._id.toString(), student2._id.toString()],
          reason: 'Application criteria not met',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRejectUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.rejectedCount, 2);
      assert.strictEqual(res.responseData.data.skippedCount, 0);

      // Verify users in database
      const u1 = await User.findById(student1._id);
      const u2 = await User.findById(student2._id);
      assert.strictEqual(u1.status, 'rejected');
      assert.strictEqual(u1.isActive, false);
      assert.strictEqual(u2.status, 'rejected');
      assert.strictEqual(u2.isActive, false);

      // Verify audit logs
      const logs = await AuditLog.find({
        entityId: { $in: [student1._id.toString(), student2._id.toString()] },
        action: 'USER_REJECTED',
      });
      assert.strictEqual(logs.length, 2);
      assert.strictEqual(logs[0].details.bulk, true);
      assert.strictEqual(logs[0].details.reason, 'Application criteria not met');

      // Verify emails dispatched
      const sentEmails = emailService.getSentEmails();
      assert.ok(sentEmails.some((e) => e.to === 'p_stu1@bulk-reject-test-uap.edu'));
      assert.ok(sentEmails.some((e) => e.to === 'p_stu2@bulk-reject-test-uap.edu'));
    });

    it('1.2 Bulk rejects selected pending faculty/instructors', async () => {
      const faculty1 = await User.create({
        name: 'Pending Faculty 1',
        email: 'p_fac1@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: {
          userIds: [faculty1._id.toString()],
          reason: 'Department quota reached',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRejectUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.rejectedCount, 1);

      const f1 = await User.findById(faculty1._id);
      assert.strictEqual(f1.status, 'rejected');
      assert.strictEqual(f1.isActive, false);
    });

    it('1.3 Handles mixed-role selection (students and faculty rejected together)', async () => {
      const mixedStudent = await User.create({
        name: 'Mixed Student',
        email: 'p_mix_stu@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const mixedFaculty = await User.create({
        name: 'Mixed Faculty',
        email: 'p_mix_fac@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: {
          userIds: [mixedStudent._id.toString(), mixedFaculty._id.toString()],
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRejectUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.rejectedCount, 2);
      assert.strictEqual(res.responseData.data.skippedCount, 0);
    });

    it('1.4 Skips non-pending users and reports partial failure accurately', async () => {
      const pendingUser = await User.create({
        name: 'Valid Pending User',
        email: 'p_valid@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const activeUser = await User.create({
        name: 'Already Active User',
        email: 'p_active@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'active',
        isActive: true,
      });

      const nonExistentId = '666666666666666666666666';

      const req = {
        body: {
          userIds: [pendingUser._id.toString(), activeUser._id.toString(), nonExistentId],
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRejectUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.rejectedCount, 1);
      assert.strictEqual(res.responseData.data.skippedCount, 2);
      assert.ok(res.responseData.data.rejectedUserIds.includes(pendingUser._id.toString()));
      assert.ok(res.responseData.data.skipped.some((s) => s.id === activeUser._id.toString()));
      assert.ok(res.responseData.data.skipped.some((s) => s.id === nonExistentId));
    });

    it('1.5 Denies unauthorized access by non-admin users', async () => {
      const pendingUser = await User.create({
        name: 'Pending Target',
        email: 'p_target@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: { userIds: [pendingUser._id.toString()] },
        user: studentUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      let caughtErr = null;
      await adminController.bulkRejectUsers(req, res, (err) => {
        caughtErr = err;
      });

      assert.ok(caughtErr || res.statusCode === 403);
      if (caughtErr) {
        assert.strictEqual(caughtErr.statusCode, 403);
      }
    });
  });

  // =========================================================================
  // 2. Mandatory Student MFA
  // =========================================================================
  describe('Mandatory Student MFA Enforcement', () => {
    it('2.1 Backend rejects student MFA disable attempt via authController.mfaDisable', async () => {
      const req = {
        user: { _id: studentUser._id, role: 'student' },
        body: { password: 'Student@123' },
      };
      const res = mockResponse();

      await authController.mfaDisable(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.responseData.message, /mandatory for student accounts/i);
    });

    it('2.2 Backend rejects student MFA disable attempt via authService.disableMfa', async () => {
      studentUser.mfaEnabled = true;
      await studentUser.save();

      await assert.rejects(
        async () => {
          await authService.disableMfa({
            userId: studentUser._id,
            password: 'Student@123',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /mandatory for student accounts/i);
          return true;
        }
      );
    });

    it('2.3 Instructor can disable MFA when credentials are valid', async () => {
      const secret = mfaUtil.generateTotpSecret();
      instructorUser.mfaSecret = mfaUtil.encryptSecret(secret);
      instructorUser.mfaEnabled = true;
      instructorUser.mfaRecoveryCodes = [];
      await instructorUser.save();

      const result = await authService.disableMfa({
        userId: instructorUser._id,
        password: 'Instructor@123',
      });

      assert.ok(result.message.includes('disabled successfully'));
      const updated = await User.findById(instructorUser._id);
      assert.strictEqual(updated.mfaEnabled, false);
    });

    it('2.4 Admin can disable MFA when credentials are valid', async () => {
      const secret = mfaUtil.generateTotpSecret();
      adminUser.mfaSecret = mfaUtil.encryptSecret(secret);
      adminUser.mfaEnabled = true;
      adminUser.mfaRecoveryCodes = [];
      await adminUser.save();

      const result = await authService.disableMfa({
        userId: adminUser._id,
        password: 'Admin@123',
      });

      assert.ok(result.message.includes('disabled successfully'));
      const updated = await User.findById(adminUser._id);
      assert.strictEqual(updated.mfaEnabled, false);
    });
  });

  // =========================================================================
  // 3. MFA Challenge Security & 5-Minute Expiration
  // =========================================================================
  describe('MFA Challenge Security & Expiration Enforcement', () => {
    it('3.1 Challenge is stored as SHA-256 hash and never plaintext in MongoDB', async () => {
      const challengeId = crypto.randomUUID();
      const challengeHash = mfaUtil.hashMfaChallenge(challengeId);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const challengeDoc = await MfaChallenge.create({
        challengeHash,
        userId: studentUser._id,
        expiresAt,
      });

      // Retrieve directly via raw mongoose collection to inspect document fields
      const rawDoc = await MfaChallenge.collection.findOne({ _id: challengeDoc._id });
      assert.ok(rawDoc.challengeHash, 'challengeHash must be persisted');
      assert.strictEqual(rawDoc.challengeHash, challengeHash);
      assert.strictEqual(rawDoc.challengeHash.length, 64);
      assert.strictEqual(rawDoc.challengeId, undefined, 'Raw challengeId must NOT be in MongoDB');
      assert.strictEqual(rawDoc.totpCode, undefined, 'TOTP code must NOT be in MongoDB');
      assert.strictEqual(rawDoc.code, undefined, 'code must NOT be in MongoDB');

      // Cleanup
      await MfaChallenge.deleteOne({ _id: challengeDoc._id });
    });

    it('3.2 expiresAt is set to 5 minutes after creation', async () => {
      const beforeCreation = Date.now();
      const challenge = await authService._createMfaChallenge(studentUser._id);
      const afterCreation = Date.now();

      assert.ok(challenge.expiresAt instanceof Date);
      const diffMs = challenge.expiresAt.getTime() - beforeCreation;
      // 5 minutes = 300,000 ms. Allow 2000ms delta for test execution time
      assert.ok(diffMs >= 300000 - 1000 && diffMs <= 300000 + 2000, `Expected ~300000ms but got ${diffMs}`);

      // Cleanup
      await MfaChallenge.deleteOne({ challengeHash: challenge.challengeHash });
    });

    it('3.3 Expired challenge (currentTime >= expiresAt) is rejected', async () => {
      const challengeId = crypto.randomUUID();
      const challengeHash = mfaUtil.hashMfaChallenge(challengeId);
      // Already expired 10 seconds ago
      const expiresAt = new Date(Date.now() - 10000);

      await MfaChallenge.create({
        challengeHash,
        userId: studentUser._id,
        expiresAt,
      });

      const mfaToken = generateMfaChallengeToken({
        userId: studentUser._id.toString(),
        challengeId,
      });

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /expired/i);
          return true;
        }
      );

      // Cleanup
      await MfaChallenge.deleteOne({ challengeHash });
    });

    it('3.4 Consumed / used challenge is rejected and cannot be replayed', async () => {
      const challengeId = crypto.randomUUID();
      const challengeHash = mfaUtil.hashMfaChallenge(challengeId);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await MfaChallenge.create({
        challengeHash,
        userId: studentUser._id,
        consumed: true,
        consumedAt: new Date(),
        expiresAt,
      });

      const mfaToken = generateMfaChallengeToken({
        userId: studentUser._id.toString(),
        challengeId,
      });

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /already been used/i);
          return true;
        }
      );

      // Cleanup
      await MfaChallenge.deleteOne({ challengeHash });
    });

    it('3.5 Exceeded attempt limit locks challenge from further guesses', async () => {
      const challengeId = crypto.randomUUID();
      const challengeHash = mfaUtil.hashMfaChallenge(challengeId);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await MfaChallenge.create({
        challengeHash,
        userId: studentUser._id,
        attempts: 5,
        maxAttempts: 5,
        expiresAt,
      });

      const mfaToken = generateMfaChallengeToken({
        userId: studentUser._id.toString(),
        challengeId,
      });

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /maximum mfa verification attempts exceeded/i);
          return true;
        }
      );

      // Cleanup
      await MfaChallenge.deleteOne({ challengeHash });
    });
  });

  // =========================================================================
  // 4. Bulk Revoke & Restore Functionality
  // =========================================================================
  describe('Bulk Revocation & Restore Functionality', () => {
    it('4.1 Bulk revokes selected active accounts with session invalidation', async () => {
      const activeUser1 = await User.create({
        name: 'Active Student 1',
        email: 'act_stu1@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'active',
        isActive: true,
        tokenVersion: 1,
      });

      const activeUser2 = await User.create({
        name: 'Active Instructor 1',
        email: 'act_ins1@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'active',
        isActive: true,
        tokenVersion: 0,
      });

      const req = {
        body: {
          userIds: [activeUser1._id.toString(), activeUser2._id.toString()],
          reason: 'Academic integrity breach investigation',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRevokeUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.revokedCount, 2);
      assert.strictEqual(res.responseData.data.skippedCount, 0);

      // Verify users in database
      const u1 = await User.findById(activeUser1._id);
      assert.strictEqual(u1.status, 'revoked');
      assert.strictEqual(u1.isActive, false);
      assert.strictEqual(u1.tokenVersion, 2); // Session invalidated: incremented from 1
      assert.ok(u1.revokedAt instanceof Date);
      assert.strictEqual(u1.revokedBy.toString(), adminUser._id.toString());
      assert.strictEqual(u1.rejectionReason, 'Academic integrity breach investigation');

      const u2 = await User.findById(activeUser2._id);
      assert.strictEqual(u2.status, 'revoked');
      assert.strictEqual(u2.isActive, false);
      assert.strictEqual(u2.tokenVersion, 1); // Session invalidated: incremented from 0
      assert.ok(u2.revokedAt instanceof Date);

      // Verify audit logs
      const auditLogs = await AuditLog.find({
        action: 'USER_REVOKED',
        entityId: { $in: [activeUser1._id.toString(), activeUser2._id.toString()] },
      });
      assert.strictEqual(auditLogs.length, 2);
      assert.strictEqual(auditLogs[0].details.bulk, true);

      // Verify in-app notifications
      const notifs = await Notification.find({
        userId: { $in: [activeUser1._id, activeUser2._id] },
        title: 'Account Access Revoked',
      });
      assert.strictEqual(notifs.length, 2);

      // Verify revocation email dispatch
      const sentEmails = emailService.getSentEmails();
      const revokedEmails = sentEmails.filter(
        (e) =>
          e.to === activeUser1.email || e.to === activeUser2.email
      );
      assert.strictEqual(revokedEmails.length, 2);
      assert.strictEqual(revokedEmails[0].subject, 'Account Status Notice — Unified Assessment Platform');
      assert.match(revokedEmails[0].html, /Account Access Revoked/i);
    });

    it('4.2 Skips non-active users (e.g. pending, rejected) and reports partial failure accurately', async () => {
      // Pending user
      const pendingUser = await User.create({
        name: 'Pending User For Revoke',
        email: 'pend_skip@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      // Active user
      const activeUser = await User.create({
        name: 'Active User For Revoke',
        email: 'act_valid@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'active',
        isActive: true,
      });

      const req = {
        body: {
          userIds: [pendingUser._id.toString(), activeUser._id.toString()],
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRevokeUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.revokedCount, 1);
      assert.strictEqual(res.responseData.data.skippedCount, 1);

      // Pending user should remain untouched
      const pUser = await User.findById(pendingUser._id);
      assert.strictEqual(pUser.status, 'pending');

      // Verify skip reason mentions that only active users can be revoked
      assert.strictEqual(res.responseData.data.skipped[0].id, pendingUser._id.toString());
      assert.match(res.responseData.data.skipped[0].reason, /Only active users can be revoked/i);
    });

    it('4.3 Disallows bulk revocation of self or administrator accounts', async () => {
      const otherAdmin = await User.create({
        name: 'Other Admin',
        email: 'other_admin@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'admin',
        status: 'active',
        isActive: true,
      });

      const req = {
        body: {
          userIds: [adminUser._id.toString(), otherAdmin._id.toString()],
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRevokeUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.revokedCount, 0);
      assert.strictEqual(res.responseData.data.skippedCount, 2);

      const skipReasons = res.responseData.data.skipped.map((s) => s.reason);
      assert.ok(skipReasons.some((r) => r.includes('cannot revoke your own administrator account')));
      assert.ok(skipReasons.some((r) => r.includes('Cannot revoke administrator accounts')));
    });

    it('4.4 Denies unauthorized bulk revocation by non-admin users', async () => {
      const req = {
        body: { userIds: ['some-user-id'] },
        user: studentUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkRevokeUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.responseData.message, /administrator privileges required/i);
    });

    it('4.5 Restores a revoked user back to active status', async () => {
      const revokedUser = await User.create({
        name: 'Revoked Student',
        email: 'rev_stu@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'revoked',
        isActive: false,
        revokedAt: new Date(),
        revokedBy: adminUser._id,
        rejectionReason: 'Temporary suspension',
      });

      const req = {
        params: { id: revokedUser._id.toString() },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.restoreUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.status, 'active');
      assert.strictEqual(res.responseData.data.isActive, true);

      // Verify in database
      const dbUser = await User.findById(revokedUser._id);
      assert.strictEqual(dbUser.status, 'active');
      assert.strictEqual(dbUser.isActive, true);
      assert.strictEqual(dbUser.revokedAt, null);
      assert.strictEqual(dbUser.revokedBy, null);
      assert.strictEqual(dbUser.rejectionReason, null);

      // Verify audit log
      const audit = await AuditLog.findOne({
        action: 'USER_RESTORED',
        entityId: revokedUser._id.toString(),
      });
      assert.ok(audit);

      // Verify in-app notification
      const notif = await Notification.findOne({
        userId: revokedUser._id,
        title: 'Account Access Restored',
      });
      assert.ok(notif);
    });

    it('4.6 Rejects restore request for an already active user', async () => {
      const activeUser = await User.create({
        name: 'Already Active',
        email: 'al_act@bulk-reject-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'active',
        isActive: true,
      });

      const req = {
        params: { id: activeUser._id.toString() },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.restoreUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.responseData.message, /already active/i);
    });
  });
});

