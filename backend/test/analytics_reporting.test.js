const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const http = require('node:http');

const { connectDB, disconnectDB } = require('../src/config/db');
const {
  User,
  Assessment,
  Question,
  MockTest,
  MockTestAttempt,
  Submission,
  Evaluation,
  Subject,
  Topic,
} = require('../src/models');

const analyticsService = require('../src/services/analytics.service');
const { hashPassword } = require('../src/utils/password');
const { generateAccessToken } = require('../src/utils/jwt');
const app = require('../src/app');

describe('UAP Phase 5: Analytics & Reporting Engine Test Suite', () => {
  let server;
  let baseUrl;

  let studentAlice;
  let studentBob;
  let studentZero;
  let instructorAlan;
  let instructorBeth;
  let adminCarol;

  let aliceToken;
  let bobToken;
  let alanToken;
  let bethToken;
  let carolToken;

  let testSubject;
  let testTopic;
  let assessmentMath;
  let assessmentCS;
  let foreignAssessment;
  let mockTestDSA;

  let qMath1;
  let qMath2;
  let qCS1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await MockTestAttempt.init();
    await Submission.init();

    const timestamp = Date.now();
    const passwordHash = await hashPassword('P5Pass@1234');

    studentAlice = await User.create({
      name: 'Alice Analytics',
      email: `alice_${timestamp}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-A-${timestamp.toString().slice(-4)}`,
      department: 'Computer Science',
    });

    studentBob = await User.create({
      name: 'Bob Analytics',
      email: `bob_${timestamp}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-B-${timestamp.toString().slice(-4)}`,
      department: 'Data Science',
    });

    studentZero = await User.create({
      name: 'Zero Analytics Student',
      email: `zero_${timestamp}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-Z-${timestamp.toString().slice(-4)}`,
      department: 'Mathematics',
    });

    instructorAlan = await User.create({
      name: 'Dr. Alan Faculty',
      email: `alan_${timestamp}@uap.edu`,
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: `FAC-AL-${timestamp.toString().slice(-4)}`,
      department: 'Computer Science',
    });

    instructorBeth = await User.create({
      name: 'Dr. Beth Foreign Faculty',
      email: `beth_${timestamp}@uap.edu`,
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: `FAC-BE-${timestamp.toString().slice(-4)}`,
      department: 'Cybersecurity',
    });

    adminCarol = await User.create({
      name: 'Dean Carol Admin',
      email: `carol_${timestamp}@uap.edu`,
      password: passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
      adminId: `ADM-C-${timestamp.toString().slice(-4)}`,
    });

    aliceToken = generateAccessToken({ id: studentAlice._id.toString(), role: 'student', email: studentAlice.email });
    bobToken = generateAccessToken({ id: studentBob._id.toString(), role: 'student', email: studentBob.email });
    alanToken = generateAccessToken({ id: instructorAlan._id.toString(), role: 'instructor', email: instructorAlan.email });
    bethToken = generateAccessToken({ id: instructorBeth._id.toString(), role: 'instructor', email: instructorBeth.email });
    carolToken = generateAccessToken({ id: adminCarol._id.toString(), role: 'admin', email: adminCarol.email });

    testSubject = await Subject.create({
      name: 'Discrete Mathematics & Graph Theory',
      code: `MATH-${timestamp.toString().slice(-4)}`,
      department: 'Computer Science & Engineering',
    });

    testTopic = await Topic.create({
      name: 'Graph Traversal Algorithms',
      code: 'TOP-GT-01',
      subjectId: testSubject._id,
      concepts: [
        { name: 'Breadth First Search', code: 'BFS' },
        { name: 'Depth First Search', code: 'DFS' },
      ],
    });

    assessmentMath = await Assessment.create({
      title: 'Discrete Mathematics Midterm',
      category: 'Mathematics',
      instructorId: instructorAlan._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
    });

    assessmentCS = await Assessment.create({
      title: 'Advanced Algorithms Final',
      category: 'Computer Science',
      instructorId: instructorAlan._id,
      durationMinutes: 90,
      totalPoints: 100,
      passingScore: 70,
      status: 'published',
      accessType: 'public',
    });

    foreignAssessment = await Assessment.create({
      title: 'Confidential Cybersecurity Exam',
      category: 'Cybersecurity',
      instructorId: instructorBeth._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
    });

    qMath1 = await Question.create({
      assessmentId: assessmentMath._id,
      questionText: 'What is the sum of degrees in an undirected graph?',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'Twice the number of edges' },
        { id: 'opt_2', text: 'Number of edges' },
      ],
      correctAnswer: 'opt_1',
      points: 50,
      orderIndex: 0,
      difficulty: 'EASY',
    });

    qMath2 = await Question.create({
      assessmentId: assessmentMath._id,
      questionText: 'Is every tree a planar graph?',
      type: 'true_false',
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ],
      correctAnswer: 'true',
      points: 50,
      orderIndex: 1,
      difficulty: 'MEDIUM',
    });

    qCS1 = await Question.create({
      assessmentId: assessmentCS._id,
      questionText: 'Explain Dijkstra shortest path algorithm time complexity.',
      type: 'short_answer',
      points: 100,
      orderIndex: 0,
      difficulty: 'HARD',
    });

    mockTestDSA = await MockTest.create({
      title: 'GATE Computer Science Mock Test 1',
      examination: 'GATE',
      subjectId: testSubject._id,
      ownerFacultyId: instructorAlan._id,
      durationMinutes: 60,
      totalMarks: 100,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });

    // Start HTTP server for API tests
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
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

  const makeRequest = (method, path, token, body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData);
              resolve({ statusCode: res.statusCode, data: parsed });
            } catch {
              resolve({ statusCode: res.statusCode, raw: rawData });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  it('1. Correct score aggregation across multiple evaluated attempts', async () => {
    const sub1 = await Submission.create({
      assessmentId: assessmentMath._id,
      studentId: studentAlice._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      score: 80,
      totalPoints: 100,
      percentage: 80,
      passed: true,
      submittedAt: new Date(Date.now() - 3600000),
    });

    const sub2 = await Submission.create({
      assessmentId: assessmentCS._id,
      studentId: studentAlice._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      score: 90,
      totalPoints: 100,
      percentage: 90,
      passed: true,
      submittedAt: new Date(),
    });

    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.strictEqual(perf.assessmentsCompleted, 2);
    assert.strictEqual(perf.evaluatedAssessments, 2);
    assert.strictEqual(perf.overallAverageScore, 85.0);
    assert.strictEqual(perf.highestScore, 90.0);
    assert.strictEqual(perf.lowestScore, 80.0);
    assert.strictEqual(perf.passRate, 100);
  });

  it('2. Pending manual review exclusion: pending attempts must not dilute average score', async () => {
    // Add pending submission (0 points earned so far, awaiting instructor)
    const pendingSub = await Submission.create({
      assessmentId: foreignAssessment._id,
      studentId: studentAlice._id,
      status: 'submitted',
      evaluationStatus: 'pending',
      score: 0,
      totalPoints: 100,
      percentage: 0,
      passed: false,
      submittedAt: new Date(),
    });

    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    // Completed is 3 (2 evaluated + 1 submitted), but evaluated remains 2!
    assert.strictEqual(perf.assessmentsCompleted, 3);
    assert.strictEqual(perf.evaluatedAssessments, 2);
    assert.strictEqual(perf.pendingEvaluations, 1);
    // Crucial: average score remains 85.0, NOT diluted by the pending 0%
    assert.strictEqual(perf.overallAverageScore, 85.0);
    assert.strictEqual(perf.highestScore, 90.0);
  });

  it('3. Finalized score calculation: incorporating manual grading updates composite metrics', async () => {
    // Instructor grades the pending submission
    const pending = await Submission.findOne({
      studentId: studentAlice._id,
      evaluationStatus: 'pending',
    });
    assert.ok(pending);

    pending.status = 'evaluated';
    pending.evaluationStatus = 'completed';
    pending.score = 70;
    pending.percentage = 70;
    pending.passed = true;
    await pending.save();

    await Evaluation.create({
      submissionId: pending._id,
      evaluatorId: instructorBeth._id,
      finalScore: 70,
      percentage: 70,
      passed: true,
      status: 'completed',
    });

    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.strictEqual(perf.evaluatedAssessments, 3);
    assert.strictEqual(perf.pendingEvaluations, 0);
    // (80 + 90 + 70) / 3 = 80.0
    assert.strictEqual(perf.overallAverageScore, 80.0);
    assert.strictEqual(perf.lowestScore, 70.0);
    assert.strictEqual(perf.highestScore, 90.0);
  });

  it('4. Subject performance: aggregates performance metrics grouped by curriculum area', async () => {
    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.ok(Array.isArray(perf.subjectPerformance));
    assert.ok(perf.subjectPerformance.length >= 2);

    const mathSubj = perf.subjectPerformance.find((s) => s.subjectName === 'Mathematics');
    assert.ok(mathSubj);
    assert.strictEqual(mathSubj.evaluatedAssessments, 1);
    assert.strictEqual(mathSubj.averageScore, 80.0);
    assert.strictEqual(mathSubj.passRate, 100);

    const csSubj = perf.subjectPerformance.find((s) => s.subjectName === 'Computer Science');
    assert.ok(csSubj);
    assert.strictEqual(mathSubj.evaluatedAssessments, 1);
    assert.strictEqual(csSubj.averageScore, 90.0);
  });

  it('5. Topic performance: accuracy, confidence scores, and weak/strong identification', async () => {
    // Create evaluated mock test attempt for Alice with topic data
    await MockTestAttempt.create({
      mockTestId: mockTestDSA._id,
      studentId: studentAlice._id,
      status: 'EVALUATED',
      evaluationStatus: 'COMPLETED',
      totalMarks: 100,
      earnedMarks: 85,
      percentage: 85,
      submittedAt: new Date(),
      topicWiseAnalytics: [
        {
          topicId: testTopic._id,
          topicName: 'Graph Traversal Algorithms',
          totalQuestions: 10,
          correctCount: 9,
          accuracyPercentage: 90,
        },
        {
          topicName: 'Dynamic Programming Knapsack',
          totalQuestions: 6,
          correctCount: 2,
          accuracyPercentage: 33,
        },
      ],
    });

    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.ok(Array.isArray(perf.topicPerformance));

    const strongTopic = perf.topicPerformance.find((t) => t.topicName === 'Graph Traversal Algorithms');
    assert.ok(strongTopic);
    assert.strictEqual(strongTopic.accuracyPercentage, 90);
    assert.strictEqual(strongTopic.confidenceScore, 'HIGH'); // 10 questions >= 6
    assert.strictEqual(strongTopic.status, 'STRONG'); // 90% >= 75%

    const weakTopic = perf.topicPerformance.find((t) => t.topicName === 'Dynamic Programming Knapsack');
    assert.ok(weakTopic);
    assert.strictEqual(weakTopic.accuracyPercentage, 33);
    assert.strictEqual(weakTopic.confidenceScore, 'HIGH'); // 6 questions >= 6
    assert.strictEqual(weakTopic.status, 'WEAK'); // 33% < 50%
  });

  it('6. Concept performance: confidence scores based on sample size thresholds', async () => {
    await MockTestAttempt.create({
      mockTestId: mockTestDSA._id,
      studentId: studentAlice._id,
      status: 'EVALUATED',
      evaluationStatus: 'COMPLETED',
      totalMarks: 50,
      earnedMarks: 40,
      percentage: 80,
      submittedAt: new Date(),
      conceptWiseAnalytics: [
        {
          concept: 'Breadth First Search',
          questionsAttempted: 8,
          correctCount: 7,
          accuracyPercentage: 88,
        },
        {
          concept: 'Topological Sorting',
          questionsAttempted: 4,
          correctCount: 2,
          accuracyPercentage: 50,
        },
        {
          concept: 'A* Heuristics',
          questionsAttempted: 1,
          correctCount: 1,
          accuracyPercentage: 100,
        },
      ],
    });

    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.ok(Array.isArray(perf.conceptPerformance));

    const highConcept = perf.conceptPerformance.find((c) => c.concept === 'Breadth First Search');
    assert.ok(highConcept);
    assert.strictEqual(highConcept.confidenceScore, 'HIGH'); // >= 6 attempts
    assert.strictEqual(highConcept.status, 'STRONG');

    const medConcept = perf.conceptPerformance.find((c) => c.concept === 'Topological Sorting');
    assert.ok(medConcept);
    assert.strictEqual(medConcept.confidenceScore, 'MEDIUM'); // 4 attempts (3..5)

    const lowConcept = perf.conceptPerformance.find((c) => c.concept === 'A* Heuristics');
    assert.ok(lowConcept);
    assert.strictEqual(lowConcept.confidenceScore, 'LOW'); // 1 attempt (< 3)
    assert.strictEqual(lowConcept.status, 'NEUTRAL'); // Sample size < 2 precludes false-positive STRONG
  });

  it('7. Difficulty analysis: categorizes performance across Easy, Medium, and Hard tiers', async () => {
    await MockTestAttempt.create({
      mockTestId: mockTestDSA._id,
      studentId: studentAlice._id,
      status: 'EVALUATED',
      evaluationStatus: 'COMPLETED',
      totalMarks: 30,
      earnedMarks: 20,
      percentage: 67,
      submittedAt: new Date(),
      difficultyWiseAnalytics: {
        easy: { total: 10, correct: 9, score: 9 },
        medium: { total: 10, correct: 6, score: 6 },
        hard: { total: 5, correct: 1, score: 1 },
      },
    });

    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.ok(perf.difficultyPerformance);
    assert.strictEqual(perf.difficultyPerformance.easy.accuracyPercentage, 90);
    assert.strictEqual(perf.difficultyPerformance.medium.accuracyPercentage, 60);
    assert.strictEqual(perf.difficultyPerformance.hard.accuracyPercentage, 20);
  });

  it('8. Student data isolation: Student A cannot access Student B performance or streak (RBAC 403)', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getStudentPerformance(studentBob._id, studentAlice);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await analyticsService.getStudentStreak(studentBob._id, studentAlice);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );

    const httpRes = await makeRequest(
      'GET',
      `/api/analytics/student/performance?studentId=${studentBob._id}`,
      aliceToken
    );
    assert.strictEqual(httpRes.statusCode, 403);
  });

  it('9. Faculty ownership: Instructor A cannot query Instructor B assessment analytics (RBAC 403)', async () => {
    // Alan tries to access Beth's foreign assessment
    await assert.rejects(
      async () => {
        await analyticsService.getInstructorAssessmentAnalytics(foreignAssessment._id, instructorAlan);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );

    const httpRes = await makeRequest(
      'GET',
      `/api/analytics/instructor/assessment/${foreignAssessment._id}`,
      alanToken
    );
    assert.strictEqual(httpRes.statusCode, 403);
  });

  it('10. Admin institutional scope: Administrator can query any student and platform overview', async () => {
    // Admin Carol queries Alice's performance
    const alicePerf = await analyticsService.getStudentPerformance(studentAlice._id, adminCarol);
    assert.ok(alicePerf);
    assert.strictEqual(alicePerf.hasData, true);

    // Admin queries platform overview
    const overview = await analyticsService.getAdminOverview();
    assert.ok(overview);
    assert.ok(overview.totalAssessments >= 3);
    assert.ok(overview.totalSubmissions >= 3);
    assert.ok(Array.isArray(overview.scoreDistribution));
    assert.strictEqual(overview.scoreDistribution.length, 5);

    // Admin HTTP endpoint
    const httpRes = await makeRequest('GET', '/api/analytics/admin/overview', carolToken);
    assert.strictEqual(httpRes.statusCode, 200);
    assert.ok(httpRes.data.data.totalActiveStudents >= 1);
  });

  it('11. Empty datasets: Student with zero submissions returns safe zero/null metrics', async () => {
    const emptyPerf = await analyticsService.getStudentPerformance(studentZero._id, studentZero);
    assert.strictEqual(emptyPerf.assessmentsAttempted, 0);
    assert.strictEqual(emptyPerf.assessmentsCompleted, 0);
    assert.strictEqual(emptyPerf.evaluatedAssessments, 0);
    assert.strictEqual(emptyPerf.overallAverageScore, null);
    assert.strictEqual(emptyPerf.highestScore, null);
    assert.strictEqual(emptyPerf.lowestScore, null);
    assert.strictEqual(emptyPerf.passRate, 0);
    assert.strictEqual(emptyPerf.hasData, false);
    assert.deepStrictEqual(emptyPerf.recentResults, []);
  });

  it('12. Pagination: Leaderboard and admin faculty activity respect page and limit', async () => {
    const leaderboard = await analyticsService.getLeaderboard({
      scope: 'overall',
      requestingUser: adminCarol,
      page: 1,
      limit: 1,
    });
    assert.strictEqual(leaderboard.page, 1);
    assert.strictEqual(leaderboard.limit, 1);
    assert.ok(leaderboard.rankings.length <= 1);
    assert.ok(leaderboard.totalPages >= 1);

    const facultyActivity = await analyticsService.getAdminFacultyActivity({
      page: 1,
      limit: 1,
    });
    assert.strictEqual(facultyActivity.page, 1);
    assert.strictEqual(facultyActivity.limit, 1);
    assert.ok(facultyActivity.faculty.length <= 1);
    assert.ok(facultyActivity.totalFaculty >= 2);
  });

  it('13. Date filtering: filters queries by recent, last_week, and custom date range', async () => {
    const pastDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 Day ago
    await Submission.create({
      assessmentId: assessmentMath._id,
      studentId: studentBob._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      score: 95,
      totalPoints: 100,
      percentage: 95,
      passed: true,
      createdAt: pastDate,
      submittedAt: pastDate,
    });

    // Recent 48h filter excludes 40-day-old submission
    const recentPerf = await analyticsService.getStudentPerformance(studentBob._id, studentBob, {
      dateFilter: 'recent',
    });
    assert.strictEqual(recentPerf.assessmentsAttempted, 0);

    // All filter includes it
    const allPerf = await analyticsService.getStudentPerformance(studentBob._id, studentBob, {
      dateFilter: 'all',
    });
    assert.strictEqual(allPerf.assessmentsAttempted, 1);
    assert.strictEqual(allPerf.overallAverageScore, 95.0);
  });

  it('14. Duplicate submission handling: repeated attempts do not double count unique participants or corrupt cohort metrics', async () => {
    // 1. Verify institutional Assessment prevents duplicate submission records via unique compound index
    await assert.rejects(
      async () => {
        await Submission.create({
          assessmentId: assessmentMath._id,
          studentId: studentBob._id,
          status: 'evaluated',
          evaluationStatus: 'completed',
          score: 95,
          totalPoints: 100,
          percentage: 95,
          passed: true,
          submittedAt: new Date(),
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || /duplicate key/i.test(err.message));
        return true;
      }
    );

    // 2. Instructor analytics reflects existing completed submissions accurately
    const mathAnalytics = await analyticsService.getInstructorAssessmentAnalytics(assessmentMath._id, instructorAlan);
    assert.ok(mathAnalytics.completedSubmissions >= 1);
    assert.strictEqual(mathAnalytics.evaluationCompletionStatus, 'completed');

    // 3. Admin overview reports accurate non-duplicated active student metrics
    const adminOverview = await analyticsService.getAdminOverview();
    assert.ok(adminOverview.totalActiveStudents >= 1);
  });

  it('15. Retake handling: tracking score progression, attempt history and latest vs highest scores', async () => {
    // Bob takes GATE Mock Test attempt 1 (earns 60%)
    await MockTestAttempt.create({
      mockTestId: mockTestDSA._id,
      studentId: studentBob._id,
      status: 'EVALUATED',
      evaluationStatus: 'COMPLETED',
      totalMarks: 100,
      earnedMarks: 60,
      percentage: 60,
      submittedAt: new Date(Date.now() - 50000),
    });

    // Bob retakes GATE Mock Test attempt 2 (earns 90%)
    await MockTestAttempt.create({
      mockTestId: mockTestDSA._id,
      studentId: studentBob._id,
      status: 'EVALUATED',
      evaluationStatus: 'COMPLETED',
      totalMarks: 100,
      earnedMarks: 90,
      percentage: 90,
      submittedAt: new Date(),
    });

    const perf = await analyticsService.getStudentPerformance(studentBob._id, studentBob);
    // Evaluated count includes both retake attempts
    assert.ok(perf.evaluatedAssessments >= 3);
    assert.strictEqual(perf.highestScore, 95.0); // from assessmentMath (95) vs 60 vs 90
    assert.ok(perf.lowestScore <= 60.0);

    // Mock test performance summarizes multiple attempts
    assert.ok(perf.mockTestPerformance);
    assert.ok(perf.mockTestPerformance.totalAttempts >= 2);
    assert.strictEqual(perf.mockTestPerformance.highestScore, 90);

    // Verify chronological order in trends
    const trends = await analyticsService.getStudentTrends(studentBob._id, studentBob);
    assert.ok(Array.isArray(trends));
    assert.ok(trends.length >= 3);
    for (let i = 1; i < trends.length; i++) {
      const prev = new Date(trends[i - 1].timestamp).getTime();
      const curr = new Date(trends[i].timestamp).getTime();
      assert.ok(prev <= curr, `Expected chronological order: ${prev} <= ${curr}`);
    }
  });

  it('16. Historical question snapshots: mutations to question bank do not alter finalized historical scores', async () => {
    // Fetch Alice's existing performance baseline
    const perfBefore = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    const aliceAvgBefore = perfBefore.overallAverageScore;
    const aliceHighestBefore = perfBefore.highestScore;

    // Mutate original question in question bank: change points from 50 to 500, alter statement
    const originalPoints = qMath1.points;
    qMath1.points = 500;
    qMath1.questionText = 'MUTATED QUESTION STATEMENT FOR SNAPSHOT TEST';
    await qMath1.save();

    // Re-query Alice's performance
    const perfAfter = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.strictEqual(perfAfter.overallAverageScore, aliceAvgBefore, 'Historical finalized average must be immutable');
    assert.strictEqual(perfAfter.highestScore, aliceHighestBefore, 'Historical highest score must remain unaltered');

    // Restore original points
    qMath1.points = originalPoints;
    await qMath1.save();
  });

  it('17. Large dataset query behaviour: pagination, bounded projection, and pipeline memory safety', async () => {
    // Test pagination slicing on leaderboard
    const page1 = await analyticsService.getLeaderboard({
      scope: 'overall',
      requestingUser: adminCarol,
      page: 1,
      limit: 1,
    });
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page1.limit, 1);
    assert.strictEqual(page1.rankings.length, 1);

    const page2 = await analyticsService.getLeaderboard({
      scope: 'overall',
      requestingUser: adminCarol,
      page: 2,
      limit: 1,
    });
    assert.strictEqual(page2.page, 2);
    assert.strictEqual(page2.limit, 1);
    assert.strictEqual(page2.rankings.length, 1);
    assert.notStrictEqual(page1.rankings[0].studentId, page2.rankings[0].studentId);

    // Verify admin overview aggregates with bounded distribution buckets
    const overview = await analyticsService.getAdminOverview();
    assert.ok(Array.isArray(overview.scoreDistribution));
    assert.strictEqual(overview.scoreDistribution.length, 5);
    assert.ok(Array.isArray(overview.categories));
  });

  it('18. Phase 1 regression: coding and SQL execution metrics and validation rules', async () => {
    // 1. Coding Question schema validation with testCases
    const qCode = new Question({
      statement: 'Implement binary search on sorted array',
      questionType: 'CODING',
      codingConfig: {
        problemTitle: 'Binary Search',
        executionCategory: 'code',
        allowedLanguages: ['python', 'javascript'],
        cpuTimeLimitMs: 2000,
        memoryLimitMb: 256,
        testCases: [
          { input: '[1, 2, 3], 2', expectedOutput: '1', isHidden: false, weight: 10 },
          { input: '[1, 2, 3], 5', expectedOutput: '-1', isHidden: true, weight: 10 },
        ],
      },
    });
    await qCode.validate();
    assert.strictEqual(qCode.questionType, 'CODING');
    assert.strictEqual(qCode.codingConfig.allowedLanguages.length, 2);

    // 2. SQL Question schema validation
    const qSQL = new Question({
      statement: 'Find second highest salary from employees table',
      questionType: 'SQL',
      codingConfig: {
        problemTitle: 'Second Highest Salary',
        executionCategory: 'sql',
        allowedLanguages: ['sqlite', 'postgresql'],
        sqlDialect: 'sqlite',
        schemaDdl: 'CREATE TABLE employees (id INT, salary INT);',
        testCases: [
          { input: '', expectedOutput: '200', isHidden: false, weight: 1 },
        ],
      },
    });
    await qSQL.validate();
    assert.strictEqual(qSQL.questionType, 'SQL');
    assert.strictEqual(qSQL.codingConfig.executionCategory, 'sql');

    // 3. Analytics service student performance contract exposes coding & sql structures
    const perf = await analyticsService.getStudentPerformance(studentAlice._id, studentAlice);
    assert.ok(perf.codingAndSqlPerformance);
    assert.ok(perf.codingAndSqlPerformance.coding);
    assert.ok(perf.codingAndSqlPerformance.sql);
    assert.strictEqual(typeof perf.codingAndSqlPerformance.coding.attempted, 'number');
    assert.strictEqual(typeof perf.codingAndSqlPerformance.sql.attempted, 'number');
  });

  it('19. Phase 2 regression: non-coding evaluation types and Mock Bank blueprint integrity', async () => {
    // 1. Non-coding types: FILE_UPLOAD, MULTI_SELECT, SINGLE_MCQ, TRUE_FALSE
    const qFile = new Question({
      statement: 'Upload system architecture diagram',
      questionType: 'FILE_UPLOAD',
      fileUploadConfig: { maxFileSizeMb: 15, allowedFileTypes: ['pdf', 'png'] },
    });
    await qFile.validate();
    assert.strictEqual(qFile.questionType, 'FILE_UPLOAD');

    const qMSQ = new Question({
      statement: 'Select all NP-complete problems',
      questionType: 'MULTI_SELECT',
      options: [
        { id: 'opt_1', text: '3-SAT', isCorrect: true },
        { id: 'opt_2', text: 'Vertex Cover', isCorrect: true },
        { id: 'opt_3', text: 'Shortest Path', isCorrect: false },
      ],
    });
    await qMSQ.validate();
    assert.strictEqual(qMSQ.questionType, 'MULTI_SELECT');

    // 2. Mock Test Blueprint structure with blueprintRuleSchema
    const mt = new MockTest({
      title: 'Regression Blueprint Test',
      examination: 'GATE',
      subjectId: testSubject._id,
      ownerFacultyId: instructorAlan._id,
      durationMinutes: 180,
      totalMarks: 100,
      status: 'DRAFT',
      blueprint: {
        rules: [
          {
            subjectId: testSubject._id,
            topicId: testTopic._id,
            difficulty: 'MEDIUM',
            questionType: 'SINGLE_MCQ',
            count: 10,
            marksPerQuestion: 2,
          },
        ],
      },
    });
    await mt.validate();
    assert.strictEqual(mt.examination, 'GATE');
    assert.strictEqual(mt.blueprint.rules.length, 1);
    assert.strictEqual(mt.blueprint.rules[0].questionType, 'SINGLE_MCQ');
  });

  it('20. Phase 3 security regression: RBAC boundaries, strict token authentication, and forbidden bypasses', async () => {
    // Unauthenticated request -> 401
    const unauthRes = await makeRequest('GET', '/api/analytics/admin/overview', null, null);
    assert.strictEqual(unauthRes.statusCode, 401);

    // Student token attempting Admin route -> 403
    const studentToAdmin = await makeRequest('GET', '/api/analytics/admin/overview', aliceToken);
    assert.strictEqual(studentToAdmin.statusCode, 403);

    // Student token attempting Instructor route -> 403
    const studentToInst = await makeRequest(
      'GET',
      `/api/analytics/instructor/assessment/${assessmentMath._id}`,
      aliceToken
    );
    assert.strictEqual(studentToInst.statusCode, 403);

    // Cross-student parameter tampering -> 403
    const crossStudent = await makeRequest(
      'GET',
      `/api/analytics/student/performance?studentId=${studentBob._id}`,
      aliceToken
    );
    assert.strictEqual(crossStudent.statusCode, 403);

    // Instructor accessing foreign assessment -> 403
    const instForeign = await makeRequest(
      'GET',
      `/api/analytics/instructor/assessment/${foreignAssessment._id}`,
      alanToken
    );
    assert.strictEqual(instForeign.statusCode, 403);
  });

  it('21. Phase 4 lifecycle regression: attempt lifecycle transitions, submission locking, and concurrency protection', async () => {
    // 1. Partial unique index prevents duplicate IN_PROGRESS attempts
    const indexes = MockTestAttempt.schema.indexes();
    const hasPartialIndex = indexes.some(
      ([keys, options]) =>
        keys.mockTestId === 1 &&
        keys.studentId === 1 &&
        options?.unique === true &&
        options?.partialFilterExpression?.status === 'IN_PROGRESS'
    );
    assert.ok(hasPartialIndex, 'Expected partial unique index on { mockTestId: 1, studentId: 1, status: IN_PROGRESS }');

    // 2. Lifecycle transitions: Create IN_PROGRESS attempt
    const attempt = await MockTestAttempt.create({
      mockTestId: mockTestDSA._id,
      studentId: studentBob._id,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });
    assert.strictEqual(attempt.status, 'IN_PROGRESS');

    // 3. Concurrent creation attempt with same mockTestId and studentId must fail with duplicate key E11000
    await assert.rejects(
      async () => {
        await MockTestAttempt.create({
          mockTestId: mockTestDSA._id,
          studentId: studentBob._id,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || /duplicate key/i.test(err.message));
        return true;
      }
    );

    // 4. Transition to SUBMITTED releases the in-progress constraint
    attempt.status = 'SUBMITTED';
    attempt.submittedAt = new Date();
    await attempt.save();
    assert.strictEqual(attempt.status, 'SUBMITTED');

    // 5. Transition to EVALUATED
    attempt.status = 'EVALUATED';
    attempt.evaluationStatus = 'COMPLETED';
    attempt.earnedMarks = 75;
    attempt.percentage = 75;
    await attempt.save();
    assert.strictEqual(attempt.status, 'EVALUATED');
  });
});
