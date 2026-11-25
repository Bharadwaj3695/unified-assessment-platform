import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const require = createRequire(import.meta.url);
const MockTest = require('../backend/src/models/MockTest.js');
const mockTestService = require('../backend/src/services/mockTest.service.js');

const HIGHER_ED_EXAMINATIONS = [
  'GATE 2027',
  'CAT 2026',
  'GRE',
  'University Semester Examination',
  'Placement Assessment',
  'Company Hiring Assessment',
];

test('Target Examination UI uses a simple manual text input without fixed dropdown or suggestions', async (t) => {
  const studioSrc = fs.readFileSync(
    path.join(rootDir, 'frontend/src/pages/instructor/TestCreatorStudio.jsx'),
    'utf8'
  );
  const blueprintModalSrc = fs.readFileSync(
    path.join(rootDir, 'frontend/src/components/instructor/MockTestBlueprintModal.jsx'),
    'utf8'
  );

  await t.test('TestCreatorStudio renders simple text input with required label and placeholder', () => {
    assert.doesNotMatch(studioSrc, /Combobox/, 'TestCreatorStudio must not use Combobox dropdown');
    assert.doesNotMatch(studioSrc, /examinationSuggestions/, 'TestCreatorStudio must not load examination suggestions');
    assert.match(studioSrc, /Target Examination/, 'Label must be Target Examination');
    assert.match(studioSrc, /placeholder="Enter examination name"/, 'Placeholder must be Enter examination name');
    assert.match(studioSrc, /type="text"/, 'Target Examination must be a text input');
    assert.match(studioSrc, /const \[examination, setExamination\] = useState\(''\)/, 'Target Examination must start empty so placeholder is shown');
  });

  await t.test('MockTestBlueprintModal renders simple text input with required label and placeholder', () => {
    assert.match(blueprintModalSrc, /Target Examination/, 'Blueprint modal label must be Target Examination');
    assert.match(blueprintModalSrc, /placeholder="Enter examination name"/, 'Blueprint modal placeholder must be Enter examination name');
    assert.match(blueprintModalSrc, /examination:\s*''/, 'Blueprint modal examination must start empty');
  });
});

test('MockTest Schema supports any custom graduate-level examination name without enum restriction', () => {
  const examPath = MockTest.schema.path('examination');
  assert.ok(examPath, 'MockTest schema must define examination path');
  assert.equal(examPath.options.enum, undefined, 'MockTest examination must not enforce a fixed enum');
  assert.equal(examPath.options.trim, true, 'MockTest examination must trim outer whitespace');

  for (const examName of HIGHER_ED_EXAMINATIONS) {
    const doc = new MockTest({
      title: `${examName} Test`,
      examination: `  ${examName}  `,
      subjectId: '650000000000000000000001',
      ownerFacultyId: '650000000000000000000002',
    });
    assert.equal(doc.examination, examName, `Exact examination name "${examName}" must be preserved`);
  }

  const draftWithEmptyExam = new MockTest({
    title: 'Draft Without Exam Yet',
    examination: '',
    subjectId: '650000000000000000000001',
    ownerFacultyId: '650000000000000000000002',
  });
  assert.equal(draftWithEmptyExam.examination, '', 'Drafts with empty examination must be permitted');
});

test('mockTestService exposes createMockTest and publishMockTest with null-safe examination handling', () => {
  const serviceSrc = fs.readFileSync(
    path.join(rootDir, 'backend/src/services/mockTest.service.js'),
    'utf8'
  );
  const controllerSrc = fs.readFileSync(
    path.join(rootDir, 'backend/src/controllers/mockTest.controller.js'),
    'utf8'
  );

  assert.equal(typeof mockTestService.createMockTest, 'function');
  assert.equal(typeof mockTestService.publishMockTest, 'function');
  assert.match(serviceSrc, /data\.examination === null\s*\?\s*''/, 'Service must map null examination to empty string');
  assert.match(controllerSrc, /rest\.examination === null\s*\?\s*''/, 'Controller must map null examination to empty string');
});
