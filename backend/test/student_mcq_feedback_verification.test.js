const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Assessment, Question, Submission, Evaluation } = require('../src/models');
const submissionService = require('../src/services/submission.service');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Student Submission Feedback & MCQ Options Verification', () => {
  let studentA;
  let studentB;
  let instructor;
  let studentAToken;
  let studentBToken;
  let instructorToken;
  let assessment;
  let mcq4Options;
  let mcq3Options;
  let mcqUnanswered;
  let descriptiveQ;
  let submissionA;
  let evaluationA;
  let server;
  let baseUrl;

  // Helper function to recursively search for sensitive keys anywhere in a JSON object
  const findKeyRecursively = (obj, targetKey) => {
    if (!obj || typeof obj !== 'object') return false;
    if (Object.prototype.hasOwnProperty.call(obj, targetKey)) return true;
    for (const val of Object.values(obj)) {
      if (typeof val === 'object' && val !== null) {
        if (findKeyRecursively(val, targetKey)) return true;
      }
    }
    return false;
  };

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    studentA = await User.create({
      name: 'Alice Student',
      email: `alice_${Date.now()}@uap.edu`,
      password: 'Password@123',
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `ST_${Date.now()}_A`,
    });

    studentB = await User.create({
      name: 'Bob Student',
      email: `bob_${Date.now()}@uap.edu`,
      password: 'Password@123',
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `ST_${Date.now()}_B`,
    });

    instructor = await User.create({
      name: 'Dr. Turing',
      email: `turing_${Date.now()}@uap.edu`,
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: `FAC_${Date.now()}`,
    });

    studentAToken = generateAccessToken({ id: studentA._id.toString(), role: 'student' });
    studentBToken = generateAccessToken({ id: studentB._id.toString(), role: 'student' });
    instructorToken = generateAccessToken({ id: instructor._id.toString(), role: 'instructor' });

    assessment = await Assessment.create({
      title: 'Web Protocols & Systems Final',
      category: 'Computer Science',
      instructorId: instructor._id,
      totalPoints: 70,
      durationMinutes: 60,
      passingScore: 50,
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    // 1. Standard 4-option MCQ
    mcq4Options = await Question.create({
      assessmentId: assessment._id,
      questionText: 'Which HTTP status code signifies that a requested resource has not been modified and can be retrieved from client cache?',
      type: 'mcq',
      options: [
        { id: 'a', text: '200 OK' },
        { id: 'b', text: '304 Not Modified' },
        { id: 'c', text: '404 Not Found' },
        { id: 'd', text: '500 Internal Server Error' },
      ],
      correctAnswer: 'b',
      explanation: 'HTTP 304 indicates conditional GET matched ETag/Last-Modified header.',
      points: 20,
      orderIndex: 0,
    });

    // 2. 3-option MCQ (Different option count)
    mcq3Options = await Question.create({
      assessmentId: assessment._id,
      questionText: 'Which cache directive prevents any caching whatsoever?',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'no-cache' },
        { id: 'opt_2', text: 'no-store' },
        { id: 'opt_3', text: 'max-age=0' },
      ],
      correctAnswer: 'opt_2',
      explanation: 'no-store instructs intermediaries and browser to never write response to disk/memory.',
      points: 20,
      orderIndex: 1,
    });

    // 3. Unanswered MCQ
    mcqUnanswered = await Question.create({
      assessmentId: assessment._id,
      questionText: 'What is the default port for HTTPS?',
      type: 'mcq',
      options: [
        { id: '80', text: 'Port 80' },
        { id: '443', text: 'Port 443' },
      ],
      correctAnswer: '443',
      explanation: 'HTTPS standard IANA port is 443.',
      points: 10,
      orderIndex: 2,
    });

    // 4. Descriptive question
    descriptiveQ = await Question.create({
      assessmentId: assessment._id,
      questionText: 'Describe how ETags provide optimistic concurrency control.',
      type: 'short_answer',
      points: 20,
      orderIndex: 3,
    });

    // Create evaluated submission for Student A
    submissionA = await Submission.create({
      assessmentId: assessment._id,
      studentId: studentA._id,
      answers: {
        [mcq4Options._id.toString()]: 'b', // Correct 4-option selection
        [mcq3Options._id.toString()]: 'opt_1', // Incorrect 3-option selection
        // mcqUnanswered is intentionally left absent (unanswered)
        [descriptiveQ._id.toString()]: 'ETags allow clients to send If-Match headers to verify state before mutating.',
      },
      score: 35,
      autoScore: 20,
      manualScore: 15,
      finalScore: 35,
      totalPoints: 70,
      percentage: 50,
      passed: true,
      status: 'evaluated',
      resultStatus: 'passed',
      evaluationStatus: 'completed',
    });

    // Create Evaluation with question feedback & faculty comment
    evaluationA = await Evaluation.create({
      submissionId: submissionA._id,
      evaluatorId: instructor._id,
      questionFeedback: {
        [mcq4Options._id.toString()]: {
          pointsAwarded: 20,
          comment: 'Good understanding of HTTP caching.',
        },
        [mcq3Options._id.toString()]: {
          pointsAwarded: 0,
          comment: 'Review difference between no-cache and no-store.',
        },
        [descriptiveQ._id.toString()]: {
          pointsAwarded: 15,
          comment: 'Well explained, mention weak vs strong ETags next time.',
        },
      },
      generalFeedback: 'Solid performance on caching and state transfer mechanics.',
      finalScore: 35,
      percentage: 50,
      status: 'completed',
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('1. should return all MCQ options for review to student caller via HTTP endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const data = body.data || body;

    assert.ok(data.assessment);
    assert.strictEqual(data.assessment.questions.length, 4);

    const q1 = data.assessment.questions.find((q) => q._id.toString() === mcq4Options._id.toString());
    assert.strictEqual(q1.options.length, 4);
    assert.strictEqual(q1.options[0].text, '200 OK');
    assert.strictEqual(q1.options[1].text, '304 Not Modified');
    assert.strictEqual(q1.options[2].text, '404 Not Found');
    assert.strictEqual(q1.options[3].text, '500 Internal Server Error');

    const q2 = data.assessment.questions.find((q) => q._id.toString() === mcq3Options._id.toString());
    assert.strictEqual(q2.options.length, 3);
  });

  it('2. SECURITY: deep inspection confirms correctAnswer and explanation are completely absent from student response tree', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const body = await res.json();

    // Deep recursive search across entire JSON tree
    assert.strictEqual(
      findKeyRecursively(body, 'correctAnswer'),
      false,
      'correctAnswer must NOT exist anywhere in the student HTTP response tree'
    );
    assert.strictEqual(
      findKeyRecursively(body, 'explanation'),
      false,
      'explanation must NOT exist anywhere in the student HTTP response tree'
    );

    // Also inspect serialized string to ensure no accidental key exposure in text
    const serialized = JSON.stringify(body);
    assert.strictEqual(serialized.includes('"correctAnswer"'), false);
    assert.strictEqual(serialized.includes('"explanation"'), false);
  });

  it('3. should preserve student submitted answer in response payload', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const body = await res.json();
    const data = body.data || body;

    const answers = data.answers;
    assert.ok(answers);
    assert.strictEqual(answers[mcq4Options._id.toString()], 'b');
    assert.strictEqual(answers[mcq3Options._id.toString()], 'opt_1');
    assert.strictEqual(answers[mcqUnanswered._id.toString()], undefined);
  });

  it('4. should provide points awarded and faculty comment for questions', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const body = await res.json();
    const data = body.data || body;
    const qFb = data.evaluation.questionFeedback;

    assert.ok(qFb);
    assert.strictEqual(qFb[mcq4Options._id.toString()].pointsAwarded, 20);
    assert.strictEqual(qFb[mcq4Options._id.toString()].comment, 'Good understanding of HTTP caching.');

    assert.strictEqual(qFb[mcq3Options._id.toString()].pointsAwarded, 0);
    assert.strictEqual(qFb[mcq3Options._id.toString()].comment, 'Review difference between no-cache and no-store.');
  });

  it('5. should populate pointsAwarded automatically for unanswered or non-feedback MCQs', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const body = await res.json();
    const data = body.data || body;
    const qFb = data.evaluation.questionFeedback;

    const unansweredFb = qFb[mcqUnanswered._id.toString()];
    assert.ok(unansweredFb, 'Unanswered MCQ must have feedback entry in evaluation');
    assert.strictEqual(unansweredFb.pointsAwarded, 0, 'Unanswered MCQ must be awarded 0 points');
  });

  it('6. Marks calculation invariance: repeated GET calls produce identical scores and do NOT mutate database record', async () => {
    // Record DB state before calls
    const evalBefore = await Evaluation.findById(evaluationA._id).lean();

    // Call 1
    const res1 = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const body1 = await res1.json();
    const data1 = body1.data || body1;

    // Call 2
    const res2 = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const body2 = await res2.json();
    const data2 = body2.data || body2;

    // Scores must be identical on repeated calls
    assert.deepStrictEqual(data1.evaluation.questionFeedback, data2.evaluation.questionFeedback);
    assert.strictEqual(data1.finalScore, data2.finalScore);

    // Verify DB record in MongoDB was NOT mutated by read calls
    const evalAfter = await Evaluation.findById(evaluationA._id).lean();
    assert.deepStrictEqual(evalBefore.updatedAt, evalAfter.updatedAt);
    assert.deepStrictEqual(evalBefore.questionFeedback, evalAfter.questionFeedback);
  });

  it('7. should block unauthorized student B from accessing student A submission via HTTP (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /unauthorized access/i);
  });

  it('8. should block unauthenticated request without token (HTTP 401)', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`);
    assert.strictEqual(res.status, 401);
  });

  it('9. should allow instructor to view full submission data with answer keys intact', async () => {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionA._id}`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const data = body.data || body;
    assert.ok(data.assessment.questions[0].correctAnswer, 'Instructor must see correctAnswer');
  });
});
