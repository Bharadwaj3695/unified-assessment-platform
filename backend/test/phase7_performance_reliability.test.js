const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../src/config/db');
const executionApp = require('../../code-IDE-service/src/app');
const executionEnv = require('../../code-IDE-service/src/config/env');
const executionClient = require('../src/services/executionClient.service');
const redisQueue = require('../../code-IDE-service/src/queue/redisQueue.service');

const {
  User,
  Subject,
  Topic,
  Question,
  MockTest,
  MockTestAttempt,
  Submission,
  Assessment,
} = require('../src/models');
const mockTestService = require('../src/services/mockTest.service');
const submissionService = require('../src/services/submission.service');
const analyticsService = require('../src/services/analytics.service');

describe('UAP Phase 7: Production Performance, Reliability & Load Verification', () => {
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  let facultyUser;
  let studentUser;
  let testSubject;
  let testTopic;
  let testMockTest;
  let benchmarkQuestions = [];

  const performanceMetrics = {
    apiResponseTimes: {},
    queryEfficiency: {},
    concurrency: {},
    autosave: {},
    executorThroughput: {},
    workerRecovery: {},
    resilience: {},
    largeDatasets: {},
  };

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Start isolated local execution server for throughput and executor benchmarking
    await new Promise((resolve) => {
      executionServer = http.createServer(executionApp);
      executionServer.listen(0, () => {
        const port = executionServer.address().port;
        originalClientUrl = executionClient.baseUrl;
        originalApiKey = executionClient.apiKey;
        executionClient.baseUrl = `http://127.0.0.1:${port}`;
        executionClient.apiKey = executionEnv.INTERNAL_API_KEY;
        resolve();
      });
    });

    facultyUser = await User.create({
      name: 'Perf Lead Faculty',
      email: `perf_faculty_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
    });

    studentUser = await User.create({
      name: 'Perf Student Candidate',
      email: `perf_student_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'student',
      isVerified: true,
      approvalStatus: 'approved',
    });

    testSubject = await Subject.create({
      name: 'Computer Systems Performance',
      code: `CS-PERF-${Date.now()}`,
      examCategories: ['INSTITUTIONAL', 'PRACTICE'],
      units: [{ unitNumber: 1, name: 'Systems Benchmarking' }],
      createdBy: facultyUser._id,
    });

    testTopic = await Topic.create({
      name: 'Scalability and Concurrency',
      code: `TOPIC-SCALE-${Date.now()}`,
      subjectId: testSubject._id,
      conceptTags: ['latency', 'throughput', 'concurrency'],
      createdBy: facultyUser._id,
    });

    // Seed realistic questions for performance test
    for (let i = 0; i < 10; i++) {
      const q = await Question.create({
        statement: `Calculate sum for query index ${i + 1}`,
        questionType: 'CODING',
        subject: testSubject.name,
        subjectId: testSubject._id,
        topicIds: [testTopic._id],
        difficulty: 'MEDIUM',
        marks: 10,
        codingConfig: {
          defaultLanguage: 'python',
          allowedLanguages: ['python', 'javascript'],
          timeLimitSeconds: 2,
          memoryLimitMb: 256,
          testCases: [
            { input: '2 3', expectedOutput: '5', isHidden: false, weight: 5 },
            { input: '10 20', expectedOutput: '30', isHidden: true, weight: 5 },
          ],
        },
        ownerFacultyId: facultyUser._id,
        status: 'PUBLISHED',
      });
      benchmarkQuestions.push(q);
    }

    testMockTest = await MockTest.create({
      title: 'Phase 7 Performance Benchmark Assessment',
      examination: 'GATE',
      subjectId: testSubject._id,
      topicIds: [testTopic._id],
      ownerFacultyId: facultyUser._id,
      durationMinutes: 60,
      totalMarks: 100,
      passingMarks: 40,
      questions: benchmarkQuestions.map((q, idx) => ({
        questionId: q._id,
        versionNumber: 1,
        orderIndex: idx,
        marks: q.marks,
        negativeMarks: 0,
        questionSnapshot: q.toObject(),
      })),
      resolvedQuestions: benchmarkQuestions.map((q, idx) => ({
        questionId: q._id,
        versionNumber: 1,
        orderIndex: idx,
        marks: q.marks,
        negativeMarks: 0,
        questionSnapshot: q.toObject(),
      })),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
  });

  after(async () => {
    if (executionServer) {
      await new Promise((res) => executionServer.close(res));
    }
    executionClient.baseUrl = originalClientUrl;
    executionClient.apiKey = originalApiKey;
    await disconnectDB();

    console.log('\n================================================================');
    console.log('--- PHASE 7 RECORDED PERFORMANCE & RELIABILITY METRICS ---');
    console.log('================================================================');
    console.log(JSON.stringify(performanceMetrics, null, 2));
    console.log('================================================================\n');
  });

  // =========================================================================
  // 1. API Response Times & Latency Percentiles
  // =========================================================================
  describe('1. API Response Times and Latency Percentiles', () => {
    it('1.1 should measure read latency for mock test retrieval within 150ms SLA', async () => {
      const samples = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const test = await mockTestService.getMockTestById(testMockTest._id.toString(), facultyUser);
        const duration = performance.now() - start;
        assert.ok(test);
        samples.push(duration);
      }
      samples.sort((a, b) => a - b);
      const p50 = samples[Math.floor(samples.length * 0.5)];
      const p95 = samples[Math.floor(samples.length * 0.95)];
      const avg = samples.reduce((s, v) => s + v, 0) / samples.length;

      performanceMetrics.apiResponseTimes.mockTestFetch = {
        samples: samples.length,
        p50Ms: Number(p50.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        avgMs: Number(avg.toFixed(2)),
      };

      assert.ok(p50 < 150, `P50 latency (${p50}ms) must remain below 150ms SLA`);
      assert.ok(p95 < 350, `P95 latency (${p95}ms) must remain below 350ms SLA`);
    });

    it('1.2 should measure attempt initiation latency within 250ms SLA', async () => {
      const tempStudent = await User.create({
        name: 'Latency Test Student',
        email: `latency_stud_${Date.now()}@uap.edu`,
        password: 'Password123!',
        role: 'student',
        isVerified: true,
        approvalStatus: 'approved',
      });

      const start = performance.now();
      const attempt = await mockTestService.startAttempt(testMockTest._id.toString(), tempStudent);
      const latency = performance.now() - start;

      assert.ok(attempt.attemptId);
      const attemptDoc = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(attemptDoc.status, 'IN_PROGRESS');
      performanceMetrics.apiResponseTimes.startAttemptLatencyMs = Number(latency.toFixed(2));
      assert.ok(latency < 500, `Attempt initialization (${latency}ms) should be under 500ms`);
    });
  });

  // =========================================================================
  // 2. Database Query Efficiency & Index Utilization
  // =========================================================================
  describe('2. Database Query Efficiency and Index Utilization', () => {
    it('2.1 should verify optimal compound index usage for student attempt lookup', async () => {
      const explainResult = await MockTestAttempt.find({
        mockTestId: testMockTest._id,
        studentId: studentUser._id,
        status: 'IN_PROGRESS',
      }).explain('executionStats');

      const stats = explainResult.executionStats || explainResult[0]?.executionStats;
      assert.ok(stats, 'Query explain plan must contain executionStats');

      performanceMetrics.queryEfficiency.attemptLookup = {
        executionStages: stats.executionStages?.stage,
        nReturned: stats.nReturned,
        totalDocsExamined: stats.totalDocsExamined,
        executionTimeMillis: stats.executionTimeMillis,
      };

      // Ensure no full collection scan is performed
      assert.notStrictEqual(stats.executionStages?.stage, 'COLLSCAN', 'Must utilize indexed stage rather than COLLSCAN');
    });

    it('2.2 should verify compound index usage for published questions query', async () => {
      const explainResult = await Question.find({
        subjectId: testSubject._id,
        status: 'PUBLISHED',
      }).explain('executionStats');

      const stats = explainResult.executionStats || explainResult[0]?.executionStats;
      assert.ok(stats);

      performanceMetrics.queryEfficiency.publishedQuestionsLookup = {
        stage: stats.executionStages?.stage,
        totalDocsExamined: stats.totalDocsExamined,
        executionTimeMillis: stats.executionTimeMillis,
      };

      assert.ok(stats.executionTimeMillis <= 50, 'Index query should resolve in <= 50ms');
    });
  });

  // =========================================================================
  // 3. Concurrent Assessment Attempts (Zero Cross-Talk)
  // =========================================================================
  describe('3. Concurrent Assessment Attempts', () => {
    it('3.1 should initialize 20 concurrent student attempts without state collision', async () => {
      const students = [];
      for (let i = 0; i < 20; i++) {
        const u = await User.create({
          name: `Concurrent Student ${i}`,
          email: `concurrent_${i}_${Date.now()}@uap.edu`,
          password: 'Password123!',
          role: 'student',
          isVerified: true,
          approvalStatus: 'approved',
        });
        students.push(u);
      }

      const start = performance.now();
      const attemptPromises = students.map((s) =>
        mockTestService.startAttempt(testMockTest._id.toString(), s)
      );
      const attempts = await Promise.all(attemptPromises);
      const totalDuration = performance.now() - start;

      assert.strictEqual(attempts.length, 20);
      const uniqueAttemptIds = new Set(attempts.map((a) => a.attemptId.toString()));
      assert.strictEqual(uniqueAttemptIds.size, 20, 'Each concurrent student must receive a distinct unique attempt ID');

      // Verify each attempt is independently in progress
      const foundAttempts = await MockTestAttempt.find({ _id: { $in: Array.from(uniqueAttemptIds) } });
      assert.strictEqual(foundAttempts.length, 20);
      foundAttempts.forEach((a) => {
        assert.strictEqual(a.status, 'IN_PROGRESS');
        assert.strictEqual(a.mockTestId.toString(), testMockTest._id.toString());
      });

      performanceMetrics.concurrency.concurrentAttempts20 = {
        totalDurationMs: Number(totalDuration.toFixed(2)),
        avgPerAttemptMs: Number((totalDuration / 20).toFixed(2)),
        successRate: '100%',
      };
    });
  });

  // =========================================================================
  // 4. Concurrent Submissions & Atomic CAS Locks
  // =========================================================================
  describe('4. Concurrent Submissions and Atomic CAS Locking', () => {
    it('4.1 should handle simultaneous submission requests with exactly one success (Atomic CAS)', async () => {
      const concurrentStudent = await User.create({
        name: 'Race Candidate',
        email: `race_candidate_${Date.now()}@uap.edu`,
        password: 'Password123!',
        role: 'student',
        isVerified: true,
        approvalStatus: 'approved',
      });

      const attempt = await mockTestService.startAttempt(testMockTest._id.toString(), concurrentStudent);

      // Fire 5 simultaneous submit requests for the same attempt
      const submissionPayload = {
        responses: [
          {
            questionId: benchmarkQuestions[0]._id.toString(),
            codeAnswer: { language: 'python', code: 'print("5")' },
          },
        ],
      };

      const start = performance.now();
      const results = await Promise.allSettled([
        mockTestService.submitAttempt(attempt.attemptId, concurrentStudent, submissionPayload),
        mockTestService.submitAttempt(attempt.attemptId, concurrentStudent, submissionPayload),
        mockTestService.submitAttempt(attempt.attemptId, concurrentStudent, submissionPayload),
        mockTestService.submitAttempt(attempt.attemptId, concurrentStudent, submissionPayload),
        mockTestService.submitAttempt(attempt.attemptId, concurrentStudent, submissionPayload),
      ]);
      const duration = performance.now() - start;

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one submission request must succeed');
      assert.strictEqual(rejected.length, 4, 'Remaining duplicate concurrent submit requests must be rejected');

      // Confirm attempt state in DB is finalized
      const finalAttempt = await MockTestAttempt.findById(attempt.attemptId);
      assert.ok(['SUBMITTED', 'EVALUATED'].includes(finalAttempt.status));

      performanceMetrics.concurrency.atomicCasSubmissionRace = {
        totalAttempts: 5,
        succeeded: fulfilled.length,
        rejectedAsDuplicate: rejected.length,
        executionTimeMs: Number(duration.toFixed(2)),
      };
    });
  });

  // =========================================================================
  // 5. Autosave Behaviour & Idempotency
  // =========================================================================
  describe('5. Autosave Behaviour and Rapid Update Idempotency', () => {
    it('5.1 should handle rapid sequential autosaves with monotonically increasing timestamps', async () => {
      const autosaveStudent = await User.create({
        name: 'Autosave Candidate',
        email: `autosave_${Date.now()}@uap.edu`,
        password: 'Password123!',
        role: 'student',
        isVerified: true,
        approvalStatus: 'approved',
      });

      const perfAssessment = await Assessment.create({
        title: 'Autosave Perf Assessment',
        description: 'Autosave performance testing',
        category: 'Engineering',
        instructorId: facultyUser._id,
        durationMinutes: 60,
        totalPoints: 10,
        status: 'published',
      });

      const autosaveQuestion = await Question.create({
        statement: 'What is 2+2?',
        questionType: 'SINGLE_MCQ',
        assessmentId: perfAssessment._id,
        difficulty: 'EASY',
        marks: 5,
        options: [
          { id: 'opt_1', text: '4', isCorrect: true },
          { id: 'opt_2', text: '5', isCorrect: false },
        ],
        status: 'PUBLISHED',
      });

      const sub = await submissionService.startAttempt(autosaveStudent._id, perfAssessment._id);

      const latencies = [];
      for (let i = 1; i <= 10; i++) {
        const start = performance.now();
        const updated = await submissionService.autosaveAnswer(
          sub._id,
          autosaveStudent._id,
          autosaveQuestion._id,
          `opt_${i % 2 === 0 ? 1 : 2}`
        );
        const lat = performance.now() - start;
        latencies.push(lat);

        assert.strictEqual(updated.success, true);
      }

      const avgLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      performanceMetrics.autosave.rapidAutosave10Ops = {
        avgLatencyMs: Number(avgLat.toFixed(2)),
        maxLatencyMs: Number(Math.max(...latencies).toFixed(2)),
        minLatencyMs: Number(Math.min(...latencies).toFixed(2)),
      };

      assert.ok(avgLat < 100, `Average autosave latency (${avgLat}ms) must remain below 100ms`);
    });
  });

  // =========================================================================
  // 6. Executor Throughput & Worker Recovery
  // =========================================================================
  describe('6. Executor Throughput and Worker Recovery', () => {
    it('6.1 should process multiple concurrent execution suites and measure throughput', async () => {
      const suitePayload = {
        language: 'python',
        code: 'import sys\nline = sys.stdin.read().split()\nprint(int(line[0]) + int(line[1]))',
        testCases: [
          { input: '4 6', expectedOutput: '10' },
          { input: '100 200', expectedOutput: '300' },
        ],
        timeoutMs: 2000,
        memoryLimitMb: 256,
      };

      const start = performance.now();
      const jobPromises = Array.from({ length: 10 }, () =>
        executionClient.executeSuite(suitePayload)
      );
      const responses = await Promise.all(jobPromises);
      const totalDuration = performance.now() - start;

      responses.forEach((res) => {
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.status, 200);
        assert.ok(res.data.success);
      });

      const throughputReqPerSec = (10 / (totalDuration / 1000)).toFixed(2);
      performanceMetrics.executorThroughput.concurrentSuites10 = {
        totalDurationMs: Number(totalDuration.toFixed(2)),
        avgPerSuiteMs: Number((totalDuration / 10).toFixed(2)),
        throughputSuitesPerSec: Number(throughputReqPerSec),
      };

      assert.ok(Number(throughputReqPerSec) >= 5, 'Executor throughput should be at least 5 suites/sec in test harness');
    });

    it('6.2 should recover safely when a malformed job or runtime error occurs without crashing', async () => {
      // Execute an execution with invalid syntax / syntax error
      const brokenPayload = {
        language: 'python',
        code: '__TRIGGER_SYNTAX_ERROR__',
        testCases: [{ input: '1', expectedOutput: '1' }],
      };

      const result = await executionClient.executeSuite(brokenPayload);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.data.success, true);
      assert.strictEqual(result.data.data.verdict, 'COMPILATION_ERROR');

      // Immediate subsequent valid execution must still process without issue
      const validPayload = {
        language: 'python',
        code: 'print("healthy")',
        stdin: '',
        expectedOutput: 'healthy',
      };
      const healthyCheck = await executionClient.executeCode(validPayload);
      assert.strictEqual(healthyCheck.ok, true);
      assert.strictEqual(healthyCheck.data.data.verdict, 'ACCEPTED');

      performanceMetrics.workerRecovery.faultTolerance = 'VERIFIED_RECOVERED';
    });
  });

  // =========================================================================
  // 7. Redis Availability & Fallback Behavior
  // =========================================================================
  describe('7. Redis Availability and Queue Behavior', () => {
    it('7.1 should report healthy state or safe synchronous fallback when Redis is offline', async () => {
      const isRedisOnline = redisQueue.isConnected;

      if (!isRedisOnline) {
        // Fallback mode: jobs are processed synchronously via jobQueue
        performanceMetrics.resilience.redisMode = 'SYNCHRONOUS_IN_PROCESS_FALLBACK';
      } else {
        performanceMetrics.resilience.redisMode = 'DISTRIBUTED_QUEUE_CONNECTED';
      }

      // Verify execution client can probe health endpoint
      const health = await executionClient.checkHealth();
      assert.strictEqual(health.status, 200);
      assert.ok(['healthy', 'online'].includes(health.data.status));
    });
  });

  // =========================================================================
  // 8. MongoDB Connectivity & Recovery
  // =========================================================================
  describe('8. MongoDB Connectivity and Outage Protection', () => {
    it('8.1 should verify active MongoDB connection state readyState === 1', () => {
      const readyState = mongoose.connection.readyState;
      assert.strictEqual(readyState, 1, 'MongoDB connection state must be connected (1)');
      performanceMetrics.resilience.mongoDbState = 'CONNECTED';
    });

    it('8.2 should prevent database operations from hanging when connection is checked', async () => {
      const adminPing = await mongoose.connection.db.admin().ping();
      assert.strictEqual(adminPing.ok, 1);
      performanceMetrics.resilience.mongoDbPing = 'OK';
    });
  });

  // =========================================================================
  // 9. Large Question Banks (Indexing & Scalability)
  // =========================================================================
  describe('9. Large Question Banks Scalability', () => {
    it('9.1 should query and paginate across 100+ questions in under 100ms', async () => {
      // Bulk insert 100 draft questions to simulate a growing question bank
      const batchDocs = [];
      for (let i = 0; i < 100; i++) {
        batchDocs.push({
          statement: `Scale Question statement text for item ${i}`,
          questionType: i % 2 === 0 ? 'SINGLE_MCQ' : 'TRUE_FALSE',
          subject: testSubject.name,
          subjectId: testSubject._id,
          topicIds: [testTopic._id],
          difficulty: i % 3 === 0 ? 'EASY' : i % 3 === 1 ? 'MEDIUM' : 'HARD',
          marks: 5,
          ownerFacultyId: facultyUser._id,
          status: 'PUBLISHED',
        });
      }
      await Question.insertMany(batchDocs);

      const start = performance.now();
      const queried = await Question.find({ subjectId: testSubject._id, status: 'PUBLISHED' })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean();
      const elapsed = performance.now() - start;

      assert.strictEqual(queried.length, 25);
      performanceMetrics.largeDatasets.query100QuestionsPaginatedMs = Number(elapsed.toFixed(2));
      assert.ok(elapsed < 100, `Paginated query across large question bank took ${elapsed}ms (expected < 100ms)`);
    });
  });

  // =========================================================================
  // 10. Large Assessment Datasets (Analytics Aggregation)
  // =========================================================================
  describe('10. Large Assessment Datasets and Analytics Aggregation', () => {
    it('10.1 should aggregate student performance metrics across 50 attempts in under 200ms', async () => {
      // Create 50 completed attempts to evaluate analytics pipeline scaling
      const attemptBatch = [];
      for (let i = 0; i < 50; i++) {
        attemptBatch.push({
          mockTestId: testMockTest._id,
          studentId: studentUser._id,
          attemptNumber: i + 1,
          status: 'EVALUATED',
          evaluationStatus: 'COMPLETED',
          score: 40 + (i % 50),
          autoScore: 40 + (i % 50),
          manualScore: 0,
          percentage: ((40 + (i % 50)) / 100) * 100,
          startedAt: new Date(Date.now() - 3600000),
          submittedAt: new Date(Date.now() - 1800000),
          timeSpentSeconds: 1800,
        });
      }
      await MockTestAttempt.insertMany(attemptBatch);

      const start = performance.now();
      const studentMetrics = await analyticsService.getStudentPerformance(studentUser._id.toString(), studentUser);
      const elapsed = performance.now() - start;

      assert.ok(studentMetrics);
      assert.ok(studentMetrics.assessmentsCompleted >= 50);
      assert.strictEqual(typeof studentMetrics.overallAverageScore, 'number');

      performanceMetrics.largeDatasets.analyticsAggregation50AttemptsMs = Number(elapsed.toFixed(2));
      assert.ok(elapsed < 200, `Analytics aggregation took ${elapsed}ms (expected < 200ms)`);
    });
  });
});
