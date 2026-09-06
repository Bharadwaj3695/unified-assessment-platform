const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const emailService = require('../src/services/email.service');
const notificationService = require('../src/services/notification.service');
const authService = require('../src/services/auth.service');
const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');
const evaluationService = require('../src/services/evaluation.service');
const notificationController = require('../src/controllers/notification.controller');
const adminController = require('../src/controllers/admin.controller');
const { User, Assessment, Question, Submission, Notification } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Phase G Verification: Transactional Notifications & Nodemailer SMTP Service', () => {
  let adminUser;
  let instructorUser;
  let studentUser;
  let testAssessment;
  let mcqQuestion;
  let shortAnswerQuestion;

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

  before(async () => {
    await connectDB();
    await seedDatabase();

    // Ensure clean state for test accounts
    await User.deleteMany({
      email: {
        $in: [
          'applicant.g@uap.edu',
          'rejected.g@uap.edu',
          'revoked.g@uap.edu',
          'student.g@uap.edu',
          'instructor.g@uap.edu',
        ],
      },
    });

    const pass = await hashPassword('Password123');

    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    instructorUser = await User.create({
      name: 'Prof. Grace Hopper',
      email: 'instructor.g@uap.edu',
      password: pass,
      role: 'instructor',
      status: 'active',
      isActive: true,
    });

    studentUser = await User.create({
      name: 'Linus Torvalds',
      email: 'student.g@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    // Create a published assessment with 1 MCQ (10 pts) and 1 Short Answer (20 pts)
    testAssessment = await Assessment.create({
      title: 'Compiler Design & ASTs',
      category: 'Computer Science',
      instructorId: instructorUser._id,
      durationMinutes: 45,
      totalPoints: 30,
      passingScore: 60,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [studentUser._id],
    });

    mcqQuestion = await Question.create({
      assessmentId: testAssessment._id,
      questionText: 'Which phase produces an Abstract Syntax Tree (AST)?',
      type: 'mcq',
      options: [
        { id: '1', text: 'Semantic Analysis' },
        { id: '2', text: 'Syntax Analysis (Parsing)' },
        { id: '3', text: 'Lexical Analysis' },
      ],
      correctAnswer: '2',
      points: 10,
    });

    shortAnswerQuestion = await Question.create({
      assessmentId: testAssessment._id,
      questionText: 'Explain the difference between LL and LR parsers.',
      type: 'short_answer',
      points: 20,
    });
  });

  after(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'applicant.g@uap.edu',
          'rejected.g@uap.edu',
          'revoked.g@uap.edu',
          'student.g@uap.edu',
          'instructor.g@uap.edu',
        ],
      },
    });
    if (testAssessment) {
      await Question.deleteMany({ assessmentId: testAssessment._id });
      await Submission.deleteMany({ assessmentId: testAssessment._id });
      await Assessment.deleteOne({ _id: testAssessment._id });
    }
    await disconnectDB();
  });

  beforeEach(() => {
    emailService.clearSentEmails();
  });

  it('1. SMTP connection check in test mode returns verified with test_fallback', async () => {
    const status = await emailService.verifyConnection();
    assert.strictEqual(status.verified, true);
    assert.strictEqual(status.mode, 'test_fallback');
  });

  it('2. Registration triggers pending applicant email and admin in-app notification', async () => {
    await User.deleteOne({ email: 'applicant.g@uap.edu' });

    const regResult = await authService.register({
      name: 'Applicant Grace',
      email: 'applicant.g@uap.edu',
      password: 'Password123',
      role: 'student',
      instituteCode: 'INST-2025',
    });

    assert.strictEqual(regResult.status, 'pending');

    const sentEmails = emailService.getSentEmails();
    assert.ok(sentEmails.length >= 2, 'Should send applicant acknowledgement and admin alert emails');

    const applicantEmail = sentEmails.find((e) => e.to === 'applicant.g@uap.edu');
    assert.ok(applicantEmail, 'Applicant should receive pending registration email');
    assert.match(applicantEmail.subject, /Application Received/i);
    assert.match(applicantEmail.html, /Pending Review/i);

    const adminEmail = sentEmails.find((e) => e.subject.includes('New Applicant Pending Review'));
    assert.ok(adminEmail, 'Admins should receive email alert');

    // Admin should also receive an in-app notification
    const adminNotifs = await Notification.find({ userId: adminUser._id }).sort({ createdAt: -1 });
    const matchNotif = adminNotifs.find((n) => n.title === 'New Applicant Pending');
    assert.ok(matchNotif, 'Admin should have received an in-app notification');
    assert.strictEqual(matchNotif.type, 'system');
  });

  it('3. Admin approve sends approval email and in-app notification to user', async () => {
    const applicant = await User.findOne({ email: 'applicant.g@uap.edu' });
    assert.ok(applicant);

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

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail);
    assert.strictEqual(lastEmail.to, 'applicant.g@uap.edu');
    assert.match(lastEmail.subject, /Account Approved/i);
    assert.match(lastEmail.html, /Welcome/i);

    // In-app notification for approved user
    const userNotif = await Notification.findOne({
      userId: applicant._id,
      title: 'Account Approved',
    });
    assert.ok(userNotif, 'User should receive Account Approved in-app notification');
    assert.strictEqual(userNotif.read, false);
  });

  it('4. Admin reject sends rejection email with custom reason and in-app notification', async () => {
    const pass = await hashPassword('Password123');
    await User.deleteOne({ email: 'rejected.g@uap.edu' });

    const rejectedUser = await User.create({
      name: 'Rejected Student',
      email: 'rejected.g@uap.edu',
      password: pass,
      role: 'student',
      status: 'pending',
      isActive: false,
    });

    const rejectionReason = 'Incomplete accreditation credentials provided';
    const req = {
      params: { id: rejectedUser._id.toString() },
      body: { reason: rejectionReason },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.rejectUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail);
    assert.strictEqual(lastEmail.to, 'rejected.g@uap.edu');
    assert.match(lastEmail.subject, /Account Application Status/i);
    assert.match(lastEmail.html, new RegExp(rejectionReason));

    const rejectedNotif = await Notification.findOne({
      userId: rejectedUser._id,
      title: 'Account Application Rejected',
    });
    assert.ok(rejectedNotif);
    assert.match(rejectedNotif.message, new RegExp(rejectionReason));
  });

  it('5. Admin revoke sends revocation notice email and in-app notification', async () => {
    const pass = await hashPassword('Password123');
    await User.deleteOne({ email: 'revoked.g@uap.edu' });

    const revokedUser = await User.create({
      name: 'Revoked User',
      email: 'revoked.g@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    const revokeReason = 'Academic integrity policy violation';
    const req = {
      params: { id: revokedUser._id.toString() },
      body: { reason: revokeReason },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.revokeUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);

    const lastEmail = emailService.getLastEmail();
    assert.ok(lastEmail);
    assert.strictEqual(lastEmail.to, 'revoked.g@uap.edu');
    assert.match(lastEmail.subject, /Account Status Notice/i);
    assert.match(lastEmail.html, new RegExp(revokeReason));
  });

  it('6. Publishing restricted assessment notifies assigned students via email & in-app', async () => {
    // Create a draft assessment and assign studentUser
    const newAssessment = await Assessment.create({
      title: 'Operating Systems & Concurrency',
      category: 'Computer Science',
      instructorId: instructorUser._id,
      durationMinutes: 60,
      totalPoints: 50,
      passingScore: 60,
      status: 'draft',
      accessType: 'restricted',
      assignedStudents: [studentUser._id],
    });

    await assessmentService.updateAssessment(
      newAssessment._id,
      instructorUser._id,
      { status: 'published' }
    );

    const sentEmails = emailService.getSentEmails();
    const publishedEmail = sentEmails.find((e) => e.to === studentUser.email);
    assert.ok(publishedEmail, 'Assigned student should receive published assessment email');
    assert.match(publishedEmail.subject, /New Assessment Available: Operating Systems & Concurrency/i);

    const studentNotif = await Notification.findOne({
      userId: studentUser._id,
      title: 'New Assessment Assigned',
    });
    assert.ok(studentNotif, 'Assigned student should receive in-app notification');

    // Clean up
    await Assessment.deleteOne({ _id: newAssessment._id });
  });

  it('7. Student submission triggers email & in-app notification to instructor', async () => {
    // Start attempt: startAttempt(studentId, assessmentId)
    const attempt = await submissionService.startAttempt(studentUser._id, testAssessment._id);
    assert.ok(attempt);

    // Answer MCQ correctly
    await submissionService.autosaveAnswer(attempt._id, studentUser._id, mcqQuestion._id, '2');
    // Answer Short Answer
    await submissionService.autosaveAnswer(
      attempt._id,
      studentUser._id,
      shortAnswerQuestion._id,
      'LL is top-down left-to-right, LR is bottom-up left-to-right.'
    );

    // Submit
    const submitted = await submissionService.submitAssessment(attempt._id, studentUser._id);
    assert.strictEqual(submitted.status, 'submitted');

    // Verify email sent to instructor
    const sentEmails = emailService.getSentEmails();
    const instructorEmail = sentEmails.find((e) => e.to === instructorUser.email);
    assert.ok(instructorEmail, 'Instructor should receive submission received email');
    assert.match(instructorEmail.subject, /Submission Received/i);
    assert.match(instructorEmail.html, /Evaluation Studio/i);

    // Verify in-app notification to instructor
    const notif = await Notification.findOne({
      userId: instructorUser._id,
      title: 'New Assessment Submission',
    });
    assert.ok(notif, 'Instructor should have received in-app notification');
    assert.strictEqual(notif.type, 'assessment');
  });

  it('8. Subjective evaluation completion triggers grade release email & in-app notification to student', async () => {
    const submission = await Submission.findOne({
      assessmentId: testAssessment._id,
      studentId: studentUser._id,
    });
    assert.ok(submission);

    // Instructor grades subjective question (18 out of 20 pts)
    await evaluationService.evaluateSubmission(
      instructorUser._id,
      submission._id,
      {
        questionFeedback: {
          [shortAnswerQuestion._id.toString()]: {
            pointsAwarded: 18,
            comment: 'Accurate distinction with good technical depth.',
          },
        },
        generalFeedback: 'Superb work on language parsing fundamentals.',
      }
    );

    const sentEmails = emailService.getSentEmails();
    const studentGradeEmail = sentEmails.find((e) => e.to === studentUser.email);
    assert.ok(studentGradeEmail, 'Student should receive grade released email');
    assert.match(studentGradeEmail.subject, /Evaluation Completed/i);
    assert.match(studentGradeEmail.html, /Superb work/i);

    const gradeNotif = await Notification.findOne({
      userId: studentUser._id,
      type: 'grade',
    });
    assert.ok(gradeNotif, 'Student should receive grade in-app notification');
    assert.match(gradeNotif.title, /Assessment Evaluated/i);
  });

  it('9. In-app Notification API: get, mark read, mark all read, and delete endpoints', async () => {
    // Create 3 fresh test notifications for studentUser
    await Notification.deleteMany({ userId: studentUser._id });

    const n1 = await Notification.create({
      userId: studentUser._id,
      title: 'Alert 1',
      message: 'First test alert',
      read: false,
    });
    const n2 = await Notification.create({
      userId: studentUser._id,
      title: 'Alert 2',
      message: 'Second test alert',
      read: false,
    });
    const n3 = await Notification.create({
      userId: studentUser._id,
      title: 'Alert 3',
      message: 'Third test alert',
      read: true,
    });

    // 1. GET notifications
    const getReq = { user: { id: studentUser._id }, query: { limit: 10 } };
    const getRes = mockResponse();
    await notificationController.getNotifications(getReq, getRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.responseData.data.notifications.length, 3);
    assert.strictEqual(getRes.responseData.data.unreadCount, 2);

    // 2. Mark specific notification as read (n1)
    const readReq = { user: { id: studentUser._id }, params: { id: n1._id.toString() } };
    const readRes = mockResponse();
    await notificationController.markAsRead(readReq, readRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(readRes.statusCode, 200);
    const updatedN1 = await Notification.findById(n1._id);
    assert.strictEqual(updatedN1.read, true);

    // 3. Mark all as read
    const readAllReq = { user: { id: studentUser._id } };
    const readAllRes = mockResponse();
    await notificationController.markAllAsRead(readAllReq, readAllRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(readAllRes.statusCode, 200);
    const remainingUnread = await Notification.countDocuments({ userId: studentUser._id, read: false });
    assert.strictEqual(remainingUnread, 0);

    // 4. Delete notification (n2)
    const delReq = { user: { id: studentUser._id }, params: { id: n2._id.toString() } };
    const delRes = mockResponse();
    await notificationController.deleteNotification(delReq, delRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(delRes.statusCode, 200);
    const deletedN2 = await Notification.findById(n2._id);
    assert.strictEqual(deletedN2, null);

    // 5. Unauthorized access: instructor cannot delete student's notification
    const unauthDelReq = { user: { id: instructorUser._id }, params: { id: n3._id.toString() } };
    const unauthDelRes = mockResponse();
    let caughtError = null;
    await notificationController.deleteNotification(unauthDelReq, unauthDelRes, (err) => {
      caughtError = err;
    });
    assert.ok(caughtError, 'Should reject foreign notification deletion');
    assert.strictEqual(caughtError.statusCode, 404);
  });
});
