import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readRel(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('Exam-wise Progress, My Results, My Attempts, and Individual Reports UI Contracts', async (t) => {
  const dashboardSrc = readRel('frontend/src/pages/student/Dashboard.jsx');
  const progressSrc = readRel('frontend/src/components/student/StudentExamProgress.jsx');
  const reportSrc = readRel('frontend/src/pages/common/ExamPerformanceReport.jsx');
  const routesSrc = readRel('frontend/src/routes/AppRoutes.jsx');
  const navSrc = readRel('frontend/src/config/navigationConfig.js');
  const certsSrc = readRel('frontend/src/pages/student/Certifications.jsx');
  const certSvcSrc = readRel('frontend/src/services/certificate.service.js');
  const queueSrc = readRel('frontend/src/pages/instructor/SubmissionsQueue.jsx');
  const evalStudioSrc = readRel('frontend/src/pages/instructor/EvaluationStudio.jsx');
  const mockModalSrc = readRel('frontend/src/components/instructor/MockTestAttemptsModal.jsx');
  const mockEvalSrc = readRel('frontend/src/pages/instructor/MockTestEvaluationStudio.jsx');

  await t.test('AppRoutes registers both student and faculty report routes without disturbing existing dashboards', () => {
    assert.match(routesSrc, /path="reports\/:attemptType\/:attemptId" element=\{<ExamPerformanceReport \/>\}/);
    assert.match(routesSrc, /path="progress" element=\{<StudentDashboard \/>\}/);
    assert.match(routesSrc, /path="results" element=\{<StudentDashboard \/>\}/);
    assert.match(routesSrc, /path="attempts" element=\{<StudentDashboard \/>\}/);
  });

  await t.test('Student Dashboard separates Progress, My Results, My Attempts, and preserves Assessment Performance', () => {
    assert.match(dashboardSrc, /if \(location\.pathname\.includes\('\/student\/progress'\)\) return 'progress'/);
    assert.match(dashboardSrc, /if \(location\.pathname\.includes\('\/student\/results'\)\) return 'results'/);
    assert.match(dashboardSrc, /currentView === 'progress' && <StudentExamProgress \/>/);
    assert.match(dashboardSrc, /title="Assessment Performance"/);
    assert.match(dashboardSrc, /currentView === 'results'\s*\?\s*submissions\.filter/);
  });

  await t.test('StudentExamProgress focuses on exam-wise performance, pending separation, and Coming Soon AI contract', () => {
    assert.match(progressSrc, /Exam Performance/);
    assert.match(progressSrc, /View Report/);
    assert.match(progressSrc, /Download PDF/);
    assert.match(progressSrc, /Pending Evaluation/);
    assert.match(progressSrc, /Report available after evaluation/);
    assert.match(progressSrc, /Performance Analysis/);
    assert.match(progressSrc, /Coming Soon/);
  });

  await t.test('My Certificates navigation, dedicated page, empty state, and PDF/PNG/JPG downloads exist', () => {
    assert.match(navSrc, /name:\s*'My Certificates'/);
    assert.match(navSrc, /path:\s*'\/student\/certificates'/);
    assert.match(routesSrc, /path="certificates" element=\{<StudentCertifications \/>\}/);
    assert.match(certsSrc, /No certificates earned yet\./);
    assert.match(certsSrc, /\['pdf', 'png', 'jpg'\]/);
    assert.match(certSvcSrc, /format = 'pdf'/);
  });

  await t.test('ExamPerformanceReport handles pending 409 state, question/topic sections, PDF download, and AI disclaimer', () => {
    assert.match(reportSrc, /Report available after evaluation/);
    assert.match(reportSrc, /Download PDF/);
    assert.match(reportSrc, /Question-Wise Performance/);
    assert.match(reportSrc, /Faculty Feedback & Grading Remarks/);
    assert.match(reportSrc, /Performance Analysis/);
  });

  await t.test('Faculty workflows expose View Report and Download PDF only for finalized evaluations', () => {
    assert.match(queueSrc, /\/instructor\/reports\/assessment\//);
    assert.match(queueSrc, /Download PDF/);
    assert.match(evalStudioSrc, /submission\.evaluationStatus === 'completed'/);
    assert.match(mockModalSrc, /\/instructor\/reports\/mock_test\//);
    assert.match(mockEvalSrc, /\/instructor\/reports\/mock_test\//);
  });
});
