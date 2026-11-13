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

describe('1. Shared Loading UI Components Contract', () => {
  test('1.1 Button component supports loadingText, aria-busy, and exports LoadingButton', () => {
    const buttonSrc = readProjectFile('frontend/src/components/ui/Button.jsx');
    assert.match(buttonSrc, /loadingText\s*=\s*null/, 'Button must accept loadingText prop');
    assert.match(buttonSrc, /aria-busy=\{isSpinning\}/, 'Button must bind aria-busy to isSpinning');
    assert.match(buttonSrc, /isSpinning\s*&&\s*loadingText\s*\?\s*loadingText\s*:\s*children/, 'Button must display loadingText when spinning');
    assert.match(buttonSrc, /export\s+const\s+LoadingButton/, 'Button must export LoadingButton named component');
  });

  test('1.2 LoadingButton component exists and provides standard async button abstraction', () => {
    const loadingButtonSrc = readProjectFile('frontend/src/components/ui/LoadingButton.jsx');
    assert.match(loadingButtonSrc, /import Button from '\.\/Button'/, 'LoadingButton must import Button');
    assert.match(loadingButtonSrc, /loadingText\s*=\s*'Processing\.\.\.'/, 'LoadingButton must provide standard loading text default');
    assert.match(loadingButtonSrc, /export default LoadingButton/, 'LoadingButton must export default');
  });

  test('1.3 InlineLoader component provides accessible, compact indicator without full-page overlay', () => {
    const inlineLoaderSrc = readProjectFile('frontend/src/components/ui/InlineLoader.jsx');
    assert.match(inlineLoaderSrc, /role="status"/, 'InlineLoader must have role status');
    assert.match(inlineLoaderSrc, /aria-live="polite"/, 'InlineLoader must have aria-live polite');
    assert.match(inlineLoaderSrc, /<Spinner\s+size=\{size\}/, 'InlineLoader must render Spinner');
    assert.match(inlineLoaderSrc, /className="sr-only"/, 'InlineLoader must have accessible screen reader text');
  });
});

describe('2. Concurrency Guards & Async Hooks Contract', () => {
  test('2.1 useAsyncAction prevents duplicate executions from rapid clicks and manages state', () => {
    const hookSrc = readProjectFile('frontend/src/hooks/useAsyncAction.js');
    assert.match(hookSrc, /isExecutingRef\.current/, 'Must track execution ref for concurrency guard');
    assert.match(hookSrc, /if\s*\(isExecutingRef\.current\)\s*return/, 'Must immediately block overlapping executions');
    assert.match(hookSrc, /finally\s*\{[\s\S]*?isExecutingRef\.current\s*=\s*false/, 'Must reset execution ref in finally block');
    assert.match(hookSrc, /setIsLoading\(false\)/, 'Must reset loading state in finally block');
  });

  test('2.2 useRefresh prevents overlapping revalidations and provides feedback', () => {
    const refreshHookSrc = readProjectFile('frontend/src/hooks/useRefresh.js');
    assert.match(refreshHookSrc, /isRefreshingRef\.current/, 'Must track refresh execution ref');
    assert.match(refreshHookSrc, /if\s*\(isRefreshingRef\.current\)\s*return/, 'Must block overlapping refresh triggers');
    assert.match(refreshHookSrc, /finally\s*\{[\s\S]*?isRefreshingRef\.current\s*=\s*false/, 'Must clear refresh ref in finally block');
    assert.match(refreshHookSrc, /toast\.success/, 'Must dispatch success toast feedback');
  });
});

describe('3. Student Workspace Loading & Refresh Verification', () => {
  test('3.1 Student Dashboard Refresh Data button provides real revalidation, disabled state, and spinner', () => {
    const studentDashSrc = readProjectFile('frontend/src/pages/student/Dashboard.jsx');
    assert.match(studentDashSrc, /useRefresh/, 'Student Dashboard must import and use useRefresh');
    assert.match(studentDashSrc, /isRefreshingDashboard/, 'Student Dashboard must bind refresh state');
    assert.match(studentDashSrc, /isLoading=\{isRefreshingDashboard\}/, 'Refresh button must bind isLoading');
    assert.match(studentDashSrc, /loadingText="Refreshing\.\.\."/, 'Refresh button must display Refreshing... text');
  });

  test('3.2 Student Certifications page separates background refresh from initial table skeleton', () => {
    const certsSrc = readProjectFile('frontend/src/pages/student/Certifications.jsx');
    assert.match(certsSrc, /useRefresh/, 'Certifications must import and use useRefresh');
    assert.match(certsSrc, /fetchCertificates\(true\)/, 'Manual refresh must invoke fetchCertificates with background flag');
    assert.match(certsSrc, /isLoading=\{isRefreshing\}/, 'Refresh button must bind isLoading to isRefreshing');
    assert.match(certsSrc, /loadingText="Refreshing\.\.\."/, 'Refresh button must display Refreshing...');
  });

  test('3.3 Student Attempt final submission modal provides clear Submitting... loading text', () => {
    const attemptSrc = readProjectFile('frontend/src/pages/student/Attempt.jsx');
    assert.match(attemptSrc, /loadingText="Submitting\.\.\."/, 'Attempt final submission button must have loadingText');
    assert.match(attemptSrc, /isLoading=\{isSubmitting\}/, 'Attempt submit button must bind isLoading');
  });

  test('3.4 Student Reassignment Request modal has Submitting Request... loading state', () => {
    const modalSrc = readProjectFile('frontend/src/components/modals/ReassignmentRequestModal.jsx');
    assert.match(modalSrc, /loadingText="Submitting Request\.\.\."/, 'Reassignment modal must have loadingText');
    assert.match(modalSrc, /isLoading=\{isSubmitting\}/, 'Reassignment modal must bind isLoading');
  });
});

describe('4. Instructor Workspace Loading & Refresh Verification', () => {
  test('4.1 SubmissionsQueue provides background refresh without layout thrashing', () => {
    const queueSrc = readProjectFile('frontend/src/pages/instructor/SubmissionsQueue.jsx');
    assert.match(queueSrc, /useRefresh/, 'SubmissionsQueue must import useRefresh');
    assert.match(queueSrc, /isLoading=\{isRefreshing\}/, 'SubmissionsQueue refresh button must bind isLoading');
    assert.match(queueSrc, /loadingText="Refreshing\.\.\."/, 'SubmissionsQueue refresh button must display Refreshing...');
  });

  test('4.2 AssessmentAnalytics provides background refresh without replacing dashboard with skeleton', () => {
    const analyticsSrc = readProjectFile('frontend/src/pages/instructor/AssessmentAnalytics.jsx');
    assert.match(analyticsSrc, /useRefresh/, 'AssessmentAnalytics must import useRefresh');
    assert.match(analyticsSrc, /isLoading=\{isRefreshing\}/, 'AssessmentAnalytics refresh button must bind isLoading');
    assert.match(analyticsSrc, /loadingText="Refreshing\.\.\."/, 'AssessmentAnalytics refresh button must display Refreshing...');
  });

  test('4.3 Instructor Dashboard includes dedicated Refresh Data button with spinning icon', () => {
    const instDashSrc = readProjectFile('frontend/src/pages/instructor/Dashboard.jsx');
    assert.match(instDashSrc, /useRefresh/, 'Instructor Dashboard must import useRefresh');
    assert.match(instDashSrc, /Refresh Data/, 'Instructor Dashboard must contain Refresh Data button');
    assert.match(instDashSrc, /loadingText="Refreshing\.\.\."/, 'Instructor Dashboard refresh button must have loadingText');
  });

  test('4.4 AssessmentsList includes dedicated Refresh button with spinning icon', () => {
    const listSrc = readProjectFile('frontend/src/pages/instructor/AssessmentsList.jsx');
    assert.match(listSrc, /useRefresh/, 'AssessmentsList must import useRefresh');
    assert.match(listSrc, /isLoading=\{isRefreshing\}/, 'AssessmentsList refresh button must bind isLoading');
    assert.match(listSrc, /loadingText="Refreshing\.\.\."/, 'AssessmentsList refresh button must display Refreshing...');
    assert.match(listSrc, /loadingText="Deleting\.\.\."/, 'Delete modal button must have loadingText');
    assert.match(listSrc, /loadingText="Publishing\.\.\."/, 'Publish modal button must have loadingText');
  });

  test('4.5 QuestionBankList includes dedicated Refresh Bank button and delete feedback', () => {
    const qbSrc = readProjectFile('frontend/src/pages/instructor/QuestionBankList.jsx');
    assert.match(qbSrc, /useRefresh/, 'QuestionBankList must import useRefresh');
    assert.match(qbSrc, /Refresh Bank/, 'QuestionBankList must contain Refresh Bank button');
    assert.match(qbSrc, /loadingText="Refreshing\.\.\."/, 'QuestionBankList refresh button must display Refreshing...');
    assert.match(qbSrc, /loadingText="Deleting\.\.\."/, 'QuestionBankList delete modal button must display Deleting...');
  });

  test('4.6 StudentsList includes dedicated Refresh button', () => {
    const studentsSrc = readProjectFile('frontend/src/pages/instructor/StudentsList.jsx');
    assert.match(studentsSrc, /useRefresh/, 'StudentsList must import useRefresh');
    assert.match(studentsSrc, /isLoading=\{isRefreshing\}/, 'StudentsList refresh button must bind isLoading');
    assert.match(studentsSrc, /loadingText="Refreshing\.\.\."/, 'StudentsList refresh button must display Refreshing...');
  });

  test('4.7 EvaluationStudio provides clear loading text on draft save and final publish', () => {
    const evalSrc = readProjectFile('frontend/src/pages/instructor/EvaluationStudio.jsx');
    assert.match(evalSrc, /loadingText="Saving Draft\.\.\."/, 'Save draft button must have loadingText');
    assert.match(evalSrc, /loadingText="Publishing Grade\.\.\."/, 'Publish grade modal button must have loadingText');
    assert.match(evalSrc, /loadingText="Sending\.\.\."/, 'Send email modal button must have loadingText');
  });
});

describe('5. Admin Workspace Loading & Refresh Verification', () => {
  test('5.1 Admin Dashboard hero refresh button binds loading state and loadingText', () => {
    const adminDashSrc = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
    assert.match(adminDashSrc, /id="adminRefreshDataBtn"/, 'Admin dashboard refresh button must exist');
    assert.match(adminDashSrc, /isLoading=\{isRefreshing\}/, 'Admin dashboard refresh button must bind isLoading');
    assert.match(adminDashSrc, /loadingText="Refreshing\.\.\."/, 'Admin dashboard refresh button must have loadingText');
  });

  test('5.2 Admin Dashboard action modals provide contextual loading text', () => {
    const adminDashSrc = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
    assert.match(adminDashSrc, /loadingText="Activating Account\.\.\."/, 'Single approve button must have loadingText');
    assert.match(adminDashSrc, /loadingText="Approving\.\.\."/, 'Bulk approve button must have loadingText');
    assert.match(adminDashSrc, /loadingText="Rejecting\.\.\."/, 'Bulk reject button must have loadingText');
    assert.match(adminDashSrc, /loadingText="Deactivating\.\.\."/, 'Bulk deactivate button must have loadingText');
  });

  test('5.3 FacultyRegistry refresh button is disabled during refresh with aria-busy and spin', () => {
    const regSrc = readProjectFile('frontend/src/pages/admin/FacultyRegistry.jsx');
    assert.match(regSrc, /useRefresh/, 'FacultyRegistry must import useRefresh');
    assert.match(regSrc, /disabled=\{isRefreshing\}/, 'Refresh button must be disabled when refreshing');
    assert.match(regSrc, /aria-busy=\{isRefreshing\}/, 'Refresh button must have aria-busy');
  });

  test('5.4 StudentRegistry refresh button is disabled during refresh with aria-busy and spin', () => {
    const regSrc = readProjectFile('frontend/src/pages/admin/StudentRegistry.jsx');
    assert.match(regSrc, /useRefresh/, 'StudentRegistry must import useRefresh');
    assert.match(regSrc, /disabled=\{isRefreshing\}/, 'Refresh button must be disabled when refreshing');
    assert.match(regSrc, /aria-busy=\{isRefreshing\}/, 'Refresh button must have aria-busy');
  });

  test('5.5 FacultyManagement refresh button is disabled during refresh with aria-busy and spin', () => {
    const mgmtSrc = readProjectFile('frontend/src/pages/admin/FacultyManagement.jsx');
    assert.match(mgmtSrc, /useRefresh/, 'FacultyManagement must import useRefresh');
    assert.match(mgmtSrc, /disabled=\{isRefreshing\}/, 'Refresh button must be disabled when refreshing');
    assert.match(mgmtSrc, /aria-busy=\{isRefreshing\}/, 'Refresh button must have aria-busy');
  });

  test('5.6 StudentsManagement refresh button is disabled during refresh with aria-busy and spin', () => {
    const mgmtSrc = readProjectFile('frontend/src/pages/admin/StudentsManagement.jsx');
    assert.match(mgmtSrc, /useRefresh/, 'StudentsManagement must import useRefresh');
    assert.match(mgmtSrc, /disabled=\{isRefreshing\}/, 'Refresh button must be disabled when refreshing');
    assert.match(mgmtSrc, /aria-busy=\{isRefreshing\}/, 'Refresh button must have aria-busy');
  });
});

describe('6. Auth & Profile Workspaces Loading Verification', () => {
  test('6.1 Login page provides Signing In... and Google connecting spinner', () => {
    const loginSrc = readProjectFile('frontend/src/pages/auth/Login.jsx');
    assert.match(loginSrc, /loadingText="Signing In\.\.\."/, 'Login button must have loadingText');
    assert.match(loginSrc, /isGoogleLoading\s*\?/, 'Google button must render conditional loading indicator');
    assert.match(loginSrc, /aria-busy=\{isGoogleLoading\}/, 'Google button must bind aria-busy');
  });

  test('6.2 Signup page provides dynamic role-based loadingText', () => {
    const signupSrc = readProjectFile('frontend/src/pages/auth/Signup.jsx');
    assert.match(signupSrc, /loadingText=\{values\.role === 'student' \? 'Verifying & Creating\.\.\.' : 'Submitting Application\.\.\.'\}/, 'Signup button must have dynamic loadingText');
  });

  test('6.3 MfaVerify page provides contextual loadingText across all verification modes', () => {
    const mfaSrc = readProjectFile('frontend/src/pages/auth/MfaVerify.jsx');
    assert.match(mfaSrc, /loadingText="Verifying Code\.\.\."/, 'TOTP & email verify buttons must have loadingText');
    assert.match(mfaSrc, /loadingText="Verifying Recovery Key\.\.\."/, 'Recovery code button must have loadingText');
  });

  test('6.4 Profile pages across all three roles provide Saving Changes... feedback', () => {
    const studentProf = readProjectFile('frontend/src/pages/student/Profile.jsx');
    const instProf = readProjectFile('frontend/src/pages/instructor/Profile.jsx');
    const adminProf = readProjectFile('frontend/src/pages/admin/Profile.jsx');

    assert.match(studentProf, /loadingText="Saving Changes\.\.\."/, 'Student Profile must have loadingText');
    assert.match(instProf, /loadingText="Saving Changes\.\.\."/, 'Instructor Profile must have loadingText');
    assert.match(adminProf, /loadingText="Saving Changes\.\.\."/, 'Admin Profile must have loadingText');
  });
});
