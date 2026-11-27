import { test, describe, before } from 'node:test';
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

describe('UAP Phase 2 Frontend Integration — File Upload & Faculty Manual Grading UI', () => {
  const attemptSrc = readProjectFile('frontend/src/pages/student/MockTestAttempt.jsx');
  const serviceSrc = readProjectFile('frontend/src/services/uapQuestionBank.service.js');
  const gradingStudioSrc = readProjectFile('frontend/src/pages/instructor/MockTestEvaluationStudio.jsx');
  const attemptsModalSrc = readProjectFile('frontend/src/components/instructor/MockTestAttemptsModal.jsx');
  const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');

  // =========================================================================
  // 1. Student File Upload UI & Validation
  // =========================================================================
  describe('Student File Upload Interface & Pre-Upload Validation', () => {
    test('1.1 MockTestAttempt renders drag-and-drop zone and file input for FILE_UPLOAD questions', () => {
      assert.match(
        attemptSrc,
        /rawQType\s*===\s*'FILE_UPLOAD'/,
        'MockTestAttempt must have dedicated section for FILE_UPLOAD question type'
      );
      assert.match(
        attemptSrc,
        /onDragOver/,
        'Must support drag and drop events (onDragOver)'
      );
      assert.match(
        attemptSrc,
        /onDrop/,
        'Must support file drop handler (onDrop)'
      );
      assert.match(
        attemptSrc,
        /<input[^>]*type="file"/,
        'Must provide a file input element for manual file picking'
      );
    });

    test('1.2 Displays allowed formats and max file size from trusted question snapshot', () => {
      assert.match(
        attemptSrc,
        /Formats:\s*\{\s*allowedExts\.map/,
        'Must display permitted formats from fileUploadConfig'
      );
      assert.match(
        attemptSrc,
        /Max File Size:\s*\{\s*maxMb\s*\}\s*MB/,
        'Must display maximum file size in MB'
      );
    });

    test('1.3 Pre-upload validation enforces size limit and rejects oversized files', () => {
      assert.match(
        attemptSrc,
        /file\.size\s*>\s*maxMb\s*\*\s*1024\s*\*\s*1024/,
        'Must check file size against maxMb before triggering network upload'
      );
      assert.match(
        attemptSrc,
        /exceeds maximum limit/,
        'Must show informative toast error when file exceeds size limit'
      );
    });

    test('1.4 Pre-upload validation enforces format allowlist and rejects executable files', () => {
      assert.match(
        attemptSrc,
        /dangerousExts\s*=\s*\/\^\(exe\|sh\|bat\|cmd\|php\|js/,
        'Must inspect file extension against blacklisted script and executable formats'
      );
      assert.match(
        attemptSrc,
        /Executable and script files are strictly forbidden/,
        'Must alert student that executable files are prohibited'
      );
      assert.match(
        attemptSrc,
        /!allowed\.includes\(ext\)/,
        'Must verify file extension against question allowedFileTypes allowlist'
      );
    });

    test('1.5 Shows upload progress bar, loading state, and success/error feedback', () => {
      assert.match(
        attemptSrc,
        /uploadState\.isUploading/,
        'Must track uploading state per question'
      );
      assert.match(
        attemptSrc,
        /uploadState\.progress/,
        'Must track and render upload progress percentage'
      );
      assert.match(
        attemptSrc,
        /Uploading Document/,
        'Must display active upload progress text'
      );
      assert.match(
        attemptSrc,
        /Attached & Linked to Question/,
        'Must display success state once document is uploaded'
      );
    });

    test('1.6 Associates uploaded file with attemptId and questionId via service', () => {
      assert.match(
        attemptSrc,
        /uapQuestionBankService\.uploadMockTestFile\(\s*attemptId,\s*currentQId,\s*file,/,
        'Must pass attemptId and questionId to uploadMockTestFile service'
      );
      assert.match(
        serviceSrc,
        /\/mock-tests\/attempts\/\$\{attemptId\}\/questions\/\$\{questionId\}\/upload/,
        'uapQuestionBankService must route upload to backend upload endpoint'
      );
    });

    test('1.7 Successfully attached file metadata is included in final exam submission payload', () => {
      assert.match(
        attemptSrc,
        /fileAnswer:\s*a\.fileAnswer\s*\|\|\s*null/,
        'Submission payload must include fileAnswer metadata descriptor'
      );
      assert.match(
        attemptSrc,
        /ans\?\.fileAnswer/,
        'Question palette must mark FILE_UPLOAD question as answered when file is attached'
      );
    });
  });

  // =========================================================================
  // 2. Faculty Manual Grading UI & Rubric Evaluation
  // =========================================================================
  describe('Faculty Manual Grading Studio & Rubric Evaluation', () => {
    test('2.1 MockTestEvaluationStudio fetches attempt for review via backend endpoint', () => {
      assert.match(
        gradingStudioSrc,
        /uapQuestionBankService\.getMockTestAttemptForReview\(attemptId\)/,
        'Must fetch enriched attempt review data'
      );
      assert.match(
        serviceSrc,
        /\/mock-tests\/attempts\/\$\{attemptId\}\/review/,
        'uapQuestionBankService must provide review endpoint route'
      );
    });

    test('2.2 Displays candidate descriptive text answers and uploaded document references', () => {
      assert.match(
        gradingStudioSrc,
        /resp\.questionType\s*===\s*'DESCRIPTIVE'/,
        'Must render descriptive answer presentation card'
      );
      assert.match(
        gradingStudioSrc,
        /resp\.questionType\s*===\s*'FILE_UPLOAD'/,
        'Must render file upload submission card'
      );
      assert.match(
        gradingStudioSrc,
        /download=\{resp\.fileAnswer\.originalFilename\}/,
        'Must provide secure download link for student uploaded document'
      );
    });

    test('2.3 Displays rubric criteria matrix with maximum marks and interactive scoring', () => {
      assert.match(
        gradingStudioSrc,
        /qGrade\.rubricScores\?\.length\s*>\s*0/,
        'Must detect and display rubric criteria matrix'
      );
      assert.match(
        gradingStudioSrc,
        /handleRubricScoreChange/,
        'Must provide rubric criterion score update handler'
      );
      assert.match(
        gradingStudioSrc,
        /rub\.maxMarks/,
        'Must display maximum marks for each rubric criterion'
      );
    });

    test('2.4 Validates awarded marks do not exceed maximum configured marks', () => {
      assert.match(
        gradingStudioSrc,
        /num\s*>\s*maxMarks/,
        'Must validate awarded marks against maxMarks on input change'
      );
      assert.match(
        gradingStudioSrc,
        /exceed maximum allowed marks/,
        'Must block submit when awarded marks exceed question maxMarks'
      );
      assert.match(
        gradingStudioSrc,
        /cannot be negative/,
        'Must enforce non-negative marks'
      );
    });

    test('2.5 Submits grading feedback through existing backend evaluation endpoint', () => {
      assert.match(
        gradingStudioSrc,
        /uapQuestionBankService\.evaluateMockTestAttempt\(\s*attemptId,\s*\{\s*responsesFeedback,\s*generalFeedback,?\s*\}\s*\)/,
        'Must submit responsesFeedback and generalFeedback to evaluateMockTestAttempt'
      );
      assert.match(
        serviceSrc,
        /\/mock-tests\/attempts\/\$\{attemptId\}\/evaluate/,
        'uapQuestionBankService must post grading payload to backend evaluation endpoint'
      );
    });

    test('2.6 Displays grading status and locks form when attempt is finalized', () => {
      assert.match(
        gradingStudioSrc,
        /isFinalized\s*=\s*reviewData\.status\s*===\s*'EVALUATED'\s*&&\s*reviewData\.evaluationStatus\s*===\s*'COMPLETED'/,
        'Must determine finalized status from attempt status and evaluationStatus'
      );
      assert.match(
        gradingStudioSrc,
        /disabled=\{isFinalized\}/,
        'All grading inputs and buttons must be disabled when attempt is already finalized'
      );
      assert.match(
        gradingStudioSrc,
        /Grading Finalized/,
        'Must display finalized badge'
      );
    });

    test('2.7 Enforces authorization and renders Access Denied when unauthorized faculty attempts to grade', () => {
      assert.match(
        gradingStudioSrc,
        /err\.response\?\.status\s*===\s*403/,
        'Must catch HTTP 403 Forbidden on attempt review query'
      );
      assert.match(
        gradingStudioSrc,
        /unauthorized/,
        'Must manage unauthorized state'
      );
      assert.match(
        gradingStudioSrc,
        /Access Denied/,
        'Must render Access Denied message for unauthorized faculty'
      );
    });
  });

  // =========================================================================
  // 3. Navigation & Route Registration
  // =========================================================================
  describe('Routing & Component Wiring', () => {
    test('3.1 AppRoutes registers MockTestEvaluationStudio under protected instructor routes', () => {
      assert.match(
        routesSrc,
        /import\s+MockTestEvaluationStudio\s+from\s+'\.\.\/pages\/instructor\/MockTestEvaluationStudio'/,
        'AppRoutes must import MockTestEvaluationStudio'
      );
      assert.match(
        routesSrc,
        /<Route\s+path="mock-tests\/evaluate\/:attemptId"\s+element=\{<MockTestEvaluationStudio\s*\/>\}\s*\/>/,
        'AppRoutes must register route /instructor/mock-tests/evaluate/:attemptId'
      );
    });

    test('3.2 QuestionBankHub integrates MockTestAttemptsModal for grading access', () => {
      const hubSrc = readProjectFile('frontend/src/pages/instructor/QuestionBankHub.jsx');
      assert.match(
        hubSrc,
        /MockTestAttemptsModal/,
        'QuestionBankHub must import and render MockTestAttemptsModal'
      );
      assert.match(
        hubSrc,
        /View Submissions & Grade/,
        'QuestionBankHub mock tests tab must render a button to view submissions and grade'
      );
      assert.match(
        attemptsModalSrc,
        /navigate\(`\/instructor\/mock-tests\/evaluate\/\$\{attempt\._id\}`\)/,
        'MockTestAttemptsModal must navigate faculty to evaluation studio'
      );
    });
  });
});
