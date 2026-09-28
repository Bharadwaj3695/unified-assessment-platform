const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const submissionService = require('../src/services/submission.service');
const assessmentService = require('../src/services/assessment.service');
const proctoringService = require('../src/services/proctoring.service');
const { generateAccessToken } = require('../src/utils/jwt');
const {
  User,
  Assessment,
  Question,
  Submission,
  ProctoringSession,
  ProctoringEvent,
} = require('../src/models');

describe('AI-Assisted Proctoring Phase 1 & Phase 2A Verification', () => {
  let server;
  let baseUrl;
  let student1;
  let student2;
  let instructor1;
  let instructor2;
  let adminUser;
  let student1Token;
  let student2Token;
  let instructor1Token;
  let instructor2Token;
  let adminToken;

  let proctoredExam;
  let nonProctoredExam;
  let phase2Exam;
  let q1;
  let qShort;
  let qLong;
  let qMcq;
  let phase2Submission;
  let phase2Session;

  before(async () => {
    await connectDB();
    await seedDatabase();

    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });
    instructor1 = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    await User.deleteOne({ email: 'instructor2_proctest@uap.edu' });
    instructor2 = await User.create({
      name: 'Second Proctoring Instructor',
      email: 'instructor2_proctest@uap.edu',
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      isActive: true,
    });

    student1Token = generateAccessToken({
      id: student1._id.toString(),
      role: 'student',
      email: student1.email,
    });
    student2Token = generateAccessToken({
      id: student2._id.toString(),
      role: 'student',
      email: student2.email,
    });
    instructor1Token = generateAccessToken({
      id: instructor1._id.toString(),
      role: 'instructor',
      email: instructor1.email,
    });
    instructor2Token = generateAccessToken({
      id: instructor2._id.toString(),
      role: 'instructor',
      email: instructor2.email,
    });
    adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      role: 'admin',
      email: adminUser.email,
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Clean up any previous test data
    const priorAssessments = await Assessment.find({
      title: {
        $in: [
          'Proctored Test Exam',
          'Standard Non-Proctored Exam',
          'Phase 2A Written Integrity Exam',
        ],
      },
    });
    for (const pa of priorAssessments) {
      const priorSubs = await Submission.find({ assessmentId: pa._id });
      for (const ps of priorSubs) {
        const pSessions = await ProctoringSession.find({ submissionId: ps._id });
        for (const sess of pSessions) {
          await ProctoringEvent.deleteMany({ sessionId: sess._id });
        }
        await ProctoringSession.deleteMany({ submissionId: ps._id });
      }
      await Submission.deleteMany({ assessmentId: pa._id });
      await Question.deleteMany({ assessmentId: pa._id });
      await Assessment.deleteOne({ _id: pa._id });
    }

    // 1. Create a Proctored Assessment with cameraRequired = true
    proctoredExam = await Assessment.create({
      title: 'Proctored Test Exam',
      description: 'Exam with proctoring enabled and camera required',
      category: 'Computer Science',
      instructorId: instructor1._id,
      durationMinutes: 30,
      totalPoints: 20,
      passingScore: 50,
      status: 'published',
      accessType: 'public',
      proctoringEnabled: true,
      cameraRequired: true,
    });

    // 2. Create a Non-Proctored Assessment
    nonProctoredExam = await Assessment.create({
      title: 'Standard Non-Proctored Exam',
      description: 'Standard exam without proctoring',
      category: 'Computer Science',
      instructorId: instructor1._id,
      durationMinutes: 30,
      totalPoints: 20,
      passingScore: 50,
      status: 'published',
      accessType: 'public',
      proctoringEnabled: false,
      cameraRequired: false,
    });

    q1 = await Question.create({
      assessmentId: proctoredExam._id,
      questionText: 'What is 2 + 2?',
      type: 'mcq',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '4' },
      ],
      correctAnswer: 'b',
      points: 20,
      orderIndex: 0,
    });

    // 3. Create a Phase 2A Exam with Short Answer and Long Answer
    phase2Exam = await Assessment.create({
      title: 'Phase 2A Written Integrity Exam',
      description: 'Exam testing clipboard restrictions on written questions',
      category: 'Software Engineering',
      instructorId: instructor1._id,
      durationMinutes: 45,
      totalPoints: 60,
      passingScore: 50,
      status: 'published',
      accessType: 'public',
      proctoringEnabled: true,
      cameraRequired: false,
    });

    qShort = await Question.create({
      assessmentId: phase2Exam._id,
      questionText: 'Explain the purpose of database indexing in 2-3 sentences.',
      type: 'short_answer',
      options: [],
      points: 20,
      orderIndex: 0,
    });

    qLong = await Question.create({
      assessmentId: phase2Exam._id,
      questionText: 'Describe architectural trade-offs between monoliths and microservices.',
      type: 'long_answer',
      options: [],
      points: 30,
      orderIndex: 1,
    });

    qMcq = await Question.create({
      assessmentId: phase2Exam._id,
      questionText: 'Which protocol is connectionless?',
      type: 'mcq',
      options: [
        { id: 'a', text: 'TCP' },
        { id: 'b', text: 'UDP' },
      ],
      correctAnswer: 'b',
      points: 10,
      orderIndex: 2,
    });
  });

  after(async () => {
    const cleanupExams = [proctoredExam, nonProctoredExam, phase2Exam];
    for (const ex of cleanupExams) {
      if (ex) {
        const subs = await Submission.find({ assessmentId: ex._id });
        for (const s of subs) {
          const sessList = await ProctoringSession.find({ submissionId: s._id });
          for (const sess of sessList) {
            await ProctoringEvent.deleteMany({ sessionId: sess._id });
          }
          await ProctoringSession.deleteMany({ submissionId: s._id });
        }
        await Submission.deleteMany({ assessmentId: ex._id });
        await Question.deleteMany({ assessmentId: ex._id });
        await Assessment.deleteOne({ _id: ex._id });
      }
    }
    await User.deleteOne({ email: 'instructor2_proctest@uap.edu' });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // ---------------- Phase 1 Tests ----------------
  it('1. should configure proctoring settings on assessment model correctly', async () => {
    const fetchedProctored = await Assessment.findById(proctoredExam._id);
    assert.strictEqual(fetchedProctored.proctoringEnabled, true);
    assert.strictEqual(fetchedProctored.cameraRequired, true);

    const fetchedNonProctored = await Assessment.findById(nonProctoredExam._id);
    assert.strictEqual(fetchedNonProctored.proctoringEnabled, false);
    assert.strictEqual(fetchedNonProctored.cameraRequired, false);
  });

  it('2. should auto-create ProctoringSession and session_started event when starting proctored assessment', async () => {
    const submission = await submissionService.startAttempt(student1._id, proctoredExam._id);
    assert.ok(submission._id);
    assert.ok(submission.proctoringSessionId, 'Submission should reference proctoringSessionId');

    const session = await ProctoringSession.findById(submission.proctoringSessionId);
    assert.ok(session, 'ProctoringSession document must exist in database');
    assert.strictEqual(session.submissionId.toString(), submission._id.toString());
    assert.strictEqual(session.studentId.toString(), student1._id.toString());
    assert.strictEqual(session.assessmentId.toString(), proctoredExam._id.toString());
    assert.strictEqual(session.cameraStatus, 'prompted');
    assert.strictEqual(session.status, 'active');
    assert.ok(session.startedAt instanceof Date);
    assert.strictEqual(session.endedAt, null);

    const events = await ProctoringEvent.find({ sessionId: session._id }).sort({ timestamp: 1 });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].eventType, 'session_started');
    assert.strictEqual(events[0].severity, 'info');
    assert.strictEqual(events[0].metadata.cameraRequired, true);
    assert.strictEqual(events[0].metadata.cameraStatus, 'prompted');
  });

  it('3. should NOT create a ProctoringSession when starting a non-proctored assessment', async () => {
    const submission = await submissionService.startAttempt(student1._id, nonProctoredExam._id);
    assert.ok(submission._id);
    assert.ok(!submission.proctoringSessionId, 'Submission should not have proctoringSessionId');

    const session = await ProctoringSession.findOne({ submissionId: submission._id });
    assert.strictEqual(session, null, 'No proctoring session should be created');
  });

  it('4. should reject event recording from an unauthorized student (ownership enforcement)', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });
    assert.ok(submission);

    const session = await ProctoringSession.findOne({ submissionId: submission._id });
    assert.ok(session);

    await assert.rejects(
      async () => {
        await proctoringService.recordEvent(session._id, student2._id, {
          eventType: 'camera_permission_granted',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /do not own this proctoring session/i);
        return true;
      }
    );
  });

  it('5. should reject invalid event types with 400', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });
    const session = await ProctoringSession.findOne({ submissionId: submission._id });

    await assert.rejects(
      async () => {
        await proctoringService.recordEvent(session._id, student1._id, {
          eventType: 'unsupported_ai_flag',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /invalid event type/i);
        return true;
      }
    );
  });

  it('6. should record camera permission granted and update session cameraStatus to granted', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });
    const session = await ProctoringSession.findOne({ submissionId: submission._id });

    const event = await proctoringService.recordEvent(session._id, student1._id, {
      eventType: 'camera_permission_granted',
      metadata: { deviceLabel: 'HD Webcam' },
    });

    assert.ok(event._id);
    assert.strictEqual(event.eventType, 'camera_permission_granted');

    const updatedSession = await ProctoringSession.findById(session._id);
    assert.strictEqual(updatedSession.cameraStatus, 'granted');
  });

  it('7. should record camera disconnected event and update session cameraStatus to disconnected', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });
    const session = await ProctoringSession.findOne({ submissionId: submission._id });

    const event = await proctoringService.recordEvent(session._id, student1._id, {
      eventType: 'camera_disconnected',
      severity: 'warn',
      metadata: { reason: 'Track ended' },
    });

    assert.ok(event._id);
    assert.strictEqual(event.eventType, 'camera_disconnected');
    assert.strictEqual(event.severity, 'warn');

    const updatedSession = await ProctoringSession.findById(session._id);
    assert.strictEqual(updatedSession.cameraStatus, 'disconnected');
  });

  it('8. should record camera permission denied and update session cameraStatus to denied', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });
    const session = await ProctoringSession.findOne({ submissionId: submission._id });

    const event = await proctoringService.recordEvent(session._id, student1._id, {
      eventType: 'camera_permission_denied',
      severity: 'warn',
      metadata: { error: 'NotAllowedError: Permission denied' },
    });

    assert.ok(event._id);
    assert.strictEqual(event.eventType, 'camera_permission_denied');

    const updatedSession = await ProctoringSession.findById(session._id);
    assert.strictEqual(updatedSession.cameraStatus, 'denied');
  });

  it('9. should auto-conclude proctoring session and record session_ended upon exam submission', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });
    const session = await ProctoringSession.findOne({ submissionId: submission._id });
    assert.strictEqual(session.status, 'active');

    const submitted = await submissionService.submitAssessment(
      submission._id,
      student1._id,
      {}
    );
    assert.ok(
      ['submitted', 'evaluated'].includes(submitted.status),
      `Submission status should be submitted or evaluated, got ${submitted.status}`
    );

    const finalizedSession = await ProctoringSession.findById(session._id);
    assert.strictEqual(finalizedSession.status, 'completed');
    assert.ok(finalizedSession.endedAt instanceof Date);

    const events = await ProctoringEvent.find({ sessionId: session._id }).sort({ timestamp: 1 });
    const endEvent = events.find((e) => e.eventType === 'session_ended');
    assert.ok(endEvent, 'session_ended event must be logged');
    assert.strictEqual(endEvent.severity, 'info');
  });

  it('10. should allow assessment instructor to view proctoring telemetry in getSubmissionById', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });

    const subDetails = await submissionService.getSubmissionById(
      submission._id,
      instructor1._id,
      'instructor'
    );

    assert.ok(subDetails.proctoring, 'Instructor should receive proctoring telemetry');
    assert.ok(subDetails.proctoring.session);
    assert.strictEqual(subDetails.proctoring.session.status, 'completed');
    assert.ok(Array.isArray(subDetails.proctoring.events));
    assert.ok(subDetails.proctoring.events.length >= 4);

    const timestamps = subDetails.proctoring.events.map((e) => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      assert.ok(timestamps[i] >= timestamps[i - 1], 'Events must be in chronological order');
    }
  });

  it('11. should block another instructor from viewing proctoring telemetry for an assessment they do not own', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });

    await assert.rejects(
      async () => {
        await proctoringService.getSessionBySubmissionId(
          submission._id,
          instructor2._id,
          'instructor'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /do not own the assessment/i);
        return true;
      }
    );
  });

  it('12. should allow admin read-only access to proctoring session and events', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });

    const result = await proctoringService.getSessionBySubmissionId(
      submission._id,
      adminUser._id,
      'admin'
    );

    assert.ok(result.session);
    assert.strictEqual(result.session.submissionId.toString(), submission._id.toString());
    assert.ok(Array.isArray(result.events));
    assert.ok(result.events.length > 0);
  });

  it('13. should block unauthorized student from reading foreign proctoring session', async () => {
    const submission = await Submission.findOne({
      studentId: student1._id,
      assessmentId: proctoredExam._id,
    });

    await assert.rejects(
      async () => {
        await proctoringService.getSessionBySubmissionId(
          submission._id,
          student2._id,
          'student'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /unauthorized access/i);
        return true;
      }
    );
  });

  it('14. should confirm MongoDB collections proctoringsessions and proctoringevents exist and are populated', async () => {
    const sessionCount = await ProctoringSession.countDocuments();
    const eventCount = await ProctoringEvent.countDocuments();

    assert.ok(sessionCount > 0, 'proctoringsessions collection has documents');
    assert.ok(eventCount > 0, 'proctoringevents collection has documents');

    assert.strictEqual(ProctoringSession.collection.name, 'proctoringsessions');
    assert.strictEqual(ProctoringEvent.collection.name, 'proctoringevents');
  });

  // ---------------- Phase 2A Clipboard Policy & Telemetry Tests ----------------
  it('15. should start active attempt for Phase 2A written assessment and initialize session', async () => {
    phase2Submission = await submissionService.startAttempt(student1._id, phase2Exam._id);
    assert.ok(phase2Submission._id);
    assert.ok(phase2Submission.proctoringSessionId);

    phase2Session = await ProctoringSession.findById(phase2Submission.proctoringSessionId);
    assert.ok(phase2Session);
    assert.strictEqual(phase2Session.status, 'active');
  });

  it('16. should record paste_blocked event for Long Answer question with appropriate severity and safe metadata', async () => {
    const event = await proctoringService.recordEvent(phase2Session._id, student1._id, {
      eventType: 'paste_blocked',
      severity: 'low',
      metadata: {
        questionId: qLong._id.toString(),
        questionType: 'long_answer',
        action: 'paste',
        source: 'written_response',
      },
    });

    assert.ok(event._id);
    assert.strictEqual(event.eventType, 'paste_blocked');
    assert.strictEqual(event.severity, 'low');
    assert.strictEqual(event.metadata.questionId, qLong._id.toString());
    assert.strictEqual(event.metadata.questionType, 'long_answer');
    assert.strictEqual(event.metadata.action, 'paste');
    assert.strictEqual(event.metadata.source, 'written_response');
  });

  it('17. should record copy_blocked event for Short Answer question', async () => {
    const event = await proctoringService.recordEvent(phase2Session._id, student1._id, {
      eventType: 'copy_blocked',
      metadata: {
        questionId: qShort._id.toString(),
        questionType: 'short_answer',
        action: 'copy',
        source: 'written_response',
      },
    });

    assert.ok(event._id);
    assert.strictEqual(event.eventType, 'copy_blocked');
    assert.strictEqual(event.severity, 'low');
    assert.strictEqual(event.metadata.questionId, qShort._id.toString());
    assert.strictEqual(event.metadata.questionType, 'short_answer');
    assert.strictEqual(event.metadata.action, 'copy');
  });

  it('18. should record cut_blocked event for Long Answer question', async () => {
    const event = await proctoringService.recordEvent(phase2Session._id, student1._id, {
      eventType: 'cut_blocked',
      metadata: {
        questionId: qLong._id.toString(),
        questionType: 'long_answer',
        action: 'cut',
        source: 'written_response',
      },
    });

    assert.ok(event._id);
    assert.strictEqual(event.eventType, 'cut_blocked');
    assert.strictEqual(event.metadata.action, 'cut');
  });

  it('19. should block foreign student from recording clipboard events for another student session (HTTP 403)', async () => {
    await assert.rejects(
      async () => {
        await proctoringService.recordEvent(phase2Session._id, student2._id, {
          eventType: 'paste_blocked',
          metadata: { questionId: qLong._id.toString() },
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /do not own this proctoring session/i);
        return true;
      }
    );
  });

  it('20. should block unauthenticated HTTP request from recording clipboard events (HTTP 401)', async () => {
    const res = await fetch(`${baseUrl}/api/proctoring/sessions/${phase2Session._id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'paste_blocked',
        metadata: { questionId: qLong._id.toString() },
      }),
    });

    assert.strictEqual(res.status, 401);
  });

  it('21. should allow authenticated student to post clipboard telemetry via HTTP API (HTTP 201)', async () => {
    const res = await fetch(`${baseUrl}/api/proctoring/sessions/${phase2Session._id}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({
        eventType: 'copy_blocked',
        severity: 'low',
        metadata: {
          questionId: qLong._id.toString(),
          questionType: 'long_answer',
          action: 'copy',
          source: 'written_response',
        },
      }),
    });

    assert.ok([200, 201].includes(res.status));
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.eventType, 'copy_blocked');
  });

  it('22. should reject invalid clipboard event type with 400', async () => {
    await assert.rejects(
      async () => {
        await proctoringService.recordEvent(phase2Session._id, student1._id, {
          eventType: 'unknown_clipboard_injection',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /invalid event type/i);
        return true;
      }
    );
  });

  it('23. should reject non-existent session with 404', async () => {
    const randomSessionId = new mongoose.Types.ObjectId();
    await assert.rejects(
      async () => {
        await proctoringService.recordEvent(randomSessionId, student1._id, {
          eventType: 'paste_blocked',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.match(err.message, /session not found/i);
        return true;
      }
    );
  });

  it('24. should strictly NEVER persist clipboard contents or copied text in MongoDB Atlas', async () => {
    const sneakyPayload = {
      eventType: 'paste_blocked',
      severity: 'low',
      metadata: {
        questionId: qLong._id.toString(),
        questionType: 'long_answer',
        action: 'paste',
        source: 'written_response',
        clipboardText: 'MALICIOUS_OR_CONFIDENTIAL_COPIED_DATA_XYZ',
        copiedContent: 'SECRET_ESSAY_TEXT_SAMPLE',
        password: 'my_secret_password',
      },
    };

    // Use a fresh distinct action or wait 2s to avoid deduplication
    await new Promise((r) => setTimeout(r, 2100));

    const recorded = await proctoringService.recordEvent(
      phase2Session._id,
      student1._id,
      sneakyPayload
    );

    assert.ok(recorded._id);
    const fromDb = await ProctoringEvent.findById(recorded._id).lean();

    assert.strictEqual(fromDb.metadata.clipboardText, undefined);
    assert.strictEqual(fromDb.metadata.copiedContent, undefined);
    assert.strictEqual(fromDb.metadata.password, undefined);

    const jsonString = JSON.stringify(fromDb);
    assert.strictEqual(
      jsonString.includes('MALICIOUS_OR_CONFIDENTIAL_COPIED_DATA_XYZ'),
      false,
      'Clipboard text must never be persisted in MongoDB'
    );
    assert.strictEqual(
      jsonString.includes('SECRET_ESSAY_TEXT_SAMPLE'),
      false,
      'Copied content must never be persisted in MongoDB'
    );
  });

  it('25. should deduplicate rapid consecutive clipboard telemetry to prevent MongoDB flooding', async () => {
    const first = await proctoringService.recordEvent(phase2Session._id, student1._id, {
      eventType: 'cut_blocked',
      metadata: {
        questionId: qShort._id.toString(),
        action: 'cut',
      },
    });

    // Immediate duplicate call within 100ms
    const duplicate = await proctoringService.recordEvent(phase2Session._id, student1._id, {
      eventType: 'cut_blocked',
      metadata: {
        questionId: qShort._id.toString(),
        action: 'cut',
      },
    });

    assert.strictEqual(first._id.toString(), duplicate._id.toString(), 'Rapid duplicate should return the existing event');
  });

  it('26. should allow assessment instructor and admin to view clipboard telemetry in proctoring event log', async () => {
    const instructorView = await proctoringService.getSessionBySubmissionId(
      phase2Submission._id,
      instructor1._id,
      'instructor'
    );

    assert.ok(instructorView.session);
    assert.ok(instructorView.events.length > 0);

    const clipboardEvts = instructorView.events.filter((e) =>
      ['paste_blocked', 'copy_blocked', 'cut_blocked'].includes(e.eventType)
    );
    assert.ok(clipboardEvts.length >= 3, 'Instructor should view all recorded clipboard integrity events');

    const adminView = await proctoringService.getSessionBySubmissionId(
      phase2Submission._id,
      adminUser._id,
      'admin'
    );
    assert.ok(adminView.session);
    assert.strictEqual(adminView.events.length, instructorView.events.length);
  });
});
