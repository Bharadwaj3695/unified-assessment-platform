const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Question, Submission, Evaluation } = require('../src/models');
const analyticsService = require('../src/services/analytics.service');
const { hashPassword } = require('../src/utils/password');

const http = require('node:http');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Phase 6 Verification Suite: Performance, Leaderboard, Streaks & Analytics', () => {
  let server;
  let baseUrl;
  let studentA;
  let studentB;
  let studentC;
  let instructorA;
  let instructorB;
  let adminUser;

  let studentAToken;
  let studentBToken;
  let instructorAToken;
  let instructorBToken;
  let adminToken;

  let assessmentA;
  let assessmentB;
  let foreignAssessment;
  let qMCQ;
  let qTrueFalse;
  let qSubjective;

  before(async () => {
    await connectDB();
    await seedDatabase();

    const passwordHash = await hashPassword('Test@1234');

    // Create dedicated test users
    studentA = await User.create({
      name: 'Phase 6 Student Alpha',
      email: 'p6_student_alpha@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P6-001',
      department: 'Computer Science',
    });

    studentB = await User.create({
      name: 'Phase 6 Student Beta',
      email: 'p6_student_beta@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P6-002',
      department: 'Software Engineering',
    });

    studentC = await User.create({
      name: 'Phase 6 Student Gamma',
      email: 'p6_student_gamma@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P6-003',
      department: 'Data Science',
    });

    instructorA = await User.create({
      name: 'Phase 6 Instructor A',
      email: 'p6_instructor_a@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P6-001',
      department: 'Computer Science',
    });

    instructorB = await User.create({
      name: 'Phase 6 Instructor B',
      email: 'p6_instructor_b@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P6-002',
      department: 'Information Technology',
    });

    adminUser = await User.create({
      name: 'Phase 6 Admin',
      email: 'p6_admin@uap.edu',
      password: passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
      adminId: 'ADM-P6-001',
    });

    // Create Instructor A assessments
    assessmentA = await Assessment.create({
      title: 'Phase 6 Software Engineering Metrics Exam',
      description: 'Testing analytics metrics and scoring.',
      category: 'Software Engineering',
      instructorId: instructorA._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    qMCQ = await Question.create({
      assessmentId: assessmentA._id,
      questionText: 'What is the purpose of encapsulation?',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'Data hiding and bundling' },
        { id: 'opt_2', text: 'Multiple inheritance' },
        { id: 'opt_3', text: 'Database caching' },
      ],
      correctAnswer: 'opt_1',
      points: 25,
      orderIndex: 0,
    });

    qTrueFalse = await Question.create({
      assessmentId: assessmentA._id,
      questionText: 'Coupling should be high between modules in modular architecture.',
      type: 'true_false',
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ],
      correctAnswer: 'false',
      points: 25,
      orderIndex: 1,
    });

    qSubjective = await Question.create({
      assessmentId: assessmentA._id,
      questionText: 'Explain the open-closed principle in software architecture.',
      type: 'short_answer',
      points: 50,
      orderIndex: 2,
    });

    assessmentB = await Assessment.create({
      title: 'Phase 6 Data Structures & Algorithms Quiz',
      description: 'Algorithmic efficiency exam.',
      category: 'Computer Science',
      instructorId: instructorA._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 70,
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    // Create Instructor B (Foreign) assessment
    foreignAssessment = await Assessment.create({
      title: 'Phase 6 Foreign Instructor Confidential Assessment',
      description: 'Owned exclusively by Instructor B.',
      category: 'Cybersecurity',
      instructorId: instructorB._id,
      durationMinutes: 50,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [studentA._id],
    });

    studentAToken = generateAccessToken({ id: studentA._id.toString(), role: studentA.role, email: studentA.email });
    studentBToken = generateAccessToken({ id: studentB._id.toString(), role: studentB.role, email: studentB.email });
    instructorAToken = generateAccessToken({ id: instructorA._id.toString(), role: instructorA.role, email: instructorA.email });
    instructorBToken = generateAccessToken({ id: instructorB._id.toString(), role: instructorB.role, email: instructorB.email });
    adminToken = generateAccessToken({ id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Cleanup created test records
    await Submission.deleteMany({
      studentId: { $in: [studentA._id, studentB._id, studentC._id] },
    });
    await Question.deleteMany({
      assessmentId: { $in: [assessmentA._id, assessmentB._id, foreignAssessment._id] },
    });
    await Assessment.deleteMany({
      _id: { $in: [assessmentA._id, assessmentB._id, foreignAssessment._id] },
    });
    await User.deleteMany({
      _id: { $in: [studentA._id, studentB._id, studentC._id, instructorA._id, instructorB._id, adminUser._id] },
    });
    await disconnectDB();
  });

  // 1. Student Own Analytics & Calculations
  it('1. should retrieve student own analytics with correct KPIs for empty state (no completed submissions)', async () => {
    const result = await analyticsService.getStudentPerformance(studentA._id, studentA);
    assert.strictEqual(result.assessmentsAttempted, 0);
    assert.strictEqual(result.assessmentsCompleted, 0);
    assert.strictEqual(result.passedAssessments, 0);
    assert.strictEqual(result.failedAssessments, 0);
    assert.strictEqual(result.passRate, 0);
    assert.strictEqual(result.overallAverageScore, null);
    assert.strictEqual(result.currentStreak, 0);
    assert.strictEqual(result.longestStreak, 0);
    assert.strictEqual(result.hasData, false);
    assert.ok(Array.isArray(result.categoryPerformance));
    assert.ok(Array.isArray(result.recentResults));
  });

  // 2. Student Privacy & RBAC: student cannot access another student's analytics
  it('2. should block student A from accessing student B analytics with 403 Forbidden', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getStudentPerformance(studentB._id, studentA);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );
  });

  it('3. should block student A from accessing student B streak details with 403 Forbidden', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getStudentStreak(studentB._id, studentA);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  it('4. should block student A from accessing student B trends with 403 Forbidden', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getStudentTrends(studentB._id, studentA);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  // 3. Calculation Accuracy: Completed vs Incomplete, Average Score & Pass Rate
  it('5. should calculate average score, pass rate, and ignore incomplete in_progress submissions for completed stats', async () => {
    const now = Date.now();

    // Student A completed submission 1: 90%, passed
    await Submission.create({
      studentId: studentA._id,
      assessmentId: assessmentA._id,
      answers: { [qMCQ._id.toString()]: 'opt_1', [qTrueFalse._id.toString()]: 'false' },
      score: 90,
      totalPoints: 100,
      percentage: 90,
      passed: true,
      status: 'evaluated',
      resultStatus: 'passed',
      evaluationStatus: 'completed',
      submittedAt: new Date(now - 3600000),
      timeSpentSeconds: 1200,
    });

    // Student A completed submission 2: 50%, failed
    await Submission.create({
      studentId: studentA._id,
      assessmentId: assessmentB._id,
      answers: {},
      score: 50,
      totalPoints: 100,
      percentage: 50,
      passed: false,
      status: 'evaluated',
      resultStatus: 'failed',
      evaluationStatus: 'completed',
      submittedAt: new Date(now - 1800000),
      timeSpentSeconds: 1500,
    });

    // Student A in-progress submission 3: must be counted in attempted, but excluded from completed KPIs
    await Submission.create({
      studentId: studentA._id,
      assessmentId: foreignAssessment._id,
      answers: {},
      score: 0,
      totalPoints: 100,
      percentage: 0,
      passed: false,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const perf = await analyticsService.getStudentPerformance(studentA._id, studentA);
    assert.strictEqual(perf.assessmentsAttempted, 3, 'Total attempted includes in_progress');
    assert.strictEqual(perf.assessmentsCompleted, 2, 'Completed count strictly ignores in_progress');
    assert.strictEqual(perf.passedAssessments, 1);
    assert.strictEqual(perf.failedAssessments, 1);
    assert.strictEqual(perf.passRate, 50, 'Pass rate should be 1 / 2 = 50%');
    assert.strictEqual(perf.overallAverageScore, 70, 'Average score should be (90 + 50) / 2 = 70%');
    assert.strictEqual(perf.hasData, true);
  });

  // 4. Category Performance breakdown
  it('6. should correctly aggregate performance grouped by assessment category', async () => {
    const perf = await analyticsService.getStudentPerformance(studentA._id, studentA);
    const catSE = perf.categoryPerformance.find((c) => c.category === 'Software Engineering');
    const catCS = perf.categoryPerformance.find((c) => c.category === 'Computer Science');

    assert.ok(catSE, 'Software Engineering category exists');
    assert.strictEqual(catSE.assessmentsCompleted, 1);
    assert.strictEqual(catSE.averageScore, 90);
    assert.strictEqual(catSE.passRate, 100);

    assert.ok(catCS, 'Computer Science category exists');
    assert.strictEqual(catCS.assessmentsCompleted, 1);
    assert.strictEqual(catCS.averageScore, 50);
    assert.strictEqual(catCS.passRate, 0);
  });

  // 5. Recent Results format & data protection
  it('7. should return recent completed results with sanitized fields', async () => {
    const perf = await analyticsService.getStudentPerformance(studentA._id, studentA);
    assert.ok(perf.recentResults.length >= 2);
    const recent = perf.recentResults[0];
    assert.ok(recent.assessmentTitle);
    assert.ok(recent.percentage !== undefined);
    assert.ok(recent.score !== undefined);
    assert.ok(recent.resultStatus);
    assert.strictEqual(recent.password, undefined);
  });

  // 6. Chronological Score Trends
  it('8. should return chronological score trends sorted ascending by submission time', async () => {
    const trends = await analyticsService.getStudentTrends(studentA._id, studentA);
    assert.strictEqual(trends.length, 2);
    // Sub 1 was 1 hour ago, sub 2 was 30 mins ago
    assert.strictEqual(trends[0].percentage, 90);
    assert.strictEqual(trends[1].percentage, 50);
    assert.ok(trends[0].date);
  });

  // 7. Streak System: Same-Day Multiple, Consecutive Days, Missed-Day Reset, Longest Streak
  it('9. should handle same-day multiple assessments without double-counting streak', () => {
    const sameDay = [
      new Date('2026-09-01T10:00:00.000Z'),
      new Date('2026-09-01T12:30:00.000Z'),
      new Date('2026-09-01T16:00:00.000Z'),
    ];
    const streak = analyticsService.calculateStreaks(sameDay);
    assert.strictEqual(streak.longestStreak, 1, 'Multiple same-day exams must count as 1 day');
  });

  it('10. should correctly calculate longest streak with missed days in between', () => {
    const dates = [
      new Date('2026-08-01T10:00:00.000Z'),
      new Date('2026-08-02T10:00:00.000Z'),
      new Date('2026-08-03T10:00:00.000Z'), // 3-day streak
      // Gap: August 4 missed!
      new Date('2026-08-05T10:00:00.000Z'),
      new Date('2026-08-06T10:00:00.000Z'), // 2-day streak
    ];
    const streak = analyticsService.calculateStreaks(dates);
    assert.strictEqual(streak.longestStreak, 3, 'Longest historical streak was 3 days');
    assert.strictEqual(streak.currentStreak, 0, 'Current streak should be 0 because last active was in August');
  });

  it('11. should recognize active current streak when last activity was today or yesterday', () => {
    const now = Date.now();
    const dayMs = 86400000;
    const today = new Date(now);
    const yesterday = new Date(now - dayMs);
    const twoDaysAgo = new Date(now - 2 * dayMs);

    const activeDates = [twoDaysAgo, yesterday, today];
    const streak = analyticsService.calculateStreaks(activeDates);
    assert.strictEqual(streak.currentStreak, 3);
    assert.strictEqual(streak.longestStreak, 3);
    assert.strictEqual(streak.streakActiveToday, true);
  });

  it('12. should reset current streak to 0 when last activity was 2 or more days ago', () => {
    const now = Date.now();
    const dayMs = 86400000;
    const threeDaysAgo = new Date(now - 3 * dayMs);
    const twoDaysAgo = new Date(now - 2 * dayMs);

    const brokenDates = [threeDaysAgo, twoDaysAgo];
    const streak = analyticsService.calculateStreaks(brokenDates);
    assert.strictEqual(streak.currentStreak, 0, 'Missed yesterday means current streak resets to 0');
    assert.strictEqual(streak.longestStreak, 2);
  });

  // 8. Leaderboard Ranking & Ties & Incomplete Exclusion
  it('13. should rank assessment leaderboard deterministically and handle ties fairly', async () => {
    // Delete previous test assessment submissions to test clean leaderboard
    await Submission.deleteMany({ assessmentId: assessmentA._id });

    const now = Date.now();

    // Student A: 95%, 1200 seconds
    await Submission.create({
      studentId: studentA._id,
      assessmentId: assessmentA._id,
      score: 95,
      totalPoints: 100,
      percentage: 95,
      passed: true,
      status: 'evaluated',
      timeSpentSeconds: 1200,
      submittedAt: new Date(now - 3000),
    });

    // Student B: 95%, 1200 seconds (Identical score and time -> TIE!)
    await Submission.create({
      studentId: studentB._id,
      assessmentId: assessmentA._id,
      score: 95,
      totalPoints: 100,
      percentage: 95,
      passed: true,
      status: 'evaluated',
      timeSpentSeconds: 1200,
      submittedAt: new Date(now - 2000),
    });

    // Student C: 80%, 900 seconds
    await Submission.create({
      studentId: studentC._id,
      assessmentId: assessmentA._id,
      score: 80,
      totalPoints: 100,
      percentage: 80,
      passed: true,
      status: 'evaluated',
      timeSpentSeconds: 900,
      submittedAt: new Date(now - 1000),
    });

    const lb = await analyticsService.getLeaderboard({
      scope: 'assessment',
      assessmentId: assessmentA._id,
      requestingUser: studentA,
    });

    assert.strictEqual(lb.totalParticipants, 3);
    assert.strictEqual(lb.rankings[0].rank, 1, 'First place is rank 1');
    assert.strictEqual(lb.rankings[1].rank, 1, 'Tied second student also shares rank 1');
    assert.strictEqual(lb.rankings[2].rank, 3, 'Next student receives competition rank 3');
  });

  it('14. should strictly exclude in_progress / unsubmitted attempts from leaderboard', async () => {
    // Create an unsubmitted in_progress attempt for assessmentA
    const passwordHash = await hashPassword('Test@1234');
    const incompleteUser = await User.create({
      name: 'Incomplete Test Student',
      email: 'p6_incomplete_user@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    await Submission.create({
      studentId: incompleteUser._id,
      assessmentId: assessmentA._id,
      status: 'in_progress',
      score: 0,
      percentage: 0,
    });

    const lb = await analyticsService.getLeaderboard({
      scope: 'assessment',
      assessmentId: assessmentA._id,
      requestingUser: studentA,
    });

    const hasIncomplete = lb.rankings.some((r) => r.studentId === incompleteUser._id.toString());
    assert.strictEqual(hasIncomplete, false, 'Incomplete attempts must NOT be ranked on leaderboard');

    // Clean up
    await Submission.deleteOne({ studentId: incompleteUser._id });
    await User.deleteOne({ _id: incompleteUser._id });
  });

  it('15. should NOT leak sensitive student fields (email, password) in leaderboard data', async () => {
    const lb = await analyticsService.getLeaderboard({
      scope: 'overall',
      requestingUser: studentA,
    });

    for (const entry of lb.rankings) {
      assert.strictEqual(entry.email, undefined, 'Student email must NOT be exposed in leaderboard');
      assert.strictEqual(entry.password, undefined, 'Student password must NOT be exposed in leaderboard');
      assert.ok(entry.studentDisplayName, 'Display name should be present');
    }
  });

  // 9. Faculty Assessment Analytics & Foreign Assessment Block
  it('16. should provide assessment analytics for the owning instructor', async () => {
    const analytics = await analyticsService.getInstructorAssessmentAnalytics(
      assessmentA._id,
      instructorA
    );

    assert.strictEqual(analytics.assessment.title, assessmentA.title);
    assert.strictEqual(analytics.completedSubmissions, 3);
    assert.strictEqual(analytics.highestScore, 95);
    assert.strictEqual(analytics.lowestScore, 80);
    assert.strictEqual(analytics.passRate, 100);
    assert.ok(Array.isArray(analytics.scoreDistribution));
    assert.strictEqual(analytics.scoreDistribution.length, 5);
  });

  it('17. should block instructor B from accessing instructor A assessment analytics with 403 Forbidden', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getInstructorAssessmentAnalytics(assessmentA._id, instructorB);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );
  });

  it('18. should block instructor B from accessing instructor A question analytics with 403 Forbidden', async () => {
    await assert.rejects(
      async () => {
        await analyticsService.getInstructorQuestionAnalytics(assessmentA._id, instructorB);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  it('19. should allow admin to access any assessment analytics', async () => {
    const analytics = await analyticsService.getInstructorAssessmentAnalytics(
      assessmentA._id,
      adminUser
    );
    assert.ok(analytics);
    assert.strictEqual(analytics.assessment.id, assessmentA._id.toString());
  });

  // 10. Question-Level Analytics (Objective vs Subjective)
  it('20. should compute objective question analytics with correct percentage and difficulty flag', async () => {
    // Populate answers on submissions for assessmentA
    await Submission.updateOne(
      { studentId: studentA._id, assessmentId: assessmentA._id },
      { $set: { answers: { [qMCQ._id.toString()]: 'opt_1' } } }
    );
    await Submission.updateOne(
      { studentId: studentB._id, assessmentId: assessmentA._id },
      { $set: { answers: { [qMCQ._id.toString()]: 'opt_2' } } } // incorrect
    );

    const qAnalytics = await analyticsService.getInstructorQuestionAnalytics(
      assessmentA._id,
      instructorA
    );

    const mcqData = qAnalytics.questions.find((q) => q.questionId === qMCQ._id.toString());
    assert.ok(mcqData);
    assert.strictEqual(mcqData.isObjective, true);
    assert.strictEqual(mcqData.attempts, 2);
    assert.strictEqual(mcqData.correctCount, 1);
    assert.strictEqual(mcqData.incorrectCount, 1);
    assert.strictEqual(mcqData.correctPercentage, 50);
  });

  it('21. should handle subjective questions properly without faking automated correctness', async () => {
    // Create evaluation with manual marks for subjective question
    const subA = await Submission.findOne({ studentId: studentA._id, assessmentId: assessmentA._id });
    await Evaluation.create({
      submissionId: subA._id,
      evaluatorId: instructorA._id,
      questionFeedback: {
        [qSubjective._id.toString()]: {
          pointsAwarded: 45,
          comment: 'Good theoretical discussion.',
        },
      },
      generalFeedback: 'Well structured.',
      finalScore: 45,
      status: 'completed',
    });

    const qAnalytics = await analyticsService.getInstructorQuestionAnalytics(
      assessmentA._id,
      instructorA
    );

    const subjectiveData = qAnalytics.questions.find((q) => q.questionId === qSubjective._id.toString());
    assert.ok(subjectiveData);
    assert.strictEqual(subjectiveData.isObjective, false);
    assert.strictEqual(subjectiveData.evaluatedCount, 1);
    assert.strictEqual(subjectiveData.averageMarks, 45);
    assert.strictEqual(subjectiveData.averagePercentage, 90);
    assert.strictEqual(subjectiveData.isDifficult, false);
  });

  // 11. Score Distribution
  it('22. should distribute scores into standard 5 buckets (0-20, 21-40, 41-60, 61-80, 81-100)', async () => {
    const analytics = await analyticsService.getInstructorAssessmentAnalytics(
      assessmentA._id,
      instructorA
    );

    const buckets = analytics.scoreDistribution;
    assert.strictEqual(buckets.length, 5);
    // Student A (95%) and Student B (95%) should be in '81–100'
    const bucket81_100 = buckets.find((b) => b.bucket === '81–100');
    assert.ok(bucket81_100.count >= 2);
    // Student C (80%) should be in '61–80'
    const bucket61_80 = buckets.find((b) => b.bucket === '61–80');
    assert.ok(bucket61_80.count >= 1);
  });

  // 12. Admin Aggregate Platform Analytics
  it('23. should provide admin platform overview statistics', async () => {
    const overview = await analyticsService.getAdminOverview();
    assert.ok(overview.totalActiveStudents >= 3);
    assert.ok(overview.totalInstructors >= 2);
    assert.ok(overview.totalAssessments >= 2);
    assert.ok(overview.completedSubmissions >= 3);
    assert.ok(overview.overallAverageScore > 0);
    assert.ok(Array.isArray(overview.activityTrend));
    assert.ok(Array.isArray(overview.categories));
  });

  // 13. Date Filtering
  it('24. should support date filtering with recent, last_week, and last_month ranges', () => {
    const recent = analyticsService.getDateRange('recent');
    assert.ok(recent.$gte);
    const msDiff = Date.now() - recent.$gte.getTime();
    assert.ok(msDiff <= 48 * 60 * 60 * 1000 + 1000);

    const lastWeek = analyticsService.getDateRange('last_week');
    assert.ok(lastWeek.$gte);

    const lastMonth = analyticsService.getDateRange('last_month');
    assert.ok(lastMonth.$gte);

    const custom = analyticsService.getDateRange(null, '2026-01-01', '2026-02-01');
    assert.strictEqual(custom.$gte.toISOString().split('T')[0], '2026-01-01');
    assert.strictEqual(custom.$lte.toISOString().split('T')[0], '2026-02-01');
  });

  // 14. Pagination and Limits
  it('25. should respect pagination and limit parameters on leaderboard', async () => {
    const page1 = await analyticsService.getLeaderboard({
      scope: 'assessment',
      assessmentId: assessmentA._id,
      requestingUser: studentA,
      page: 1,
      limit: 2,
    });
    assert.strictEqual(page1.rankings.length, 2);
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page1.totalPages, 2);

    const page2 = await analyticsService.getLeaderboard({
      scope: 'assessment',
      assessmentId: assessmentA._id,
      requestingUser: studentA,
      page: 2,
      limit: 2,
    });
    assert.strictEqual(page2.rankings.length, 1);
    assert.strictEqual(page2.page, 2);
  });

  // 15. HTTP API Integration & RBAC Enforcement
  it('26. HTTP: should retrieve student own performance via GET /api/analytics/student/performance (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/student/performance`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.assessmentsAttempted !== undefined);
    assert.ok(body.data.currentStreak !== undefined);
  });

  it('27. HTTP: should block student from requesting another student performance via query (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/student/performance?studentId=${studentB._id}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Access denied/i);
  });

  it('28. HTTP: should retrieve student trends via GET /api/analytics/student/trends (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/student/trends`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('29. HTTP: should retrieve student streak via GET /api/analytics/student/streak (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/student/streak`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.currentStreak !== undefined);
  });

  it('30. HTTP: should retrieve overall leaderboard via GET /api/analytics/leaderboard (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/leaderboard?scope=overall`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.rankings));
  });

  it('31. HTTP: should allow instructor to access own assessment analytics via GET /api/analytics/instructor/assessment/:id (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/instructor/assessment/${assessmentA._id}`, {
      headers: { Authorization: `Bearer ${instructorAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.scoreDistribution);
  });

  it('32. HTTP: should block instructor from accessing foreign assessment analytics (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/instructor/assessment/${assessmentA._id}`, {
      headers: { Authorization: `Bearer ${instructorBToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  it('33. HTTP: should allow instructor to retrieve question-level analytics via GET /api/analytics/instructor/assessment/:id/questions (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/instructor/assessment/${assessmentA._id}/questions`, {
      headers: { Authorization: `Bearer ${instructorAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.questions));
  });

  it('34. HTTP: should allow admin to access platform overview via GET /api/analytics/admin/overview (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.totalActiveStudents !== undefined);
  });

  it('35. HTTP: should block student from accessing admin platform overview (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/admin/overview`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});
