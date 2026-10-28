const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');
const evaluationService = require('../src/services/evaluation.service');
const {
  User,
  Assessment,
  Question,
  Submission,
  Evaluation,
  CertificateTemplate,
  Certificate,
} = require('../src/models');
const {
  DEFAULT_GRADING_SCHEME,
  NON_PASSING_FEEDBACK,
  validateGradingScheme,
  resolveGrade,
} = require('../src/utils/gradingScheme');

describe('Phase 2 Verification: Grading Scheme & Certification Configuration', () => {
  let instructor;
  let student;
  let testAssessment;
  let testTemplate;

  before(async () => {
    await connectDB();
    await seedDatabase();

    instructor = await User.findOne({ email: 'instructor@uap.edu' });
    student = await User.findOne({ email: 'student@uap.edu' });

    // Ensure clean state for test models
    await Certificate.deleteMany({});
    await CertificateTemplate.deleteMany({});

    // Create an institutional certificate template for template selection tests
    testTemplate = await CertificateTemplate.create({
      title: 'Institutional Excellence Template',
      name: 'Institutional Excellence Template',
      description: 'Default template for accredited institutional certificates',
      orientation: 'landscape',
      pageSize: 'A4',
      status: 'published',
      isDefault: true,
      createdBy: instructor._id,
    });
  });

  after(async () => {
    await Certificate.deleteMany({});
    await CertificateTemplate.deleteMany({});
    await disconnectDB();
  });

  describe('Part 1: Grading Scheme Utility & Mathematical Boundary Verification', () => {
    it('1.1 should have approved default grading bands spanning 0% to 100%', () => {
      assert.strictEqual(DEFAULT_GRADING_SCHEME.length, 6);
      const validation = validateGradingScheme(DEFAULT_GRADING_SCHEME);
      assert.strictEqual(validation.valid, true, `Validation failed: ${validation.error}`);

      // Verify specific approved tiers and labels
      const grades = DEFAULT_GRADING_SCHEME.map((b) => b.grade);
      assert.deepStrictEqual(grades, ['A+', 'A', 'B+', 'B', 'C', 'F']);

      const labels = DEFAULT_GRADING_SCHEME.map((b) => b.label);
      assert.deepStrictEqual(labels, [
        'Outstanding',
        'Excellent',
        'Very Good',
        'Good',
        'Satisfactory',
        'Try Again',
      ]);

      // Confirm 'Unsatisfactory' is never used
      assert.strictEqual(
        labels.some((l) => l.toLowerCase().includes('unsatisfactory')),
        false,
        'Default grading scheme must never use "Unsatisfactory"'
      );
    });

    it('1.2 should reject grading schemes with gaps between bands', () => {
      const gappedScheme = [
        { grade: 'A', minPercentage: 80, maxPercentage: 100, label: 'Excellent' },
        { grade: 'B', minPercentage: 50, maxPercentage: 70, label: 'Pass' }, // GAP: 70% to 80%
        { grade: 'F', minPercentage: 0, maxPercentage: 50, label: 'Try Again' },
      ];
      const validation = validateGradingScheme(gappedScheme);
      assert.strictEqual(validation.valid, false);
      assert.match(validation.error, /gap detected/i);
    });

    it('1.3 should reject grading schemes with overlapping bands', () => {
      const overlappingScheme = [
        { grade: 'A', minPercentage: 75, maxPercentage: 100, label: 'Excellent' },
        { grade: 'B', minPercentage: 60, maxPercentage: 80, label: 'Good' }, // OVERLAP: 75% to 80%
        { grade: 'F', minPercentage: 0, maxPercentage: 60, label: 'Try Again' },
      ];
      const validation = validateGradingScheme(overlappingScheme);
      assert.strictEqual(validation.valid, false);
      assert.match(validation.error, /overlap detected/i);
    });

    it('1.4 should reject schemes that do not start at 0% or end at 100%', () => {
      const notEndingAt100 = [
        { grade: 'A', minPercentage: 50, maxPercentage: 90, label: 'Pass' },
        { grade: 'F', minPercentage: 0, maxPercentage: 50, label: 'Fail' },
      ];
      const res1 = validateGradingScheme(notEndingAt100);
      assert.strictEqual(res1.valid, false);
      assert.match(res1.error, /maximum of 100%/i);

      const notStartingAt0 = [
        { grade: 'A', minPercentage: 50, maxPercentage: 100, label: 'Pass' },
        { grade: 'F', minPercentage: 10, maxPercentage: 50, label: 'Fail' },
      ];
      const res2 = validateGradingScheme(notStartingAt0);
      assert.strictEqual(res2.valid, false);
      assert.match(res2.error, /minimum of 0%/i);
    });

    it('1.5 should reject schemes with inverted boundaries (min >= max)', () => {
      const inverted = [
        { grade: 'A', minPercentage: 100, maxPercentage: 80, label: 'Error' },
        { grade: 'F', minPercentage: 0, maxPercentage: 80, label: 'Fail' },
      ];
      const validation = validateGradingScheme(inverted);
      assert.strictEqual(validation.valid, false);
      assert.match(validation.error, /must be less than max percentage/i);
    });

    it('1.6 resolveGrade: should accurately resolve exact boundaries [min, max)', () => {
      // 100% -> A+ (Outstanding, Passing)
      const r100 = resolveGrade(100);
      assert.strictEqual(r100.grade, 'A+');
      assert.strictEqual(r100.label, 'Outstanding');
      assert.strictEqual(r100.isPassing, true);

      // 90% -> A+ (Outstanding, min boundary inclusive)
      const r90 = resolveGrade(90);
      assert.strictEqual(r90.grade, 'A+');
      assert.strictEqual(r90.label, 'Outstanding');
      assert.strictEqual(r90.isPassing, true);

      // 89.99% -> A (Excellent)
      const r8999 = resolveGrade(89.99);
      assert.strictEqual(r8999.grade, 'A');
      assert.strictEqual(r8999.label, 'Excellent');
      assert.strictEqual(r8999.isPassing, true);

      // 80% -> A (Excellent, min boundary inclusive)
      const r80 = resolveGrade(80);
      assert.strictEqual(r80.grade, 'A');
      assert.strictEqual(r80.label, 'Excellent');
      assert.strictEqual(r80.isPassing, true);

      // 79.99% -> B+ (Very Good)
      const r7999 = resolveGrade(79.99);
      assert.strictEqual(r7999.grade, 'B+');
      assert.strictEqual(r7999.label, 'Very Good');
      assert.strictEqual(r7999.isPassing, true);

      // 70% -> B+ (Very Good, min boundary inclusive)
      const r70 = resolveGrade(70);
      assert.strictEqual(r70.grade, 'B+');
      assert.strictEqual(r70.label, 'Very Good');
      assert.strictEqual(r70.isPassing, true);

      // 69.99% -> B (Good)
      const r6999 = resolveGrade(69.99);
      assert.strictEqual(r6999.grade, 'B');
      assert.strictEqual(r6999.label, 'Good');
      assert.strictEqual(r6999.isPassing, true);

      // 60% -> B (Good, min boundary inclusive)
      const r60 = resolveGrade(60);
      assert.strictEqual(r60.grade, 'B');
      assert.strictEqual(r60.label, 'Good');
      assert.strictEqual(r60.isPassing, true);

      // 59.99% -> C (Satisfactory)
      const r5999 = resolveGrade(59.99);
      assert.strictEqual(r5999.grade, 'C');
      assert.strictEqual(r5999.label, 'Satisfactory');
      assert.strictEqual(r5999.isPassing, true);

      // 50% -> C (Satisfactory, min boundary inclusive)
      const r50 = resolveGrade(50);
      assert.strictEqual(r50.grade, 'C');
      assert.strictEqual(r50.label, 'Satisfactory');
      assert.strictEqual(r50.isPassing, true);
      assert.strictEqual(r50.outcomeFeedback, '');

      // 49.99% -> F (Try Again, Non-passing)
      const r4999 = resolveGrade(49.99);
      assert.strictEqual(r4999.grade, 'F');
      assert.strictEqual(r4999.label, 'Try Again');
      assert.strictEqual(r4999.isPassing, false);
      assert.strictEqual(r4999.outcomeFeedback, NON_PASSING_FEEDBACK);

      // 0% -> F (Try Again, Non-passing)
      const r0 = resolveGrade(0);
      assert.strictEqual(r0.grade, 'F');
      assert.strictEqual(r0.label, 'Try Again');
      assert.strictEqual(r0.isPassing, false);
      assert.strictEqual(r0.outcomeFeedback, NON_PASSING_FEEDBACK);
    });

    it('1.7 resolveGrade: handles custom passing threshold (e.g. 70%)', () => {
      // With threshold = 70%, a score of 65% gets Grade B (Good) but isPassing = false
      const r65 = resolveGrade(65, DEFAULT_GRADING_SCHEME, 70);
      assert.strictEqual(r65.grade, 'B');
      assert.strictEqual(r65.label, 'Good');
      assert.strictEqual(r65.isPassing, false);
      assert.strictEqual(r65.outcomeFeedback, NON_PASSING_FEEDBACK);

      // Score of 70% is passing
      const r70 = resolveGrade(70, DEFAULT_GRADING_SCHEME, 70);
      assert.strictEqual(r70.grade, 'B+');
      assert.strictEqual(r70.label, 'Very Good');
      assert.strictEqual(r70.isPassing, true);
      assert.strictEqual(r70.outcomeFeedback, '');
    });
  });

  describe('Part 2: Assessment Certification Persistence & Validation', () => {
    it('2.1 should create assessment with certification disabled by default', async () => {
      const created = await assessmentService.createAssessment(instructor._id, {
        title: 'Algorithms Midterm (No Cert)',
        category: 'Computer Science',
        durationMinutes: 45,
        totalPoints: 50,
        passingScore: 50,
        status: 'draft',
        questions: [
          {
            questionText: 'Is binary search O(log n)?',
            type: 'mcq',
            points: 50,
            options: [
              { id: '1', text: 'Yes' },
              { id: '2', text: 'No' },
            ],
            correctAnswer: '1',
          },
        ],
      });

      const fetched = await Assessment.findById(created._id);
      assert.strictEqual(fetched.certification.enabled, false);
      assert.strictEqual(fetched.certification.passingPercentage, 50);
      assert.strictEqual(fetched.certification.gradingScheme.length, 6);
    });

    it('2.2 should create assessment with certification explicitly enabled and configured', async () => {
      const created = await assessmentService.createAssessment(instructor._id, {
        title: 'Distributed Consensus Certification Exam',
        category: 'Computer Science',
        durationMinutes: 90,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        certification: {
          enabled: true,
          passingPercentage: 60,
          templateId: testTemplate._id,
          certificateTitle: 'Accredited Specialist in Distributed Consensus',
          signatoryName: 'Dr. Leslie Lamport',
          signatoryTitle: 'Distinguished Fellow of Systems',
        },
        questions: [
          {
            questionText: 'Which algorithm achieves Paxos-equivalent consensus with a leader?',
            type: 'mcq',
            points: 100,
            options: [
              { id: '1', text: 'Raft' },
              { id: '2', text: 'Round Robin' },
            ],
            correctAnswer: '1',
          },
        ],
      });

      testAssessment = await Assessment.findById(created._id);
      assert.strictEqual(testAssessment.certification.enabled, true);
      assert.strictEqual(testAssessment.certification.passingPercentage, 60);
      assert.strictEqual(
        testAssessment.certification.certificateTitle,
        'Accredited Specialist in Distributed Consensus'
      );
      assert.strictEqual(testAssessment.certification.signatoryName, 'Dr. Leslie Lamport');
      assert.strictEqual(
        testAssessment.certification.templateId.toString(),
        testTemplate._id.toString()
      );
    });

    it('2.3 should update assessment certification settings', async () => {
      const updated = await assessmentService.updateAssessment(
        testAssessment._id,
        instructor._id,
        {
          certification: {
            enabled: true,
            passingPercentage: 70, // Bump threshold to 70%
            templateId: testTemplate._id,
            certificateTitle: 'Senior Specialist in Distributed Consensus',
            signatoryName: 'Dr. Leslie Lamport',
            signatoryTitle: 'VP of Academic Standards',
          },
        }
      );

      assert.strictEqual(updated.certification.passingPercentage, 70);
      assert.strictEqual(
        updated.certification.certificateTitle,
        'Senior Specialist in Distributed Consensus'
      );
      assert.strictEqual(
        updated.certification.signatoryTitle,
        'VP of Academic Standards'
      );
    });

    it('2.4 should reject updating assessment with invalid gapped gradingScheme', async () => {
      await assert.rejects(
        async () => {
          await assessmentService.updateAssessment(
            testAssessment._id,
            instructor._id,
            {
              certification: {
                enabled: true,
                gradingScheme: [
                  { grade: 'A', minPercentage: 80, maxPercentage: 100, label: 'High' },
                  { grade: 'B', minPercentage: 40, maxPercentage: 60, label: 'Low' }, // GAP 60-80
                  { grade: 'F', minPercentage: 0, maxPercentage: 40, label: 'Fail' },
                ],
              },
            }
          );
        },
        (err) => {
          assert.match(err.message, /gap detected/i);
          return true;
        }
      );
    });

    it('2.5 should retrieve approved published templates via service', async () => {
      const templates = await assessmentService.getApprovedTemplates();
      assert.ok(Array.isArray(templates));
      assert.ok(templates.length >= 1);
      assert.strictEqual(templates[0].name, 'Institutional Excellence Template');
    });
  });

  describe('Part 3: Evaluation Outcome Persistence (grade, gradeLabel, passed, feedback)', () => {
    let qId;

    before(async () => {
      const q = await Question.findOne({ assessmentId: testAssessment._id });
      qId = q._id.toString();
    });

    it('3.1 should automatically record grade, gradeLabel, passed, outcomeFeedback on Evaluation when student passes', async () => {
      // Reset passing percentage back to 60% for test
      await Assessment.findByIdAndUpdate(testAssessment._id, {
        'certification.passingPercentage': 60,
      });

      // Student starts attempt
      const startRes = await submissionService.startAttempt(student._id, testAssessment._id);
      const submissionId = startRes._id;

      // Submit correct answer (100% score)
      await submissionService.submitAssessment(
        submissionId,
        student._id,
        {
          [qId]: '1', // Correct answer
        },
        false
      );

      // Verify Evaluation document was created with grade resolution fields
      const evaluation = await Evaluation.findOne({ submissionId });
      assert.ok(evaluation, 'Evaluation record should exist');
      assert.strictEqual(evaluation.finalScore, 100);
      assert.strictEqual(evaluation.percentage, 100);
      assert.strictEqual(evaluation.grade, 'A+');
      assert.strictEqual(evaluation.gradeLabel, 'Outstanding');
      assert.strictEqual(evaluation.passed, true);
      assert.strictEqual(evaluation.certificateEligible, true);
      assert.strictEqual(evaluation.outcomeFeedback, '');
    });

    it('3.2 should record encouraging feedback and label "Try Again" when student fails', async () => {
      // Create a second student or clear previous submission for this test
      await Submission.deleteMany({ assessmentId: testAssessment._id });
      await Evaluation.deleteMany({});

      const startRes = await submissionService.startAttempt(student._id, testAssessment._id);
      const submissionId = startRes._id;

      // Submit incorrect answer (0% score)
      await submissionService.submitAssessment(
        submissionId,
        student._id,
        {
          [qId]: '2', // Incorrect answer
        },
        false
      );

      const evaluation = await Evaluation.findOne({ submissionId });
      assert.ok(evaluation, 'Evaluation record should exist');
      assert.strictEqual(evaluation.finalScore, 0);
      assert.strictEqual(evaluation.percentage, 0);
      assert.strictEqual(evaluation.grade, 'F');
      assert.strictEqual(evaluation.gradeLabel, 'Try Again');
      assert.strictEqual(evaluation.passed, false);
      assert.strictEqual(evaluation.certificateEligible, false);
      assert.strictEqual(evaluation.outcomeFeedback, NON_PASSING_FEEDBACK);

      // Confirm 'Unsatisfactory' is not present
      assert.strictEqual(evaluation.gradeLabel.includes('Unsatisfactory'), false);
    });

    it('3.3 should persist grade outcome when instructor manually evaluates subjective questions', async () => {
      // Create assessment with subjective question
      const subjAssessment = await Assessment.create({
        title: 'Subjective Architectural Defense',
        category: 'Software Engineering',
        instructorId: instructor._id,
        durationMinutes: 60,
        totalPoints: 100,
        passingScore: 50,
        status: 'published',
        certification: {
          enabled: true,
          passingPercentage: 60,
        },
      });

      const essayQ = await Question.create({
        assessmentId: subjAssessment._id,
        questionText: 'Explain Paxos vs Raft consensus invariants.',
        type: 'long_answer',
        points: 100,
      });

      const attempt = await submissionService.startAttempt(student._id, subjAssessment._id);
      const subId = attempt._id;

      await submissionService.submitAssessment(
        subId,
        student._id,
        {
          [essayQ._id.toString()]: 'Raft uses strong leader invariant and log matching...',
        },
        false
      );

      // Instructor awards 85 points (85% -> Grade A, Excellent, passing)
      const evalResult = await evaluationService.evaluateSubmission(
        instructor._id,
        subId,
        {
          questionFeedback: {
            [essayQ._id.toString()]: {
              pointsAwarded: 85,
              comment: 'Rigorous and comprehensive analysis.',
            },
          },
          generalFeedback: 'Outstanding technical depth demonstrated.',
        }
      );

      const evalDoc = await Evaluation.findOne({ submissionId: subId });
      assert.ok(evalDoc);
      assert.strictEqual(evalDoc.finalScore, 85);
      assert.strictEqual(evalDoc.percentage, 85);
      assert.strictEqual(evalDoc.grade, 'A');
      assert.strictEqual(evalDoc.gradeLabel, 'Excellent');
      assert.strictEqual(evalDoc.passed, true);
      assert.strictEqual(evalDoc.certificateEligible, true);
      assert.strictEqual(evalDoc.outcomeFeedback, '');
    });

    it('3.4 should distinguish different assessment passing score vs certification passing threshold', async () => {
      // Assessment passing score = 50%, Certification passing threshold = 75%
      const dualThresholdAssessment = await Assessment.create({
        title: 'Dual Threshold Systems Exam',
        category: 'Computer Science',
        instructorId: instructor._id,
        durationMinutes: 60,
        totalPoints: 100,
        passingScore: 50,
        status: 'published',
        certification: {
          enabled: true,
          passingPercentage: 75,
        },
      });

      const q1 = await Question.create({
        assessmentId: dualThresholdAssessment._id,
        questionText: 'Question 1 (60 points)',
        type: 'mcq',
        points: 60,
        options: [{ id: '1', text: 'Correct' }, { id: '2', text: 'Wrong' }],
        correctAnswer: '1',
      });

      const q2 = await Question.create({
        assessmentId: dualThresholdAssessment._id,
        questionText: 'Question 2 (40 points)',
        type: 'mcq',
        points: 40,
        options: [{ id: '1', text: 'Correct' }, { id: '2', text: 'Wrong' }],
        correctAnswer: '1',
      });

      // Scenario A: Student scores 60% (answers Q1 correct, Q2 incorrect)
      // 60% >= 50% passingScore -> passed = true
      // 60% < 75% certification -> certificateEligible = false
      const attemptA = await submissionService.startAttempt(student._id, dualThresholdAssessment._id);
      await submissionService.submitAssessment(
        attemptA._id,
        student._id,
        { [q1._id.toString()]: '1', [q2._id.toString()]: '2' },
        false
      );

      const evalA = await Evaluation.findOne({ submissionId: attemptA._id });
      assert.ok(evalA);
      assert.strictEqual(evalA.percentage, 60);
      assert.strictEqual(evalA.passed, true, 'Student should pass assessment with 60% >= 50%');
      assert.strictEqual(evalA.certificateEligible, false, 'Student should NOT be certificate eligible with 60% < 75%');
      assert.strictEqual(evalA.grade, 'B');
      assert.strictEqual(evalA.gradeLabel, 'Good');
      assert.strictEqual(evalA.outcomeFeedback, '', 'Passing assessment should have no non-passing feedback');

      // Clean up attempt to allow Scenario B
      await Submission.deleteMany({ assessmentId: dualThresholdAssessment._id });
      await Evaluation.deleteMany({ submissionId: attemptA._id });

      // Scenario B: Student scores 100% (answers both Q1 and Q2 correct)
      // 100% >= 50% passingScore -> passed = true
      // 100% >= 75% certification -> certificateEligible = true
      const attemptB = await submissionService.startAttempt(student._id, dualThresholdAssessment._id);
      await submissionService.submitAssessment(
        attemptB._id,
        student._id,
        { [q1._id.toString()]: '1', [q2._id.toString()]: '1' },
        false
      );

      const evalB = await Evaluation.findOne({ submissionId: attemptB._id });
      assert.ok(evalB);
      assert.strictEqual(evalB.percentage, 100);
      assert.strictEqual(evalB.passed, true);
      assert.strictEqual(evalB.certificateEligible, true);
      assert.strictEqual(evalB.grade, 'A+');
    });

    it('3.5 should NOT mark certificateEligible when certification is disabled even if student passes with 100%', async () => {
      const disabledCertAssessment = await Assessment.create({
        title: 'Cert Disabled Architecture Quiz',
        category: 'Software Engineering',
        instructorId: instructor._id,
        durationMinutes: 30,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        certification: {
          enabled: false,
          passingPercentage: 50,
        },
      });

      const q = await Question.create({
        assessmentId: disabledCertAssessment._id,
        questionText: 'Is microservices architecture distributed?',
        type: 'mcq',
        points: 100,
        options: [{ id: '1', text: 'Yes' }, { id: '2', text: 'No' }],
        correctAnswer: '1',
      });

      const attempt = await submissionService.startAttempt(student._id, disabledCertAssessment._id);
      await submissionService.submitAssessment(
        attempt._id,
        student._id,
        { [q._id.toString()]: '1' },
        false
      );

      const evalDoc = await Evaluation.findOne({ submissionId: attempt._id });
      assert.ok(evalDoc);
      assert.strictEqual(evalDoc.percentage, 100);
      assert.strictEqual(evalDoc.passed, true, 'Assessment passed');
      assert.strictEqual(
        evalDoc.certificateEligible,
        false,
        'Certificate eligible MUST be false when certification is disabled'
      );
    });

    it('3.6 should ignore client-submitted grades, scores, or eligibility in submitAssessment', async () => {
      const secureAssessment = await Assessment.create({
        title: 'Security Tamper Resistance Exam',
        category: 'Cybersecurity',
        instructorId: instructor._id,
        durationMinutes: 30,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        certification: {
          enabled: true,
          passingPercentage: 60,
        },
      });

      const q = await Question.create({
        assessmentId: secureAssessment._id,
        questionText: 'Choose the correct answer',
        type: 'mcq',
        points: 100,
        options: [{ id: '1', text: 'Correct' }, { id: '2', text: 'Incorrect' }],
        correctAnswer: '1',
      });

      const attempt = await submissionService.startAttempt(student._id, secureAssessment._id);

      // Student attempts to submit forged metadata along with incorrect answer
      await submissionService.submitAssessment(
        attempt._id,
        student._id,
        {
          [q._id.toString()]: '2', // Incorrect answer
          // Tampered fields injected into answer dictionary or payload:
          score: 100,
          finalScore: 100,
          percentage: 100,
          grade: 'A+',
          gradeLabel: 'Outstanding',
          passed: true,
          certificateEligible: true,
        },
        false
      );

      const evalDoc = await Evaluation.findOne({ submissionId: attempt._id });
      assert.ok(evalDoc);
      assert.strictEqual(evalDoc.finalScore, 0, 'Score must be calculated from authoritative question key');
      assert.strictEqual(evalDoc.percentage, 0);
      assert.strictEqual(evalDoc.grade, 'F');
      assert.strictEqual(evalDoc.gradeLabel, 'Try Again');
      assert.strictEqual(evalDoc.passed, false);
      assert.strictEqual(evalDoc.certificateEligible, false);
      assert.strictEqual(evalDoc.outcomeFeedback, NON_PASSING_FEEDBACK);
    });

    it('3.7 should persist custom grading scheme after saving and reloading from MongoDB', async () => {
      const customScheme = [
        { grade: 'Honors', minPercentage: 85, maxPercentage: 100, label: 'Highest Honors' },
        { grade: 'Pass', minPercentage: 55, maxPercentage: 85, label: 'Standard Pass' },
        { grade: 'F', minPercentage: 0, maxPercentage: 55, label: 'Try Again' },
      ];

      const created = await assessmentService.createAssessment(instructor._id, {
        title: 'Custom Honors Policy Exam',
        category: 'Computer Science',
        durationMinutes: 60,
        totalPoints: 100,
        passingScore: 55,
        status: 'draft',
        certification: {
          enabled: true,
          passingPercentage: 85,
          gradingScheme: customScheme,
          certificateTitle: 'Honors Certification Award',
          signatoryName: 'Prof. Turing',
          signatoryTitle: 'Chair of Computing',
        },
      });

      // Reload directly from MongoDB Atlas / mongoose
      const reloaded = await Assessment.findById(created._id).lean();
      assert.ok(reloaded);
      assert.strictEqual(reloaded.certification.enabled, true);
      assert.strictEqual(reloaded.certification.passingPercentage, 85);
      assert.strictEqual(reloaded.certification.certificateTitle, 'Honors Certification Award');
      assert.strictEqual(reloaded.certification.signatoryName, 'Prof. Turing');
      assert.strictEqual(reloaded.certification.signatoryTitle, 'Chair of Computing');
      assert.strictEqual(reloaded.certification.gradingScheme.length, 3);
      assert.strictEqual(reloaded.certification.gradingScheme[0].grade, 'Honors');
      assert.strictEqual(reloaded.certification.gradingScheme[0].label, 'Highest Honors');
      assert.strictEqual(reloaded.certification.gradingScheme[1].grade, 'Pass');
      assert.strictEqual(reloaded.certification.gradingScheme[2].grade, 'F');
    });

    it('3.8 should automatically issue Certificate when student meets certification threshold', async () => {
      const certAsmt = await Assessment.create({
        title: 'Auto Issuance Verification Exam',
        category: 'Software Engineering',
        instructorId: instructor._id,
        durationMinutes: 45,
        totalPoints: 100,
        passingScore: 50,
        status: 'published',
        certification: {
          enabled: true,
          passingPercentage: 70,
          templateId: testTemplate._id,
          certificateTitle: 'Certified Software Engineer',
        },
      });

      const q = await Question.create({
        assessmentId: certAsmt._id,
        questionText: 'Is clean code maintainable?',
        type: 'mcq',
        points: 100,
        options: [{ id: '1', text: 'Yes' }, { id: '2', text: 'No' }],
        correctAnswer: '1',
      });

      const attempt = await submissionService.startAttempt(student._id, certAsmt._id);
      await submissionService.submitAssessment(attempt._id, student._id, { [q._id.toString()]: '1' });

      // Certificate record must be persisted
      const certDoc = await Certificate.findOne({
        studentId: student._id,
        assessmentId: certAsmt._id,
      });
      assert.ok(certDoc, 'Certificate document must exist in MongoDB');
      assert.strictEqual(certDoc.status, 'active');
      assert.strictEqual(certDoc.academicSnapshot.percentage, 100);
      assert.strictEqual(certDoc.academicSnapshot.grade, 'A+');
      assert.strictEqual(certDoc.academicSnapshot.certificateTitle, 'Certified Software Engineer');

      // Verify that instructor submissions queue includes certificate details
      const instructorQueue = await evaluationService.getSubmissionsForInstructor(instructor._id, {
        assessmentId: certAsmt._id,
      });
      assert.ok(instructorQueue.submissions.length > 0);
      const subItem = instructorQueue.submissions[0];
      assert.ok(subItem.certificate, 'Instructor submission must include certificate');
      assert.strictEqual(subItem.certificate.certificateId, certDoc.certificateId);

      // Verify that student submissions query includes certificate details
      const studentSubs = await submissionService.getStudentSubmissions(student._id);
      const foundSub = studentSubs.find((s) => (s.assessment?._id || s.assessment)?.toString() === certAsmt._id.toString());
      assert.ok(foundSub, 'Student submissions must include submitted assessment');
      assert.ok(foundSub.certificate, 'Student submission must include certificate');
      assert.strictEqual(foundSub.certificate.certificateId, certDoc.certificateId);
    });

    it('3.9 should NOT issue certificate when student passes ordinary assessment but falls below certification threshold', async () => {
      const highCertAsmt = await Assessment.create({
        title: 'High Bar Certification Exam',
        category: 'Computer Science',
        instructorId: instructor._id,
        durationMinutes: 45,
        totalPoints: 100,
        passingScore: 50, // Ordinary pass: 50%
        status: 'published',
        certification: {
          enabled: true,
          passingPercentage: 80, // Certification threshold: 80%
          templateId: testTemplate._id,
        },
      });

      const q1 = await Question.create({
        assessmentId: highCertAsmt._id,
        questionText: 'Q1',
        type: 'mcq',
        points: 60,
        options: [{ id: '1', text: 'Correct' }, { id: '2', text: 'Incorrect' }],
        correctAnswer: '1',
      });

      const q2 = await Question.create({
        assessmentId: highCertAsmt._id,
        questionText: 'Q2',
        type: 'mcq',
        points: 40,
        options: [{ id: '1', text: 'Correct' }, { id: '2', text: 'Incorrect' }],
        correctAnswer: '1',
      });

      // Student gets 60% (Passes 50% ordinary exam, but fails 80% certification threshold)
      const attempt = await submissionService.startAttempt(student._id, highCertAsmt._id);
      await submissionService.submitAssessment(attempt._id, student._id, {
        [q1._id.toString()]: '1', // Correct (60 pts)
        [q2._id.toString()]: '2', // Incorrect (0 pts)
      });

      const evalDoc = await Evaluation.findOne({ submissionId: attempt._id });
      assert.ok(evalDoc);
      assert.strictEqual(evalDoc.passed, true, 'Student passed the assessment (60% >= 50%)');
      assert.strictEqual(evalDoc.certificateEligible, false, 'Student not eligible for certificate (60% < 80%)');

      const certDoc = await Certificate.findOne({
        studentId: student._id,
        assessmentId: highCertAsmt._id,
      });
      assert.strictEqual(certDoc, null, 'No certificate should be issued');
    });
  });

  describe('Part 4: Certificate & CertificateTemplate Model Integrity', () => {
    it('4.1 should enforce unique compound index { studentId: 1, assessmentId: 1 } on Certificate', async () => {
      await Certificate.deleteMany({});
      const issuedAt = new Date();
      const dummySubmissionId = new mongoose.Types.ObjectId();
      const certificateData = {
        certificateId: 'CERT-2026-TEST01',
        verificationCode: 'VERIFY-TOKEN-TEST01',
        studentId: student._id,
        assessmentId: testAssessment._id,
        submissionId: dummySubmissionId,
        templateId: testTemplate._id,
        templateVersion: 1,
        templateSnapshot: {
          title: 'Institutional Excellence Template',
          elements: [],
        },
        academicSnapshot: {
          studentName: 'Test Student',
          studentEmail: 'student@uap.edu',
          assessmentTitle: 'Distributed Consensus',
          certificateTitle: 'Specialist in Distributed Consensus',
          score: 95,
          totalPoints: 100,
          percentage: 95,
          grade: 'A+',
          gradeLabel: 'Outstanding',
          passingPercentage: 60,
        },
        issuedAt,
      };

      // First certificate creation succeeds
      const cert1 = await Certificate.create(certificateData);
      assert.ok(cert1._id);

      // Duplicate issuance for same student and assessment must be rejected by compound unique index
      await assert.rejects(
        async () => {
          await Certificate.create({
            ...certificateData,
            certificateId: 'CERT-2026-TEST02', // Different cert ID
            verificationCode: 'VERIFY-TOKEN-TEST02', // Different verificationCode
            // Same studentId + assessmentId
          });
        },
        (err) => {
          assert.ok(
            err.code === 11000 || /duplicate key/i.test(err.message),
            `Expected duplicate key error, got: ${err.message}`
          );
          return true;
        }
      );
    });

    it('4.2 should support Certificate revocation metadata', async () => {
      const cert = await Certificate.findOne({ certificateId: 'CERT-2026-TEST01' });
      assert.strictEqual(cert.status, 'active');

      cert.status = 'revoked';
      cert.revocation = {
        revokedAt: new Date(),
        revokedBy: instructor._id,
        reason: 'Academic integrity investigation upheld',
      };
      await cert.save();

      const reloaded = await Certificate.findOne({ certificateId: 'CERT-2026-TEST01' });
      assert.strictEqual(reloaded.status, 'revoked');
      assert.strictEqual(reloaded.revocation.reason, 'Academic integrity investigation upheld');
    });
  });
});
