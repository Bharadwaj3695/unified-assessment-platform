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

describe('Faculty Create Test Hub — Two Unified Cards Redesign Verification', () => {
  const createTestSrc = readProjectFile('frontend/src/pages/instructor/CreateTest.jsx');
  const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');
  const navSrc = readProjectFile('frontend/src/config/navigationConfig.js');

  test('1. AppRoutes and Navigation maintain /instructor/create-test and faculty routes', () => {
    assert.match(
      routesSrc,
      /<Route\s+path="create-test"\s+element=\{<CreateTest\s*\/>\}\s*\/>/,
      'AppRoutes must register create-test route under instructor'
    );
    assert.match(
      navSrc,
      /'\/instructor\/create-test'/,
      'NavigationConfig must include /instructor/create-test in matchPatterns'
    );
  });

  test('2. Two top-level cards layout replaces four separate cards', () => {
    // Check two-cards grid container
    assert.match(
      createTestSrc,
      /data-testid="create-test-two-cards-grid"/,
      'CreateTest must define the two-card grid container'
    );
    assert.match(
      createTestSrc,
      /grid\s+grid-cols-1\s+lg:grid-cols-2/,
      'Grid must be 2 columns on desktop and 1 column on mobile'
    );

    // Check exactly two top-level card testids
    assert.match(
      createTestSrc,
      /data-testid="card-assessment-mock"/,
      'Card 1 must be Assessment & Mock Test'
    );
    assert.match(
      createTestSrc,
      /data-testid="card-interview-assessments"/,
      'Card 2 must be Interview Assessments'
    );

    // Verify there are no 4 separate top-level cards
    const topCardMatches = createTestSrc.match(/data-testid="card-[^"]+"/g) || [];
    assert.equal(
      topCardMatches.length,
      2,
      'Must contain exactly two top-level cards'
    );
  });

  test('3. Card 1 (Assessment & Mock Test) contains the two required sub-options', () => {
    assert.match(
      createTestSrc,
      /Assessment & Mock Test/,
      'Card 1 title must be Assessment & Mock Test'
    );

    // Sub-option 1: Course Assessment
    assert.match(
      createTestSrc,
      /data-testid="sub-option-course-assessment"/,
      'Must contain Course Assessment sub-option'
    );
    assert.match(
      createTestSrc,
      /Course Assessment/,
      'Course Assessment title must be present'
    );

    // Sub-option 2: Mock Test & Blueprint
    assert.match(
      createTestSrc,
      /data-testid="sub-option-mock-blueprint"/,
      'Must contain Mock Test & Blueprint sub-option'
    );
    assert.match(
      createTestSrc,
      /Mock Test & Blueprint/,
      'Mock Test & Blueprint title must be present'
    );
  });

  test('4. Card 1 actions wire properly to AssessmentBuilder and MockTestBlueprintModal', () => {
    // Course Assessment navigates to /instructor/create
    assert.match(
      createTestSrc,
      /navigate\(['"`]\/instructor\/create['"`]\)/,
      'Course Assessment button must navigate to /instructor/create'
    );

    // Mock Test & Blueprint opens modal
    assert.match(
      createTestSrc,
      /setIsMockModalOpen\(true\)/,
      'Mock Test button must open the blueprint modal'
    );

    // Modal is rendered
    assert.match(
      createTestSrc,
      /<MockTestBlueprintModal[\s\S]*?isOpen=\{isMockModalOpen\}[\s\S]*?onClose=\{[^}]*\}[\s\S]*?subjects=\{subjects\}/,
      'MockTestBlueprintModal must be preserved with isOpen, onClose, and subjects'
    );
  });

  test('5. Card 2 (Interview Assessments) contains the two required sub-options', () => {
    assert.match(
      createTestSrc,
      /Interview Assessments/,
      'Card 2 title must be Interview Assessments'
    );

    // Sub-option 1: AI Mock Interview
    assert.match(
      createTestSrc,
      /data-testid="sub-option-ai-interview"/,
      'Must contain AI Mock Interview sub-option'
    );
    assert.match(
      createTestSrc,
      /AI Mock Interview/,
      'AI Mock Interview title must be present'
    );

    // Sub-option 2: Faculty Interview
    assert.match(
      createTestSrc,
      /data-testid="sub-option-faculty-interview"/,
      'Must contain Faculty Interview sub-option'
    );
    assert.match(
      createTestSrc,
      /Faculty Interview/,
      'Faculty Interview title must be present'
    );
  });

  test('6. Card 2 options are visibly marked Coming Soon and disabled', () => {
    // AI Mock Interview has Coming Soon badge and disabled button
    const aiInterviewBlock = createTestSrc.slice(
      createTestSrc.indexOf('data-testid="sub-option-ai-interview"'),
      createTestSrc.indexOf('data-testid="sub-option-faculty-interview"')
    );
    assert.match(
      aiInterviewBlock,
      /Coming Soon/,
      'AI Mock Interview must be marked Coming Soon'
    );
    assert.match(
      aiInterviewBlock,
      /<Button[\s\S]*?disabled[\s\S]*?>[\s\S]*?Coming Soon[\s\S]*?<\/Button>/,
      'AI Mock Interview button must be disabled'
    );

    // Faculty Interview has Coming Soon badge and disabled button
    const facultyInterviewBlock = createTestSrc.slice(
      createTestSrc.indexOf('data-testid="sub-option-faculty-interview"')
    );
    assert.match(
      facultyInterviewBlock,
      /Coming Soon/,
      'Faculty Interview must be marked Coming Soon'
    );
    assert.match(
      facultyInterviewBlock,
      /<Button[\s\S]*?disabled[\s\S]*?>[\s\S]*?Coming Soon[\s\S]*?<\/Button>/,
      'Faculty Interview button must be disabled'
    );
  });

  test('7. Visual indicators, icons, badges, and dark theme classes are applied', () => {
    assert.match(createTestSrc, /dark:bg-surface-dark/, 'Card dark mode background token used');
    assert.match(createTestSrc, /dark:border-surface-dark-border/, 'Card dark mode border token used');
    assert.match(createTestSrc, /Badge/, 'Badge component imported and used');
    assert.match(createTestSrc, /BookOpen/, 'BookOpen icon imported');
    assert.match(createTestSrc, /Sliders/, 'Sliders icon imported');
    assert.match(createTestSrc, /Sparkles/, 'Sparkles icon imported');
    assert.match(createTestSrc, /Users/, 'Users icon imported');
  });
});
