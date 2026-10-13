const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const emailService = require('../src/services/email.service');
const adminController = require('../src/controllers/admin.controller');
const authService = require('../src/services/auth.service');
const { User, Notification, AuditLog } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

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

describe('Phase 9C Verification: Admin Approval Email & SMTP Delivery Verification', () => {
  let adminUser;
  let defaultPassword;

  before(async () => {
    await connectDB();
    await seedDatabase();

    defaultPassword = await hashPassword('Password123!');
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
  });

  after(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'test_applicant_9c_1@uap.edu',
          'test_applicant_9c_2@uap.edu',
          'test_applicant_9c_3@uap.edu',
        ],
      },
    });
    await disconnectDB();
  });

  it('1. Admin approves pending applicant: transitions to active and records audit log', async () => {
    const applicant = await User.create({
      name: 'Eleanor Vance',
      email: 'test_applicant_9c_1@uap.edu',
      password: defaultPassword,
      role: 'student',
      status: 'pending',
      isActive: false,
      instituteCode: 'TEST-9C',
    });

    const req = {
      params: { id: applicant._id.toString() },
      body: { role: 'student' },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.approveUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);

    const updatedUser = await User.findById(applicant._id);
    assert.strictEqual(updatedUser.status, 'active');
    assert.strictEqual(updatedUser.isActive, true);
    assert.ok(updatedUser.approvedAt);
    assert.strictEqual(updatedUser.approvedBy.toString(), adminUser._id.toString());

    // Verify audit log
    const auditLog = await AuditLog.findOne({
      entityId: applicant._id.toString(),
      action: 'USER_APPROVED',
    });
    assert.ok(auditLog, 'USER_APPROVED audit log should exist');

    // Verify in-app notification
    const notification = await Notification.findOne({
      userId: applicant._id,
      title: 'Account Approved',
    });
    assert.ok(notification, 'In-app notification must be created');
    assert.strictEqual(notification.link, '/auth/login');
    assert.strictEqual(notification.type, 'system');
    assert.match(notification.message, /approved with role "student"/i);

    // Verify approval email dispatch
    const sentEmails = emailService.getSentEmails();
    assert.ok(sentEmails.length >= 1, 'At least 1 email should have been dispatched');

    const approvalEmail = sentEmails.find((e) => e.to === 'test_applicant_9c_1@uap.edu');
    assert.ok(approvalEmail, 'Approval email must be addressed to applicant');
    assert.match(approvalEmail.subject, /Your UAP Account Has Been Approved/i);
    assert.match(approvalEmail.html, /Congratulations/i);
    assert.match(approvalEmail.html, /Eleanor Vance/i);
    assert.match(approvalEmail.html, /\/auth\/login/i);

    // Verify safe content
    const fullContent = (approvalEmail.text + ' ' + approvalEmail.html).toLowerCase();
    assert.ok(fullContent.includes('eleanor vance'));
    assert.ok(fullContent.includes('approved'));
    assert.ok(fullContent.includes('/auth/login'));

    // Strict absence of sensitive credentials
    assert.strictEqual(fullContent.includes('password123'), false);
    assert.strictEqual(fullContent.includes('secret'), false);
    assert.strictEqual(fullContent.includes('jwt'), false);
    assert.strictEqual(fullContent.includes('refresh_token'), false);
    assert.strictEqual(fullContent.includes('bearer'), false);
    assert.strictEqual(fullContent.includes('otp'), false);
    assert.strictEqual(fullContent.includes('recovery'), false);
  });

  it('5. Email delivery failure does not roll back account approval or in-app notification', async () => {
    const applicant2 = await User.create({
      name: 'Robustness Test Candidate',
      email: 'test_applicant_9c_2@uap.edu',
      password: defaultPassword,
      role: 'student',
      status: 'pending',
      isActive: false,
    });

    // Temporarily mock emailService.sendAccountApprovedEmail to reject / throw an error
    const originalSend = emailService.sendAccountApprovedEmail;
    emailService.sendAccountApprovedEmail = async () => {
      throw new Error('Simulated SMTP Socket Connection Timeout (ETIMEDOUT)');
    };

    try {
      const req = {
        params: { id: applicant2._id.toString() },
        body: { role: 'student' },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.approveUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      // Account must still transition to active
      const user = await User.findById(applicant2._id);
      assert.strictEqual(user.status, 'active');
      assert.strictEqual(user.isActive, true);

      // In-app notification must still be preserved
      const notif = await Notification.findOne({
        userId: applicant2._id,
        title: 'Account Approved',
      });
      assert.ok(notif, 'In-app notification must still exist even if email failed');
    } finally {
      emailService.sendAccountApprovedEmail = originalSend;
    }
  });

  it('6. Controlled test email method (sendTestEmail) dispatches correctly', async () => {
    const result = await emailService.sendTestEmail('dev_test@uap.edu');
    assert.strictEqual(result.success, true);
    assert.ok(result.messageId);

    const lastEmail = emailService.getLastEmail();
    assert.strictEqual(lastEmail.to, 'dev_test@uap.edu');
    assert.strictEqual(lastEmail.subject, 'UAP Test Email');
    assert.match(lastEmail.text, /UAP SMTP delivery test/i);
  });

  it('7. Missing SMTP configuration uses safe in-memory fallback without throwing', async () => {
    // When SMTP is not configured in test or development, verifyConnection returns verified fallback
    const status = await emailService.verifyConnection();
    assert.strictEqual(status.verified, true);
  });

  it('8. Approved user can authenticate successfully via password login', async () => {
    const loginResult = await authService.login({
      email: 'test_applicant_9c_1@uap.edu',
      password: 'Password123!',
    });

    assert.ok(loginResult.accessToken);
    assert.strictEqual(loginResult.user.status, 'active');
    assert.strictEqual(loginResult.user.role, 'student');
  });
});
