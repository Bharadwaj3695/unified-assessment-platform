const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const assessmentService = require('../src/services/assessment.service');
const { User, Assessment, Question } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Phase C Verification: Assessment Access & Student Authorization', () => {
  let instructor1;
  let instructor2;
  let student1;
  let student2;
  let publicPublished;
  let restrictedForStudent1;
  let draftAssessment;
  let archivedAssessment;

  before(async () => {
    await connectDB();
    await seedDatabase();

    instructor1 = await User.findOne({ email: 'instructor@uap.edu' });
    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });

    // Create a second instructor to verify ownership boundaries
    await User.deleteOne({ email: 'ada.lovelace@uap.edu' });
    const pass = await hashPassword('Password123');
    instructor2 = await User.create({
      name: 'Dr. Ada Lovelace',
      email: 'ada.lovelace@uap.edu',
      password: pass,
      role: 'instructor',
      status: 'active',
      isActive: true,
    });

    // 1. Public Published Assessment
    publicPublished = await Assessment.create({
      title: 'Public Security Assessment',
      category: 'Cybersecurity',
      instructorId: instructor1._id,
      durationMinutes: 45,
      totalPoints: 50,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      assignedStudents: [],
    });

    await Question.create({
      assessmentId: publicPublished._id,
      questionText: 'What is HTTPS?',
      type: 'mcq',
      options: [
        { id: 'a', text: 'HyperText Transfer Protocol Secure' },
        { id: 'b', text: 'Home Tool Protocol System' },
      ],
      correctAnswer: 'a',
      explanation: 'CONFIDENTIAL: Instructor grading key and solution.',
      points: 50,
      orderIndex: 0,
    });

    // 2. Restricted Published Assessment (Assigned ONLY to student1)
    restrictedForStudent1 = await Assessment.create({
      title: 'Advanced Honours Restricted Seminar',
      category: 'Research',
      instructorId: instructor1._id,
      durationMinutes: 90,
      totalPoints: 100,
      passingScore: 70,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [student1._id],
    });

    await Question.create({
      assessmentId: restrictedForStudent1._id,
      questionText: 'Explain zero-knowledge proofs.',
      type: 'short_answer',
      options: [],
      correctAnswer: 'Cryptographic proof of knowledge without revealing information.',
      explanation: 'CONFIDENTIAL: Grading rubric for research honours.',
      points: 100,
      orderIndex: 0,
    });

    // 3. Draft Assessment
    draftAssessment = await Assessment.create({
      title: 'Draft In-Progress Exam',
      category: 'Software Architecture',
      instructorId: instructor1._id,
      durationMinutes: 30,
      totalPoints: 20,
      passingScore: 50,
      status: 'draft',
      accessType: 'public',
      assignedStudents: [],
    });

    // 4. Archived Assessment
    archivedAssessment = await Assessment.create({
      title: 'Archived Past Semester Exam',
      category: 'History of Computing',
      instructorId: instructor1._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'archived',
      accessType: 'public',
      assignedStudents: [],
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('should include public published assessment in student catalog', async () => {
    const { assessments } = await assessmentService.getAssessments({
      role: 'student',
      userId: student1._id,
    });
    const found = assessments.find((a) => a._id.toString() === publicPublished._id.toString());
    assert.ok(found, 'Public published assessment must be visible in student catalog');
    assert.strictEqual(found.accessType, 'public');
  });

  it('should include restricted assessment for assigned student in catalog', async () => {
    const { assessments } = await assessmentService.getAssessments({
      role: 'student',
      userId: student1._id,
    });
    const found = assessments.find((a) => a._id.toString() === restrictedForStudent1._id.toString());
    assert.ok(found, 'Restricted assessment must be visible to assigned student');
  });

  it('should hide restricted assessment from unassigned student catalog', async () => {
    const { assessments } = await assessmentService.getAssessments({
      role: 'student',
      userId: student2._id,
    });
    const found = assessments.find((a) => a._id.toString() === restrictedForStudent1._id.toString());
    assert.strictEqual(found, undefined, 'Restricted assessment must be invisible to unassigned student');
  });

  it('should block unassigned student from retrieving restricted assessment details', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.getAssessmentById(restrictedForStudent1._id, {
          id: student2._id,
          role: 'student',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not authorized to view or attempt this restricted assessment/i);
        return true;
      }
    );
  });

  it('should block student from retrieving draft assessments', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.getAssessmentById(draftAssessment._id, {
          id: student1._id,
          role: 'student',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not open for student access/i);
        return true;
      }
    );
  });

  it('should block student from retrieving archived assessments', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.getAssessmentById(archivedAssessment._id, {
          id: student1._id,
          role: 'student',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not open for student access/i);
        return true;
      }
    );
  });

  it('should never expose correctAnswer to student callers', async () => {
    const result = await assessmentService.getAssessmentById(publicPublished._id, {
      id: student1._id,
      role: 'student',
    });

    assert.ok(result);
    assert.ok(result.questions.length > 0);
    const q = result.questions[0];
    assert.strictEqual(q.correctAnswer, undefined, 'correctAnswer must be sanitized from student view');
  });

  it('should never expose private explanation to student callers', async () => {
    const result = await assessmentService.getAssessmentById(publicPublished._id, {
      id: student1._id,
      role: 'student',
    });

    assert.ok(result);
    const q = result.questions[0];
    assert.strictEqual(q.explanation, undefined, 'explanation must be sanitized from student view');
  });

  it('should enforce instructor ownership: Instructor B cannot modify Instructor A assessment', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.updateAssessment(
          publicPublished._id,
          instructor2._id,
          { title: 'Unauthorized Modification' },
          false // isAdmin: false
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /you do not own this assessment/i);
        return true;
      }
    );
  });

  it('should enforce instructor ownership: Instructor B cannot delete Instructor A assessment', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.deleteAssessment(
          publicPublished._id,
          instructor2._id,
          false // isAdmin: false
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /unauthorized to delete this assessment/i);
        return true;
      }
    );
  });

  it('should reject invalid student IDs during restricted assessment validation', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.validateAssignedStudents(['507f1f77bcf86cd799439011']); // Non-existent user
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /do not exist or are not registered students/i);
        return true;
      }
    );
  });
});
