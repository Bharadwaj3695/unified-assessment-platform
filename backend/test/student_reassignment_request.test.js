const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Submission, ReassignmentRequest, AuditLog, Notification } = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Student Reassignment Request Feature: End-to-End Verification', () => {
  let server;
  let baseUrl;
  let student1;
  let student2;
  let instructor1;
  let instructor2;
  let student1Token;
  let student2Token;
  let instructor1Token;
  let instructor2Token;

  let openExam;
  let missedExam;
  let passedExam;
  let failedExam;
  let restrictedExam;

  before(async () => {
    await connectDB();
    await seedDatabase();

    // Start HTTP server on dynamic port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    student1 = await User.findOne({ role: 'student' });
    student2 = await User.findOne({ role: 'student', _id: { $ne: student1._id } });
    instructor1 = await User.findOne({ role: 'instructor' });
    instructor2 = await User.findOne({ role: 'instructor', _id: { $ne: instructor1._id } });

    // Generate tokens
    student1Token = generateAccessToken({ id: student1._id, role: student1.role });
    student2Token = generateAccessToken({ id: student2._id, role: student2.role });
    instructor1Token = generateAccessToken({ id: instructor1._id, role: instructor1.role });
    instructor2Token = generateAccessToken({ id: instructor2._id, role: instructor2.role });

    // 1. Open / Available Exam (deadline in the future)
    openExam = await Assessment.create({
      title: 'Open Active Assessment',
      category: 'Computer Science',
      instructorId: instructor1._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      deadlineAt: new Date(Date.now() + 86400000), // tomorrow
    });

    // 2. Missed Exam (deadline in the past, no submission by student1)
    missedExam = await Assessment.create({
      title: 'Missed Historical Exam',
      category: 'Software Engineering',
      instructorId: instructor1._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      deadlineAt: new Date(Date.now() - 3600000), // 1 hour ago
    });

    // 3. Passed Exam (student1 submitted and passed)
    passedExam = await Assessment.create({
      title: 'Passed Certification Exam',
      category: 'Database Systems',
      instructorId: instructor1._id,
      durationMinutes: 30,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
    });
    await Submission.create({
      studentId: student1._id,
      assessmentId: passedExam._id,
      status: 'evaluated',
      score: 85,
      totalPoints: 100,
      percentage: 85,
      passed: true,
      submittedAt: new Date(),
    });

    // 4. Failed Exam (student1 submitted and failed)
    failedExam = await Assessment.create({
      title: 'Failed Algorithms Midterm',
      category: 'Data Structures & Algorithms',
      instructorId: instructor1._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
    });
    await Submission.create({
      studentId: student1._id,
      assessmentId: failedExam._id,
      status: 'evaluated',
      score: 40,
      totalPoints: 100,
      percentage: 40,
      passed: false,
      submittedAt: new Date(),
    });

    // 5. Restricted Exam assigned to student2 only
    restrictedExam = await Assessment.create({
      title: 'Restricted Cohort Exam',
      category: 'Cybersecurity',
      instructorId: instructor1._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [student2._id],
      deadlineAt: new Date(Date.now() - 3600000),
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('should reject unauthenticated request', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'I had a severe power outage during the test.' }),
    });

    assert.strictEqual(res.status, 401);
  });

  it('should reject non-student role (e.g. instructor)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructor1Token}`,
      },
      body: JSON.stringify({ reason: 'I had a severe power outage during the test.' }),
    });

    assert.strictEqual(res.status, 403);
  });

  it('should return 404 for nonexistent assessment ID', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await fetch(`${baseUrl}/api/assessments/${fakeId}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: 'I had a severe power outage during the test.' }),
    });

    assert.strictEqual(res.status, 404);
  });

  it('should reject empty or whitespace-only reason', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: '             ' }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 422);
    assert.strictEqual(data.success, false);
  });

  it('should reject reason with fewer than 10 non-whitespace characters', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: 'Too short' }), // 8 non-whitespace characters
    });

    const data = await res.json();
    assert.strictEqual(res.status, 422);
    assert.match(data.errors?.[0]?.message || data.message, /10 non-whitespace characters/i);
  });

  it('should reject reason exceeding 500 characters', async () => {
    const longReason = 'A'.repeat(501);
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: longReason }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 422);
    assert.match(data.errors?.[0]?.message || data.message, /500/);
  });

  it('should reject request on an open assessment that has not passed its deadline', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${openExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: 'Please let me re-take this open assessment early.' }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(data.message, /currently open/i);
  });

  it('should reject request on an assessment already passed', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${passedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: 'I want a higher score even though I passed.' }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(data.message, /already successfully passed/i);
  });

  it('should reject request if student is not assigned to restricted assessment', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${restrictedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: 'I am requesting access to this exam.' }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.message, /not authorized or assigned/i);
  });

  it('should successfully submit reassignment request for a missed assessment', async () => {
    const reasonText = 'I had an urgent medical emergency and could not submit before the deadline.';
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: reasonText }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.status, 'pending');
    assert.strictEqual(data.data.assessmentId.toString(), missedExam._id.toString());
    assert.strictEqual(data.data.studentId.toString(), student1._id.toString());
    assert.strictEqual(data.data.reason, reasonText);

    // Verify AuditLog recorded
    const audit = await AuditLog.findOne({
      action: 'REASSIGNMENT_REQUEST_SUBMITTED',
      entityId: data.data._id,
    });
    assert.ok(audit, 'AuditLog entry must be created');
    assert.strictEqual(audit.userId.toString(), student1._id.toString());
    assert.strictEqual(audit.details.eligibilityReason, 'missed');
  });

  it('should prevent duplicate pending request for the same student and assessment', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: 'Second request attempting to duplicate the first one.' }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 409);
    assert.match(data.message, /already pending/i);
  });

  it('should successfully submit reassignment request for a failed assessment', async () => {
    const reasonText = 'My internet disconnected midway through the exam causing early auto-submission.';
    const res = await fetch(`${baseUrl}/api/assessments/${failedExam._id}/reassignment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({ reason: reasonText }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.status, 'pending');

    // Verify AuditLog recorded
    const audit = await AuditLog.findOne({
      action: 'REASSIGNMENT_REQUEST_SUBMITTED',
      entityId: data.data._id,
    });
    assert.ok(audit);
    assert.strictEqual(audit.details.eligibilityReason, 'failed');
  });

  it('should retrieve student personal requests via GET /api/assessments/reassignment-requests/mine', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/reassignment-requests/mine`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.strictEqual(data.data.length, 2); // missedExam + failedExam
  });

  it('should retrieve single assessment request status via GET /api/assessments/:id/reassignment-request', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-request`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data);
    assert.strictEqual(data.data.status, 'pending');
  });

  it('should prevent non-owner instructor from viewing assessment requests', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-requests`, {
      headers: {
        Authorization: `Bearer ${instructor2Token}`, // instructor2 does not own missedExam
      },
    });

    assert.strictEqual(res.status, 403);
  });

  it('should allow owner instructor to view assessment requests', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${missedExam._id}/reassignment-requests`, {
      headers: {
        Authorization: `Bearer ${instructor1Token}`, // instructor1 owns missedExam
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.strictEqual(data.data.length, 1);
    assert.strictEqual(data.data[0].studentId._id.toString(), student1._id.toString());
  });

  it('should allow instructor to review (approve) the request with notes', async () => {
    const reqDoc = await ReassignmentRequest.findOne({
      studentId: student1._id,
      assessmentId: missedExam._id,
    });
    assert.ok(reqDoc);

    const reviewRes = await fetch(`${baseUrl}/api/assessments/reassignment-requests/${reqDoc._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructor1Token}`,
      },
      body: JSON.stringify({
        status: 'approved',
        reviewNotes: 'Medical documentation verified. Approved for reassignment.',
      }),
    });

    const reviewData = await reviewRes.json();
    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewData.data.status, 'approved');
    assert.strictEqual(reviewData.data.reviewNotes, 'Medical documentation verified. Approved for reassignment.');

    // Verify AuditLog recorded
    const audit = await AuditLog.findOne({
      action: 'REASSIGNMENT_REQUEST_APPROVED',
      entityId: reqDoc._id.toString(),
    });
    assert.ok(audit, 'AuditLog for approval must exist');
    assert.strictEqual(audit.userId.toString(), instructor1._id.toString());

    // Verify Notification sent to student
    const notif = await Notification.findOne({
      userId: student1._id,
      title: 'Reassignment Request Approved',
    });
    assert.ok(notif, 'Student notification must be created');
  });

  it('should reject re-reviewing an already reviewed request', async () => {
    const reqDoc = await ReassignmentRequest.findOne({
      studentId: student1._id,
      assessmentId: missedExam._id,
    });
    assert.strictEqual(reqDoc.status, 'approved');

    const res = await fetch(`${baseUrl}/api/assessments/reassignment-requests/${reqDoc._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructor1Token}`,
      },
      body: JSON.stringify({
        status: 'rejected',
        reviewNotes: 'Changing mind',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(data.message, /already been reviewed/i);
  });
});
