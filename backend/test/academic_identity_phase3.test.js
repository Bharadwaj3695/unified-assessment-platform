const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Question, Submission, Evaluation, Notification, AuditLog } = require('../src/models');
const userService = require('../src/services/user.service');
const evaluationService = require('../src/services/evaluation.service');
const submissionService = require('../src/services/submission.service');
const authService = require('../src/services/auth.service');
const { generateStudentId, generateFacultyId, migrateUserAcademicIds } = require('../src/utils/idGenerator');
const { hashPassword } = require('../src/utils/password');

describe('Phase 3 Verification: Academic Identity, Profiles & Faculty Feedback', () => {
  let studentA;
  let studentB;
  let instructorA;
  let instructorB;
  let adminUser;
  let assessmentA;
  let questionA;
  let submissionA;

  before(async () => {
    await connectDB();
    await seedDatabase();

    // 1. Create or retrieve clean test users with unique identifiers
    const testPassword = await hashPassword('Test@1234');

    studentA = await User.findOne({ email: 'phase3_student_a@uap.edu' });
    if (!studentA) {
      studentA = await User.create({
        name: 'Phase3 Student Alpha',
        email: 'phase3_student_a@uap.edu',
        password: testPassword,
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: 'STU-2026-901',
        department: 'Computer Science',
        avatar: '/uploads/student-alpha.png',
      });
    }

    studentB = await User.findOne({ email: 'phase3_student_b@uap.edu' });
    if (!studentB) {
      studentB = await User.create({
        name: 'Phase3 Student Beta',
        email: 'phase3_student_b@uap.edu',
        password: testPassword,
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: 'STU-2026-902',
        department: 'Software Engineering',
        avatar: '/uploads/student-beta.png',
      });
    }

    instructorA = await User.findOne({ email: 'phase3_instructor_a@uap.edu' });
    if (!instructorA) {
      instructorA = await User.create({
        name: 'Prof. Phase3 Lead',
        email: 'phase3_instructor_a@uap.edu',
        password: testPassword,
        role: 'instructor',
        status: 'active',
        isActive: true,
        facultyId: 'FAC-2026-901',
        department: 'Computer Science & Engineering',
        subjectId: 'CS-401',
        subjectName: 'Artificial Intelligence & Neural Architectures',
        subjectDescription: 'Advanced machine learning, transformers, and model evaluation.',
        avatar: '/uploads/instructor-alpha.png',
      });
    }

    instructorB = await User.findOne({ email: 'phase3_instructor_b@uap.edu' });
    if (!instructorB) {
      instructorB = await User.create({
        name: 'Prof. Foreign Faculty',
        email: 'phase3_instructor_b@uap.edu',
        password: testPassword,
        role: 'instructor',
        status: 'active',
        isActive: true,
        facultyId: 'FAC-2026-902',
        department: 'Mathematics & Computing',
        subjectId: 'MATH-201',
        subjectName: 'Discrete Mathematics',
        subjectDescription: 'Graph theory, combinatorics, and proof methods.',
        avatar: '/uploads/instructor-beta.png',
      });
    }

    adminUser = await User.findOne({ role: 'admin', status: 'active' });

    // 2. Setup Assessment and Question for instructorA
    assessmentA = await Assessment.findOne({ title: 'Phase 3 Verification Assessment' });
    if (!assessmentA) {
      assessmentA = await Assessment.create({
        title: 'Phase 3 Verification Assessment',
        description: 'Comprehensive test for evaluation comments, scoring, and faculty email.',
        category: 'Artificial Intelligence',
        instructorId: instructorA._id,
        durationMinutes: 30,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        allowReview: true,
      });
    }

    questionA = await Question.findOne({ assessmentId: assessmentA._id });
    if (!questionA) {
      questionA = await Question.create({
        assessmentId: assessmentA._id,
        type: 'long_answer',
        questionText: 'Explain the backpropagation algorithm through computational graphs.',
        points: 50,
        orderIndex: 0,
      });
    }

    // 3. Setup Submission for studentA
    await Submission.deleteMany({ assessmentId: assessmentA._id, studentId: studentA._id });
    submissionA = await Submission.create({
      assessmentId: assessmentA._id,
      studentId: studentA._id,
      status: 'submitted',
      evaluationStatus: 'pending',
      answers: new Map([[questionA._id.toString(), 'Backpropagation applies the chain rule in reverse topological order.']]),
      submittedAt: new Date(),
      autoScore: 0,
      totalPoints: 100,
    });
  });

  after(async () => {
    // Clean up test records
    await Submission.deleteMany({ assessmentId: assessmentA._id });
    await Question.deleteMany({ assessmentId: assessmentA._id });
    await Assessment.deleteMany({ title: 'Phase 3 Verification Assessment' });
    await Evaluation.deleteMany({ submissionId: submissionA._id });
    await disconnectDB();
  });

  // ==========================================
  // PART 1: IMMUTABLE STUDENT ID
  // ==========================================
  describe('Part 1: Immutable Student ID', () => {
    it('1. should generate and store student ID with expected format STU-YYYY-XXX', async () => {
      const generatedId = await generateStudentId();
      assert.match(generatedId, /^STU-\d{4}-\d{3}$/, 'Student ID should match STU-YYYY-XXX pattern');
    });

    it('2. should enforce uniqueness for studentId in MongoDB Atlas', async () => {
      const testPass = await hashPassword('Test@1234');
      const duplicateStudent = new User({
        name: 'Duplicate Student Test',
        email: 'duplicate_stu_test@uap.edu',
        password: testPass,
        role: 'student',
        studentId: studentA.studentId, // Duplicate of studentA
      });

      await assert.rejects(
        duplicateStudent.save(),
        (err) => err.code === 11000 || /duplicate key/i.test(err.message),
        'MongoDB unique index should reject duplicate studentId'
      );
    });

    it('3. should allow student to read their own studentId via profile API', async () => {
      const profile = await userService.getProfile(studentA._id);
      assert.strictEqual(profile.studentId, studentA.studentId);
      assert.strictEqual(profile.role, 'student');
    });

    it('4. should strictly reject attempts by student to modify studentId via profile update', async () => {
      await assert.rejects(
        userService.updateProfile(studentA._id, { studentId: 'STU-9999-999' }),
        (err) => err.statusCode === 400 && /immutable/i.test(err.message),
        'Profile update should reject modification of studentId with 400'
      );

      // Verify studentId remains unchanged in database
      const refreshed = await User.findById(studentA._id);
      assert.strictEqual(refreshed.studentId, studentA.studentId);
    });

    it('5. should reject casual modification of studentId at Mongoose model pre-save hook', async () => {
      const stuDoc = await User.findById(studentA._id);
      stuDoc.studentId = 'STU-TAMPERED-001';

      await assert.rejects(
        stuDoc.save(),
        (err) => err.statusCode === 400 && /immutable/i.test(err.message),
        'Mongoose model hook should block modification of studentId'
      );
    });
  });

  // ==========================================
  // PART 2: IMMUTABLE FACULTY ID
  // ==========================================
  describe('Part 2: Immutable Faculty ID', () => {
    it('6. should store facultyId with expected format FAC-YYYY-XXX', async () => {
      const generatedFacultyId = await generateFacultyId();
      assert.match(generatedFacultyId, /^FAC-\d{4}-\d{3}$/, 'Faculty ID should match FAC-YYYY-XXX');
    });

    it('7. should enforce uniqueness for facultyId in database', async () => {
      const testPass = await hashPassword('Test@1234');
      const duplicateFaculty = new User({
        name: 'Duplicate Faculty Test',
        email: 'duplicate_fac_test@uap.edu',
        password: testPass,
        role: 'instructor',
        facultyId: instructorA.facultyId, // Duplicate of instructorA
      });

      await assert.rejects(
        duplicateFaculty.save(),
        (err) => err.code === 11000 || /duplicate key/i.test(err.message),
        'MongoDB unique index should reject duplicate facultyId'
      );
    });

    it('8. should reject attempts by faculty to modify facultyId via profile update', async () => {
      await assert.rejects(
        userService.updateProfile(instructorA._id, { facultyId: 'FAC-MODIFIED-999' }),
        (err) => err.statusCode === 400 && /immutable/i.test(err.message),
        'Profile update should reject modification of facultyId with 400'
      );

      const refreshed = await User.findById(instructorA._id);
      assert.strictEqual(refreshed.facultyId, instructorA.facultyId);
    });

    it('9. should reject casual modification of facultyId at Mongoose model pre-save hook', async () => {
      const facDoc = await User.findById(instructorA._id);
      facDoc.facultyId = 'FAC-TAMPERED-002';

      await assert.rejects(
        facDoc.save(),
        (err) => err.statusCode === 400 && /immutable/i.test(err.message),
        'Mongoose model hook should block modification of facultyId'
      );
    });
  });

  // ==========================================
  // PART 3 & 4 & 5: PROFILES, SUBJECT INFO & ACADEMIC SUMMARY
  // ==========================================
  describe('Parts 3, 4 & 5: Profiles, Academic Identity & Subject Information', () => {
    it('10. should return student profile with profile picture, studentId, and academic summary', async () => {
      const profile = await userService.getProfile(studentA._id);

      assert.ok(profile.studentId, 'studentId must be present');
      assert.ok(profile.avatar, 'avatar must be present');
      assert.ok(profile.department, 'department must be present');
      assert.ok(profile.academicSummary, 'academicSummary must be present');
      assert.strictEqual(profile.email, studentA.email);
    });

    it('11. should return faculty profile with profile picture, facultyId, and subject portfolio', async () => {
      const profile = await userService.getProfile(instructorA._id);

      assert.strictEqual(profile.facultyId, instructorA.facultyId);
      assert.strictEqual(profile.subjectId, 'CS-401');
      assert.strictEqual(profile.subjectName, 'Artificial Intelligence & Neural Architectures');
      assert.ok(profile.subjectDescription, 'subjectDescription must be present');
      assert.strictEqual(profile.avatar, instructorA.avatar);
      assert.strictEqual(profile.department, instructorA.department);
    });

    it('12. should derive truthful academic summary from actual evaluations and avoid false claims', async () => {
      const summary = await userService.getStudentAcademicSummary(studentA._id);
      assert.ok(summary.summary, 'Summary text should be derived');
      assert.ok(typeof summary.metrics.totalCompleted === 'number');
      // Must not contain uncalculated assertions
      assert.doesNotMatch(summary.summary, /Top in class/i);
    });

    it('13. should reject unauthorized profile update modifying restricted fields (role, status, isActive)', async () => {
      await assert.rejects(
        userService.updateProfile(studentA._id, { role: 'admin', isActive: true, status: 'active' }),
        (err) => err.statusCode === 400,
        'Should reject changing system administrative roles/status via profile update'
      );
    });
  });

  // ==========================================
  // PART 6: FACULTY VIEW OF STUDENT IN EVALUATION
  // ==========================================
  describe('Part 6: Faculty View of Student Context in Evaluation', () => {
    it('14. should return student academic identity (avatar, studentId, department) when faculty evaluates owned submission', async () => {
      const subDetails = await submissionService.getSubmissionById(submissionA._id, instructorA._id, 'instructor');

      assert.ok(subDetails.student, 'Student details must be populated');
      assert.strictEqual(subDetails.student.studentId, studentA.studentId);
      assert.strictEqual(subDetails.student.avatar, studentA.avatar);
      assert.strictEqual(subDetails.student.department, studentA.department);
      assert.strictEqual(subDetails.student.email, studentA.email);
    });

    it('15. should block foreign faculty from viewing unrelated student submission details', async () => {
      await assert.rejects(
        submissionService.getSubmissionById(submissionA._id, instructorB._id, 'instructor'),
        (err) => err.statusCode === 403 && /not own the assessment/i.test(err.message),
        'Foreign instructor must be rejected with HTTP 403'
      );
    });
  });

  // ==========================================
  // PART 7 & 8: FACULTY COMMENTS & STUDENT FEEDBACK
  // ==========================================
  describe('Parts 7 & 8: Faculty Comments & Student Feedback View', () => {
    it('16. should allow authorized faculty to add question-level and general evaluation comments', async () => {
      const qId = questionA._id.toString();
      const evalData = {
        questionFeedback: {
          [qId]: {
            pointsAwarded: 45,
            comment: 'Strong explanation of computational graphs and gradient backpropagation.',
          },
        },
        generalFeedback: 'Exceptional comprehension of deep learning mathematical foundations.',
      };

      const result = await evaluationService.evaluateSubmission(instructorA._id, submissionA._id, evalData);

      assert.ok(result.evaluation);
      assert.strictEqual(result.evaluation.generalFeedback, evalData.generalFeedback);
      const qFeedback = result.evaluation.questionFeedback.get
        ? result.evaluation.questionFeedback.get(qId)
        : result.evaluation.questionFeedback[qId];
      assert.strictEqual(qFeedback.pointsAwarded, 45);
      assert.strictEqual(qFeedback.comment, evalData.questionFeedback[qId].comment);
      assert.strictEqual(result.submission.feedback, evalData.generalFeedback);
      assert.strictEqual(result.submission.status, 'evaluated');
    });

    it('17. should reject evaluation comments from foreign faculty who does not own the assessment', async () => {
      const qId = questionA._id.toString();
      const foreignEvalData = {
        questionFeedback: { [qId]: { pointsAwarded: 10, comment: 'Unauthorized review' } },
        generalFeedback: 'Should be rejected',
      };

      await assert.rejects(
        evaluationService.evaluateSubmission(instructorB._id, submissionA._id, foreignEvalData),
        (err) => err.statusCode === 403 && /Access denied/i.test(err.message),
        'Foreign instructor must be rejected with 403'
      );
    });

    it('18. should allow student to read their own evaluation feedback and question comments', async () => {
      const studentView = await submissionService.getSubmissionById(submissionA._id, studentA._id, 'student');

      assert.ok(studentView.evaluation, 'Student should see evaluation');
      assert.strictEqual(studentView.evaluation.generalFeedback, 'Exceptional comprehension of deep learning mathematical foundations.');
      const qId = questionA._id.toString();
      assert.strictEqual(studentView.evaluation.questionFeedback[qId].comment, 'Strong explanation of computational graphs and gradient backpropagation.');
      assert.strictEqual(studentView.evaluation.evaluatorId.name, instructorA.name);
    });

    it('19. should block another student from reading foreign student feedback', async () => {
      await assert.rejects(
        submissionService.getSubmissionById(submissionA._id, studentB._id, 'student'),
        (err) => err.statusCode === 403 && /Unauthorized access/i.test(err.message),
        'Other students must be blocked with HTTP 403'
      );
    });
  });

  // ==========================================
  // PART 9: FACULTY EMAIL TO STUDENT
  // ==========================================
  describe('Part 9: Faculty Email to Student Action', () => {
    it('20. should allow authorized faculty to send direct academic email to student for owned submission', async () => {
      const emailPayload = {
        subject: 'Commendation on Deep Learning Assessment',
        message: 'Dear Alex, your mathematical derivations on computational graphs were outstanding. Keep up the great work!',
      };

      const result = await evaluationService.sendStudentEmail(instructorA._id, submissionA._id, emailPayload);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.recipientEmail, studentA.email);
      assert.strictEqual(result.subject, emailPayload.subject);
    });

    it('21. should reject foreign faculty from emailing student on an assessment they do not own', async () => {
      const unauthorizedPayload = {
        subject: 'Foreign Instructor Contact',
        message: 'This message should not be permitted to send.',
      };

      await assert.rejects(
        evaluationService.sendStudentEmail(instructorB._id, submissionA._id, unauthorizedPayload),
        (err) => err.statusCode === 403 && /not own the assessment/i.test(err.message),
        'Foreign faculty email attempt must return HTTP 403'
      );
    });

    it('22. should resolve recipient strictly from student account record and ignore arbitrary recipient inputs', async () => {
      const payloadWithSpoofedRecipient = {
        recipient: 'victim@external.com', // Attempted recipient spoofing
        subject: 'Security Check on Email Recipient Resolution',
        message: 'Verifying that email is strictly dispatched to student record email only.',
      };

      const result = await evaluationService.sendStudentEmail(instructorA._id, submissionA._id, payloadWithSpoofedRecipient);
      assert.strictEqual(result.recipientEmail, studentA.email, 'Recipient must strictly be student account email');
    });

    it('23. should never expose SMTP credentials in API responses', async () => {
      const result = await evaluationService.sendStudentEmail(instructorA._id, submissionA._id, {
        subject: 'Security Audit: SMTP Leak Prevention',
        message: 'Checking that SMTP credentials, passwords, and tokens are omitted.',
      });

      const jsonStr = JSON.stringify(result);
      assert.strictEqual(/password|secret|auth|transporter/i.test(jsonStr), false, 'SMTP credentials must never be in response');
    });

    it('24. should create both in-app notification and audit log for faculty email communication', async () => {
      const latestNotification = await Notification.findOne({
        userId: studentA._id,
        type: 'info',
        title: { $regex: /Message from Faculty/i },
      }).sort({ createdAt: -1 });

      assert.ok(latestNotification, 'Student should receive in-app notification of faculty email');

      const auditEntry = await AuditLog.findOne({
        action: 'FACULTY_SENT_STUDENT_EMAIL',
        entityId: submissionA._id.toString(),
      }).sort({ createdAt: -1 });

      assert.ok(auditEntry, 'Audit log must record email event');
      assert.strictEqual(auditEntry.details.recipientEmail, studentA.email);
    });
  });

  // ==========================================
  // PART 10 & 15: NOTIFICATION & MIGRATION VERIFICATION
  // ==========================================
  describe('Parts 10 & 15: Feedback Notifications & Existing User Migration', () => {
    it('25. should generate "New Faculty Feedback" notification when faculty grades submission', async () => {
      const feedbackNotification = await Notification.findOne({
        userId: studentA._id,
        title: 'New Faculty Feedback',
      }).sort({ createdAt: -1 });

      assert.ok(feedbackNotification, 'Student should have received New Faculty Feedback notification');
      assert.ok(feedbackNotification.message.includes(assessmentA.title));
    });

    it('26. should safely backfill studentId and facultyId for existing accounts without overwriting existing IDs', async () => {
      // Create legacy accounts without academic IDs
      const legacyStudent = await User.create({
        name: 'Legacy Student Account',
        email: 'legacy_student_backfill@uap.edu',
        password: await hashPassword('Test@1234'),
        role: 'student',
        studentId: null,
      });

      const legacyInstructor = await User.create({
        name: 'Legacy Faculty Account',
        email: 'legacy_faculty_backfill@uap.edu',
        password: await hashPassword('Test@1234'),
        role: 'instructor',
        facultyId: null,
      });

      const migrationResult = await migrateUserAcademicIds();
      assert.ok(migrationResult.migratedStudentsCount >= 1, 'Should migrate at least 1 student');
      assert.ok(migrationResult.migratedInstructorsCount >= 1, 'Should migrate at least 1 instructor');

      const updatedStudent = await User.findById(legacyStudent._id);
      assert.ok(updatedStudent.studentId, 'Legacy student must receive studentId');
      assert.match(updatedStudent.studentId, /^STU-\d{4}-\d{3}$/);

      const updatedInstructor = await User.findById(legacyInstructor._id);
      assert.ok(updatedInstructor.facultyId, 'Legacy faculty must receive facultyId');
      assert.match(updatedInstructor.facultyId, /^FAC-\d{4}-\d{3}$/);

      // Verify existing studentA's studentId was NOT overwritten
      const preservedStudentA = await User.findById(studentA._id);
      assert.strictEqual(preservedStudentA.studentId, studentA.studentId, 'Existing valid studentId must be preserved');

      // Cleanup legacy accounts
      await User.deleteMany({ email: { $in: ['legacy_student_backfill@uap.edu', 'legacy_faculty_backfill@uap.edu'] } });
    });
  });
});
