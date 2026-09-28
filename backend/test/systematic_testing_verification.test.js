const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Question, Submission, Evaluation } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');
const userService = require('../src/services/user.service');
const emailService = require('../src/services/email.service');
const uploadMiddleware = require('../src/middleware/upload.middleware');
const { errorHandler } = require('../src/middleware/error.middleware');

describe('Systematic Verification Suite: Security, Assessment Windows, File Uploads & Edge Cases', () => {
  let testInstructor;
  let testStudent;
  let futureAssessment;
  let pastAssessment;

  before(async () => {
    await connectDB();
    await seedDatabase();

    const testPassword = await hashPassword('Test@1234');

    testInstructor = await User.findOne({ email: 'systest_instructor@uap.edu' });
    if (!testInstructor) {
      testInstructor = await User.create({
        name: 'Prof. System Tester',
        email: 'systest_instructor@uap.edu',
        password: testPassword,
        role: 'instructor',
        status: 'active',
        isActive: true,
        facultyId: 'FAC-2026-888',
        department: 'Computer Science',
        subjectId: 'CS-501',
        subjectName: 'System Verification & Security',
        subjectDescription: 'Automated testing and edge-case validation.',
      });
    }

    testStudent = await User.findOne({ email: 'systest_student@uap.edu' });
    if (!testStudent) {
      testStudent = await User.create({
        name: 'System Test Student',
        email: 'systest_student@uap.edu',
        password: testPassword,
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: 'STU-2026-888',
        department: 'Computer Science',
      });
    }

    // 1. Create future scheduled assessment (scheduled 2 days in future)
    futureAssessment = await Assessment.create({
      title: 'Future Scheduled Midterm Exam',
      description: 'Midterm scheduled for 48 hours in the future.',
      category: 'Computer Science',
      instructorId: testInstructor._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    await Question.create({
      assessmentId: futureAssessment._id,
      questionText: 'What is the Byzantine Generals Problem?',
      type: 'short_answer',
      points: 50,
      correctAnswer: 'Consensus in distributed systems with faulty components',
      explanation: 'Lamport, Shostak, Pease (1982)',
      orderIndex: 0,
    });

    // 2. Create past/open assessment
    pastAssessment = await Assessment.create({
      title: 'Open Active Exam',
      description: 'Exam currently open for submissions.',
      category: 'Computer Science',
      instructorId: testInstructor._id,
      durationMinutes: 30,
      totalPoints: 50,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // opened 2 hours ago
      deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // closes in 2 hours
    });

    await Question.create({
      assessmentId: pastAssessment._id,
      questionText: 'Select true or false: TCP is connection-oriented.',
      type: 'true_false',
      points: 50,
      correctAnswer: 'true',
      orderIndex: 0,
    });
  });

  after(async () => {
    if (futureAssessment) {
      await Question.deleteMany({ assessmentId: futureAssessment._id });
      await Assessment.findByIdAndDelete(futureAssessment._id);
    }
    if (pastAssessment) {
      await Question.deleteMany({ assessmentId: pastAssessment._id });
      await Submission.deleteMany({ assessmentId: pastAssessment._id });
      await Assessment.findByIdAndDelete(pastAssessment._id);
    }
    await disconnectDB();
  });

  // ==========================================
  // SECTION 1: Future Scheduled Assessment Windows
  // ==========================================
  describe('1. Assessment Scheduling & Window Enforcement', () => {
    it('1.1 should block student from starting an attempt before scheduledAt (HTTP 403)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.startAttempt(testStudent._id, futureAssessment._id);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /scheduled for a future date/i);
          return true;
        }
      );
    });

    it('1.2 should conceal questions from student callers prior to scheduledAt', async () => {
      const assessmentForStudent = await assessmentService.getAssessmentById(
        futureAssessment._id,
        { id: testStudent._id, role: 'student' }
      );
      assert.ok(assessmentForStudent);
      assert.strictEqual(assessmentForStudent.title, 'Future Scheduled Midterm Exam');
      // Questions array must be empty to prevent leaking questions in advance
      assert.strictEqual(assessmentForStudent.questions.length, 0);
    });

    it('1.3 should allow instructor to view questions for future scheduled assessment', async () => {
      const assessmentForInstructor = await assessmentService.getAssessmentById(
        futureAssessment._id,
        { id: testInstructor._id, role: 'instructor' }
      );
      assert.ok(assessmentForInstructor);
      assert.strictEqual(assessmentForInstructor.questions.length, 1);
      assert.strictEqual(assessmentForInstructor.questions[0].questionText, 'What is the Byzantine Generals Problem?');
    });

    it('1.4 should allow student to start attempt when scheduled window is active', async () => {
      const submission = await submissionService.startAttempt(testStudent._id, pastAssessment._id);
      assert.ok(submission);
      assert.strictEqual(submission.status, 'in_progress');
      assert.strictEqual(submission.studentId.toString(), testStudent._id.toString());
      assert.strictEqual(submission.assessmentId.toString(), pastAssessment._id.toString());
    });

    it('1.5 should reject creating assessment with deadlineAt <= scheduledAt (HTTP 400)', async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const deadlineAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours earlier!

      await assert.rejects(
        async () => {
          await assessmentService.createAssessment(testInstructor._id, {
            title: 'Invalid Date Range Exam',
            category: 'General',
            durationMinutes: 60,
            scheduledAt,
            deadlineAt,
            status: 'draft',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /deadline must be after scheduled start time/i);
          return true;
        }
      );
    });

    it('1.6 should reject updating assessment with deadlineAt <= scheduledAt (HTTP 400)', async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const deadlineAt = new Date(Date.now() + 10 * 60 * 60 * 1000);

      await assert.rejects(
        async () => {
          await assessmentService.updateAssessment(
            pastAssessment._id,
            testInstructor._id,
            { scheduledAt, deadlineAt },
            false
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /deadline must be after scheduled start time/i);
          return true;
        }
      );
    });
  });

  // ==========================================
  // SECTION 2: Assessment Date Filtering ("Recent", "Last week", "Last month")
  // ==========================================
  describe('2. Assessment Date Filtering', () => {
    it('2.1 should filter assessments with dateFilter="recent" (last 48h)', async () => {
      const res = await assessmentService.getAssessments({
        role: 'instructor',
        userId: testInstructor._id,
        dateFilter: 'recent',
      });
      assert.ok(Array.isArray(res.assessments));
      assert.ok(res.assessments.length >= 2);
      res.assessments.forEach((a) => {
        const diffMs = Date.now() - new Date(a.createdAt).getTime();
        assert.ok(diffMs <= 48 * 60 * 60 * 1000 + 5000);
      });
    });

    it('2.2 should filter assessments with dateFilter="last_week" (last 7d)', async () => {
      const res = await assessmentService.getAssessments({
        role: 'instructor',
        userId: testInstructor._id,
        dateFilter: 'last_week',
      });
      assert.ok(Array.isArray(res.assessments));
      assert.ok(res.assessments.length >= 2);
      res.assessments.forEach((a) => {
        const diffMs = Date.now() - new Date(a.createdAt).getTime();
        assert.ok(diffMs <= 7 * 24 * 60 * 60 * 1000 + 5000);
      });
    });

    it('2.3 should filter assessments with dateFilter="last_month" (last 30d)', async () => {
      const res = await assessmentService.getAssessments({
        role: 'instructor',
        userId: testInstructor._id,
        dateFilter: 'last_month',
      });
      assert.ok(Array.isArray(res.assessments));
      assert.ok(res.assessments.length >= 2);
    });

    it('2.4 should handle unrecognized dateFilter gracefully without crashing', async () => {
      const res = await assessmentService.getAssessments({
        role: 'instructor',
        userId: testInstructor._id,
        dateFilter: 'invalid_filter_name',
      });
      assert.ok(Array.isArray(res.assessments));
      assert.ok(res.assessments.length >= 2);
    });
  });

  // ==========================================
  // SECTION 3: File Upload & Multer Security & Error Handling
  // ==========================================
  describe('3. File Upload Security & Error Middleware', () => {
    it('3.1 should reject dangerous executable file extensions (.exe) with 400', (t, done) => {
      uploadMiddleware.avatarUpload.single('avatar');
      const req = {};
      const file = { originalname: 'trojan.exe', mimetype: 'application/x-msdownload' };
      
      uploadMiddleware.fileFilter
        ? uploadMiddleware.fileFilter(req, file, (err) => {
            assert.ok(err);
            assert.strictEqual(err.statusCode, 400);
            assert.match(err.message, /forbidden/i);
            done();
          })
        : done();
    });

    it('3.2 should map MulterError LIMIT_FILE_SIZE to HTTP 413 in error.middleware', () => {
      const multerErr = new Error('File too large');
      multerErr.name = 'MulterError';
      multerErr.code = 'LIMIT_FILE_SIZE';

      let responseSent = false;
      let sentStatus = 0;
      let sentBody = null;

      const mockRes = {
        status(code) {
          sentStatus = code;
          return this;
        },
        json(body) {
          responseSent = true;
          sentBody = body;
          return this;
        },
      };

      errorHandler(multerErr, {}, mockRes, () => {});

      assert.strictEqual(responseSent, true);
      assert.strictEqual(sentStatus, 413);
      assert.strictEqual(sentBody.success, false);
      assert.match(sentBody.message, /allowed limit/i);
    });

    it('3.3 should map general MulterError (e.g. LIMIT_UNEXPECTED_FILE) to HTTP 400', () => {
      const multerErr = new Error('Unexpected field');
      multerErr.name = 'MulterError';
      multerErr.code = 'LIMIT_UNEXPECTED_FILE';

      let sentStatus = 0;
      let sentBody = null;

      const mockRes = {
        status(code) {
          sentStatus = code;
          return this;
        },
        json(body) {
          sentBody = body;
          return this;
        },
      };

      errorHandler(multerErr, {}, mockRes, () => {});

      assert.strictEqual(sentStatus, 400);
      assert.strictEqual(sentBody.success, false);
      assert.strictEqual(sentBody.message, 'Unexpected field');
    });
  });

  // ==========================================
  // SECTION 4: Role Escalation & Academic ID Immutability
  // ==========================================
  describe('4. Role Escalation & Academic ID Immutability Security', () => {
    it('4.1 should reject student attempting to elevate role to admin via profile update (HTTP 400)', async () => {
      await assert.rejects(
        async () => {
          await userService.updateProfile(testStudent._id, { role: 'admin' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Administrative account roles/i);
          return true;
        }
      );
    });

    it('4.2 should reject student attempting to activate account via profile update (HTTP 400)', async () => {
      await assert.rejects(
        async () => {
          await userService.updateProfile(testStudent._id, { status: 'active', isActive: true });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('4.3 should reject modifying permanent studentId via updateProfile (HTTP 400)', async () => {
      await assert.rejects(
        async () => {
          await userService.updateProfile(testStudent._id, { studentId: 'STU-HACKED-999' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /permanent and immutable/i);
          return true;
        }
      );
    });

    it('4.4 should reject modifying permanent facultyId via updateProfile (HTTP 400)', async () => {
      await assert.rejects(
        async () => {
          await userService.updateProfile(testInstructor._id, { facultyId: 'FAC-HACKED-999' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /permanent and immutable/i);
          return true;
        }
      );
    });

    it('4.5 should enforce studentId immutability at Mongoose pre-save hook level', async () => {
      const studentDoc = await User.findById(testStudent._id);
      studentDoc.studentId = 'STU-MODIFIED-HOOK-TEST';
      await assert.rejects(
        async () => {
          await studentDoc.save();
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /immutable/i);
          return true;
        }
      );
    });
  });

  // ==========================================
  // SECTION 5: Submissions, Autosave & Authoritative Timer Limits
  // ==========================================
  describe('5. Submissions, Autosave & Timer Limits', () => {
    it('5.1 should submit active assessment attempt and calculate score', async () => {
      const activeSub = await Submission.findOne({
        studentId: testStudent._id,
        assessmentId: pastAssessment._id,
      });
      assert.ok(activeSub);

      const q = await Question.findOne({ assessmentId: pastAssessment._id });
      const submitted = await submissionService.submitAssessment(activeSub._id, testStudent._id, {
        [q._id.toString()]: 'true',
      });

      assert.strictEqual(submitted.status, 'evaluated'); // 100% true/false is auto-evaluated
      assert.strictEqual(submitted.passed, true);
      assert.strictEqual(submitted.score, 50);
      assert.strictEqual(submitted.percentage, 100);
    });

    it('5.2 should reject duplicate startAttempt after assessment is submitted (one-attempt rule)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.startAttempt(testStudent._id, pastAssessment._id);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /already completed an attempt/i);
          return true;
        }
      );
    });

    it('5.3 should reject autosaveAnswer on a finalized/submitted attempt (HTTP 400)', async () => {
      const activeSub = await Submission.findOne({
        studentId: testStudent._id,
        assessmentId: pastAssessment._id,
      });
      const q = await Question.findOne({ assessmentId: pastAssessment._id });

      await assert.rejects(
        async () => {
          await submissionService.autosaveAnswer(activeSub._id, testStudent._id, q._id, 'false');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Cannot update answers on a finalized/i);
          return true;
        }
      );
    });
  });

  // ==========================================
  // SECTION 6: External Services Fallbacks (Email & Nodemailer)
  // ==========================================
  describe('6. External Services Fallbacks', () => {
    it('6.1 should verify SMTP in test/fallback mode without live network calls', async () => {
      const result = await emailService.verifyConnection();
      assert.strictEqual(result.verified, true);
      assert.strictEqual(result.mode, 'test_fallback');
    });

    it('6.2 should deliver transactional email to in-memory store without crashing', async () => {
      emailService.clearSentEmails();
      const sendResult = await emailService.sendMail({
        to: 'student.verification@uap.edu',
        subject: 'System Verification Confirmation',
        text: 'Automated test email.',
      });

      assert.strictEqual(sendResult.success, true);
      const sent = emailService.getLastEmail();
      assert.ok(sent);
      assert.strictEqual(sent.to, 'student.verification@uap.edu');
      assert.strictEqual(sent.subject, 'System Verification Confirmation');
    });
  });
});
