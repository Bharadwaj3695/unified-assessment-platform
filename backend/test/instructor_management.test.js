const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');
const evaluationService = require('../src/services/evaluation.service');
const { User, Assessment, Question, Submission } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Phase E Verification: Instructor Assessment Management & Search', () => {
  let instructorA;
  let instructorB;
  let studentA;
  let studentB;
  let createdAssessment;
  let restrictedAssessment;

  before(async () => {
    await connectDB();
    await seedDatabase();

    instructorA = await User.findOne({ email: 'instructor@uap.edu' });
    studentA = await User.findOne({ email: 'student@uap.edu' });
    studentB = await User.findOne({ email: 'alice@uap.edu' });

    await User.deleteOne({ email: 'alan.turing@uap.edu' });
    const pass = await hashPassword('Password123');
    instructorB = await User.create({
      name: 'Professor Turing',
      email: 'alan.turing@uap.edu',
      password: pass,
      role: 'instructor',
      status: 'active',
      isActive: true,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('1. instructor creates assessment with questions and draft status', async () => {
    const payload = {
      title: 'Distributed Systems & Consensus',
      description: 'Covers Paxos, Raft, and Vector Clocks',
      category: 'Distributed Computing',
      durationMinutes: 75,
      passingScore: 65,
      accessType: 'public',
      status: 'draft',
      questions: [
        {
          questionText: 'What problem does Raft consensus solve?',
          type: 'mcq',
          options: [
            { id: '1', text: 'Distributed state machine replication' },
            { id: '2', text: 'Single threaded execution' },
          ],
          correctAnswer: '1',
          explanation: 'Raft manages replicated logs across distributed nodes.',
          points: 10,
        },
        {
          questionText: 'Explain the difference between 2PC and 3PC.',
          type: 'short_answer',
          points: 15,
        },
        {
          questionText: 'Design a distributed key-value store with eventual consistency.',
          type: 'long_answer',
          points: 25,
        },
      ],
    };

    createdAssessment = await assessmentService.createAssessment(instructorA._id, payload);

    assert.ok(createdAssessment);
    assert.strictEqual(createdAssessment.title, 'Distributed Systems & Consensus');
    assert.strictEqual(createdAssessment.status, 'draft');
    assert.strictEqual(createdAssessment.totalPoints, 50); // 10 + 15 + 25
    assert.strictEqual(createdAssessment.questions.length, 3);
    assert.strictEqual(createdAssessment.instructorId._id.toString(), instructorA._id.toString());
  });

  it('2. student still cannot access draft assessment', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.getAssessmentById(createdAssessment._id, {
          id: studentA._id,
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

  it('3. instructor edits own assessment details and updates questions', async () => {
    const updatePayload = {
      title: 'Advanced Distributed Systems & Consensus',
      durationMinutes: 90,
      passingScore: 70,
      questions: [
        {
          questionText: 'What problem does Raft consensus solve?',
          type: 'mcq',
          options: [
            { id: '1', text: 'Distributed state machine replication' },
            { id: '2', text: 'Single threaded execution' },
          ],
          correctAnswer: '1',
          points: 20,
        },
        {
          questionText: 'Explain the difference between 2PC and 3PC.',
          type: 'short_answer',
          points: 30,
        },
      ],
    };

    const updated = await assessmentService.updateAssessment(
      createdAssessment._id,
      instructorA._id,
      updatePayload,
      false
    );

    assert.strictEqual(updated.title, 'Advanced Distributed Systems & Consensus');
    assert.strictEqual(updated.durationMinutes, 90);
    assert.strictEqual(updated.passingScore, 70);
    assert.strictEqual(updated.totalPoints, 50); // 20 + 30
    assert.strictEqual(updated.questions.length, 2);
  });

  it('4. instructor cannot edit another instructor\'s assessment', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.updateAssessment(
          createdAssessment._id,
          instructorB._id, // foreign instructor
          { title: 'Hacked Title' },
          false
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /do not own this assessment/i);
        return true;
      }
    );
  });

  it('5. instructor publishes assessment', async () => {
    const published = await assessmentService.updateAssessment(
      createdAssessment._id,
      instructorA._id,
      { status: 'published' },
      false
    );

    assert.strictEqual(published.status, 'published');

    // Student can now view published assessment (sanitized)
    const studentView = await assessmentService.getAssessmentById(createdAssessment._id, {
      id: studentA._id,
      role: 'student',
    });
    assert.strictEqual(studentView.title, 'Advanced Distributed Systems & Consensus');
    assert.strictEqual(studentView.questions[0].correctAnswer, undefined);
  });

  it('6. instructor can create restricted assessment and assign valid students', async () => {
    const payload = {
      title: 'Restricted Honours Seminar Assessment',
      category: 'Research',
      durationMinutes: 60,
      passingScore: 75,
      accessType: 'restricted',
      assignedStudents: [studentA._id],
      status: 'published',
      questions: [
        {
          questionText: 'State the CAP theorem tradeoffs.',
          type: 'short_answer',
          points: 20,
        },
      ],
    };

    restrictedAssessment = await assessmentService.createAssessment(instructorA._id, payload);
    assert.strictEqual(restrictedAssessment.accessType, 'restricted');
    assert.strictEqual(restrictedAssessment.assignedStudents.length, 1);
    const assignedId = restrictedAssessment.assignedStudents[0]._id
      ? restrictedAssessment.assignedStudents[0]._id.toString()
      : restrictedAssessment.assignedStudents[0].toString();
    assert.strictEqual(assignedId, studentA._id.toString());
  });

  it('7. non-student user assignment is rejected', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.validateAssignedStudents([instructorB._id]);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /not registered students/i);
        return true;
      }
    );
  });

  it('8. student A has access but student B is blocked from restricted assessment', async () => {
    // Student A (assigned) can access
    const asmtA = await assessmentService.getAssessmentById(restrictedAssessment._id, {
      id: studentA._id,
      role: 'student',
    });
    assert.ok(asmtA);

    // Student B (unassigned) is blocked
    await assert.rejects(
      async () => {
        await assessmentService.getAssessmentById(restrictedAssessment._id, {
          id: studentB._id,
          role: 'student',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not authorized/i);
        return true;
      }
    );
  });

  it('9. instructor updates assigned students on restricted assessment', async () => {
    // Add studentB to assigned students
    const updated = await assessmentService.updateAssessment(
      restrictedAssessment._id,
      instructorA._id,
      {
        accessType: 'restricted',
        assignedStudents: [studentA._id, studentB._id],
      },
      false
    );

    assert.strictEqual(updated.assignedStudents.length, 2);

    // Student B now has access
    const asmtB = await assessmentService.getAssessmentById(restrictedAssessment._id, {
      id: studentB._id,
      role: 'student',
    });
    assert.ok(asmtB);
  });

  it('10. instructor search finds assessments by title, description, or category', async () => {
    // Search by title keyword
    const searchTitle = await assessmentService.getAssessments({
      role: 'instructor',
      userId: instructorA._id,
      search: 'Distributed Systems',
    });
    assert.ok(searchTitle.assessments.length >= 1);
    assert.ok(searchTitle.assessments.some((a) => a.title.includes('Distributed Systems')));

    // Search by category
    const searchCategory = await assessmentService.getAssessments({
      role: 'instructor',
      userId: instructorA._id,
      search: 'Research',
    });
    assert.ok(searchCategory.assessments.length >= 1);
    assert.ok(searchCategory.assessments.some((a) => a.category === 'Research'));

    // Instructor B searching sees 0 of Instructor A's assessments
    const searchInstructorB = await assessmentService.getAssessments({
      role: 'instructor',
      userId: instructorB._id,
      search: 'Distributed Systems',
    });
    assert.strictEqual(searchInstructorB.assessments.length, 0);
  });

  it('11. instructor cannot view another instructor\'s submission details', async () => {
    // Create an attempt by studentA for Instructor A's assessment
    const asmtId = restrictedAssessment._id || restrictedAssessment.id;
    const attempt = await submissionService.startAttempt(studentA._id, asmtId);

    // Instructor A can access the submission
    const subA = await submissionService.getSubmissionById(attempt._id, instructorA._id, 'instructor');
    assert.ok(subA);

    // Instructor B is forbidden from accessing the submission
    await assert.rejects(
      async () => {
        await submissionService.getSubmissionById(attempt._id, instructorB._id, 'instructor');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /do not own the assessment/i);
        return true;
      }
    );
  });

  it('12. instructor cannot delete another instructor\'s assessment', async () => {
    await assert.rejects(
      async () => {
        await assessmentService.deleteAssessment(
          createdAssessment._id,
          instructorB._id,
          false
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /unauthorized to delete/i);
        return true;
      }
    );
  });

  it('13. instructor deletes own assessment', async () => {
    const res = await assessmentService.deleteAssessment(
      createdAssessment._id,
      instructorA._id,
      false
    );
    assert.match(res.message, /deleted successfully/i);

    const deleted = await Assessment.findById(createdAssessment._id);
    assert.strictEqual(deleted, null);

    const questions = await Question.find({ assessmentId: createdAssessment._id });
    assert.strictEqual(questions.length, 0);
  });
});
