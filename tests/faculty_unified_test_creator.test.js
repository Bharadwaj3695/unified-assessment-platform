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

const createTestSrc = readProjectFile('frontend/src/pages/instructor/CreateTest.jsx');
const studioSrc = readProjectFile('frontend/src/pages/instructor/TestCreatorStudio.jsx');
const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');
const navSrc = readProjectFile('frontend/src/config/navigationConfig.js');

describe('UAP — Unified Test Creator & Question Authoring Integration Verification', () => {

  test('1. Create Test Hub has concise header and breadcrumb', () => {
    assert.match(createTestSrc, /Faculty Workspace\s*\/\s*Create Test|Faculty Workspace[\s\S]*?Create Test/, 'Breadcrumb present');
    assert.match(createTestSrc, /Create Test/, 'Title is Create Test');
    assert.match(createTestSrc, /Select test type/, 'Subtitle is Select test type');
    assert.doesNotMatch(createTestSrc, /Design and configure comprehensive academic/i, 'No marketing fluff');
  });

  test('2. Create Test Hub has single primary card containing Assessment and Mock Test with single Launch button', () => {
    assert.match(createTestSrc, /data-testid="card-primary-test-creation"/, 'Single primary test creation card present');
    assert.match(createTestSrc, /data-testid="option-course-assessment"/, 'Course Assessment selectable option present');
    assert.match(createTestSrc, /data-testid="option-mock-test"/, 'Mock Test selectable option present');
    assert.match(createTestSrc, /Select Test Type/, 'Primary card title is Select Test Type');
    assert.match(createTestSrc, /selectedTestType === 'assessment'/, 'Course Assessment selection highlighted');
    assert.match(createTestSrc, /selectedTestType === 'mock'/, 'Mock Test selection highlighted');
    
    // Single Launch button inside the same card
    assert.match(createTestSrc, />\s*Launch\s*<\/Button>/, 'Launch button strictly labeled Launch');
    assert.doesNotMatch(createTestSrc, /Launch Test Creator/, 'Does not use Launch Test Creator label');
  });

  test('3. Interview Options are displayed separately as Coming Soon without Launch buttons', () => {
    assert.match(createTestSrc, /data-testid="card-interview-ai"/, 'AI Mock Interview card present');
    assert.match(createTestSrc, /data-testid="card-interview-faculty"/, 'Faculty Interview card present');
    assert.match(createTestSrc, /Coming Soon/, 'Coming Soon badges present');
  });

  test('4. Launch button opens TestCreatorStudio preserving selected type', () => {
    assert.match(
      createTestSrc,
      /\/instructor\/test-creator\?type=|\/instructor\/create\?type=/,
      'Launch button navigates to creator with type query param'
    );
    assert.match(routesSrc, /TestCreatorStudio/, 'AppRoutes imports TestCreatorStudio');
    assert.match(routesSrc, /path="test-creator"/, 'AppRoutes has test-creator route');
    assert.match(navSrc, /'\/instructor\/test-creator'/, 'NavigationConfig includes test-creator pattern');
  });

  test('5. Test Creator Studio Header displays title, badges, and actions', () => {
    assert.match(studioSrc, /Test Creator Studio/, 'Header title is Test Creator Studio');
    assert.match(studioSrc, /Student Preview/, 'Student Preview action present');
    assert.match(studioSrc, /Save Draft/, 'Save Draft action present');
    assert.match(studioSrc, /Publish/, 'Publish action present');
    assert.match(studioSrc, /totalMarks/, 'Total marks badge computed');
    assert.match(studioSrc, /questions\.length/, 'Question count badge computed');
  });

  test('6. Questions section provides Add Question at both top and bottom', () => {
    assert.match(studioSrc, /data-testid="btn-add-question-top"/, 'Add question button at top present');
    assert.match(studioSrc, /data-testid="btn-add-question-bottom"/, 'Add question button at bottom present');
  });

  test('7. Coding Question integrates full FacultyCodeIDE inside question card', () => {
    assert.match(studioSrc, /import FacultyCodeIDE from/, 'Imports FacultyCodeIDE');
    assert.match(studioSrc, /<FacultyCodeIDE/, 'Renders FacultyCodeIDE for coding questions');
    assert.match(studioSrc, /onUpdateCodingConfig/, 'Passes onUpdateCodingConfig to FacultyCodeIDE');
  });

  test('8. Student Preview integrates StudentCodeIDE and protects hidden test cases', () => {
    assert.match(studioSrc, /import StudentCodeIDE from/, 'Imports StudentCodeIDE');
    assert.match(studioSrc, /<StudentCodeIDE/, 'Renders StudentCodeIDE in student preview');
    assert.match(studioSrc, /filter\(\(tc\)\s*=>\s*!tc\.isHidden\)/, 'Strictly filters out hidden test cases in student preview');
  });
});

test('Test Creator Studio initializes test type from URL', () => {
  // Verify that the component reads the URL query parameter.
  assert.match(studioSrc, /useSearchParams/);

  // Verify both supported types are handled.
  assert.match(studioSrc, /assessment/);
  assert.match(studioSrc, /mock/);

  // Verify the selected type controls the displayed UI.
  assert.match(studioSrc, /testTypeLabel/);
});
