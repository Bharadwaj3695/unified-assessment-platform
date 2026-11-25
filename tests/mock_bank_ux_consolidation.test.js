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

describe('UAP – Mock Bank UX Consolidation & Multi-Question Creation Suite', () => {
  const navSrc = readProjectFile('frontend/src/config/navigationConfig.js');
  const hubSrc = readProjectFile('frontend/src/pages/instructor/QuestionBankHub.jsx');
  const studioSrc = readProjectFile('frontend/src/pages/instructor/QuestionStudio.jsx');
  const evalSrc = readProjectFile('frontend/src/pages/instructor/MockTestEvaluationStudio.jsx');
  const searchSrc = readProjectFile('frontend/src/components/common/search/InstructorSearchBar.jsx');
  const tailwindSrc = readProjectFile('frontend/tailwind.config.js');

  // =========================================================================
  // 1. Mock Bank Sidebar Navigation
  // =========================================================================
  describe('1. Mock Bank Sidebar Navigation & Labeling', () => {
    test('1.1 Navigation configuration sets user-facing label to Mock Bank', () => {
      assert.match(
        navSrc,
        /id:\s*['"]instructor-question-bank['"][\s\S]*?name:\s*['"]Mock Bank['"]/,
        'Navigation item for instructor question bank must have name "Mock Bank"'
      );
      assert.doesNotMatch(
        navSrc,
        /id:\s*['"]instructor-question-bank['"][\s\S]*?name:\s*['"]Question Bank['"]/,
        'Must not retain old "Question Bank" name in sidebar navigation item'
      );
    });

    test('1.2 Route compatibility is strictly preserved for existing paths', () => {
      assert.match(
        navSrc,
        /path:\s*['"]\/instructor\/question-bank['"]/,
        'Must preserve canonical route /instructor/question-bank'
      );
      assert.match(
        navSrc,
        /matchPatterns:\s*\[[\s\S]*?\/instructor\/question-bank[\s\S]*?\/instructor\/question-studio[\s\S]*?\/instructor\/question-bank-hub/,
        'Must maintain match patterns for question-studio and hub'
      );
    });

    test('1.3 Auxiliary instructor pages reflect consistent Mock Bank labeling', () => {
      assert.match(
        evalSrc,
        /Return to Mock Bank|Back to Mock Bank/,
        'MockTestEvaluationStudio must refer to Mock Bank'
      );
      assert.match(
        searchSrc,
        /Mock Bank Repository/,
        'InstructorSearchBar must refer to Mock Bank Repository'
      );
    });
  });

  // =========================================================================
  // 2. Question Count Accuracy
  // =========================================================================
  describe('2. Question Count Accuracy', () => {
    test('2.1 Questions tab displays actual prepared question count N', () => {
      assert.match(
        hubSrc,
        /Questions\s*\(\{\s*totalQuestions\s*\}\)/,
        'Questions tab must display dynamic totalQuestions count'
      );
    });

    test('2.2 Question count does not count question banks as questions', () => {
      assert.match(
        hubSrc,
        /setTotalQuestions\s*\(\s*res\.pagination\?\.total\s*\|\|\s*\(res\.data\s*\?\s*res\.data\.length\s*:\s*0\)\s*\)/,
        'Total count must strictly be derived from questions query and pagination'
      );
    });
  });

  // =========================================================================
  // 3. Unified Questions View
  // =========================================================================
  describe('3. Unified Questions View & Bank/Pool Integration', () => {
    test('3.1 Search, filter, and table views exist for questions', () => {
      assert.match(hubSrc, /handleSearchSubmit/, 'Must have search form submit handler');
      assert.match(hubSrc, /selectedSubject/, 'Must support filtering by subject');
      assert.match(hubSrc, /selectedType/, 'Must support filtering by question type');
      assert.match(hubSrc, /selectedDifficulty/, 'Must support filtering by difficulty');
      assert.match(hubSrc, /selectedStatus/, 'Must support filtering by publication status');
    });

    test('3.2 Question banks and pools are integrated as a filter within the unified questions view', () => {
      assert.match(
        hubSrc,
        /selectedBank/,
        'Must maintain selectedBank state for filtering questions by bank'
      );
      assert.match(
        hubSrc,
        /<select[^>]*value=\{\s*selectedBank\s*\}[\s\S]*?All Banks & Pools/,
        'Must render bank/pool selection dropdown in questions filter bar'
      );
    });

    test('3.3 Table displays pool assignment badge when question belongs to a bank', () => {
      assert.match(
        hubSrc,
        /assignedBanks/,
        'Must compute bank assignment for individual question row'
      );
      assert.match(
        hubSrc,
        /Bank:\s*\$\{\s*assignedBanks\[0\]\.title\s*\}/,
        'Must display assigned bank badge or title on question row'
      );
    });
  });

  // =========================================================================
  // 4. Removal of Redundant Tabs
  // =========================================================================
  describe('4. Removal of Redundant Tabs', () => {
    test('4.1 Only 2 user-facing tabs are displayed: Questions and Mock Tests & Blueprints', () => {
      // Must not have activeTab === 'banks' or activeTab === 'hierarchy' buttons in tabs bar
      assert.doesNotMatch(
        hubSrc,
        /setActiveTab\(['"]banks['"]\)/,
        'Must remove separate Question Banks & Pools tab navigation button'
      );
      assert.doesNotMatch(
        hubSrc,
        /setActiveTab\(['"]hierarchy['"]\)/,
        'Must remove separate Syllabus Hierarchy tab navigation button'
      );
      assert.doesNotMatch(
        hubSrc,
        /Syllabus Hierarchy/,
        'Must remove Syllabus Hierarchy tab from user-facing navigation'
      );
    });

    test('4.2 Subtitle badge "UAP Centralized Subsystem" is removed', () => {
      assert.doesNotMatch(
        hubSrc,
        /UAP Centralized Subsystem/,
        'Subtitle badge "UAP Centralized Subsystem" must be removed'
      );
    });

    test('4.3 Page title is simplified to Mock Bank', () => {
      assert.match(
        hubSrc,
        /<h1[^>]*>Mock Bank<\/h1>/,
        'Hub page title must be "Mock Bank"'
      );
    });
  });

  // =========================================================================
  // 5. Add Question Action
  // =========================================================================
  describe('5. Add Question Action', () => {
    test('5.1 Question Studio provides Add Question and Add Another Question buttons', () => {
      assert.match(
        studioSrc,
        /handleAddQuestion/,
        'Must define handleAddQuestion handler'
      );
      assert.match(
        studioSrc,
        /Add Question/,
        'Must render Add Question action'
      );
      assert.match(
        studioSrc,
        /Add Another Question/,
        'Must render bottom Add Another Question button'
      );
    });

    test('5.2 Adding question creates a new card with independent client ID and default metadata', () => {
      assert.match(
        studioSrc,
        /setQuestions\(\(prev\)\s*=>\s*\[\.\.\.prev,\s*newQ\]\)/,
        'Must append new question object to session questions array'
      );
      assert.match(
        studioSrc,
        /createDefaultQuestion/,
        'Must instantiate questions using default factory'
      );
    });
  });

  // =========================================================================
  // 6. Multiple Question Cards
  // =========================================================================
  describe('6. Multiple Question Cards', () => {
    test('6.1 Question Studio renders an array of question cards in one session', () => {
      assert.match(
        studioSrc,
        /questions\.map\(\(q,\s*qIdx\)\s*=>/,
        'Must map over questions array to render multiple question cards'
      );
      assert.match(
        studioSrc,
        /Question #\{qIdx \+ 1\}/,
        'Must display question number indicator for each card'
      );
    });

    test('6.2 Supports collapsing and expanding individual cards or all cards', () => {
      assert.match(
        studioSrc,
        /handleToggleCollapse/,
        'Must define handleToggleCollapse for single cards'
      );
      assert.match(
        studioSrc,
        /handleCollapseAll/,
        'Must support Expand All and Collapse All'
      );
      assert.match(
        studioSrc,
        /isCollapsed/,
        'Must track isCollapsed boolean per question'
      );
    });
  });

  // =========================================================================
  // 7. Different Question Types in One Session
  // =========================================================================
  describe('7. Different Question Types in One Authoring Session', () => {
    test('7.1 Every question card has its own question type selector', () => {
      assert.match(
        studioSrc,
        /handleTypeChange\(qIdx,\s*e\.target\.value\)/,
        'Every card must independently update its questionType'
      );
      assert.match(
        studioSrc,
        /QUESTION_TYPES\.map/,
        'Must populate question types dropdown for each card'
      );
    });

    test('7.2 Supports all required question types', () => {
      const types = [
        'SINGLE_MCQ',
        'MULTI_SELECT',
        'TRUE_FALSE',
        'FILL_BLANK',
        'SHORT_ANSWER',
        'DESCRIPTIVE',
        'CODING',
        'SQL',
        'FILE_UPLOAD',
      ];
      for (const t of types) {
        assert.match(
          studioSrc,
          new RegExp(`id:\\s*['"]${t}['"]`),
          `QuestionStudio must support question type ${t}`
        );
      }
    });

    test('7.3 Supports question-specific configurations dynamically per card', () => {
      assert.match(studioSrc, /q\.questionType === 'SINGLE_MCQ'/);
      assert.match(studioSrc, /q\.questionType === 'MULTI_SELECT'/);
      assert.match(studioSrc, /q\.questionType === 'TRUE_FALSE'/);
      assert.match(studioSrc, /q\.questionType === 'FILL_BLANK'/);
      assert.match(studioSrc, /q\.questionType === 'SHORT_ANSWER'/);
      assert.match(studioSrc, /q\.questionType === 'DESCRIPTIVE'/);
      assert.match(studioSrc, /q\.questionType === 'CODING'/);
      assert.match(studioSrc, /q\.questionType === 'SQL'/);
      assert.match(studioSrc, /q\.questionType === 'FILE_UPLOAD'/);
    });
  });

  // =========================================================================
  // 8. Independent Question State Preservation
  // =========================================================================
  describe('8. Independent Question State Preservation', () => {
    test('8.1 Input updates to one question do not overwrite other questions', () => {
      assert.match(
        studioSrc,
        /updateQuestionField\s*=\s*\(idx,\s*field,\s*value\)/,
        'Must define updateQuestionField with index scoping'
      );
      assert.match(
        studioSrc,
        /updateEvaluationConfig\s*=\s*\(idx,\s*field,\s*value\)/,
        'Must define updateEvaluationConfig with index scoping'
      );
    });

    test('8.2 Switching between questions or collapse states retains entered field values', () => {
      assert.match(
        studioSrc,
        /next\[idx\]\s*=\s*\{\s*\.\.\.next\[idx\],\s*\[field\]:\s*value\s*\}/,
        'Field updates must preserve existing object properties immutably'
      );
    });
  });

  // =========================================================================
  // 9. Edit, Duplicate, Delete and Reorder
  // =========================================================================
  describe('9. Edit, Duplicate, Delete and Reorder Actions', () => {
    test('9.1 Duplicate creates a deep copy with a new client ID and reset savedId', () => {
      assert.match(
        studioSrc,
        /handleDuplicateQuestion/,
        'Must implement handleDuplicateQuestion'
      );
      assert.match(
        studioSrc,
        /duplicated\.savedId\s*=\s*null/,
        'Duplicated question must clear savedId to prevent overwriting existing record'
      );
      assert.match(
        studioSrc,
        /duplicated\.clientId\s*=\s*generateClientId\(\)/,
        'Duplicated question must generate fresh clientId'
      );
    });

    test('9.2 Reorder shifts question up or down', () => {
      assert.match(
        studioSrc,
        /handleMoveQuestion\s*=\s*\(idx,\s*direction\)/,
        'Must implement handleMoveQuestion with index and direction'
      );
    });

    test('9.3 Delete removes target question after safety check', () => {
      assert.match(
        studioSrc,
        /handleRemoveQuestion/,
        'Must implement handleRemoveQuestion'
      );
      assert.match(
        studioSrc,
        /questions\.length\s*<=\s*1/,
        'Must prevent deleting the only remaining question in session'
      );
    });
  });

  // =========================================================================
  // 10. Per-Question Validation
  // =========================================================================
  describe('10. Per-Question Validation', () => {
    test('10.1 Individual validation checks validateSingleQuestion', () => {
      assert.match(
        studioSrc,
        /validateSingleQuestion/,
        'Must define standalone validateSingleQuestion validator'
      );
      assert.match(
        studioSrc,
        /statement\.length\s*<\s*5/,
        'Must validate statement minimum length'
      );
    });

    test('10.2 Validation reports per-card errors and visual badge', () => {
      assert.match(
        studioSrc,
        /validationReport/,
        'Must store validation report on question model'
      );
      assert.match(
        studioSrc,
        /rep\.errors\.map/,
        'Must display specific validation errors inside card'
      );
    });
  });

  // =========================================================================
  // 11. Multiple-Question Save Behaviour
  // =========================================================================
  describe('11. Multiple-Question Save Behaviour', () => {
    test('11.1 Save All Drafts iterates questions and calls existing create/update endpoints', () => {
      assert.match(
        studioSrc,
        /handleSaveAllDrafts/,
        'Must define handleSaveAllDrafts handler'
      );
      assert.match(
        studioSrc,
        /uapQuestionBankService\.createQuestion/,
        'Must reuse existing question creation API'
      );
      assert.match(
        studioSrc,
        /uapQuestionBankService\.updateQuestion/,
        'Must reuse existing question update API for previously saved questions'
      );
    });

    test('11.2 Individual card quick save saves single draft', () => {
      assert.match(
        studioSrc,
        /handleSaveSingleDraft/,
        'Must provide single draft save handler'
      );
    });
  });

  // =========================================================================
  // 12. Partial Save Failure and Retry
  // =========================================================================
  describe('12. Partial Save Failure & Duplicate Prevention on Retry', () => {
    test('12.1 Successfully saved questions acquire savedId so retry does not duplicate them', () => {
      assert.match(
        studioSrc,
        /savedId:\s*newId/,
        'Must set savedId on question when createQuestion resolves successfully'
      );
      assert.match(
        studioSrc,
        /if\s*\(\s*q\.savedId\s*\)\s*\{[\s\S]*?updateQuestion[\s\S]*?\}\s*else\s*\{[\s\S]*?createQuestion/,
        'Must branch: call updateQuestion if savedId exists, otherwise createQuestion'
      );
    });

    test('12.2 Errors are isolated to failed questions without discarding successful ones', () => {
      assert.match(
        studioSrc,
        /saveStatus:\s*['"]error['"]/,
        'Must set saveStatus to error on failed question'
      );
      assert.match(
        studioSrc,
        /saveError:\s*errMsg/,
        'Must record error message on specific failed question'
      );
    });
  });

  // =========================================================================
  // 13. Evaluation Settings Per Question
  // =========================================================================
  describe('13. Evaluation Settings Per Question Card (No Standalone Right Panel)', () => {
    test('13.1 Separate right Evaluation Configuration panel is removed', () => {
      assert.doesNotMatch(
        studioSrc,
        /Step 8: Marks & Difficulty Rating/,
        'Old standalone Step 8 sidebar panel must be removed'
      );
      assert.doesNotMatch(
        studioSrc,
        /lg:col-span-2[\s\S]*?<div className="space-y-6">[\s\S]*?Curriculum Hierarchy[\s\S]*?Evaluation Configuration/,
        'Must not render 1/3 right column for evaluation config'
      );
    });

    test('13.2 Compact Question Settings are integrated into each card', () => {
      assert.match(
        studioSrc,
        /Difficulty/,
        'Must include Difficulty setting in card'
      );
      assert.match(
        studioSrc,
        /Negative Marks/,
        'Must include Negative Marks setting in card'
      );
      assert.match(
        studioSrc,
        /Est\. Time \(sec\)|Estimated Time/,
        'Must include Estimated Time setting in card'
      );
    });
  });

  // =========================================================================
  // 14. Subject and Topic Metadata Preservation
  // =========================================================================
  describe('14. Curriculum & Metadata Preservation', () => {
    test('14.1 Preserves examination category, subject, topic, and concept tags', () => {
      assert.match(studioSrc, /examCategory/, 'Must preserve examCategory in payload');
      assert.match(studioSrc, /subjectId/, 'Must preserve subjectId in payload');
      assert.match(studioSrc, /topicIds/, 'Must preserve topicIds in payload');
      assert.match(studioSrc, /conceptTags/, 'Must preserve conceptTags in payload');
    });

    test('14.2 Displays compact Curriculum Context banner', () => {
      assert.match(
        studioSrc,
        /Curriculum & Exam Context/,
        'Must render compact Curriculum & Exam Context banner'
      );
    });
  });

  // =========================================================================
  // 15. AI Generator & Bulk Import Regression
  // =========================================================================
  describe('15. AI Generator and Bulk Import Regression', () => {
    test('15.1 QuestionBankHub maintains AiQuestionGeneratorModal and BulkQuestionImportModal', () => {
      assert.match(
        hubSrc,
        /<AiQuestionGeneratorModal/,
        'Must keep AiQuestionGeneratorModal in Hub'
      );
      assert.match(
        hubSrc,
        /<BulkQuestionImportModal/,
        'Must keep BulkQuestionImportModal in Hub'
      );
    });
  });

  // =========================================================================
  // 16. Mock Test Blueprint Regression
  // =========================================================================
  describe('16. Mock Test Blueprint Regression', () => {
    test('16.1 QuestionBankHub maintains MockTestBlueprintModal and MockTestAttemptsModal', () => {
      assert.match(
        hubSrc,
        /<MockTestBlueprintModal/,
        'Must keep MockTestBlueprintModal in Hub'
      );
      assert.match(
        hubSrc,
        /<MockTestAttemptsModal/,
        'Must keep MockTestAttemptsModal in Hub'
      );
    });
  });

  // =========================================================================
  // 17. Responsive Layout
  // =========================================================================
  describe('17. Responsive Layout Ergonomics', () => {
    test('17.1 Uses responsive grid classes for desktop, tablet, and mobile', () => {
      assert.match(
        studioSrc,
        /grid-cols-1\s*md:grid-cols-4|grid-cols-2\s*sm:grid-cols-4/,
        'Must use responsive breakpoints for form controls'
      );
      assert.match(
        hubSrc,
        /flex-col\s*lg:flex-row/,
        'Must use responsive flex layout for hub header'
      );
    });
  });

  // =========================================================================
  // 18. Orange Theme Token Consistency
  // =========================================================================
  describe('18. Orange Theme Token Consistency', () => {
    test('18.1 Uses brand-primary and terracotta design system tokens', () => {
      assert.match(studioSrc, /bg-brand-primary/, 'Must use bg-brand-primary');
      assert.match(studioSrc, /text-brand-primary/, 'Must use text-brand-primary');
      assert.match(studioSrc, /shadow-warm-xs/, 'Must use shadow-warm-xs token');
      assert.match(hubSrc, /bg-brand-primary/, 'Must use bg-brand-primary');
      assert.match(hubSrc, /shadow-warm-xs/, 'Must use shadow-warm-xs token');
    });

    test('18.2 Tailwind config defines authoritative brand terracotta color #E05D38', () => {
      assert.match(
        tailwindSrc,
        /['"]?primary['"]?:\s*['"]#E05D38['"]/,
        'brand.primary must be #E05D38'
      );
      assert.match(
        tailwindSrc,
        /['"]?primary-hover['"]?:\s*['"]#C94A26['"]/,
        'brand.primary-hover must be #C94A26'
      );
    });
  });

  // =========================================================================
  // 19. Subject & Default Topics Manual Entry Fix Suite
  // =========================================================================
  describe('19. Subject & Default Topics Manual Entry Fix Suite', () => {
    test('19.1 Subject manual text entry replaces dropdown and has orange focus styling', () => {
      // Must have label Subject with required asterisk
      assert.match(
        studioSrc,
        /Subject\s*<span className="text-rose-500">\*<\/span>/,
        'Subject label must have required indicator'
      );
      // Must have normal text input with placeholder "Enter subject name (e.g. Data Structures)"
      assert.match(
        studioSrc,
        /<input[\s\S]*?placeholder="Enter subject name \(e\.g\. Data Structures\)"/,
        'Subject field must be a text input with specified placeholder'
      );
      // Must NOT render a select dropdown for curriculumContext.subjectId
      assert.doesNotMatch(
        studioSrc,
        /<select[^>]*value=\{\s*curriculumContext\.subjectId\s*\}/,
        'Must remove dependent Subject dropdown'
      );
      // Must use UAP terracotta focus ring
      assert.match(
        studioSrc,
        /focus:ring-brand-primary/,
        'Subject input must use orange brand-primary focus ring'
      );
    });

    test('19.2 Default Topics manual text entry replaces dependent dropdown', () => {
      // Must have label Default Topics
      assert.match(
        studioSrc,
        /<label[^>]*>\s*Default Topics\s*<\/label>/,
        'Default Topics label must be present'
      );
      // Must have normal text input with placeholder "Enter topic names (e.g. Trees, Graphs, Recursion)"
      assert.match(
        studioSrc,
        /<input[\s\S]*?placeholder="Enter topic names \(e\.g\. Trees, Graphs, Recursion\)"/,
        'Default Topics field must be a text input with specified placeholder'
      );
      // Must NOT make API calls to fetch topics when subject changes
      assert.doesNotMatch(
        studioSrc,
        /uapQuestionBankService\.getTopics\(\{\s*subjectId/,
        'Must not call getTopics API when user enters subject'
      );
    });

    test('19.3 Default Topics is optional with red asterisk removed', () => {
      // Must NOT have red required asterisk on Default Topics label
      assert.doesNotMatch(
        studioSrc,
        /Default Topics\s*<span className="text-rose-500">\*<\/span>/,
        'Default Topics must not have red required asterisk'
      );
    });

    test('19.4 Empty Default Topics does not block saving', () => {
      // validateSingleQuestion must NOT reject empty topicIds or topics
      assert.doesNotMatch(
        studioSrc,
        /At least one topic must be assigned before publishing/,
        'Empty Default Topics must not block question publishing or saving'
      );
    });

    test('19.5 Subject validation remains correct and required for publishing', () => {
      assert.match(
        studioSrc,
        /Subject must be entered before publishing|Subject is required before publishing/,
        'Subject validation must remain required before publishing'
      );
    });

    test('19.6 Multiple topic names are handled correctly via comma separation', () => {
      assert.match(
        studioSrc,
        /handleCurriculumTopicsChange/,
        'Must define handleCurriculumTopicsChange'
      );
      assert.match(
        studioSrc,
        /\.split\(','\)[\s\S]*?\.map\(\(t\)\s*=>\s*t\.trim\(\)\)[\s\S]*?\.filter\(Boolean\)/,
        'Must parse comma-separated topic entries into clean array'
      );
    });

    test('19.7 Concept Tags remain independent and not merged with Default Topics', () => {
      assert.match(
        studioSrc,
        /Concept Tags \(Press Enter\)/,
        'Concept Tags field must be preserved independently'
      );
      assert.match(
        studioSrc,
        /handleAddCurriculumTag/,
        'Concept Tags must retain dedicated tag addition handler'
      );
      assert.match(
        studioSrc,
        /handleRemoveCurriculumTag/,
        'Concept Tags must retain dedicated tag removal handler'
      );
    });

    test('19.8 Session defaults propagate to newly added questions', () => {
      assert.match(
        studioSrc,
        /createDefaultQuestion\(\s*\{[\s\S]*?questionType:\s*type[\s\S]*?\},\s*curriculumContext\s*\)/,
        'New questions must inherit session defaults from curriculumContext'
      );
    });

    test('19.9 Individual question metadata remains isolated', () => {
      assert.match(
        studioSrc,
        /updateQuestionField\s*=\s*\(idx,\s*field,\s*value\)/,
        'Individual question fields must be updated with index isolation'
      );
    });

    test('19.10 Save All Drafts preserves metadata correctly', () => {
      assert.match(
        studioSrc,
        /buildQuestionPayload[\s\S]*?subject[\s\S]*?subjectId[\s\S]*?topics[\s\S]*?topicIds[\s\S]*?conceptTags/,
        'Question payload must preserve subject, subjectId, topics, topicIds, and conceptTags'
      );
    });

    test('19.11 Partial-save retry preserves metadata and prevents duplicate questions', () => {
      assert.match(
        studioSrc,
        /if\s*\(\s*q\.savedId\s*\)\s*\{[\s\S]*?updateQuestion[\s\S]*?\}\s*else\s*\{[\s\S]*?createQuestion[\s\S]*?savedId:\s*newId/,
        'Retry must branch on savedId to avoid duplicate question creations'
      );
    });

    test('19.12 Existing subjectId/topicIds records remain compatible during edit load', () => {
      assert.match(
        studioSrc,
        /q\.subject\s*\|\|\s*q\.subjectId\?\.name/,
        'Edit mode must load and support both text subject and populated subjectId'
      );
      assert.match(
        studioSrc,
        /loadedTopicIds/,
        'Edit mode must preserve valid ObjectId topicIds'
      );
    });

    test('19.13 Existing question bank hub displays subject and topics with backward compatibility', () => {
      assert.match(
        hubSrc,
        /q\.subject\s*\|\|\s*q\.subjectId\?\.name\s*\|\|\s*['"]General['"]/,
        'Hub question table must support both manual subject string and populated subjectId'
      );
      assert.match(
        hubSrc,
        /q\.topics\?\.\[0\]\s*\|\|\s*q\.topicIds\?\.\[0\]\?\.name\s*\|\|\s*['"]-['"]/,
        'Hub question table must support both manual topics string array and populated topicIds'
      );
    });
  });
});
