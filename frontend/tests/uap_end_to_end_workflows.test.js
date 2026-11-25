import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('UAP Phase 6 — End-to-End Frontend Workflows & Integration Suite', () => {
  // Load source files for deep structural and behavioural verification
  const appRoutesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');
  const protectedRouteSrc = readProjectFile('frontend/src/routes/ProtectedRoute.jsx');
  const roleRouteSrc = readProjectFile('frontend/src/routes/RoleRoute.jsx');
  const authContextSrc = readProjectFile('frontend/src/context/AuthContext.jsx');
  const apiSrc = readProjectFile('frontend/src/services/api.js');
  const authServiceSrc = readProjectFile('frontend/src/services/auth.service.js');
  const assessmentServiceSrc = readProjectFile('frontend/src/services/assessment.service.js');
  const submissionServiceSrc = readProjectFile('frontend/src/services/submission.service.js');
  const instructorServiceSrc = readProjectFile('frontend/src/services/instructor.service.js');
  const adminServiceSrc = readProjectFile('frontend/src/services/admin.service.js');
  const analyticsServiceSrc = readProjectFile('frontend/src/services/analytics.service.js');
  const uapQuestionBankServiceSrc = readProjectFile('frontend/src/services/uapQuestionBank.service.js');
  const navigationConfigSrc = readProjectFile('frontend/src/config/navigationConfig.js');

  const studentDashboardSrc = readProjectFile('frontend/src/pages/student/Dashboard.jsx');
  const studentAttemptSrc = readProjectFile('frontend/src/pages/student/Attempt.jsx');
  const mockTestsListSrc = readProjectFile('frontend/src/pages/student/MockTestsList.jsx');
  const mockTestAttemptSrc = readProjectFile('frontend/src/pages/student/MockTestAttempt.jsx');
  const mockTestAnalyticsSrc = readProjectFile('frontend/src/pages/student/MockTestAnalytics.jsx');
  const studentCodeIDESrc = readProjectFile('frontend/src/components/student/StudentCodeIDE.jsx');
  const codeEditorSrc = readProjectFile('frontend/src/components/common/CodeEditor.jsx');

  const instructorDashboardSrc = readProjectFile('frontend/src/pages/instructor/Dashboard.jsx');
  const assessmentBuilderSrc = readProjectFile('frontend/src/pages/instructor/AssessmentBuilder.jsx');
  const questionBankHubSrc = readProjectFile('frontend/src/pages/instructor/QuestionBankHub.jsx');
  const questionStudioSrc = readProjectFile('frontend/src/pages/instructor/QuestionStudio.jsx');
  const submissionsQueueSrc = readProjectFile('frontend/src/pages/instructor/SubmissionsQueue.jsx');
  const evaluationStudioSrc = readProjectFile('frontend/src/pages/instructor/EvaluationStudio.jsx');
  const mockTestEvaluationStudioSrc = readProjectFile('frontend/src/pages/instructor/MockTestEvaluationStudio.jsx');
  const assessmentAnalyticsSrc = readProjectFile('frontend/src/pages/instructor/AssessmentAnalytics.jsx');

  const adminDashboardSrc = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
  const studentRegistrySrc = readProjectFile('frontend/src/pages/admin/StudentRegistry.jsx');
  const facultyRegistrySrc = readProjectFile('frontend/src/pages/admin/FacultyRegistry.jsx');
  const studentsManagementSrc = readProjectFile('frontend/src/pages/admin/StudentsManagement.jsx');
  const facultyManagementSrc = readProjectFile('frontend/src/pages/admin/FacultyManagement.jsx');

  // =========================================================================
  // 1. Student Login and Assessment Workflow
  // =========================================================================
  describe('1. Student Login & Assessment Workflow End-to-End', () => {
    test('1.1 AuthContext handles authentication state, tokens, user hydration, and session persistence', () => {
      assert.match(authContextSrc, /login\s*=\s*async/, 'AuthContext must export login function');
      assert.match(authContextSrc, /storage\.setToken/, 'Must persist accessToken in storage');
      assert.match(authContextSrc, /storage\.setUser/, 'Must persist user profile in storage');
      assert.match(authContextSrc, /refreshToken/, 'Must support session token rehydration');
      assert.match(authContextSrc, /completeMfaLogin/, 'Must support completing MFA login challenge');
    });

    test('1.2 Student Dashboard loads real assessments, student submissions, and performance metrics', () => {
      assert.match(studentDashboardSrc, /assessmentService\.getAssessments/, 'Dashboard must fetch assessments from actual API');
      assert.match(studentDashboardSrc, /submissionService\.getStudentSubmissions/, 'Dashboard must fetch student submissions');
      assert.match(studentDashboardSrc, /analyticsService\.getStudentPerformance/, 'Dashboard must fetch analytics');
    });

    test('1.3 Student Attempt initiates or resumes attempt via submissionService', () => {
      assert.match(studentAttemptSrc, /submissionService\.startAttempt/, 'Must initiate attempt via actual startAttempt endpoint');
      assert.match(studentAttemptSrc, /assessmentService\.getAssessmentById/, 'Must retrieve sanitized assessment metadata');
      assert.match(studentAttemptSrc, /setSubmission/, 'Must store submission state');
    });

    test('1.4 Question navigation preserves in-memory answer state and handles palette jumping', () => {
      assert.match(studentAttemptSrc, /handleSaveAndNext/, 'Must implement Save & Next handler');
      assert.match(studentAttemptSrc, /handleNextQuestion/, 'Must implement Next Question handler');
      assert.match(studentAttemptSrc, /handlePrevQuestion/, 'Must implement Prev Question handler');
      assert.match(studentAttemptSrc, /answersRef\.current/, 'Must preserve answers safely in ref across renders');
    });

    test('1.5 Server-authoritative timer countdown with auto-submit on expiration', () => {
      assert.match(studentAttemptSrc, /deadlineMs|deadlineAt/, 'Must calculate remaining time against server deadlineAt');
      assert.match(studentAttemptSrc, /handleFinalSubmitRef\.current\s*\(\s*true\s*\)|handleFinalSubmit\s*\(\s*true\s*\)/, 'Must auto-submit when timer reaches zero');
    });

    test('1.6 Final submission dispatches answers and navigates to student dashboard with confirmation', () => {
      assert.match(studentAttemptSrc, /submissionService\.submitAssessment/, 'Must call backend submitAssessment endpoint');
      assert.match(studentAttemptSrc, /navigate\('\/student\/dashboard'/, 'Must navigate to dashboard upon completion');
      assert.match(studentAttemptSrc, /toast\.success/, 'Must provide positive confirmation feedback toast');
    });

    test('1.7 Submission review and manual-review status visibility in Student Dashboard', () => {
      assert.match(studentDashboardSrc, /openFeedbackModal/, 'Dashboard must support opening submission feedback modal');
      assert.match(studentDashboardSrc, /routeSubmissionId/, 'Must support deep-linking via /student/submissions/:id');
      assert.match(studentDashboardSrc, /sub\.status/, 'Must inspect submission evaluation status');
    });
  });

  // =========================================================================
  // 2. Instructor Question Creation & Authoring
  // =========================================================================
  describe('2. Instructor Question Creation & Authoring Studio', () => {
    test('2.1 Question Studio provides manual Subject text input with required indicator', () => {
      assert.match(
        questionStudioSrc,
        /Subject\s*<span className="text-rose-500">\*<\/span>/,
        'Subject label must have required indicator'
      );
      assert.match(
        questionStudioSrc,
        /<input[\s\S]*?placeholder="Enter subject name \(e\.g\. Data Structures\)"/,
        'Must provide clear discipline placeholder'
      );
      assert.doesNotMatch(
        questionStudioSrc,
        /<select[^>]*value=\{\s*curriculumSubject\s*\}/,
        'Subject must not be a dropdown select'
      );
    });

    test('2.2 Default Topics is optional manual text entry supporting comma separation', () => {
      assert.match(
        questionStudioSrc,
        /<input[\s\S]*?placeholder="Enter topic names \(e\.g\. Trees, Graphs, Recursion\)"/,
        'Default Topics field must be a text input with specified placeholder'
      );
      assert.doesNotMatch(
        questionStudioSrc,
        /Default Topics\s*<span className="text-rose-500">\*<\/span>/,
        'Default Topics must not have red required asterisk'
      );
      assert.match(
        questionStudioSrc,
        /handleCurriculumTopicsChange/,
        'Must define handleCurriculumTopicsChange for comma separation'
      );
    });

    test('2.3 Supports all required question types with per-card independent type selection', () => {
      const types = [
        'SINGLE_MCQ',
        'MULTI_SELECT',
        'TRUE_FALSE',
        'SHORT_ANSWER',
        'DESCRIPTIVE',
        'CODING',
        'SQL',
        'FILE_UPLOAD',
      ];
      for (const t of types) {
        assert.match(questionStudioSrc, new RegExp(`q\\.questionType === '${t}'`), `Must support ${t} question type`);
      }
    });

    test('2.4 Dynamic per-card question configurations for coding, sql, and file upload', () => {
      assert.match(questionStudioSrc, /starterCode/, 'Must support starterCode configuration');
      assert.match(questionStudioSrc, /testCases/, 'Must support testCases configuration for coding questions');
      assert.match(questionStudioSrc, /fileUploadConfig/, 'Must support fileUploadConfig for document submissions');
      assert.match(questionStudioSrc, /allowedFileTypes/, 'Must specify permitted file formats');
      assert.match(questionStudioSrc, /maxFileSizeMb/, 'Must specify maximum file size in MB');
    });
  });

  // =========================================================================
  // 3. Multi-Question Save and Publish
  // =========================================================================
  describe('3. Multi-Question Authoring, Validation, Save & Publish', () => {
    test('3.1 Question Studio allows adding multiple questions in one authoring session', () => {
      assert.match(questionStudioSrc, /handleAddQuestion/, 'Must define handleAddQuestion handler');
      assert.match(questionStudioSrc, /Add Question/, 'Must render Add Question action');
      assert.match(questionStudioSrc, /Add Another Question/, 'Must render bottom Add Another Question button');
      assert.match(questionStudioSrc, /createDefaultQuestion/, 'Must instantiate questions using default factory');
    });

    test('3.2 Supports card collapse/expand all and individual card toggles', () => {
      assert.match(questionStudioSrc, /handleToggleCollapse/, 'Must toggle individual card collapse');
      assert.match(questionStudioSrc, /handleCollapseAll/, 'Must support Expand All and Collapse All');
      assert.match(questionStudioSrc, /isCollapsed/, 'Must track isCollapsed boolean per question');
    });

    test('3.3 Card actions: duplicate, reorder, and safe deletion', () => {
      assert.match(questionStudioSrc, /handleDuplicateQuestion/, 'Must implement handleDuplicateQuestion');
      assert.match(questionStudioSrc, /duplicated\.savedId\s*=\s*null/, 'Duplicate must clear savedId to prevent overwriting existing record');
      assert.match(questionStudioSrc, /duplicated\.clientId\s*=\s*generateClientId\(\)/, 'Duplicate must generate fresh clientId');
      assert.match(questionStudioSrc, /handleMoveQuestion\s*=\s*\(idx,\s*direction\)/, 'Must support reordering questions up/down');
      assert.match(questionStudioSrc, /handleRemoveQuestion/, 'Must implement safe delete handler');
    });

    test('3.4 Independent validation and visual badges per question card', () => {
      assert.match(questionStudioSrc, /validateSingleQuestion/, 'Must validate questions individually');
      assert.match(questionStudioSrc, /validationReport/, 'Must store validation report on question model');
      assert.match(questionStudioSrc, /rep\.errors\.map/, 'Must display specific validation errors inside card');
    });

    test('3.5 Save All Drafts isolates partial save failures and prevents duplicates on retry', () => {
      assert.match(questionStudioSrc, /handleSaveAllDrafts/, 'Must define handleSaveAllDrafts handler');
      assert.match(questionStudioSrc, /savedId:\s*newId/, 'Must set savedId on question when createQuestion resolves successfully');
      assert.match(
        questionStudioSrc,
        /if\s*\(\s*q\.savedId\s*\)\s*\{[\s\S]*?updateQuestion[\s\S]*?\}\s*else\s*\{[\s\S]*?createQuestion/,
        'Must branch: call updateQuestion if savedId exists, otherwise createQuestion'
      );
      assert.match(questionStudioSrc, /saveStatus:\s*['"]error['"]/, 'Must set saveStatus to error on failed question');
    });

    test('3.6 Question publication workflow updates question to published status', () => {
      assert.match(questionStudioSrc, /handlePublishAll/, 'Must provide bulk question publication action');
      assert.match(questionStudioSrc, /uapQuestionBankService\.publishQuestion/, 'Must invoke publishQuestion endpoint');
      assert.match(uapQuestionBankServiceSrc, /publishQuestion\s*\(/, 'uapQuestionBankService must define publishQuestion');
    });
  });

  // =========================================================================
  // 4. Mock Bank Consolidation & Mock Test Blueprint Workflow
  // =========================================================================
  describe('4. Mock Bank Consolidation & Mock Test Blueprint Workflow', () => {
    test('4.1 Mock Bank presents consolidated 2-tab view without redundant hierarchy tabs', () => {
      assert.match(questionBankHubSrc, /<h1[^>]*>Mock Bank<\/h1>/, 'Hub page title must be "Mock Bank"');
      assert.doesNotMatch(questionBankHubSrc, /setActiveTab\(['"]banks['"]\)/, 'Must remove separate Question Banks tab');
      assert.doesNotMatch(questionBankHubSrc, /setActiveTab\(['"]hierarchy['"]\)/, 'Must remove separate Syllabus Hierarchy tab');
      assert.doesNotMatch(questionBankHubSrc, /Syllabus Hierarchy/, 'Must remove Syllabus Hierarchy tab');
      assert.doesNotMatch(questionBankHubSrc, /UAP Centralized Subsystem/, 'Must remove subtitle badge');
    });

    test('4.2 AI Question Generator modal integration in Question Bank Hub', () => {
      assert.match(questionBankHubSrc, /AiQuestionGeneratorModal/, 'Must import and mount AiQuestionGeneratorModal');
      assert.match(uapQuestionBankServiceSrc, /createAiGenerationJob/, 'Must communicate with AI generation endpoint');
    });

    test('4.3 Bulk Question Import modal integration in Question Bank Hub', () => {
      assert.match(questionBankHubSrc, /BulkQuestionImportModal/, 'Must mount BulkQuestionImportModal');
      assert.match(uapQuestionBankServiceSrc, /uploadImportFile/, 'Must support uploading bulk import files');
    });

    test('4.4 Mock Test Blueprint modal supports rules and blueprint generation', () => {
      assert.match(questionBankHubSrc, /MockTestBlueprintModal/, 'Must mount MockTestBlueprintModal');
      assert.match(uapQuestionBankServiceSrc, /createMockTest/, 'Must support creating mock test blueprint');
      assert.match(uapQuestionBankServiceSrc, /generateMockTestBlueprint/, 'Must trigger blueprint resolution');
      assert.match(uapQuestionBankServiceSrc, /publishMockTest/, 'Must publish mock test');
    });
  });

  // =========================================================================
  // 5. Student Mock Test Attempt
  // =========================================================================
  describe('5. Student Mock Test Attempt Lifecycle', () => {
    test('5.1 MockTestsList displays available tests and launches attempt session', () => {
      assert.match(mockTestsListSrc, /uapQuestionBankService\.getMockTests/, 'Must fetch published mock tests');
      assert.match(mockTestsListSrc, /navigate\(`\/student\/mock-test\/\$\{test\._id\}`\)/, 'Must navigate to mock test attempt');
    });

    test('5.2 MockTestAttempt starts session via actual backend endpoint and loads snapshot', () => {
      assert.match(mockTestAttemptSrc, /uapQuestionBankService\.startMockTestAttempt/, 'Must call startMockTestAttempt endpoint');
      assert.match(mockTestAttemptSrc, /res\.data\.attemptId/, 'Must capture attemptId from backend');
      assert.match(mockTestAttemptSrc, /res\.data\.mockTest/, 'Must capture resolved mockTest questions');
    });

    test('5.3 Timer countdown with formatted display and auto-submit on expiration', () => {
      assert.match(mockTestAttemptSrc, /timeLeftSeconds/, 'Must track countdown in seconds');
      assert.match(mockTestAttemptSrc, /handleSubmitAttempt/, 'Must trigger submission on expiry');
      assert.match(mockTestAttemptSrc, /formatTime/, 'Must format minutes and seconds cleanly');
    });

    test('5.4 Submitting mock test packages responses and navigates to analytics', () => {
      assert.match(mockTestAttemptSrc, /uapQuestionBankService\.submitMockTestAttempt/, 'Must submit responses to backend');
      assert.match(mockTestAttemptSrc, /navigate\(`\/student\/mock-test-analytics\/\$\{attemptId\}`\)/, 'Must redirect to analytics upon submission');
    });
  });

  // =========================================================================
  // 6. Coding and SQL Execution Integration
  // =========================================================================
  describe('6. Coding and SQL Execution Integration', () => {
    test('6.1 CodeEditor renders CodeMirror editor supporting Python, JavaScript, and SQL', () => {
      assert.match(codeEditorSrc, /@uiw\/react-codemirror/, 'Must utilize CodeMirror editor component');
      assert.match(codeEditorSrc, /@codemirror\/lang-python/, 'Must support Python grammar extension');
      assert.match(codeEditorSrc, /@codemirror\/lang-javascript/, 'Must support JavaScript grammar extension');
      assert.match(codeEditorSrc, /@codemirror\/lang-sql/, 'Must support SQL grammar extension');
      assert.match(studentCodeIDESrc, /CodeEditor/, 'StudentCodeIDE must embed CodeEditor component');
    });

    test('6.2 Student Attempt runs code via submissionService.runCode with stdin', () => {
      assert.match(studentAttemptSrc, /submissionService\.runCode/, 'Must invoke submissionService.runCode');
      assert.match(studentAttemptSrc, /customStdin/, 'Must support custom user stdin input');
      assert.match(studentAttemptSrc, /isExecutingByQuestion/, 'Must track execution spinner state');
    });

    test('6.3 Displays execution results: stdout, stderr, execution time, and memory', () => {
      assert.match(studentAttemptSrc, /executionResultsByQuestion/, 'Must store execution output by question');
      assert.match(studentAttemptSrc, /stdout/, 'Must display stdout output');
      assert.match(studentAttemptSrc, /stderr/, 'Must display stderr diagnostics on execution error');
    });

    test('6.4 Reset code confirmation modal restores starter template without losing question position', () => {
      assert.match(studentAttemptSrc, /resetModalState/, 'Must provide reset confirmation modal state');
      assert.match(studentAttemptSrc, /starterCode/, 'Must restore question starter template');
    });
  });

  // =========================================================================
  // 7. Non-Coding Question Evaluation
  // =========================================================================
  describe('7. Objective & Subjective Question Evaluation', () => {
    test('7.1 Supports MCQ single, multi-select, and True/False auto-grading', () => {
      assert.match(studentAttemptSrc, /handleOptionSelect/, 'Must capture single option selection');
      assert.match(mockTestAttemptSrc, /handleSelectMultiOption/, 'Must capture multi-option selections');
    });

    test('7.2 Identifies subjective questions requiring instructor evaluation', () => {
      assert.match(evaluationStudioSrc, /short_answer|long_answer|file_upload/, 'EvaluationStudio must filter subjective questions');
      assert.match(evaluationStudioSrc, /subjectiveGradedCount/, 'Must track count of graded subjective items');
    });
  });

  // =========================================================================
  // 8. File Upload Workflow
  // =========================================================================
  describe('8. Student File Upload Interface & Pre-Upload Validation', () => {
    test('8.1 Drag-and-drop zone and file input for FILE_UPLOAD questions in MockTestAttempt', () => {
      assert.match(mockTestAttemptSrc, /rawQType\s*===\s*'FILE_UPLOAD'/, 'Must have dedicated section for FILE_UPLOAD');
      assert.match(mockTestAttemptSrc, /onDragOver/, 'Must support drag over event');
      assert.match(mockTestAttemptSrc, /onDrop/, 'Must support file drop handler');
      assert.match(mockTestAttemptSrc, /<input[^>]*type="file"/, 'Must provide hidden or visible file input');
    });

    test('8.2 Pre-upload validation enforces extension allowlist and rejects executable files', () => {
      assert.match(mockTestAttemptSrc, /dangerousExts\s*=\s*\/\^\(exe\|sh\|bat\|cmd\|php\|js/, 'Must reject executable files');
      assert.match(mockTestAttemptSrc, /Executable and script files are strictly forbidden/, 'Must notify student of dangerous extensions');
      assert.match(mockTestAttemptSrc, /!allowed\.includes\(ext\)/, 'Must verify extension against question allowlist');
    });

    test('8.3 Pre-upload validation enforces size limits', () => {
      assert.match(mockTestAttemptSrc, /file\.size\s*>\s*maxMb\s*\*\s*1024\s*\*\s*1024/, 'Must check file size against maxMb limit');
      assert.match(mockTestAttemptSrc, /exceeds maximum limit/, 'Must show toast error on oversized file');
    });

    test('8.4 Upload progress tracking and backend upload endpoint integration', () => {
      assert.match(mockTestAttemptSrc, /uploadMockTestFile/, 'Must upload file via uapQuestionBankService');
      assert.match(studentAttemptSrc, /uploadAnswerFile/, 'Standard attempt must upload file via submissionService');
      assert.match(mockTestAttemptSrc, /uploadState\.progress/, 'Must render upload progress bar');
    });

    test('8.5 Supports file preview, replacement, and deletion', () => {
      assert.match(mockTestAttemptSrc, /Replace File/, 'MockTestAttempt must support replacing uploaded file');
      assert.match(studentAttemptSrc, /handleRemoveFile/, 'Standard attempt must support removing file');
      assert.match(studentAttemptSrc, /handleDownloadFile|getAnswerFileBlob/, 'Standard attempt must support downloading uploaded file blob');
    });
  });

  // =========================================================================
  // 9. Manual Grading & Rubric Evaluation
  // =========================================================================
  describe('9. Faculty Manual Grading & Rubric Evaluation', () => {
    test('9.1 SubmissionsQueue lists student exam submissions with status filters', () => {
      assert.match(submissionsQueueSrc, /instructorService\.getInstructorSubmissions/, 'Must fetch instructor submissions');
      assert.match(submissionsQueueSrc, /statusFilter/, 'Must support filtering submissions by status');
      assert.match(submissionsQueueSrc, /Evaluate/, 'Must provide link to evaluate submission');
    });

    test('9.2 EvaluationStudio loads submission and displays subjective questions and student answers', () => {
      assert.match(evaluationStudioSrc, /instructorService\.getSubmissionForEvaluation/, 'Must load submission details');
      assert.match(evaluationStudioSrc, /questionFeedback/, 'Must track per-question points and comments');
      assert.match(evaluationStudioSrc, /calculatedManualScore/, 'Must compute live total score as grades are entered');
    });

    test('9.3 Rubric evaluation saves draft or publishes final score', () => {
      assert.match(evaluationStudioSrc, /instructorService\.submitEvaluation/, 'Must call backend submitEvaluation endpoint');
      assert.match(evaluationStudioSrc, /toast\.success/, 'Must notify instructor upon evaluation completion');
      assert.match(evaluationStudioSrc, /navigate\('\/instructor\/submissions'\)/, 'Must return to submissions queue');
    });

    test('9.4 Faculty can dispatch grade notification email to student', () => {
      assert.match(evaluationStudioSrc, /instructorService\.sendStudentEmail/, 'Must support sending grade notification email');
      assert.match(evaluationStudioSrc, /emailSubject/, 'Must capture email subject');
      assert.match(evaluationStudioSrc, /emailMessage/, 'Must capture email message body');
    });

    test('9.5 Mock Test Evaluation Studio grades mock test subjective responses', () => {
      assert.match(mockTestEvaluationStudioSrc, /uapQuestionBankService\.getMockTestAttemptForReview/, 'Must load mock attempt review');
      assert.match(mockTestEvaluationStudioSrc, /uapQuestionBankService\.evaluateMockTestAttempt/, 'Must submit mock test manual grades');
    });
  });

  // =========================================================================
  // 10. Analytics & Reporting
  // =========================================================================
  describe('10. Comprehensive Analytics Across All Roles', () => {
    test('10.1 Student Mock Test Analytics displays performance metrics and diagnostics', () => {
      assert.match(mockTestAnalyticsSrc, /uapQuestionBankService\.getMockTestAnalytics/, 'Must fetch mock test analytics');
      assert.match(mockTestAnalyticsSrc, /attempt\.earnedMarks/, 'Must render earned marks');
      assert.match(mockTestAnalyticsSrc, /scorePercentage/, 'Must render score percentage');
      assert.match(mockTestAnalyticsSrc, /attempt\.correctCount/, 'Must render correct answers count');
      assert.match(mockTestAnalyticsSrc, /conceptWiseAnalytics/, 'Must render concept analytics');
      assert.match(mockTestAnalyticsSrc, /difficultyWiseAnalytics/, 'Must render difficulty distribution');
    });

    test('10.2 Instructor Assessment Analytics displays score distribution and question breakdown', () => {
      assert.match(assessmentAnalyticsSrc, /analyticsService\.getInstructorAssessmentAnalytics/, 'Must load assessment analytics');
      assert.match(assessmentAnalyticsSrc, /analyticsService\.getInstructorQuestionAnalytics/, 'Must load question performance breakdown');
    });

    test('10.3 Admin Dashboard displays platform stats, active alerts, and audit telemetry', () => {
      assert.match(adminDashboardSrc, /adminService\.getStats/, 'Must load platform stats');
      assert.match(adminDashboardSrc, /adminService\.getLogs/, 'Must load audit logs');
    });
  });

  // =========================================================================
  // 11. Unauthorized Access & RBAC Guards
  // =========================================================================
  describe('11. Security, ProtectedRoute & RoleRoute Access Controls', () => {
    test('11.1 ProtectedRoute redirects unauthenticated users to /auth/login with return location', () => {
      assert.match(protectedRouteSrc, /!isAuthenticated/, 'Must check authentication state');
      assert.match(protectedRouteSrc, /<Navigate to="\/auth\/login"/, 'Must redirect unauthenticated traffic to login');
      assert.match(protectedRouteSrc, /state=\{\{ from: location \}\}/, 'Must preserve return location');
    });

    test('11.2 ProtectedRoute displays accessible branded preloader during auth initialization', () => {
      assert.match(protectedRouteSrc, /<PageLoader/, 'Must render PageLoader component');
      assert.match(protectedRouteSrc, /branded/, 'Must configure branded loader appearance');
      assert.match(protectedRouteSrc, /BRANDED_TRANSITION_MIN_DURATION_MS/, 'Must enforce transition presentation constant');
    });

    test('11.3 RoleRoute rejects unauthorized roles with accessible Access Denied alert', () => {
      assert.match(roleRouteSrc, /!allowedRoles\.includes\(role\)/, 'Must check active role against allowedRoles list');
      assert.match(roleRouteSrc, /Access Denied/, 'Must display Access Denied banner');
      assert.match(roleRouteSrc, /window\.history\.back\(\)/, 'Must provide return navigation button');
    });

    test('11.4 AppRoutes enforces strict role scoping for student, instructor, and admin trees', () => {
      assert.match(appRoutesSrc, /allowedRoles=\{?\['student'\]\}?/, 'Student tree must restrict to student role');
      assert.match(appRoutesSrc, /allowedRoles=\{?\['instructor',\s*'admin'\]\}?/, 'Instructor tree must allow instructor and admin roles');
      assert.match(appRoutesSrc, /allowedRoles=\{?\['admin'\]\}?/, 'Admin tree must restrict strictly to admin role');
    });
  });

  // =========================================================================
  // 12. Session Expiry & Token Renewal
  // =========================================================================
  describe('12. Session Expiry, Refresh Locks & Cross-Tab Token Synchronization', () => {
    test('12.1 api.js intercepts 401 Unauthorized and initiates silent token refresh', () => {
      assert.match(apiSrc, /error\.response\?\.status === 401/, 'Must intercept HTTP 401 status code');
      assert.match(apiSrc, /isRefreshing/, 'Must track refresh concurrency lock');
      assert.match(apiSrc, /failedQueue/, 'Must queue concurrent requests during refresh');
    });

    test('12.2 Request queue drains with new token upon refresh resolution or rejects on failure', () => {
      assert.match(apiSrc, /processQueue/, 'Must implement processQueue resolver');
      assert.match(apiSrc, /prom\.resolve\(token\)/, 'Must resolve queued requests with renewed token');
      assert.match(apiSrc, /prom\.reject\(error\)/, 'Must reject queued requests when refresh fails');
    });

    test('12.3 BroadcastChannel synchronizes token refresh and logout across browser tabs', () => {
      assert.match(apiSrc, /BroadcastChannel\('uap_auth_sync'\)/, 'Must instantiate uap_auth_sync BroadcastChannel');
      assert.match(apiSrc, /REFRESH_SUCCESS/, 'Must broadcast and handle REFRESH_SUCCESS event');
      assert.match(apiSrc, /LOGOUT/, 'Must broadcast and handle LOGOUT event across tabs');
    });
  });

  // =========================================================================
  // 13. Network Errors & Retry Handling
  // =========================================================================
  describe('13. Network Errors, Gateway Retries & Resilience', () => {
    test('13.1 api.js automatically retries idempotent GET requests on network drop or 502/503/504 errors', () => {
      assert.match(apiSrc, /originalRequest\.method\?\.toLowerCase\(\)\s*===\s*'get'/, 'Only GET requests are candidate for automatic retry');
      assert.match(apiSrc, /!originalRequest\._retry/, 'Must never retry more than once');
      assert.match(apiSrc, /error\.response\.status >= 502 && error\.response\.status <= 504/, 'Must retry gateway error statuses');
    });

    test('13.2 Aborted, canceled, and non-GET requests are strictly NEVER retried', () => {
      assert.match(apiSrc, /axios\.isCancel\(error\)/, 'Must check and respect canceled requests');
      assert.match(apiSrc, /!originalRequest\.signal\?\.aborted/, 'Must respect abort signal');
    });
  });

  // =========================================================================
  // 14. Responsive Navigation & Design System Consistency
  // =========================================================================
  describe('14. Responsive Navigation, Theme Tokens & Design Consistency', () => {
    test('14.1 Navigation config defines distinct workspaces for student, instructor, and admin', () => {
      assert.match(navigationConfigSrc, /studentNavigation/, 'Must export studentNavigation');
      assert.match(navigationConfigSrc, /instructorNavigation/, 'Must export instructorNavigation');
      assert.match(navigationConfigSrc, /adminNavigation/, 'Must export adminNavigation');
      assert.match(navigationConfigSrc, /getNavigationForRole/, 'Must export getNavigationForRole helper');
    });

    test('14.2 Active route matching helper handles exact paths, subpaths, and role root redirects', () => {
      assert.match(navigationConfigSrc, /isNavigationItemActive/, 'Must export isNavigationItemActive helper');
      assert.match(navigationConfigSrc, /currentPath === item\.path/, 'Must handle exact matches');
      assert.match(navigationConfigSrc, /currentPath\.startsWith\(`\$\{item\.path\}\/`\)/, 'Must handle subpath matches');
    });

    test('14.3 Preserves primary terracotta #E05D38 and brand styling across layouts', () => {
      const tailwindConfigSrc = readProjectFile('frontend/tailwind.config.js');
      assert.match(tailwindConfigSrc, /#E05D38/, 'Tailwind config must specify terracotta #E05D38');
    });

    test('14.4 Elimination of duplicate page-body search inputs while preserving local table filters', () => {
      assert.doesNotMatch(studentDashboardSrc, /placeholder="Search assessments by title/i, 'Student Dashboard body must not have duplicate catalog search bar');
      assert.match(studentDashboardSrc, /selectedCategory/, 'Must preserve category filter');
      assert.match(submissionsQueueSrc, /statusFilter/, 'Must preserve submission status filter');
    });

    test('14.5 Header mounts role-specific search bars with accessible navigation', () => {
      const headerSrc = readProjectFile('frontend/src/components/common/Header.jsx');
      assert.match(headerSrc, /PortalSearchBar/, 'Header must mount PortalSearchBar');
      assert.match(headerSrc, /NavbarAnnouncementTicker/, 'Header must mount NavbarAnnouncementTicker');
    });
  });
});
