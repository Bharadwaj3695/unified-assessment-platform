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

test('Reusable Pagination UI & Scope Contracts', async (t) => {
  const paginationSrc = readRel('frontend/src/components/ui/Pagination.jsx');
  const paginationUtilSrc = readRel('frontend/src/utils/pagination.js');

  await t.test('Pagination component provides 5/10/15/25/50 page sizes, default 10, First/Prev/Pages/Next/Last, and hides when unnecessary', () => {
    assert.match(paginationUtilSrc, /DEFAULT_PAGE_SIZE\s*=\s*10/);
    assert.match(paginationUtilSrc, /PAGE_SIZE_OPTIONS\s*=\s*\[5,\s*10,\s*15,\s*25,\s*50\]/);
    assert.match(paginationSrc, /Rows per page:/);
    assert.match(paginationSrc, /First page/);
    assert.match(paginationSrc, /Previous/);
    assert.match(paginationSrc, /Next/);
    assert.match(paginationSrc, /Last page/);
    assert.match(paginationSrc, /Showing/);
    assert.match(paginationSrc, /if \(safeTotal === 0 \|\| \(safeTotal <= minPageSize && safeTotalPages <= 1\)\)/);
  });

  await t.test('Faculty list pages integrate Pagination', () => {
    const requiredFacultyPages = [
      'frontend/src/pages/instructor/AssessmentsList.jsx',
      'frontend/src/pages/instructor/QuestionBankHub.jsx',
      'frontend/src/pages/instructor/SubmissionsQueue.jsx',
      'frontend/src/pages/instructor/StudentsList.jsx',
      'frontend/src/components/instructor/MockTestAttemptsModal.jsx',
      'frontend/src/pages/instructor/AssessmentAnalytics.jsx',
    ];
    for (const file of requiredFacultyPages) {
      const src = readRel(file);
      assert.match(src, /<Pagination\b/, `${file} must render <Pagination>`);
    }
  });

  await t.test('Student list pages integrate Pagination', () => {
    const requiredStudentPages = [
      'frontend/src/pages/student/Dashboard.jsx',
      'frontend/src/pages/student/Certifications.jsx',
      'frontend/src/pages/student/MockTestsList.jsx',
      'frontend/src/components/student/StudentExamProgress.jsx',
    ];
    for (const file of requiredStudentPages) {
      const src = readRel(file);
      assert.match(src, /<Pagination\b/, `${file} must render <Pagination>`);
    }
  });

  await t.test('Excluded pages do not add pagination', () => {
    const excludedPages = [
      'frontend/src/pages/instructor/Dashboard.jsx',
      'frontend/src/pages/instructor/TestCreatorStudio.jsx',
      'frontend/src/pages/instructor/QuestionStudio.jsx',
      'frontend/src/pages/student/Attempt.jsx',
      'frontend/src/pages/student/Profile.jsx',
      'frontend/src/pages/instructor/Profile.jsx',
      'frontend/src/pages/common/ExamPerformanceReport.jsx',
    ];
    for (const file of excludedPages) {
      const src = readRel(file);
      assert.doesNotMatch(src, /<Pagination\b/, `${file} must NOT render <Pagination>`);
    }

    const studentDashSrc = readRel('frontend/src/pages/student/Dashboard.jsx');
    const dashOnlyBlock = studentDashSrc.slice(
      studentDashSrc.indexOf("{currentView === 'dashboard' && ("),
      studentDashSrc.indexOf('{/* 3. Sub-View: CATALOG / MY ASSESSMENTS */}')
    );
    assert.ok(dashOnlyBlock.length > 0);
    assert.doesNotMatch(dashOnlyBlock, /<Pagination\b/);
    assert.match(studentDashSrc, /currentView === 'submissions'[\s\S]*?<Pagination\b/);
    assert.match(studentDashSrc, /currentView === 'results'[\s\S]*?<Pagination\b/);
  });
});
