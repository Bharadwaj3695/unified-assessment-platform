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

describe('UAP — Question Bank, Question Import & Certification Blueprint Verification', () => {
  const hubSrc = readProjectFile('frontend/src/pages/instructor/QuestionBankHub.jsx');
  const studioSrc = readProjectFile('frontend/src/pages/instructor/TestCreatorStudio.jsx');
  const pickerSrc = readProjectFile('frontend/src/components/modals/QuestionBankPickerModal.jsx');
  const asmtModelSrc = readProjectFile('backend/src/models/Assessment.js');
  const asmtServiceSrc = readProjectFile('backend/src/services/assessment.service.js');
  const asmtControllerSrc = readProjectFile('backend/src/controllers/assessment.controller.js');
  const asmtRoutesSrc = readProjectFile('backend/src/routes/assessment.routes.js');

  // =========================================================================
  // 1. Question Bank — Renaming & Removal of Blueprint UI
  // =========================================================================
  describe('1. Question Bank Page Layout & Blueprint Removal', () => {
    test('1.1 Visible page title is Question Bank', () => {
      assert.match(
        hubSrc,
        /<h1[^>]*data-testid="heading-question-bank"[^>]*>[\s\S]*?Question Bank[\s\S]*?<\/h1>/,
        'QuestionBankHub must render visible page heading "Question Bank"'
      );
    });

    test('1.2 Mock Test Blueprint button is removed from page action bar', () => {
      assert.doesNotMatch(
        hubSrc,
        /<button[^>]*>[^<]*Mock Test Blueprint[^<]*<\/button>/,
        'Visible Mock Test Blueprint button must be removed from Question Bank actions bar'
      );
    });

    test('1.3 Mock Tests & Blueprints tab bar is removed from page navigation', () => {
      assert.doesNotMatch(
        hubSrc,
        /<button[^>]*onClick=\{\(\)\s*=>\s*setActiveTab\('mockTests'\)\}/,
        'Mock Tests & Blueprints tab button must be removed from page navigation'
      );
    });

    test('1.4 Essential Question Bank features are preserved', () => {
      // AI Generator
      assert.match(hubSrc, /data-testid="btn-ai-generator"/, 'AI Generator button preserved');
      assert.match(hubSrc, /AiQuestionGeneratorModal/, 'AiQuestionGeneratorModal preserved');

      // Bulk Import
      assert.match(hubSrc, /data-testid="btn-bulk-import"/, 'Bulk Import button preserved');
      assert.match(hubSrc, /BulkQuestionImportModal/, 'BulkQuestionImportModal preserved');

      // Create Question
      assert.match(hubSrc, /data-testid="btn-create-question"/, 'Create Question button preserved');

      // Search & Filters
      assert.match(hubSrc, /placeholder="Search statement, code, or concept tags\.\.\."/, 'Search input preserved');
      assert.match(hubSrc, /selectedSubject/, 'Subject filter preserved');
      assert.match(hubSrc, /selectedType/, 'Question type filter preserved');
      assert.match(hubSrc, /selectedDifficulty/, 'Difficulty filter preserved');
      assert.match(hubSrc, /selectedStatus/, 'Status filter preserved');
    });

    test('1.5 Question listing table actions include View, Edit, Duplicate, Delete', () => {
      assert.match(hubSrc, /btn-view-question/, 'View Question action must be present');
      assert.match(hubSrc, /btn-edit-question/, 'Edit Question action must be present');
      assert.match(hubSrc, /btn-duplicate-question/, 'Duplicate Question action must be present');
      assert.match(hubSrc, /btn-delete-question/, 'Delete/Archive Question action must be present');
      assert.match(hubSrc, /modal-view-question/, 'Question detail preview modal must be present');
    });
  });

  // =========================================================================
  // 2. Question Bank Selection Drawer / Modal
  // =========================================================================
  describe('2. Question Bank Selection Modal & Question Import', () => {
    test('2.1 QuestionBankPickerModal layout adheres to Blueprint specification', () => {
      assert.match(
        pickerSrc,
        /title="Add Questions from Question Bank"/,
        'Modal title must be "Add Questions from Question Bank"'
      );
      assert.match(pickerSrc, /data-testid="input-search-bank-questions"/, 'Search questions input must exist');
      assert.match(pickerSrc, /data-testid="select-filter-subject"/, 'Subject filter must exist');
      assert.match(pickerSrc, /data-testid="select-filter-type"/, 'Type filter must exist');
      assert.match(pickerSrc, /data-testid="select-filter-difficulty"/, 'Difficulty filter must exist');
      assert.match(pickerSrc, /data-testid="select-filter-topic"/, 'Topic filter must exist');
    });

    test('2.2 Selection features: individual, Select All, Deselect All, count badge', () => {
      assert.match(pickerSrc, /data-testid="btn-select-all"/, 'Select All / Deselect All button must exist');
      assert.match(pickerSrc, /data-testid="btn-deselect-all"/, 'Clear Selection button must exist');
      assert.match(pickerSrc, /data-testid="badge-selected-count"/, 'Selected count badge must exist');
      assert.match(pickerSrc, /Already in test/, 'Duplicate indicator badge must exist');
      assert.match(pickerSrc, /btn-view-bank-question/, 'View Question preview button must exist');
      assert.match(pickerSrc, /data-testid="btn-add-selected-questions"/, 'Add Selected Questions button must exist');
    });

    test('2.3 Question mapping preserves full integrity (content, coding config, test cases)', () => {
      assert.match(pickerSrc, /statement:\s*qText/, 'Question statement must be preserved');
      assert.match(pickerSrc, /questionType:\s*qType/, 'Question type must be preserved');
      assert.match(pickerSrc, /marks:\s*Number/, 'Question marks must be preserved');
      assert.match(pickerSrc, /starterCode:\s*codingCfg\.starterCode/, 'Coding starter code must be preserved');
      assert.match(pickerSrc, /testCases:\s*Array\.isArray/, 'Coding test cases must be preserved');
      assert.match(pickerSrc, /bankQuestionId:\s*\(bq\._id/, 'Question Bank snapshot reference must be preserved');
    });
  });

  // =========================================================================
  // 3. Test Creator Studio — Integration & Certification
  // =========================================================================
  describe('3. Test Creator Studio — Question Bank Import & Certification', () => {
    test('3.1 Add Question offers Create New Question and From Question Bank', () => {
      // Top controls
      assert.match(
        studioSrc,
        /data-testid="btn-add-question-top"[\s\S]*?>[\s\S]*?Create New Question/,
        'Top bar must render "Create New Question"'
      );
      assert.match(
        studioSrc,
        /data-testid="btn-from-question-bank-top"[\s\S]*?>[\s\S]*?From Question Bank/,
        'Top bar must render "From Question Bank"'
      );

      // Bottom controls
      assert.match(
        studioSrc,
        /data-testid="btn-add-question-bottom"[\s\S]*?>[\s\S]*?Create New Question/,
        'Bottom of questions list must render "Create New Question"'
      );
      assert.match(
        studioSrc,
        /data-testid="btn-from-bank-bottom"[\s\S]*?>[\s\S]*?From Question Bank/,
        'Bottom of questions list must render "From Question Bank"'
      );
    });

    test('3.2 QuestionBankPickerModal is wired with duplicate check and count update', () => {
      assert.match(
        studioSrc,
        /<QuestionBankPickerModal[\s\S]*?isOpen=\{isQuestionBankModalOpen\}[\s\S]*?onSelectQuestions=\{handleImportFromQuestionBank\}[\s\S]*?existingQuestions=\{questions\}/,
        'QuestionBankPickerModal must be wired with questions and selection handler'
      );
      assert.match(
        studioSrc,
        /handleImportFromQuestionBank[\s\S]*?existingBankIds[\s\S]*?setQuestions/,
        'handleImportFromQuestionBank must deduplicate against existing questions and append'
      );
    });

    test('3.3 Enable Certification toggle and full configuration workflow', () => {
      assert.match(
        studioSrc,
        /data-testid="section-certification"/,
        'Certification section must be present in Test Details'
      );
      assert.match(
        studioSrc,
        /data-testid="toggle-enable-certification"/,
        'Enable Certification toggle checkbox must exist'
      );
      assert.match(
        studioSrc,
        /data-testid="panel-certification-config"/,
        'Certification configuration panel must render when enabled'
      );
      assert.match(studioSrc, /data-testid="input-certificate-title"/, 'Certificate title input must exist');
      assert.match(studioSrc, /data-testid="input-issuing-org"/, 'Issuing organization input must exist');
      assert.match(studioSrc, /data-testid="input-certificate-desc"/, 'Certificate description input must exist');
      assert.match(studioSrc, /data-testid="select-certificate-template"/, 'Certificate template selector must exist');
      assert.match(studioSrc, /data-testid="input-signatory-name"/, 'Signatory name input must exist');
      assert.match(studioSrc, /data-testid="input-signatory-title"/, 'Signatory title input must exist');
      assert.match(studioSrc, /data-testid="input-cert-passing-score"/, 'Minimum passing score input must exist');
      assert.match(studioSrc, /data-testid="btn-preview-certificate"/, 'Preview Certificate button must exist');
      assert.match(studioSrc, /data-testid="modal-certificate-preview"/, 'Certificate preview modal must exist');
    });

    test('3.4 Certification data is persisted in Save Draft and Publish payloads', () => {
      assert.match(
        studioSrc,
        /handleSaveDraft[\s\S]*?certification:\s*\{[\s\S]*?enabled:\s*certificationEnabled[\s\S]*?certificateTitle:/,
        'handleSaveDraft must serialize certification object'
      );
      assert.match(
        studioSrc,
        /handlePublish[\s\S]*?certification:\s*\{[\s\S]*?enabled:\s*certificationEnabled[\s\S]*?certificateTitle:/,
        'handlePublish must serialize certification object'
      );
      assert.match(
        studioSrc,
        /loadExistingTest[\s\S]*?asmt\.certification[\s\S]*?setCertificationEnabled/,
        'loadExistingTest must deserialize and populate certification configuration'
      );
    });

    test('3.5 Coding IDE and test case execution capabilities are preserved', () => {
      assert.match(studioSrc, /<FacultyCodeIDE/, 'FacultyCodeIDE component must be rendered for coding questions');
      assert.match(studioSrc, /<StudentCodeIDE/, 'StudentCodeIDE component must be rendered for preview');
      assert.match(studioSrc, /handlePreviewRunCode/, 'handlePreviewRunCode handler must be preserved');
      assert.match(studioSrc, /testCases:\s*\(.*?\.testCases[\s\S]*?filter\(\(tc\)\s*=>\s*!tc\.isHidden\)/, 'Hidden test cases must be filtered out of student preview');
    });
  });

  // =========================================================================
  // 4. Backend Contracts — Certification & Question Bank Attachment
  // =========================================================================
  describe('4. Backend Data Integrity & API Contracts', () => {
    test('4.1 Assessment model schema contains comprehensive certification sub-document', () => {
      assert.match(asmtModelSrc, /certification:\s*\{/, 'Assessment model must define certification schema');
      assert.match(asmtModelSrc, /enabled:\s*\{[\s\S]*?type:\s*Boolean/, 'certification.enabled must be boolean');
      assert.match(asmtModelSrc, /passingPercentage:\s*\{[\s\S]*?type:\s*Number/, 'certification.passingPercentage must be numeric');
      assert.match(asmtModelSrc, /issuingOrganization:\s*\{[\s\S]*?type:\s*String/, 'certification.issuingOrganization must be string');
      assert.match(asmtModelSrc, /signatoryName:\s*\{[\s\S]*?type:\s*String/, 'certification.signatoryName must be string');
      assert.match(asmtModelSrc, /signatoryTitle:\s*\{[\s\S]*?type:\s*String/, 'certification.signatoryTitle must be string');
    });

    test('4.2 Backend endpoint POST /api/assessments/:id/questions/from-bank exists', () => {
      assert.match(
        asmtRoutesSrc,
        /router\.post\(\s*['"]\/:id\/questions\/from-bank['"][\s\S]*?assessmentController\.addQuestionsFromBank\s*\)/,
        'Assessment routes must register POST /:id/questions/from-bank'
      );
      assert.match(
        asmtControllerSrc,
        /async\s+addQuestionsFromBank\s*\(req,\s*res,\s*next\)/,
        'AssessmentController must implement addQuestionsFromBank method'
      );
      assert.match(
        asmtServiceSrc,
        /async\s+addQuestionsFromBank\s*\(assessmentId,\s*instructorId,\s*questionIds/,
        'AssessmentService must implement addQuestionsFromBank method'
      );
    });

    test('4.3 addQuestionsFromBank preserves coding configs and skips duplicates', () => {
      assert.match(
        asmtServiceSrc,
        /existingBankQIds\.has\(bqIdStr\)/,
        'addQuestionsFromBank must check and skip duplicate question bank IDs'
      );
      assert.match(
        asmtServiceSrc,
        /starterCode:\s*evalCfg\.starterCode/,
        'addQuestionsFromBank must preserve coding starter code'
      );
      assert.match(
        asmtServiceSrc,
        /testCases:\s*evalCfg\.testCases/,
        'addQuestionsFromBank must preserve coding test cases'
      );
      assert.match(
        asmtServiceSrc,
        /assessment\.totalPoints\s*=\s*newTotalPoints/,
        'addQuestionsFromBank must recalculate assessment total points'
      );
    });
  });
});
