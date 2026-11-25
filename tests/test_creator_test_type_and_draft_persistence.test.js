import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('UAP Test Creator Studio — Test Type State, URL & Draft Persistence Contracts', async (t) => {
  const createTestPath = path.join(rootDir, 'frontend/src/pages/instructor/CreateTest.jsx');
  const studioPath = path.join(rootDir, 'frontend/src/pages/instructor/TestCreatorStudio.jsx');
  const appRoutesPath = path.join(rootDir, 'frontend/src/routes/AppRoutes.jsx');

  assert.ok(fs.existsSync(createTestPath), 'CreateTest.jsx must exist');
  assert.ok(fs.existsSync(studioPath), 'TestCreatorStudio.jsx must exist');
  assert.ok(fs.existsSync(appRoutesPath), 'AppRoutes.jsx must exist');

  const createTestSrc = fs.readFileSync(createTestPath, 'utf8');
  const studioSrc = fs.readFileSync(studioPath, 'utf8');
  const appRoutesSrc = fs.readFileSync(appRoutesPath, 'utf8');

  await t.test('1. CreateTest Hub passes type parameter correctly', () => {
    assert.match(
      createTestSrc,
      /navigate\(`\/instructor\/test-creator\?type=\$\{selectedTestType\}`\)/,
      'CreateTest must pass selectedTestType as URL query parameter'
    );
    assert.match(
      createTestSrc,
      /useSearchParams/,
      'CreateTest should support reading initial type from searchParams'
    );
  });

  await t.test('2. TestCreatorStudio synchronizes testType with URL searchParams', () => {
    assert.match(
      studioSrc,
      /const\s*\[searchParams,\s*setSearchParams\]\s*=\s*useSearchParams\(\)/,
      'TestCreatorStudio must use [searchParams, setSearchParams]'
    );
    assert.match(
      studioSrc,
      /handleTestTypeChange/,
      'TestCreatorStudio must define handleTestTypeChange'
    );
    assert.match(
      studioSrc,
      /updated\.set\('type',\s*newType\)/,
      'handleTestTypeChange must immediately update type in searchParams'
    );
    assert.match(
      studioSrc,
      /data-testid="select-test-type"/,
      'Test type select dropdown must have data-testid="select-test-type"'
    );
    assert.match(
      studioSrc,
      /data-testid="badge-test-type"/,
      'Studio header badge must have data-testid="badge-test-type"'
    );
  });

  await t.test('3. TestCreatorStudio handles draft saving and stores draft ID in URL', () => {
    assert.match(
      studioSrc,
      /activeDraftId/,
      'TestCreatorStudio must maintain activeDraftId'
    );
    assert.match(
      studioSrc,
      /updated\.set\('id',\s*savedId\)/,
      'Saving draft must persist draft ID into searchParams'
    );
  });

  await t.test('4. TestCreatorStudio loadExistingTest reconciles test type and avoids testType dependency loop', () => {
    assert.match(
      studioSrc,
      /getMockTestById/,
      'loadExistingTest must support loading mock test drafts'
    );
    assert.match(
      studioSrc,
      /getAssessmentById/,
      'loadExistingTest must support loading assessment drafts'
    );
    // Ensure testType is NOT in the loadExistingTest dependency array
    const effectMatch = studioSrc.match(/loadExistingTest\(\);\s*return\s*\(\)\s*=>\s*\{\s*isMounted\s*=\s*false;\s*\};\s*\}\s*,\s*\[([^\]]+)\]/);
    assert.ok(effectMatch, 'loadExistingTest effect must have dependency array');
    assert.ok(!effectMatch[1].includes('testType'), 'loadExistingTest dependency array MUST NOT contain testType');
  });

  await t.test('5. AppRoutes registers both /test-creator and /test-creator/:id routes', () => {
    assert.match(
      appRoutesSrc,
      /<Route\s+path="test-creator"\s+element={<TestCreatorStudio\s*\/>}\s*\/>/,
      'AppRoutes must register test-creator'
    );
    assert.match(
      appRoutesSrc,
      /<Route\s+path="test-creator\/:id"\s+element={<TestCreatorStudio\s*\/>}\s*\/>/,
      'AppRoutes must register test-creator/:id'
    );
    assert.match(
      appRoutesSrc,
      /<Route\s+path="edit\/:id"\s+element={<TestCreatorStudio\s*\/>}\s*\/>/,
      'AppRoutes must register edit/:id'
    );
  });
});
