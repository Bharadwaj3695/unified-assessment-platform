const test = require('node:test');
const assert = require('node:assert/strict');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Subject, Question, MockTest } = require('../src/models');
const mockTestService = require('../src/services/mockTest.service');
const mockTestController = require('../src/controllers/mockTest.controller');

test('MockTest Manual Target Examination Persistence & Editing Suite', async (t) => {
  let faculty;
  let subject;

  t.before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await Promise.all([
      User.deleteMany({}),
      Subject.deleteMany({}),
      Question.deleteMany({}),
      MockTest.deleteMany({}),
    ]);

    faculty = await User.create({
      name: 'Prof. Anand Rao',
      email: 'anand.rao@university.edu',
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      department: 'Computer Science & Engineering',
    });

    subject = await Subject.create({
      name: 'Operating Systems',
      code: 'CS302',
      department: 'Computer Science & Engineering',
      createdBy: faculty._id,
    });

    await Question.create({
      subjectId: subject._id,
      ownerFacultyId: faculty._id,
      questionType: 'SINGLE_MCQ',
      statement: 'Which scheduling algorithm can cause starvation for long processes?',
      options: [
        { id: 'opt_1', text: 'Shortest Job First', isCorrect: true },
        { id: 'opt_2', text: 'First Come First Served', isCorrect: false },
      ],
      answerKey: 'opt_1',
      marks: 5,
      status: 'PUBLISHED',
    });
  });

  t.after(async () => {
    await disconnectDB();
  });

  await t.test('saves exact custom examination names, preserves on draft reopen, and supports editing', async () => {
    const draft = await mockTestService.createMockTest(faculty, {
      title: 'Semester End Practice',
      examination: 'University Semester Examination',
      subjectId: subject._id,
      draftQuestions: [
        { clientId: 'q1', statement: 'Explain virtual memory paging.' },
      ],
    });

    assert.equal(draft.examination, 'University Semester Examination');

    const reopened = await mockTestService.getMockTestById(draft._id, faculty);
    assert.equal(reopened.examination, 'University Semester Examination');

    // Edit examination name via controller updateMockTest
    const req = {
      params: { id: draft._id.toString() },
      user: { id: faculty._id.toString(), role: 'instructor' },
      body: {
        examination: 'Company Hiring Assessment',
      },
    };
    let responsePayload = null;
    const res = {
      status() {
        return this;
      },
      json(payload) {
        responsePayload = payload;
        return this;
      },
    };

    await mockTestController.updateMockTest(req, res, (err) => {
      throw err;
    });

    assert.equal(responsePayload.success, true);
    assert.equal(responsePayload.data.examination, 'Company Hiring Assessment');

    const reopenedAfterEdit = await mockTestService.getMockTestById(draft._id, faculty);
    assert.equal(reopenedAfterEdit.examination, 'Company Hiring Assessment');

    // Publish with custom examination name
    const published = await mockTestService.publishMockTest(draft._id, faculty);
    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.examination, 'Company Hiring Assessment');
  });

  await t.test('allows empty examination in draft and requires non-empty examination on publish', async () => {
    const emptyExamDraft = await mockTestService.createMockTest(faculty, {
      title: 'Draft Without Target Exam',
      examination: '',
      subjectId: subject._id,
      draftQuestions: [
        { clientId: 'q1', statement: 'Define deadlock.' },
      ],
    });

    assert.equal(emptyExamDraft.examination, '');

    await assert.rejects(
      () => mockTestService.publishMockTest(emptyExamDraft._id, faculty),
      /Target examination is required before publishing/
    );

    // Edit to GATE 2027 and publish
    const req = {
      params: { id: emptyExamDraft._id.toString() },
      user: { id: faculty._id.toString(), role: 'instructor' },
      body: { examination: 'GATE 2027' },
    };
    const res = { status() { return this; }, json() { return this; } };
    await mockTestController.updateMockTest(req, res, (err) => { throw err; });

    const published = await mockTestService.publishMockTest(emptyExamDraft._id, faculty);
    assert.equal(published.examination, 'GATE 2027');
  });
});
