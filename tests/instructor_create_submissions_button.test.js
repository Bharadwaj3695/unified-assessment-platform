import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('Instructor Create Assessment — Submissions Action Button Verification', () => {
  const builderSrc = readProjectFile('frontend/src/pages/instructor/AssessmentBuilder.jsx');
  const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');
  const navSrc = readProjectFile('frontend/src/config/navigationConfig.js');
  const queueSrc = readProjectFile('frontend/src/pages/instructor/SubmissionsQueue.jsx');

  test('1. Action controls render Submissions button alongside Save Draft and Publish Live', () => {
    assert.match(
      builderSrc,
      /<Button[^>]*>[\s\S]*?Submissions[\s\S]*?<\/Button>/,
      'AssessmentBuilder must render a Submissions button'
    );
    assert.match(
      builderSrc,
      /<Button[^>]*>[\s\S]*?Save Draft[\s\S]*?<\/Button>/,
      'Existing Save Draft button must be preserved'
    );
    assert.match(
      builderSrc,
      /<Button[^>]*>[\s\S]*?Publish Live[\s\S]*?<\/Button>/,
      'Existing Publish Live button must be preserved'
    );
  });

  test('2. Submissions button matches styling, size, height, and responsive spacing', () => {
    // Matches size="md" and variant="outline"
    assert.match(
      builderSrc,
      /<Button[\s\S]*?variant="outline"[\s\S]*?size="md"[\s\S]*?>[\s\S]*?Submissions[\s\S]*?<\/Button>/,
      'Submissions button must use outline variant and md size matching existing design system'
    );
    // Action controls container uses gap-2.5 and responsive wrapping
    assert.match(
      builderSrc,
      /gap-2\.5[\s\S]*?flex-wrap/,
      'Action controls bar must use standard gap-2.5 spacing and responsive flex-wrap'
    );
  });

  test('3. Submissions button imports and renders appropriate submissions/clipboard icon', () => {
    assert.match(
      builderSrc,
      /import\s*\{[^}]*FileCheck2[^}]*\}\s*from\s*'lucide-react'/,
      'AssessmentBuilder must import FileCheck2 submissions icon from lucide-react'
    );
    assert.match(
      builderSrc,
      /icon=\{FileCheck2\}[\s\S]*?>[\s\S]*?Submissions/,
      'Submissions button must bind the FileCheck2 submissions icon'
    );
  });

  test('4. On click navigates to existing Instructor Submissions & Grading route', () => {
    assert.match(
      builderSrc,
      /navigate\(['"`]\/instructor\/submissions['"`]\)/,
      'Submissions button must navigate to /instructor/submissions route'
    );
    assert.match(
      routesSrc,
      /<Route\s+path="submissions"\s+element=\{<SubmissionsQueue\s*\/>\}\s*\/>/,
      'AppRoutes must contain the existing /instructor/submissions route pointing to SubmissionsQueue'
    );
  });

  test('5. Assessment ID parameter inspection contract: no unsupported ID is passed', () => {
    // Verify Instructor SubmissionsQueue route has no :id param
    const instructorRoutesSection = routesSrc.slice(
      routesSrc.indexOf('path="/instructor"'),
      routesSrc.indexOf('path="/admin"')
    );
    assert.doesNotMatch(
      instructorRoutesSection,
      /<Route\s+path="submissions\/:id"/,
      'Existing instructor submissions route does not support route parameter'
    );
    // Verify SubmissionsQueue only filters by query `search`
    assert.match(
      queueSrc,
      /params\.get\('search'\)/,
      'SubmissionsQueue only supports search query param'
    );
    assert.doesNotMatch(
      queueSrc,
      /params\.get\('(assessmentId|asmtId|assessment)'\)/,
      'SubmissionsQueue does not support assessment ID filter param'
    );
    // Navigation handler does not pass unsupported assessmentId param
    assert.match(
      builderSrc,
      /handleNavigateToSubmissions[\s\S]*?navigate\(['"`]\/instructor\/submissions['"`]\)/,
      'handleNavigateToSubmissions navigates cleanly to /instructor/submissions'
    );
  });

  test('6. Navigation config alignment for Instructor Submissions & Grading', () => {
    assert.match(
      navSrc,
      /id:\s*'instructor-submissions'/,
      'Navigation config defines instructor-submissions'
    );
    assert.match(
      navSrc,
      /path:\s*'\/instructor\/submissions'/,
      'Navigation config points to /instructor/submissions'
    );
    assert.match(
      navSrc,
      /icon:\s*FileCheck2/,
      'Navigation config uses FileCheck2 icon for submissions'
    );
  });

  test('7. Existing Save Draft and Publish Live behaviour is preserved intact', () => {
    assert.match(
      builderSrc,
      /onClick=\{\(\)\s*=>\s*handleSave\('draft'\)\}[\s\S]*?>[\s\S]*?Save Draft/,
      'Save Draft button must trigger handleSave("draft")'
    );
    assert.match(
      builderSrc,
      /if\s*\(validateForm\(true\)\)\s*\{[\s\S]*?setConfirmPublishModal\(true\);[\s\S]*?\}[\s\S]*?>[\s\S]*?Publish Live/,
      'Publish Live button must trigger validation and open confirmation modal'
    );
    assert.match(
      builderSrc,
      /loading=\{isSaving\}[\s\S]*?>[\s\S]*?Save Draft/,
      'Save Draft button must maintain isSaving loading state'
    );
    assert.match(
      builderSrc,
      /loading=\{isSaving\}[\s\S]*?>[\s\S]*?Publish Live/,
      'Publish Live button must maintain isSaving loading state'
    );
  });

  test('8. Question import, classification, and evaluation logic are unmodified', () => {
    assert.match(
      builderSrc,
      /handleImportFromQuestionBank/,
      'handleImportFromQuestionBank function must be preserved'
    );
    assert.match(
      builderSrc,
      /QuestionBankPickerModal/,
      'QuestionBankPickerModal must be preserved'
    );
    assert.match(
      builderSrc,
      /validateGradingScheme/,
      'Grading scheme validation must remain intact'
    );
  });
});
