const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const {
  User,
  StudentRegistry,
  FacultyRegistry,
  Assessment,
  Question,
  Submission,
  Evaluation,
  AuditLog,
} = require('../src/models');
const authService = require('../src/services/auth.service');
const analyticsService = require('../src/services/analytics.service');
const adminRegistryService = require('../src/services/adminRegistry.service');
const { checkDbReady } = require('../src/middleware/dbCheck.middleware');

describe('UAP: Database Connectivity, Data Integrity & Live Dashboard Verification', () => {
  let seededStudent;
  let seededInstructor;
  let seededAdmin;

  before(async () => {
    // In test mode, connectDB establishes hermetic local database
    await connectDB();
    await seedDatabase();

    seededStudent = await User.findOne({ email: 'std01@uap.edu' });
    seededInstructor = await User.findOne({ email: 'ins01@uap.edu' });
    seededAdmin = await User.findOne({ role: 'admin' });
  });

  after(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // 1. Database Connectivity & Strict Fallback Policy
  // =========================================================================
  describe('1. Database Connectivity & Strict Persistence Policy', () => {
    it('1.1 Should establish an active connection in test mode with readyState === 1', () => {
      assert.strictEqual(mongoose.connection.readyState, 1, 'Mongoose connection must be active (1)');
    });

    it('1.2 checkDbReady middleware should call next() when database is active', () => {
      let nextCalled = false;
      const req = {};
      const res = {};
      const next = () => { nextCalled = true; };

      checkDbReady(req, res, next);
      assert.strictEqual(nextCalled, true, 'checkDbReady must call next() when readyState === 1');
    });

    it('1.3 checkDbReady middleware should return HTTP 503 when readyState !== 1', () => {
      const origDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
      try {
        // Temporarily simulate disconnected state
        Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

        let statusCode = null;
        let responsePayload = null;
        const req = {};
        const res = {
          status: (code) => {
            statusCode = code;
            return {
              json: (data) => { responsePayload = data; return data; },
            };
          },
        };
        const next = () => { assert.fail('next() should not be called when database is disconnected'); };

        checkDbReady(req, res, next);
        assert.strictEqual(statusCode, 503, 'Must return HTTP 503 on database disconnect');
        assert.strictEqual(responsePayload.success, false);
        assert.match(responsePayload.message, /Database service is currently unavailable/i);
      } finally {
        delete mongoose.connection.readyState;
        if (origDescriptor) {
          Object.defineProperty(mongoose.connection, 'readyState', origDescriptor);
        }
      }
    });

    it('1.4 All models must map to their intended lowercase plural collections', () => {
      const expectedMappings = {
        User: 'users',
        StudentRegistry: 'studentregistries',
        FacultyRegistry: 'facultyregistries',
        Assessment: 'assessments',
        Question: 'questions',
        Submission: 'submissions',
        Evaluation: 'evaluations',
        AuditLog: 'auditlogs',
      };

      const models = require('../src/models');
      for (const [modelName, expectedCollection] of Object.entries(expectedMappings)) {
        assert.ok(models[modelName], `Model ${modelName} must exist`);
        assert.strictEqual(
          models[modelName].collection.name,
          expectedCollection,
          `${modelName} must map to collection ${expectedCollection}`
        );
      }
    });
  });

  // =========================================================================
  // 2. Registration & Persistence Integrity
  // =========================================================================
  describe('2. Registration & Persistence Integrity', () => {
    it('2.1 Student registration matching StudentRegistry should auto-verify and persist as active', async () => {
      // Look up a seeded authoritative student registry entry or create one
      let registryEntry = await StudentRegistry.findOne();
      if (!registryEntry) {
        registryEntry = await StudentRegistry.create({
          studentId: `STU-VER-${Date.now()}`,
          name: 'Priya Sharma',
          dateOfBirth: new Date('2003-04-20'),
          email: `priya.sharma.${Date.now()}@uap.edu`,
          status: 'active',
        });
      }

      const uniqueEmail = `verified.test.${Date.now()}@uap.edu`;
      // Update registry entry email for this specific test
      registryEntry.email = uniqueEmail;
      await registryEntry.save();

      const formattedDob = registryEntry.dateOfBirth instanceof Date
        ? registryEntry.dateOfBirth.toISOString().split('T')[0]
        : String(registryEntry.dateOfBirth).split('T')[0];

      const result = await authService.register({
        name: registryEntry.name,
        email: uniqueEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'student',
        studentId: registryEntry.studentId,
        dateOfBirth: formattedDob,
        instituteCode: 'INST-UAP',
      });

      assert.strictEqual(result.status, 'active');
      assert.strictEqual(result.verified, true);

      // Verify directly from the User database collection
      const persistedUser = await User.findOne({ email: uniqueEmail });
      assert.ok(persistedUser, 'User document must be persisted in database');
      assert.strictEqual(persistedUser.role, 'student');
      assert.strictEqual(persistedUser.status, 'active');
      assert.strictEqual(persistedUser.isActive, true);
      assert.strictEqual(persistedUser.studentId, registryEntry.studentId);
    });

    it('2.2 Student registration with unmatched identity should persist as pending', async () => {
      const uniqueEmail = `unverified.student.${Date.now()}@uap.edu`;
      const result = await authService.register({
        name: 'Unmatched Candidate',
        email: uniqueEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'student',
        studentId: 'STU-UNKNOWN-999',
        dateOfBirth: '2003-05-15',
      });

      assert.strictEqual(result.status, 'pending');
      assert.strictEqual(result.verified, false);

      const persistedUser = await User.findOne({ email: uniqueEmail });
      assert.ok(persistedUser, 'Pending student must be persisted in User collection');
      assert.strictEqual(persistedUser.role, 'student');
      assert.strictEqual(persistedUser.status, 'pending');
      assert.strictEqual(persistedUser.isActive, false);
    });

    it('2.3 Faculty registration should persist as pending with generated facultyId', async () => {
      const uniqueEmail = `faculty.applicant.${Date.now()}@uap.edu`;
      const result = await authService.register({
        name: 'Dr. Alan Turing',
        email: uniqueEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'instructor',
      });

      assert.strictEqual(result.status, 'pending');

      const persistedUser = await User.findOne({ email: uniqueEmail });
      assert.ok(persistedUser, 'Instructor applicant must be persisted in User collection');
      assert.strictEqual(persistedUser.role, 'instructor');
      assert.strictEqual(persistedUser.status, 'pending');
      assert.strictEqual(persistedUser.isActive, false);
      assert.ok(persistedUser.facultyId, 'Must have auto-generated facultyId');

      // Admin approval should synchronize to FacultyRegistry
      persistedUser.status = 'active';
      persistedUser.isActive = true;
      persistedUser.approvedAt = new Date();
      await persistedUser.save();

      await adminRegistryService.syncFacultyMemberToRegistry(persistedUser);

      const registryRecord = await FacultyRegistry.findOne({ facultyId: persistedUser.facultyId });
      assert.ok(registryRecord, 'Approved instructor must synchronize into FacultyRegistry');
      assert.strictEqual(registryRecord.status, 'active');
      assert.strictEqual(registryRecord.email, uniqueEmail);
    });

    it('2.4 Duplicate email registration must be rejected with HTTP 409', async () => {
      await assert.rejects(
        async () => {
          await authService.register({
            name: 'Duplicate Attempt',
            email: seededStudent.email,
            password: 'Password@123',
            confirmPassword: 'Password@123',
            role: 'student',
            studentId: 'STU-DUP-001',
            dateOfBirth: '2001-01-01',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409, 'Must return 409 Conflict');
          assert.match(err.message, /already registered/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Live Dashboard Data Integration & Scoping
  // =========================================================================
  describe('3. Live Dashboard Data Integration & Scoping', () => {
    it('3.1 Student dashboard performance analytics must compute live from submissions', async () => {
      const perf = await analyticsService.getStudentPerformance(
        seededStudent._id.toString(),
        { id: seededStudent._id, role: 'student' }
      );

      assert.ok(perf, 'Must return performance analytics object');
      assert.strictEqual(typeof perf.assessmentsAttempted, 'number');
      assert.strictEqual(typeof perf.assessmentsCompleted, 'number');
      assert.strictEqual(typeof perf.passedAssessments, 'number');
      assert.strictEqual(typeof perf.currentStreak, 'number');
      assert.ok(Array.isArray(perf.categoryPerformance), 'Must include categoryPerformance array');
    });

    it('3.2 Student with zero submissions should return valid empty metrics without crashing', async () => {
      const freshStudent = await User.create({
        name: 'Fresh Learner',
        email: `fresh.${Date.now()}@uap.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: `STU-NEW-${Date.now().toString().slice(-4)}`,
      });

      const perf = await analyticsService.getStudentPerformance(
        freshStudent._id.toString(),
        { id: freshStudent._id, role: 'student' }
      );

      assert.strictEqual(perf.assessmentsAttempted, 0);
      assert.strictEqual(perf.assessmentsCompleted, 0);
      assert.strictEqual(perf.passedAssessments, 0);
      assert.strictEqual(perf.overallAverageScore, null);
      assert.strictEqual(perf.currentStreak, 0);
    });

    it('3.3 Student must be forbidden from accessing another student analytics (RBAC 403)', async () => {
      const otherStudent = await User.findOne({ email: 'std02@uap.edu' });
      assert.ok(otherStudent, 'Student std02@uap.edu must exist');

      await assert.rejects(
        async () => {
          await analyticsService.getStudentPerformance(
            otherStudent._id.toString(),
            { id: seededStudent._id, role: 'student' }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /Access denied/i);
          return true;
        }
      );
    });

    it('3.4 Admin overview analytics must reflect database counts accurately', async () => {
      const overview = await analyticsService.getAdminOverview();
      const actualActiveStudents = await User.countDocuments({ role: 'student', status: 'active' });
      const actualAssessments = await Assessment.countDocuments();
      const actualSubmissions = await Submission.countDocuments();

      assert.strictEqual(overview.totalActiveStudents, actualActiveStudents);
      assert.strictEqual(overview.totalAssessments, actualAssessments);
      assert.strictEqual(overview.totalSubmissions, actualSubmissions);
      assert.strictEqual(typeof overview.overallAverageScore, 'number');
      assert.strictEqual(typeof overview.overallPassRate, 'number');
    });
  });

  // =========================================================================
  // 4. End-to-End Consistency Lifecycle
  // =========================================================================
  describe('4. End-to-End Lifecycle: Register -> Assessment -> Submit -> Evaluate -> Dashboard', () => {
    it('4.1 Complete workflow updates database and reflects live on dashboard analytics', async () => {
      // 1. Create unique test student
      const e2eStudent = await User.create({
        name: 'E2E Consistency Learner',
        email: `e2e.student.${Date.now()}@uap.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: `STU-E2E-${Date.now().toString().slice(-4)}`,
      });

      // 2. Instructor publishes a new assessment
      const assessment = await Assessment.create({
        title: 'E2E Data Integrity Examination',
        category: 'Software Engineering',
        instructorId: seededInstructor._id,
        durationMinutes: 30,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        questions: [],
      });

      const question = await Question.create({
        assessmentId: assessment._id,
        questionText: 'Does Mongoose write to the connected database?',
        type: 'mcq',
        options: [
          { id: 'opt_1', text: 'Yes' },
          { id: 'opt_2', text: 'No' },
        ],
        correctAnswer: 'opt_1',
        points: 100,
      });

      assessment.questions.push(question._id);
      await assessment.save();

      // 3. Baseline check: student has 0 completed assessments
      const initialPerf = await analyticsService.getStudentPerformance(
        e2eStudent._id.toString(),
        { id: e2eStudent._id, role: 'student' }
      );
      assert.strictEqual(initialPerf.assessmentsCompleted, 0);

      // 4. Student submits completed assessment with passing answer
      const submittedAt = new Date();
      const submission = await Submission.create({
        studentId: e2eStudent._id,
        assessmentId: assessment._id,
        status: 'evaluated',
        evaluationStatus: 'completed',
        startedAt: new Date(Date.now() - 10 * 60 * 1000),
        submittedAt,
        score: 100,
        totalPoints: 100,
        percentage: 100,
        passed: true,
        answers: { [question._id.toString()]: 'opt_1' },
      });

      // 5. Instructor creates evaluation record
      await Evaluation.create({
        submissionId: submission._id,
        evaluatorId: seededInstructor._id,
        finalScore: 100,
        percentage: 100,
        passed: true,
        status: 'completed',
        gradedAt: new Date(),
      });

      // 6. Verified: Student dashboard analytics now reflects 1 completed, 100% avg score, 1 passed
      const updatedPerf = await analyticsService.getStudentPerformance(
        e2eStudent._id.toString(),
        { id: e2eStudent._id, role: 'student' }
      );

      assert.strictEqual(updatedPerf.assessmentsCompleted, 1);
      assert.strictEqual(updatedPerf.passedAssessments, 1);
      assert.strictEqual(updatedPerf.overallAverageScore, 100);
      assert.strictEqual(updatedPerf.passRate, 100);
      assert.strictEqual(updatedPerf.currentStreak, 1);

      // 7. Verified: Category breakdown includes Software Engineering
      const catEntry = updatedPerf.categoryPerformance.find((c) => c.category === 'Software Engineering');
      assert.ok(catEntry, 'Must include Software Engineering category breakdown');
      assert.strictEqual(catEntry.assessmentsCompleted, 1);
      assert.strictEqual(catEntry.passRate, 100);
      assert.strictEqual(catEntry.averageScore, 100);
    });
  });
});
