const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Subject, Topic, Question, QuestionVersion } = require('../src/models');
const questionManagementService = require('../src/services/questionManagement.service');
const { validateQuestionObject } = require('../src/validators/question.validator');

describe('Mock Bank Studio – Subject and Topic Manual Entry Backend Suite', () => {
  let faculty;
  let legacySubject;
  let legacyTopic;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Setup test faculty
    faculty = await User.create({
      name: 'Manual Entry Instructor',
      email: `manual.instructor.${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
      department: 'Computer Science',
    });

    // Create legacy reference records to test backward compatibility
    legacySubject = await Subject.create({
      name: 'Legacy Algorithms',
      code: `LALG-${Date.now()}`,
      department: 'Computer Science',
      createdBy: faculty._id,
    });

    legacyTopic = await Topic.create({
      name: 'Dynamic Programming',
      subjectId: legacySubject._id,
      createdBy: faculty._id,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('1. should create question with manual text subject and multiple topic names', async () => {
    const data = {
      statement: 'What is the worst-case time complexity of quickselect?',
      questionType: 'SINGLE_MCQ',
      subject: 'Data Structures and Algorithms',
      topics: ['Quickselect', 'Order Statistics', 'Divide and Conquer'],
      conceptTags: ['Average O(N)', 'Worst O(N^2)'],
      options: [
        { id: 'opt_1', text: 'O(N^2)', isCorrect: true },
        { id: 'opt_2', text: 'O(N log N)', isCorrect: false },
        { id: 'opt_3', text: 'O(log N)', isCorrect: false },
        { id: 'opt_4', text: 'O(1)', isCorrect: false },
      ],
      answerKey: 'opt_1',
      marks: 2,
    };

    const created = await questionManagementService.createQuestion(faculty, data);
    assert.ok(created.id);
    assert.equal(created.subject, 'Data Structures and Algorithms');
    assert.deepEqual(created.topics, ['Quickselect', 'Order Statistics', 'Divide and Conquer']);
    assert.equal(created.subjectId, null);
    assert.deepEqual(created.topicIds, []);
  });

  it('2. should create question with empty Default Topics without blocking save', async () => {
    const data = {
      statement: 'Which data structure is typically used to implement BFS on graphs?',
      questionType: 'SINGLE_MCQ',
      subject: 'Graph Theory',
      topics: [], // Empty topics
      conceptTags: ['Graph Traversal', 'BFS'],
      options: [
        { id: 'opt_1', text: 'Queue', isCorrect: true },
        { id: 'opt_2', text: 'Stack', isCorrect: false },
      ],
      answerKey: 'opt_1',
      marks: 1,
    };

    const created = await questionManagementService.createQuestion(faculty, data);
    assert.ok(created.id);
    assert.equal(created.subject, 'Graph Theory');
    assert.deepEqual(created.topics, []);
  });

  it('3. Default Topics is optional: should validate and publish question with empty topics', async () => {
    const data = {
      statement: 'Explain the difference between process and thread in modern operating systems.',
      questionType: 'SHORT_ANSWER',
      subject: 'Operating Systems',
      topics: [], // Empty topics
      conceptTags: ['Concurrency', 'Processes'],
      answerKey: 'Process has its own memory space whereas threads share memory within the same process.',
      marks: 5,
    };

    const created = await questionManagementService.createQuestion(faculty, data);

    // Validate for publishing: should be valid despite empty topics!
    const report = await questionManagementService.validateQuestion(created.id);
    assert.equal(report.valid, true);
    assert.equal(report.errors.length, 0);

    // Publish question
    const published = await questionManagementService.publishQuestion(created.id, faculty);
    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.subject, 'Operating Systems');
    assert.deepEqual(published.topics, []);
  });

  it('4. Subject validation remains enforced: publishing without subject should fail', async () => {
    const data = {
      statement: 'What does ACID stand for in database management systems?',
      questionType: 'SHORT_ANSWER',
      subject: '', // Missing subject!
      subjectId: null,
      topics: ['Transactions'],
      answerKey: 'Atomicity, Consistency, Isolation, Durability',
      marks: 3,
    };

    const created = await questionManagementService.createQuestion(faculty, data);

    // Validation must fail because subject is required
    const report = await questionManagementService.validateQuestion(created.id);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((err) => err.includes('Subject')));

    // Attempting to publish should throw 422 error
    await assert.rejects(
      async () => {
        await questionManagementService.publishQuestion(created.id, faculty);
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.ok(err.message.includes('Subject'));
        return true;
      }
    );
  });

  it('5. Backward compatibility: should preserve existing subjectId and topicIds references', async () => {
    const data = {
      statement: 'What is the optimal substructure property of DP problems?',
      questionType: 'SINGLE_MCQ',
      subjectId: legacySubject._id.toString(),
      topicIds: [legacyTopic._id.toString()],
      conceptTags: ['Optimal Substructure', 'Bellman Equation'],
      options: [
        { id: 'opt_1', text: 'Optimal solution of subproblems leads to optimal solution of the whole problem', isCorrect: true },
        { id: 'opt_2', text: 'Subproblems are independent and disjoint', isCorrect: false },
      ],
      answerKey: 'opt_1',
      marks: 2,
    };

    const created = await questionManagementService.createQuestion(faculty, data);
    assert.ok(created.id);
    assert.equal(created.subjectId._id.toString(), legacySubject._id.toString());
    assert.equal(created.topicIds[0]._id.toString(), legacyTopic._id.toString());

    // Update with preserving reference
    const updated = await questionManagementService.updateQuestion(created.id, faculty, {
      statement: 'Updated: What is the optimal substructure property of DP problems?',
    });
    assert.equal(updated.subjectId._id.toString(), legacySubject._id.toString());
  });

  it('6. Question metadata isolation and update: editing one question does not corrupt metadata', async () => {
    const q1 = await questionManagementService.createQuestion(faculty, {
      statement: 'Question 1: Binary Search Tree Inorder Traversal',
      subject: 'Data Structures',
      topics: ['Trees', 'BST'],
    });

    const q2 = await questionManagementService.createQuestion(faculty, {
      statement: 'Question 2: Hash Map Collision Resolution',
      subject: 'Data Structures',
      topics: ['Hashing', 'Separate Chaining'],
    });

    // Update Question 1
    const updatedQ1 = await questionManagementService.updateQuestion(q1.id, faculty, {
      subject: 'Advanced Data Structures',
      topics: ['Red-Black Trees'],
    });

    // Verify Question 1 has updated metadata
    assert.equal(updatedQ1.subject, 'Advanced Data Structures');
    assert.deepEqual(updatedQ1.topics, ['Red-Black Trees']);

    // Verify Question 2 remains completely untouched
    const freshQ2 = await questionManagementService.getQuestionById(q2.id, faculty);
    assert.equal(freshQ2.subject, 'Data Structures');
    assert.deepEqual(freshQ2.topics, ['Hashing', 'Separate Chaining']);
  });

  it('7. Multi-dimensional search and filtering by manual subject and topics', async () => {
    const uniqueSubject = `ManualSearchSub_${Date.now()}`;
    const uniqueTopic = `UniqueTopic_${Date.now()}`;

    await questionManagementService.createQuestion(faculty, {
      statement: 'Filter verification target statement for search testing',
      subject: uniqueSubject,
      topics: [uniqueTopic, 'Secondary Topic'],
      conceptTags: ['SearchTag'],
    });

    // Filter by subject
    const bySubject = await questionManagementService.getQuestions({ subject: uniqueSubject }, faculty);
    assert.ok(bySubject.questions.length >= 1);
    assert.equal(bySubject.questions[0].subject, uniqueSubject);

    // Filter by topic
    const byTopic = await questionManagementService.getQuestions({ topic: uniqueTopic }, faculty);
    assert.ok(byTopic.questions.length >= 1);
    assert.ok(byTopic.questions[0].topics.includes(uniqueTopic));

    // Fulltext search
    const bySearch = await questionManagementService.getQuestions({ search: uniqueSubject }, faculty);
    assert.ok(bySearch.questions.length >= 1);
  });

  it('8. Partial-save retry: updateQuestion updates existing draft without creating duplicates', async () => {
    const draft = await questionManagementService.createQuestion(faculty, {
      statement: 'Initial draft question before partial retry',
      subject: 'Retry Testing Subject',
      topics: ['Retry Topic'],
    });
    const draftId = draft.id;

    const countBefore = await Question.countDocuments({ statement: /Initial draft question/ });
    assert.equal(countBefore, 1);

    // Simulate retry saving the question using its savedId
    const retried = await questionManagementService.updateQuestion(draftId, faculty, {
      statement: 'Initial draft question before partial retry (Updated on retry)',
      subject: 'Retry Testing Subject',
      topics: ['Retry Topic', 'Appended Topic'],
    });

    const countAfter = await Question.countDocuments({ statement: /Initial draft question/ });
    assert.equal(countAfter, 1, 'Retry must not duplicate question record');
    assert.equal(retried.id, draftId);
    assert.deepEqual(retried.topics, ['Retry Topic', 'Appended Topic']);
  });
});
