const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const {
  User,
  Subject,
  Question,
  QuestionBank,
  Assessment,
  Submission,
  Evaluation,
  MockTest,
  MockTestAttempt,
  Certificate,
  CertificateTemplate,
} = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

async function apiGet(baseUrl, path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
}

test('UAP Reusable Pagination System — Backend Endpoints, Filters, Determinism & RBAC', async (t) => {
  let server;
  let baseUrl;
  let faculty1;
  let faculty2;
  let student1;
  let student2;
  let faculty1Token;
  let faculty2Token;
  let student1Token;
  let student2Token;
  let subject;
  let bank;
  let mockTest1;

  t.before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await Promise.all([
      User.deleteMany({}),
      Subject.deleteMany({}),
      Question.deleteMany({}),
      QuestionBank.deleteMany({}),
      Assessment.deleteMany({}),
      Submission.deleteMany({}),
      Evaluation.deleteMany({}),
      MockTest.deleteMany({}),
      MockTestAttempt.deleteMany({}),
      Certificate.deleteMany({}),
      CertificateTemplate.deleteMany({}),
    ]);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    faculty1 = await User.create({
      name: 'Faculty Alpha',
      email: 'faculty.alpha@uap.edu',
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      isActive: true,
    });
    faculty2 = await User.create({
      name: 'Faculty Beta',
      email: 'faculty.beta@uap.edu',
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      isActive: true,
    });
    student1 = await User.create({
      name: 'Alice Pagination',
      email: 'alice.pag@uap.edu',
      password: 'Password@123',
      role: 'student',
      studentId: 'STU-PAG-001',
      status: 'active',
      isActive: true,
    });
    student2 = await User.create({
      name: 'Bob Pagination',
      email: 'bob.pag@uap.edu',
      password: 'Password@123',
      role: 'student',
      studentId: 'STU-PAG-002',
      status: 'active',
      isActive: true,
    });

    // Extra students for Faculty Students pagination
    for (let i = 3; i <= 14; i++) {
      await User.create({
        name: `Student Cohort ${String(i).padStart(2, '0')}`,
        email: `cohort${i}@uap.edu`,
        password: 'Password@123',
        role: 'student',
        studentId: `STU-PAG-${String(i).padStart(3, '0')}`,
        status: 'active',
        isActive: true,
      });
    }

    faculty1Token = generateAccessToken({ id: faculty1._id.toString(), role: 'instructor' });
    faculty2Token = generateAccessToken({ id: faculty2._id.toString(), role: 'instructor' });
    student1Token = generateAccessToken({ id: student1._id.toString(), role: 'student' });
    student2Token = generateAccessToken({ id: student2._id.toString(), role: 'student' });

    subject = await Subject.create({
      name: 'Algorithms',
      code: 'CS301',
      createdBy: faculty1._id,
    });

    // 13 standalone Question Bank questions (same timestamp edge case tested via sequential creation)
    const bankQIds = [];
    for (let i = 1; i <= 13; i++) {
      const q = await Question.create({
        ownerFacultyId: faculty1._id,
        subjectId: subject._id,
        subject: 'Algorithms',
        statement: `Algorithm Question #${String(i).padStart(2, '0')} ${i % 2 === 0 ? 'Graph' : 'Tree'}`,
        questionType: 'SINGLE_MCQ',
        difficulty: i <= 5 ? 'EASY' : 'MEDIUM',
        status: 'PUBLISHED',
        marks: 2,
        options: [
          { id: 'a', text: 'Opt A', isCorrect: true },
          { id: 'b', text: 'Opt B', isCorrect: false },
        ],
        answerKey: 'a',
      });
      if (i <= 7) bankQIds.push(q._id);
    }

    bank = await QuestionBank.create({
      title: 'Algorithms Pool A',
      code: 'ALGO-POOL-A',
      ownerFacultyId: faculty1._id,
      subjectId: subject._id,
      questionIds: bankQIds,
    });

    // 12 assessments for faculty1 (8 public published, 2 restricted to student1 only, 2 drafts) + 2 for faculty2
    const template = await CertificateTemplate.create({
      title: 'Standard Achievement Certificate',
      slug: 'standard-achievement-pagination',
      createdBy: faculty1._id,
      status: 'published',
    });

    const f1Assessments = [];
    for (let i = 1; i <= 12; i++) {
      const isDraft = i > 10;
      const isRestricted = i === 9 || i === 10;
      const asmt = await Assessment.create({
        title: `Algo Exam ${String(i).padStart(2, '0')}`,
        description: `Exam ${i} description`,
        category: i % 2 === 0 ? 'Computer Science' : 'Data Structures',
        instructorId: faculty1._id,
        status: isDraft ? 'draft' : 'published',
        accessType: isRestricted ? 'restricted' : 'public',
        assignedStudents: isRestricted ? [student1._id] : [],
        durationMinutes: 30,
        totalPoints: 10,
        passingScore: 60,
        questions: [],
      });
      f1Assessments.push(asmt);
    }

    await Assessment.create({
      title: 'Other Faculty Restricted Exam',
      category: 'General',
      instructorId: faculty2._id,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [student2._id],
      durationMinutes: 20,
      totalPoints: 10,
      passingScore: 60,
    });

    // 12 submissions for student1 across f1Assessments (8 evaluated, 4 submitted/pending) + 2 for student2
    for (let i = 0; i < 12; i++) {
      const asmt = f1Assessments[i];
      const isEval = i < 8;
      const sub = await Submission.create({
        assessmentId: asmt._id,
        studentId: student1._id,
        status: isEval ? 'evaluated' : 'submitted',
        evaluationStatus: isEval ? 'completed' : 'pending',
        score: isEval ? (i % 2 === 0 ? 8 : 4) : 0,
        finalScore: isEval ? (i % 2 === 0 ? 8 : 4) : undefined,
        totalPoints: 10,
        percentage: isEval ? (i % 2 === 0 ? 80 : 40) : 0,
        passed: isEval ? i % 2 === 0 : false,
        submittedAt: new Date(Date.now() - i * 60000),
      });

      if (isEval && i % 2 === 0) {
        const ev = await Evaluation.create({
          submissionId: sub._id,
          evaluatorId: faculty1._id,
          finalScore: 8,
          totalPoints: 10,
          percentage: 80,
          passed: true,
          status: 'completed',
          certificateEligible: true,
          gradedAt: new Date(Date.now() - i * 60000),
        });
        await Certificate.create({
          certificateId: `CERT-PAG-${String(i + 1).padStart(3, '0')}`,
          studentId: student1._id,
          assessmentId: asmt._id,
          submissionId: sub._id,
          evaluationId: ev._id,
          templateId: template._id,
          templateVersion: 1,
          templateSnapshot: { title: template.title },
          academicSnapshot: {
            studentName: student1.name,
            studentEmail: student1.email,
            studentIdNumber: student1.studentId,
            assessmentTitle: asmt.title,
            certificateTitle: `${asmt.title} Certificate`,
            category: asmt.category,
            score: 8,
            totalPoints: 10,
            percentage: 80,
            grade: 'A',
            passingPercentage: 60,
          },
          issuance: { status: 'issued' },
          status: 'active',
          verificationCode: `VERIFY-PAG-${i + 1}`,
          issuedAt: new Date(Date.now() - i * 60000),
        });
      }
    }

    await Submission.create({
      assessmentId: f1Assessments[0]._id,
      studentId: student2._id,
      status: 'evaluated',
      evaluationStatus: 'completed',
      score: 9,
      finalScore: 9,
      totalPoints: 10,
      percentage: 90,
      passed: true,
      submittedAt: new Date(),
    });

    // 7 Mock Tests + 7 MockTestAttempts for mockTest1
    for (let i = 1; i <= 7; i++) {
      const mt = await MockTest.create({
        title: `Mock Test ${String(i).padStart(2, '0')}`,
        examination: 'GATE',
        ownerFacultyId: faculty1._id,
        subjectId: subject._id,
        status: 'PUBLISHED',
        durationMinutes: 45,
        totalMarks: 20,
      });
      if (i === 1) mockTest1 = mt;
    }

    for (let i = 1; i <= 7; i++) {
      await MockTestAttempt.create({
        mockTestId: mockTest1._id,
        studentId: student1._id,
        status: i <= 4 ? 'EVALUATED' : 'SUBMITTED',
        evaluationStatus: i <= 4 ? 'COMPLETED' : 'PENDING_MANUAL_REVIEW',
        earnedMarks: i <= 4 ? 16 : 0,
        totalMarks: 20,
        percentage: i <= 4 ? 80 : 0,
        passed: i <= 4,
        submittedAt: new Date(Date.now() - i * 120000),
      });
    }
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  await t.test('1. Assessments pagination, filtering, sorting & RBAC', async () => {
    const p1 = await apiGet(baseUrl, '/api/assessments?page=1&limit=5', faculty1Token);
    const p2 = await apiGet(baseUrl, '/api/assessments?page=2&limit=5', faculty1Token);
    const p3 = await apiGet(baseUrl, '/api/assessments?page=3&limit=5', faculty1Token);

    assert.equal(p1.status, 200);
    assert.equal(p1.body.pagination.totalCount, 12);
    assert.equal(p1.body.pagination.totalPages, 3);
    assert.equal(p1.body.data.length, 5);
    assert.equal(p2.body.data.length, 5);
    assert.equal(p3.body.data.length, 2);

    const allIds = [...p1.body.data, ...p2.body.data, ...p3.body.data].map((a) => a._id || a.id);
    assert.equal(new Set(allIds).size, 12, 'No duplicate or missing assessments across pages');

    // Restricted filter for faculty1
    const restrictedRes = await apiGet(baseUrl, '/api/assessments?accessType=restricted&page=1&limit=5', faculty1Token);
    assert.equal(restrictedRes.body.pagination.totalCount, 2);

    // Student2 cannot see faculty2 or faculty1 restricted exams assigned only to student1
    const s2Res = await apiGet(baseUrl, '/api/assessments?page=1&limit=25', student2Token);
    assert.equal(s2Res.body.pagination.totalCount, 9); // 8 public f1 + 1 restricted f2 assigned to student2
  });

  await t.test('2. Question Bank pagination with combined subjectId + search + bankId', async () => {
    const p1 = await apiGet(baseUrl, `/api/questions?page=1&limit=5&subjectId=${subject._id}&search=Graph`, faculty1Token);
    const p2 = await apiGet(baseUrl, `/api/questions?page=2&limit=5&subjectId=${subject._id}&search=Graph`, faculty1Token);

    assert.equal(p1.status, 200);
    assert.equal(p1.body.pagination.total, 6);
    assert.equal(p1.body.data.length, 5);
    assert.equal(p2.body.data.length, 1);

    const bankPage = await apiGet(baseUrl, `/api/questions?page=1&limit=5&bankId=${bank._id}`, faculty1Token);
    assert.equal(bankPage.body.pagination.total, 7);
    assert.equal(bankPage.body.data.length, 5);

    // Out-of-bounds page clamps cleanly
    const clamped = await apiGet(baseUrl, `/api/questions?page=99&limit=5&bankId=${bank._id}`, faculty1Token);
    assert.equal(clamped.body.pagination.page, 2);
    assert.equal(clamped.body.data.length, 2);
  });

  await t.test('3. Faculty Submissions Queue pagination & status filters (pending/evaluated/certified)', async () => {
    const allP1 = await apiGet(baseUrl, '/api/evaluations/instructor/submissions?page=1&limit=5', faculty1Token);
    assert.equal(allP1.status, 200);
    assert.equal(allP1.body.pagination.totalCount, 13); // 12 student1 + 1 student2
    assert.equal(allP1.body.data.length, 5);

    const pendingRes = await apiGet(baseUrl, '/api/evaluations/instructor/submissions?status=pending&page=1&limit=10', faculty1Token);
    assert.equal(pendingRes.body.pagination.totalCount, 4);

    const evalRes = await apiGet(baseUrl, '/api/evaluations/instructor/submissions?status=evaluated&page=1&limit=5', faculty1Token);
    assert.equal(evalRes.body.pagination.totalCount, 9);

    const certRes = await apiGet(baseUrl, '/api/evaluations/instructor/submissions?status=certified&page=1&limit=10', faculty1Token);
    assert.equal(certRes.body.pagination.totalCount, 4);

    // RBAC: faculty2 owns 0 submissions
    const f2Res = await apiGet(baseUrl, '/api/evaluations/instructor/submissions?page=1&limit=10', faculty2Token);
    assert.equal(f2Res.body.pagination.totalCount, 0);
  });

  await t.test('4. Faculty Students pagination & backward-compatible non-paginated mode', async () => {
    const paged1 = await apiGet(baseUrl, '/api/users/students?page=1&limit=5', faculty1Token);
    const paged2 = await apiGet(baseUrl, '/api/users/students?page=2&limit=5', faculty1Token);
    assert.equal(paged1.status, 200);
    assert.equal(paged1.body.pagination.totalCount, 14);
    assert.equal(paged1.body.data.length, 5);
    assert.equal(paged2.body.data.length, 5);

    const unpaged = await apiGet(baseUrl, '/api/users/students', faculty1Token);
    assert.equal(unpaged.status, 200);
    assert.equal(Array.isArray(unpaged.body.data), true);
    assert.equal(unpaged.body.data.length, 14);
  });

  await t.test('5. Mock Tests & Mock Test Attempts pagination + RBAC', async () => {
    const mtPage1 = await apiGet(baseUrl, '/api/mock-tests?page=1&limit=5', student1Token);
    assert.equal(mtPage1.status, 200);
    assert.equal(mtPage1.body.pagination.totalCount, 7);
    assert.equal(mtPage1.body.data.length, 5);

    const attPage1 = await apiGet(baseUrl, `/api/mock-tests/${mockTest1._id}/attempts?page=1&limit=5`, faculty1Token);
    const attPage2 = await apiGet(baseUrl, `/api/mock-tests/${mockTest1._id}/attempts?page=2&limit=5`, faculty1Token);
    assert.equal(attPage1.status, 200);
    assert.equal(attPage1.body.pagination.totalCount, 7);
    assert.equal(attPage1.body.data.length, 5);
    assert.equal(attPage2.body.data.length, 2);

    // RBAC: faculty2 cannot inspect faculty1's mock test attempts
    const forbidden = await apiGet(baseUrl, `/api/mock-tests/${mockTest1._id}/attempts?page=1&limit=5`, faculty2Token);
    assert.equal(forbidden.status, 403);
  });

  await t.test('6. Student Submissions, Certificates & Exam Progress pagination + RBAC', async () => {
    const subP1 = await apiGet(baseUrl, '/api/submissions/student?page=1&limit=5', student1Token);
    assert.equal(subP1.status, 200);
    assert.equal(subP1.body.pagination.totalCount, 12);
    assert.equal(subP1.body.data.length, 5);
    assert.equal(subP1.body.counts.all, 12);

    const certP1 = await apiGet(baseUrl, '/api/certificates/mine?page=1&limit=2', student1Token);
    assert.equal(certP1.status, 200);
    assert.equal(certP1.body.pagination.totalCount, 4);
    assert.equal(certP1.body.data.length, 2);

    const progP1 = await apiGet(
      baseUrl,
      '/api/analytics/student/exam-progress?page=1&limit=5&pendingPage=1&pendingLimit=5',
      student1Token
    );
    assert.equal(progP1.status, 200);
    assert.equal(progP1.body.data.evaluatedExams.length, 5);
    assert.equal(progP1.body.data.evaluatedPagination.totalCount, 12); // 8 asmt + 4 mock
    assert.equal(progP1.body.data.pendingExams.length, 5);
    assert.equal(progP1.body.data.pendingPagination.totalCount, 7); // 4 asmt + 3 mock

    // RBAC: student2 only sees their own 1 submission and 0 certificates
    const s2Subs = await apiGet(baseUrl, '/api/submissions/student?page=1&limit=10', student2Token);
    assert.equal(s2Subs.body.pagination.totalCount, 1);
    const s2Certs = await apiGet(baseUrl, '/api/certificates/mine?page=1&limit=10', student2Token);
    assert.equal(s2Certs.body.pagination.totalCount, 0);
  });
});
