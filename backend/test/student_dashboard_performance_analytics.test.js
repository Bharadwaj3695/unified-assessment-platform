const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const http = require('node:http');

const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Submission } = require('../src/models');
const analyticsService = require('../src/services/analytics.service');
const { hashPassword } = require('../src/utils/password');
const { generateAccessToken } = require('../src/utils/jwt');
const app = require('../src/app');

describe('Student Dashboard: Performance & Analytics Precision Verification', () => {
  let server;
  let baseUrl;

  let studentZero;      // 0 submissions
  let studentPending;   // 1 pending evaluation
  let studentPassed;    // 1 passed evaluation (85%)
  let studentZeroScore; // 1 evaluated with genuine 0%
  let studentMixed;     // 1 passed (80%) + 1 pending evaluation
  let studentMulti;     // 2 passed (90%, 80%) + 1 failed (40%)
  let studentProgress;  // 1 in_progress attempt
  let instructorUser;
  let adminUser;

  let studentZeroToken;
  let studentPendingToken;
  let studentMixedToken;
  let adminToken;

  let assessmentMath;
  let assessmentCS;

  before(async () => {
    await connectDB();
    await seedDatabase();

    const passwordHash = await hashPassword('Password123!');

    // Create unique test users
    const ts = Date.now();
    studentZero = await User.create({
      name: 'Zero Submissions Student',
      email: `zero_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-Z-${ts.toString().slice(-4)}`,
    });

    studentPending = await User.create({
      name: 'Pending Evaluation Student',
      email: `pending_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-P-${ts.toString().slice(-4)}`,
    });

    studentPassed = await User.create({
      name: 'Passed Assessment Student',
      email: `passed_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-PAS-${ts.toString().slice(-4)}`,
    });

    studentZeroScore = await User.create({
      name: 'Zero Score Evaluated Student',
      email: `zeroscore_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-ZS-${ts.toString().slice(-4)}`,
    });

    studentMixed = await User.create({
      name: 'Mixed Evaluated and Pending Student',
      email: `mixed_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-M-${ts.toString().slice(-4)}`,
    });

    studentMulti = await User.create({
      name: 'Multi Evaluated Student',
      email: `multi_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-MUL-${ts.toString().slice(-4)}`,
    });

    studentProgress = await User.create({
      name: 'In Progress Only Student',
      email: `prog_${ts}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-PRG-${ts.toString().slice(-4)}`,
    });

    instructorUser = await User.create({
      name: 'Dr. Faculty Instructor',
      email: `fac_${ts}@uap.edu`,
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: `FAC-${ts.toString().slice(-4)}`,
    });

    adminUser = await User.create({
      name: 'Dean Administrator',
      email: `dean_${ts}@uap.edu`,
      password: passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
    });

    studentZeroToken = generateAccessToken({
      id: studentZero._id.toString(),
      role: studentZero.role,
      email: studentZero.email,
    });
    studentPendingToken = generateAccessToken({
      id: studentPending._id.toString(),
      role: studentPending.role,
      email: studentPending.email,
    });
    studentMixedToken = generateAccessToken({
      id: studentMixed._id.toString(),
      role: studentMixed.role,
      email: studentMixed.email,
    });
    adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      role: adminUser.role,
      email: adminUser.email,
    });

    // Create test assessments
    assessmentMath = await Assessment.create({
      title: 'Advanced Mathematics Midterm',
      category: 'Mathematics',
      instructorId: instructorUser._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      publishedAt: new Date(),
    });

    assessmentCS = await Assessment.create({
      title: 'Computer Science Systems',
      category: 'Computer Science',
      instructorId: instructorUser._id,
      durationMinutes: 90,
      totalPoints: 100,
      passingScore: 70,
      status: 'published',
      publishedAt: new Date(),
    });

    const assessmentMath2 = await Assessment.create({
      title: 'Discrete Mathematics Finals',
      category: 'Mathematics',
      instructorId: instructorUser._id,
      durationMinutes: 75,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      publishedAt: new Date(),
    });

    const assessmentProgress = await Assessment.create({
      title: 'In-Progress Special Topic',
      category: 'Software Engineering',
      instructorId: instructorUser._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      publishedAt: new Date(),
    });

    // Seed test submissions for each scenario:

    // 1. studentZero: 0 submissions (none created)

    // 2. studentPending: 1 pending submission (subjective questions, awaiting grading)
    await Submission.create({
      studentId: studentPending._id,
      assessmentId: assessmentMath._id,
      answers: { q1: 'Subjective response' },
      status: 'submitted',
      evaluationStatus: 'pending',
      resultStatus: 'pending_evaluation',
      passed: false,
      score: null,
      percentage: null,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 3600000),
    });

    // 3. studentPassed: 1 evaluated submission that passed (85%)
    await Submission.create({
      studentId: studentPassed._id,
      assessmentId: assessmentMath._id,
      answers: { q1: 'A' },
      status: 'evaluated',
      evaluationStatus: 'completed',
      resultStatus: 'passed',
      passed: true,
      score: 85,
      percentage: 85,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 7200000),
    });

    // 4. studentZeroScore: 1 evaluated submission with legitimate 0%
    await Submission.create({
      studentId: studentZeroScore._id,
      assessmentId: assessmentMath._id,
      answers: { q1: 'Wrong' },
      status: 'evaluated',
      evaluationStatus: 'completed',
      resultStatus: 'failed',
      passed: false,
      score: 0,
      percentage: 0,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 5400000),
    });

    // 5. studentMixed: 1 passed (80%) + 1 pending evaluation
    await Submission.create({
      studentId: studentMixed._id,
      assessmentId: assessmentMath._id,
      answers: { q1: 'Correct' },
      status: 'evaluated',
      evaluationStatus: 'completed',
      resultStatus: 'passed',
      passed: true,
      score: 80,
      percentage: 80,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 86400000),
    });
    await Submission.create({
      studentId: studentMixed._id,
      assessmentId: assessmentCS._id,
      answers: { q1: 'Pending essay' },
      status: 'submitted',
      evaluationStatus: 'pending',
      resultStatus: 'pending_evaluation',
      passed: false,
      score: null,
      percentage: null,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 3600000),
    });

    // 6. studentMulti: 2 passed (90%, 80%) + 1 failed (40%)
    await Submission.create({
      studentId: studentMulti._id,
      assessmentId: assessmentMath._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      resultStatus: 'passed',
      passed: true,
      score: 90,
      percentage: 90,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 172800000),
    });
    await Submission.create({
      studentId: studentMulti._id,
      assessmentId: assessmentCS._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      resultStatus: 'failed',
      passed: false,
      score: 40,
      percentage: 40,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 86400000),
    });
    await Submission.create({
      studentId: studentMulti._id,
      assessmentId: assessmentMath2._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      resultStatus: 'passed',
      passed: true,
      score: 80,
      percentage: 80,
      totalPoints: 100,
      submittedAt: new Date(Date.now() - 3600000),
    });

    // 7. studentProgress: 1 in_progress attempt
    await Submission.create({
      studentId: studentProgress._id,
      assessmentId: assessmentProgress._id,
      answers: {},
      status: 'in_progress',
      startedAt: new Date(),
    });

    // Start HTTP server for API route tests
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // =========================================================================
  // Scenario 1: Student with Zero Submissions
  // =========================================================================
  it('1. Student with 0 submissions must return all null/zero KPIs and empty trends', async () => {
    const perf = await analyticsService.getStudentPerformance(studentZero._id, studentZero);
    assert.strictEqual(perf.assessmentsAttempted, 0);
    assert.strictEqual(perf.assessmentsCompleted, 0);
    assert.strictEqual(perf.pendingEvaluations, 0);
    assert.strictEqual(perf.evaluatedAssessments, 0);
    assert.strictEqual(perf.passedAssessments, 0);
    assert.strictEqual(perf.failedAssessments, 0);
    assert.strictEqual(perf.passRate, 0);
    assert.strictEqual(perf.overallAverageScore, null);
    assert.strictEqual(perf.hasData, false);

    const trends = await analyticsService.getStudentTrends(studentZero._id, studentZero);
    assert.strictEqual(trends.length, 0);
  });

  // =========================================================================
  // Scenario 2: Student with 1 Pending Evaluation (Awaiting Instructor Grading)
  // =========================================================================
  it('2. Student with 1 pending evaluation must NOT increment failedAssessments or lower average score', async () => {
    const perf = await analyticsService.getStudentPerformance(studentPending._id, studentPending);
    assert.strictEqual(perf.assessmentsAttempted, 1);
    assert.strictEqual(perf.assessmentsCompleted, 1);
    assert.strictEqual(perf.pendingEvaluations, 1, 'pendingEvaluations must be 1');
    assert.strictEqual(perf.evaluatedAssessments, 0, 'evaluatedAssessments must be 0');
    assert.strictEqual(perf.passedAssessments, 0, 'passedAssessments must be 0');
    assert.strictEqual(perf.failedAssessments, 0, 'CRITICAL: pending evaluation must NOT be counted as failed!');
    assert.strictEqual(perf.passRate, 0, 'passRate must be 0 when 0 evaluated');
    assert.strictEqual(perf.overallAverageScore, null, 'CRITICAL: average score must NOT be 0 or diluted!');
    assert.strictEqual(perf.hasData, false, 'hasData must be false when no finalized evaluations exist');

    const trends = await analyticsService.getStudentTrends(studentPending._id, studentPending);
    assert.strictEqual(trends.length, 0, 'getStudentTrends must NOT return pending evaluations as 0% failed dots');
  });

  // =========================================================================
  // Scenario 3: Student with 1 Passed Evaluated Submission (85%)
  // =========================================================================
  it('3. Student with 1 passed evaluated submission (85%) must report accurate KPIs and 1 trend record', async () => {
    const perf = await analyticsService.getStudentPerformance(studentPassed._id, studentPassed);
    assert.strictEqual(perf.assessmentsAttempted, 1);
    assert.strictEqual(perf.assessmentsCompleted, 1);
    assert.strictEqual(perf.pendingEvaluations, 0);
    assert.strictEqual(perf.evaluatedAssessments, 1);
    assert.strictEqual(perf.passedAssessments, 1);
    assert.strictEqual(perf.failedAssessments, 0);
    assert.strictEqual(perf.passRate, 100);
    assert.strictEqual(perf.overallAverageScore, 85);
    assert.strictEqual(perf.hasData, true);

    const trends = await analyticsService.getStudentTrends(studentPassed._id, studentPassed);
    assert.strictEqual(trends.length, 1, 'Must return exactly 1 trend record for single evaluated attempt');
    assert.strictEqual(trends[0].percentage, 85);
    assert.strictEqual(trends[0].passed, true);
    assert.strictEqual(trends[0].resultStatus, 'passed');
  });

  // =========================================================================
  // Scenario 4: Student with 1 Evaluated Submission Legitimate 0%
  // =========================================================================
  it('4. Student with legitimate 0% evaluated score must preserve 0% as valid number, not null', async () => {
    const perf = await analyticsService.getStudentPerformance(studentZeroScore._id, studentZeroScore);
    assert.strictEqual(perf.assessmentsAttempted, 1);
    assert.strictEqual(perf.assessmentsCompleted, 1);
    assert.strictEqual(perf.pendingEvaluations, 0);
    assert.strictEqual(perf.evaluatedAssessments, 1);
    assert.strictEqual(perf.passedAssessments, 0);
    assert.strictEqual(perf.failedAssessments, 1);
    assert.strictEqual(perf.passRate, 0);
    assert.strictEqual(perf.overallAverageScore, 0, 'Genuine 0% must be preserved as 0, not converted to null');
    assert.strictEqual(perf.hasData, true);

    const trends = await analyticsService.getStudentTrends(studentZeroScore._id, studentZeroScore);
    assert.strictEqual(trends.length, 1);
    assert.strictEqual(trends[0].percentage, 0);
    assert.strictEqual(trends[0].passed, false);
    assert.strictEqual(trends[0].resultStatus, 'failed');
  });

  // =========================================================================
  // Scenario 5: Student with 1 Passed (80%) + 1 Pending Evaluation
  // =========================================================================
  it('5. Student with 1 passed (80%) and 1 pending must keep average at 80% (NOT diluted to 40%)', async () => {
    const perf = await analyticsService.getStudentPerformance(studentMixed._id, studentMixed);
    assert.strictEqual(perf.assessmentsAttempted, 2);
    assert.strictEqual(perf.assessmentsCompleted, 2);
    assert.strictEqual(perf.pendingEvaluations, 1, '1 submission awaiting evaluation');
    assert.strictEqual(perf.evaluatedAssessments, 1, 'Only 1 finalized evaluated submission');
    assert.strictEqual(perf.passedAssessments, 1);
    assert.strictEqual(perf.failedAssessments, 0, 'Pending attempt must NOT count as failed!');
    assert.strictEqual(perf.passRate, 100, 'Pass rate must be 100% (1/1 evaluated)');
    assert.strictEqual(perf.overallAverageScore, 80, 'Average score must be 80% (NOT (80+0)/2 = 40%)');
    assert.strictEqual(perf.hasData, true);

    const trends = await analyticsService.getStudentTrends(studentMixed._id, studentMixed);
    assert.strictEqual(trends.length, 1, 'Only the finalized evaluated attempt should appear in trends');
    assert.strictEqual(trends[0].percentage, 80);
    assert.strictEqual(trends[0].passed, true);
  });

  // =========================================================================
  // Scenario 6: Student with Multiple Evaluated Submissions (90%, 40%, 80%)
  // =========================================================================
  it('6. Student with multiple evaluated submissions must calculate accurate pass rate and average', async () => {
    const perf = await analyticsService.getStudentPerformance(studentMulti._id, studentMulti);
    assert.strictEqual(perf.assessmentsAttempted, 3);
    assert.strictEqual(perf.assessmentsCompleted, 3);
    assert.strictEqual(perf.pendingEvaluations, 0);
    assert.strictEqual(perf.evaluatedAssessments, 3);
    assert.strictEqual(perf.passedAssessments, 2);
    assert.strictEqual(perf.failedAssessments, 1);
    assert.strictEqual(perf.passRate, 67, 'Pass rate: 2/3 = 67%');
    assert.strictEqual(perf.overallAverageScore, 70, 'Average: (90 + 40 + 80) / 3 = 70%');

    const trends = await analyticsService.getStudentTrends(studentMulti._id, studentMulti);
    assert.strictEqual(trends.length, 3);
    assert.strictEqual(trends[0].percentage, 90);
    assert.strictEqual(trends[1].percentage, 40);
    assert.strictEqual(trends[2].percentage, 80);
  });

  // =========================================================================
  // Scenario 7: In-Progress Attempt Exclusion
  // =========================================================================
  it('7. In-progress submissions must be counted in attempted, but excluded from completed/evaluated/trends', async () => {
    const perf = await analyticsService.getStudentPerformance(studentProgress._id, studentProgress);
    assert.strictEqual(perf.assessmentsAttempted, 1, 'Attempted count includes in_progress');
    assert.strictEqual(perf.assessmentsCompleted, 0);
    assert.strictEqual(perf.pendingEvaluations, 0);
    assert.strictEqual(perf.evaluatedAssessments, 0);
    assert.strictEqual(perf.passedAssessments, 0);
    assert.strictEqual(perf.failedAssessments, 0);
    assert.strictEqual(perf.overallAverageScore, null);
    assert.strictEqual(perf.hasData, false);

    const trends = await analyticsService.getStudentTrends(studentProgress._id, studentProgress);
    assert.strictEqual(trends.length, 0);
  });

  // =========================================================================
  // Scenario 8: Category Breakdown Isolates Pending from Failed
  // =========================================================================
  it('8. Category breakdown must not treat pending evaluations as failed or dilute category average', async () => {
    const perf = await analyticsService.getStudentPerformance(studentMixed._id, studentMixed);
    const mathCat = perf.categoryPerformance.find((c) => c.category === 'Mathematics');
    const csCat = perf.categoryPerformance.find((c) => c.category === 'Computer Science');

    assert.ok(mathCat, 'Mathematics category entry must exist');
    assert.strictEqual(mathCat.evaluatedAssessments, 1);
    assert.strictEqual(mathCat.averageScore, 80);
    assert.strictEqual(mathCat.passRate, 100);

    assert.ok(csCat, 'Computer Science category entry must exist');
    assert.strictEqual(csCat.assessmentsAttempted, 1);
    assert.strictEqual(csCat.assessmentsCompleted, 1);
    assert.strictEqual(csCat.pendingEvaluations, 1);
    assert.strictEqual(csCat.evaluatedAssessments, 0);
    assert.strictEqual(csCat.averageScore, 0);
    assert.strictEqual(csCat.passRate, 0);
  });

  // =========================================================================
  // Scenario 9: Recent Results Format Sanitization for Pending vs Evaluated
  // =========================================================================
  it('9. Recent results must set score: null, percentage: null, passed: null for pending submissions', async () => {
    const perf = await analyticsService.getStudentPerformance(studentMixed._id, studentMixed);
    assert.strictEqual(perf.recentResults.length, 2);

    const pendingResult = perf.recentResults.find((r) => r.resultStatus === 'pending_evaluation');
    assert.ok(pendingResult, 'Pending evaluation must be identifiable in recentResults');
    assert.strictEqual(pendingResult.score, null);
    assert.strictEqual(pendingResult.percentage, null);
    assert.strictEqual(pendingResult.passed, null);
    assert.strictEqual(pendingResult.status, 'submitted');

    const evaluatedResult = perf.recentResults.find((r) => r.resultStatus === 'passed');
    assert.ok(evaluatedResult, 'Evaluated result must exist');
    assert.strictEqual(evaluatedResult.score, 80);
    assert.strictEqual(evaluatedResult.percentage, 80);
    assert.strictEqual(evaluatedResult.passed, true);
  });

  // =========================================================================
  // Scenario 10: Chronological Score Trends Sorted Ascending
  // =========================================================================
  it('10. Score trends must be sorted ascending by date for correct timeline visualization', async () => {
    const trends = await analyticsService.getStudentTrends(studentMulti._id, studentMulti);
    assert.strictEqual(trends.length, 3);
    const t0 = new Date(trends[0].timestamp).getTime();
    const t1 = new Date(trends[1].timestamp).getTime();
    const t2 = new Date(trends[2].timestamp).getTime();
    assert.ok(t0 <= t1, 'Trend 0 must be chronologically earlier than or equal to Trend 1');
    assert.ok(t1 <= t2, 'Trend 1 must be chronologically earlier than or equal to Trend 2');
  });

  // =========================================================================
  // Scenario 11: RBAC Student Isolation
  // =========================================================================
  it('11. Student cannot access another student performance analytics (RBAC 403)', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getStudentPerformance(studentMulti._id, studentZero);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );
  });

  // =========================================================================
  // Scenario 12: Admin Access to Any Student Analytics
  // =========================================================================
  it('12. Administrator can access any student performance analytics', async () => {
    const perf = await analyticsService.getStudentPerformance(studentMulti._id, adminUser);
    assert.ok(perf);
    assert.strictEqual(perf.evaluatedAssessments, 3);
    assert.strictEqual(perf.overallAverageScore, 70);
  });

  // =========================================================================
  // Scenario 13: HTTP GET /api/analytics/student/performance
  // =========================================================================
  it('13. HTTP: GET /api/analytics/student/performance returns updated metrics payload', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/student/performance`, {
      headers: {
        Authorization: `Bearer ${studentMixedToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const data = body.data;

    assert.strictEqual(data.assessmentsAttempted, 2);
    assert.strictEqual(data.assessmentsCompleted, 2);
    assert.strictEqual(data.pendingEvaluations, 1);
    assert.strictEqual(data.evaluatedAssessments, 1);
    assert.strictEqual(data.passedAssessments, 1);
    assert.strictEqual(data.failedAssessments, 0);
    assert.strictEqual(data.overallAverageScore, 80);
    assert.strictEqual(data.passRate, 100);
  });

  // =========================================================================
  // Scenario 14: HTTP GET /api/analytics/student/trends
  // =========================================================================
  it('14. HTTP: GET /api/analytics/student/trends returns only evaluated records', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/student/trends`, {
      headers: {
        Authorization: `Bearer ${studentMixedToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const trends = body.data;

    assert.strictEqual(trends.length, 1);
    assert.strictEqual(trends[0].percentage, 80);
    assert.strictEqual(trends[0].passed, true);
  });
});
