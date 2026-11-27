const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const {
  User,
  Question,
  Subject,
  Interview,
  InterviewSession,
  InterviewTranscriptSegment,
  BehavioralReport,
  ProctoringSession,
  ProctoringEvent,
} = require('../src/models');
const {
  validateAiTranscriptOutput,
  validateAiProctoringOutput,
} = require('../src/services/aiWorkerClient.service');

describe('UAP Faculty-to-Student Interview & Proctoring (Phases 1-5)', () => {
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

  let bankQuestion;
  let createdInterviewId;
  let aiInterviewId;

  before(async () => {
    await connectDB();
    await seedDatabase();

    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });
    instructor1 = await User.findOne({ email: 'instructor@uap.edu' });

    await User.deleteOne({ email: 'instructor2_ivtest@uap.edu' });
    instructor2 = await User.create({
      name: 'Other Faculty',
      email: 'instructor2_ivtest@uap.edu',
      password: 'Password@123',
      role: 'instructor',
      facultyId: 'FAC-TEST-999',
      status: 'active',
      isActive: true,
    });

    student1Token = generateAccessToken({
      id: student1._id.toString(),
      role: 'student',
      email: student1.email,
      tokenVersion: student1.tokenVersion || 0,
    });
    student2Token = generateAccessToken({
      id: student2._id.toString(),
      role: 'student',
      email: student2.email,
      tokenVersion: student2.tokenVersion || 0,
    });
    instructor1Token = generateAccessToken({
      id: instructor1._id.toString(),
      role: 'instructor',
      email: instructor1.email,
      tokenVersion: instructor1.tokenVersion || 0,
    });
    instructor2Token = generateAccessToken({
      id: instructor2._id.toString(),
      role: 'instructor',
      email: instructor2.email,
      tokenVersion: instructor2.tokenVersion || 0,
    });

    let subject = await Subject.findOne({ name: 'Computer Science' });
    if (!subject) {
      subject = await Subject.create({
        name: 'Computer Science',
        code: 'CS-IV',
        createdBy: instructor1._id,
      });
    }

    bankQuestion = await Question.create({
      subjectId: subject._id,
      statement: 'Explain supervised learning with a real-world example.',
      questionType: 'SHORT_ANSWER',
      marks: 15,
      conceptTags: ['Machine Learning'],
      status: 'PUBLISHED',
      ownerFacultyId: instructor1._id,
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    const ids = [createdInterviewId, aiInterviewId].filter(Boolean);
    for (const id of ids) {
      await InterviewTranscriptSegment.deleteMany({ interviewId: id });
      await BehavioralReport.deleteMany({ interviewId: id });
      const pSessions = await ProctoringSession.find({ interviewId: id });
      for (const ps of pSessions) {
        await ProctoringEvent.deleteMany({ sessionId: ps._id });
      }
      await ProctoringSession.deleteMany({ interviewId: id });
      await InterviewSession.deleteMany({ interviewId: id });
      await Interview.deleteOne({ _id: id });
    }
    if (bankQuestion) await Question.deleteOne({ _id: bankQuestion._id });
    await User.deleteOne({ email: 'instructor2_ivtest@uap.edu' });
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  it('1. Faculty creates interview with Question Bank + custom question and independent camera proctoring', async () => {
    const res = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'ML Technical Viva #1',
        instructions: 'Ensure webcam is enabled before entering.',
        interviewType: 'viva',
        studentId: student1._id.toString(),
        durationMinutes: 30,
        passingPercentage: 60,
        status: 'ready',
        questions: [
          {
            sourceType: 'bank',
            bankQuestionId: bankQuestion._id.toString(),
            topic: 'Machine Learning',
            maxMarks: 15,
          },
          {
            sourceType: 'custom',
            questionText: 'Please introduce yourself and describe your recent project.',
            topic: 'Introduction',
            maxMarks: 10,
          },
        ],
        proctoringConfig: {
          cameraProctoringEnabled: true,
          cameraPermissionRequired: true,
          aiProctoringEnabled: false,
          liveMonitoringEnabled: true,
        },
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'ready');
    assert.strictEqual(body.data.questions.length, 2);
    assert.strictEqual(
      body.data.questions[0].questionText,
      'Explain supervised learning with a real-world example.'
    );
    // Camera proctoring enabled MUST NOT auto-enable AI proctoring
    assert.strictEqual(body.data.proctoringConfig.cameraProctoringEnabled, true);
    assert.strictEqual(body.data.proctoringConfig.cameraPermissionRequired, true);
    assert.strictEqual(body.data.proctoringConfig.aiProctoringEnabled, false);
    createdInterviewId = body.data.id;
  });

  it('2. Rejects unauthorized student access and unauthorized lifecycle transitions', async () => {
    // Student 2 cannot access Student 1's interview
    const foreignRes = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}`, {
      headers: { Authorization: `Bearer ${student2Token}` },
    });
    assert.strictEqual(foreignRes.status, 403);

    // Student 1 cannot transition interview status
    const studentTransitionRes = await fetch(
      `${baseUrl}/api/interviews/${createdInterviewId}/transition`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${student1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }
    );
    assert.strictEqual(studentTransitionRes.status, 403);

    // Invalid transition: ready -> completed directly is rejected
    const invalidTrans = await fetch(
      `${baseUrl}/api/interviews/${createdInterviewId}/transition`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${instructor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      }
    );
    assert.strictEqual(invalidTrans.status, 400);
  });

  it('3. Student joins assigned interview, camera telemetry & disconnect/reconnect are tracked, and session completes', async () => {
    // Student 2 cannot start session for Student 1's interview
    const badJoin = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/session/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student2Token}` },
    });
    assert.strictEqual(badJoin.status, 403);

    // Student 1 joins
    const joinRes = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/session/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert.strictEqual(joinRes.status, 200);
    const joinBody = await joinRes.json();
    assert.strictEqual(joinBody.data.session.status, 'active');
    assert.strictEqual(joinBody.data.session.cameraPermissionStatus, 'prompted');

    // Camera granted -> disconnected -> reconnected
    const camGrant = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/session/camera`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'granted',
        eventType: 'camera_permission_granted',
        detail: 'Mock Webcam',
      }),
    });
    assert.strictEqual(camGrant.status, 200);

    const camDisc = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/session/camera`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'disconnected',
        eventType: 'camera_disconnected',
        detail: 'USB unplugged',
      }),
    });
    assert.strictEqual(camDisc.status, 200);
    const discBody = await camDisc.json();
    assert.strictEqual(discBody.data.cameraConnectionStatus, 'disconnected');

    const camReconn = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/session/camera`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'reconnected',
        eventType: 'camera_reconnected',
        detail: 'Camera restored',
      }),
    });
    assert.strictEqual(camReconn.status, 200);

    // Complete session
    const compRes = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/session/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'complete' }),
    });
    assert.strictEqual(compRes.status, 200);
    const compBody = await compRes.json();
    assert.strictEqual(compBody.data.status, 'completed');

    // Completed -> in_progress must be rejected
    const restartRes = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/transition`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    assert.strictEqual(restartRes.status, 400);
  });

  it('4. Transcript segments validate & preserve authenticated institutional IDs; faculty evaluates deterministically', async () => {
    const iv = await Interview.findById(createdInterviewId);

    // Add transcript segments
    const seg1 = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/transcript`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        speakerRole: 'faculty',
        text: 'Explain supervised learning.',
      }),
    });
    assert.strictEqual(seg1.status, 201);
    const seg1Body = await seg1.json();
    assert.match(seg1Body.data.formattedLine, /^Faculty \(/);

    const seg2 = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/transcript`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        speakerRole: 'student',
        text: '',
        status: 'unclear',
      }),
    });
    assert.strictEqual(seg2.status, 201);
    const seg2Body = await seg2.json();
    assert.strictEqual(seg2Body.data.text, '[unclear]');

    // Evaluate deterministically
    const evalRes = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/evaluate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionScores: iv.questions.map((q, i) => ({
          questionId: q._id.toString(),
          marksAwarded: i === 0 ? 12 : 8,
          maxMarks: q.maxMarks,
          topic: q.topic,
          comment: 'Good answer',
        })),
        strengths: ['Clear fundamentals'],
        improvementAreas: ['Add precision metrics'],
        facultyFeedback: 'Strong technical viva performance.',
        facultyOnlyNotes: 'Private faculty note: minor camera flicker noted.',
      }),
    });
    assert.strictEqual(evalRes.status, 200);
    const evalBody = await evalRes.json();
    // 12 + 8 = 20 out of 25 -> 80%
    assert.strictEqual(evalBody.data.performanceReport.officialScore, 20);
    assert.strictEqual(evalBody.data.performanceReport.maxScore, 25);
    assert.strictEqual(evalBody.data.performanceReport.percentage, 80);
    assert.strictEqual(evalBody.data.performanceReport.passed, true);
  });

  it('5. Enforces strict report visibility split (student sees performance ONLY; 403 on behavioral, transcript, faculty report)', async () => {
    // Student CAN view own performance report
    const studPerf = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/reports/student`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert.strictEqual(studPerf.status, 200);
    const perfBody = await studPerf.json();
    assert.strictEqual(perfBody.data.officialScore, 20);
    assert.strictEqual(perfBody.data.facultyFeedback, 'Strong technical viva performance.');
    assert.strictEqual(perfBody.data.facultyOnlyNotes, undefined);
    assert.strictEqual(perfBody.data.behavioralReport, undefined);
    assert.strictEqual(perfBody.data.transcript, undefined);

    // Student CANNOT access behavioral report
    const studBeh = await fetch(
      `${baseUrl}/api/interviews/${createdInterviewId}/reports/behavioral`,
      { headers: { Authorization: `Bearer ${student1Token}` } }
    );
    assert.strictEqual(studBeh.status, 403);

    // Student CANNOT access transcript
    const studTrans = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/transcript`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert.strictEqual(studTrans.status, 403);

    // Student CANNOT access faculty complete report
    const studFac = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/reports/faculty`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert.strictEqual(studFac.status, 403);

    // Foreign instructor CANNOT access faculty report
    const otherFac = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/reports/faculty`, {
      headers: { Authorization: `Bearer ${instructor2Token}` },
    });
    assert.strictEqual(otherFac.status, 403);

    // Owning instructor accesses complete report
    const ownFac = await fetch(`${baseUrl}/api/interviews/${createdInterviewId}/reports/faculty`, {
      headers: { Authorization: `Bearer ${instructor1Token}` },
    });
    assert.strictEqual(ownFac.status, 200);
    const ownBody = await ownFac.json();
    assert.ok(ownBody.data.performanceReport);
    assert.ok(ownBody.data.behavioralReport);
    assert.ok(ownBody.data.transcript);
    assert.strictEqual(ownBody.data.behavioralReport.observableMetrics.cameraDisconnectCount, 1);
    assert.strictEqual(ownBody.data.facultyOnlyNotes, 'Private faculty note: minor camera flicker noted.');
  });

  it('6. AI output validation rejects malformed/unsafe payloads and Phase 5 faculty review + finalization works', async () => {
    assert.throws(() =>
      validateAiTranscriptOutput({
        officialScore: 99,
        segments: [{ speakerRole: 'faculty', text: 'Hello' }],
      })
    );
    assert.throws(() =>
      validateAiProctoringOutput({
        events: [{ eventType: 'dishonest_emotion', confidence: 0.9 }],
      })
    );

    // Create AI-proctoring-enabled interview
    const createRes = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'AI Proctored Viva',
        interviewType: 'technical',
        studentId: student1._id.toString(),
        status: 'ready',
        questions: [{ questionText: 'Explain ACID properties.', maxMarks: 10 }],
        proctoringConfig: {
          cameraProctoringEnabled: true,
          aiProctoringEnabled: true,
          cameraPermissionRequired: false,
        },
      }),
    });
    assert.strictEqual(createRes.status, 201);
    aiInterviewId = (await createRes.json()).data.id;

    // Start session
    const startRes = await fetch(`${baseUrl}/api/interviews/${aiInterviewId}/session/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert.strictEqual(startRes.status, 200);

    // Trigger AI proctoring event pipeline
    const aiProcRes = await fetch(`${baseUrl}/api/interviews/${aiInterviewId}/ai/proctoring`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telemetrySignals: [
          { eventType: 'face_not_detected', durationSeconds: 15, confidence: 0.92 },
        ],
      }),
    });
    assert.strictEqual(aiProcRes.status, 200);
    const aiProcBody = await aiProcRes.json();
    assert.strictEqual(aiProcBody.data.recordedEvents.length, 1);
    const eventId = aiProcBody.data.recordedEvents[0].id;

    // Faculty reviews & rejects/dismisses flag
    const reviewRes = await fetch(`${baseUrl}/api/proctoring/events/${eventId}/review`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'rejected', reviewNotes: 'Student looked down at notes briefly.' }),
    });
    assert.strictEqual(reviewRes.status, 200);
    const reviewBody = await reviewRes.json();
    assert.strictEqual(reviewBody.data.reviewStatus, 'rejected');

    // Finalize behavioral report
    const finRes = await fetch(
      `${baseUrl}/api/interviews/${aiInterviewId}/reports/behavioral/finalize`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${instructor1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facultyReviewNotes: 'Reviewed and cleared.',
          finalize: true,
        }),
      }
    );
    assert.strictEqual(finRes.status, 200);
    const finBody = await finRes.json();
    assert.strictEqual(finBody.data.status, 'finalized');
    assert.ok(finBody.data.auditTrail.length >= 1);
  });
});
