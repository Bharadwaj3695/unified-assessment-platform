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

describe('UAP — Unified Test Creator & Question Authoring Integration Verification', () => {
  const createTestSrc = readProjectFile('frontend/src/pages/instructor/CreateTest.jsx');
  const studioSrc = readProjectFile('frontend/src/pages/instructor/TestCreatorStudio.jsx');
  const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');
  const navSrc = readProjectFile('frontend/src/config/navigationConfig.js');

  test('1. Create Test Hub has concise header and breadcrumb', () => {
    assert.match(createTestSrc, /Faculty Workspace\s*\/\s*Create Test|Faculty Workspace[\s\S]*?Create Test/, 'Breadcrumb present');
    assert.match(createTestSrc, /Create Test/, 'Title is Create Test');
    assert.match(createTestSrc, /Select test type/, 'Subtitle is Select test type');
    assert.doesNotMatch(createTestSrc, /Design and configure comprehensive academic/i, 'No marketing fluff');
  });

  test('2. Create Test Hub has two selectable cards: Assessment and Mock Test', () => {
    assert.match(createTestSrc, /data-testid="card-assessment"/, 'Assessment card present');
    assert.match(createTestSrc, /Course assessment/, 'Assessment short label present');
    assert.match(createTestSrc, /data-testid="card-mock-test"/, 'Mock Test card present');
    assert.match(createTestSrc, /Practice test/, 'Mock Test short label present');
    assert.match(createTestSrc, /selectedTestType/, 'Card selection state maintained');
    assert.match(createTestSrc, /Launch Test Creator/, 'Primary Launch Test Creator button present');
  });

  test('3. Launch button opens TestCreatorStudio preserving selected type', () => {
    assert.match(
      createTestSrc,
      /\/instructor\/test-creator\?type=|\/instructor\/create\?type=/,
      'Launch button navigates to creator with type query param'
    );
    assert.match(routesSrc, /TestCreatorStudio/, 'AppRoutes imports TestCreatorStudio');
    assert.match(routesSrc, /path="test-creator"/, 'AppRoutes has test-creator route');
    assert.match(navSrc, /'\/instructor\/test-creator'/, 'NavigationConfig includes test-creator pattern');
  });

  test('4. Test Creator Studio Header displays title, badges, and actions', () => {
    assert.match(studioSrc, /Test Creator Studio/, 'Header title is Test Creator Studio');
    assert.match(studioSrc, /Student Preview/, 'Student Preview action present');
    assert.match(studioSrc, /Save Draft/, 'Save Draft action present');
    assert.match(studioSrc, /Publish/, 'Publish action present');
    assert.match(studioSrc, /totalMarks/, 'Total marks badge computed');
    assert.match(studioSrc, /questions\.length/, 'Question count badge computed');
  });

  test('5. Test Details section provides general and type-specific rules', () => {
    assert.match(studioSrc, /Test Name/, 'Test Name input present');
    assert.match(studioSrc, /Test Type/, 'Test Type selector present');
    assert.match(studioSrc, /Subject/, 'Subject dropdown present');
    assert.match(studioSrc, /Duration/, 'Duration field present');

    // Assessment specific rules
    assert.match(studioSrc, /testType === 'assessment'/, 'Conditional assessment rules');
    assert.match(studioSrc, /Passing Score/, 'Assessment passing score present');
    assert.match(studioSrc, /Proctoring/, 'Assessment proctoring rule present');

    // Mock specific blueprint
    assert.match(studioSrc, /testType === 'mock'/, 'Conditional mock rules');
    assert.match(studioSrc, /difficultyDistribution/, 'Mock difficulty distribution present');
    assert.match(studioSrc, /Negative Marking/, 'Mock negative marking present');
  });

  test('6. Questions section provides Add Question at both top and bottom', () => {
    assert.match(studioSrc, /data-testid="btn-add-question-top"/, 'Add question button at top present');
    assert.match(studioSrc, /data-testid="btn-add-question-bottom"/, 'Add question button at bottom present');
  });

  test('7. Question cards support all Mock Bank Studio question types and card controls', () => {
    assert.match(studioSrc, /SINGLE_MCQ/, 'Single Choice MCQ supported');
    assert.match(studioSrc, /MULTI_SELECT/, 'Multiple Select supported');
    assert.match(studioSrc, /TRUE_FALSE/, 'True / False supported');
    assert.match(studioSrc, /SHORT_ANSWER/, 'Short Answer supported');
    assert.match(studioSrc, /DESCRIPTIVE/, 'Descriptive supported');
    assert.match(studioSrc, /CODING/, 'Coding challenge supported');
    assert.match(studioSrc, /SQL/, 'SQL query challenge supported');

    // Controls
    assert.match(studioSrc, /handleMoveQuestion/, 'Reorder move up/down supported');
    assert.match(studioSrc, /handleDuplicateQuestion/, 'Duplicate question supported');
    assert.match(studioSrc, /handleRemoveQuestion/, 'Delete question supported');
    assert.match(studioSrc, /handleToggleCollapse/, 'Expand/collapse supported');
  });

  test('8. Coding test cases support both public and hidden cases, hiding secrets in preview', () => {
    assert.match(studioSrc, /HIDDEN EVALUATION CASE|Hidden Evaluation Case/i, 'Hidden test cases supported');
    assert.match(studioSrc, /PUBLIC SAMPLE CASE|Public Sample Case/i, 'Public sample cases supported');
    // In preview modal, hidden cases are filtered out
    assert.match(studioSrc, /filter\(\(tc\)\s*=>\s*!tc\.isHidden\)/, 'Preview strictly filters out hidden test cases');
  });
});
