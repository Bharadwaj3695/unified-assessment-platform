import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to read file content
const readProjectFile = (relPath) => {
  const fullPath = path.join(ROOT_DIR, relPath);
  return fs.readFileSync(fullPath, 'utf8');
};

test('1. PortalSearchBar & Role Scoping Architecture', async (t) => {
  await t.test('1.1 PortalSearchBar dispatches strictly to role-specific components', () => {
    const content = readProjectFile('frontend/src/components/common/search/PortalSearchBar.jsx');
    assert.match(content, /import StudentSearchBar from '\.\/StudentSearchBar'/);
    assert.match(content, /import AdminSearchBar from '\.\/AdminSearchBar'/);
    assert.match(content, /import InstructorSearchBar from '\.\/InstructorSearchBar'/);
    assert.match(content, /case 'student':\s*return <StudentSearchBar \/>/);
    assert.match(content, /case 'admin':\s*return <AdminSearchBar \/>/);
    assert.match(content, /case 'instructor':\s*return <InstructorSearchBar \/>/);
  });

  await t.test('1.2 Header renders PortalSearchBar before theme toggle and notifications', () => {
    const headerContent = readProjectFile('frontend/src/components/common/Header.jsx');
    assert.match(headerContent, /import PortalSearchBar from '\.\/search\/PortalSearchBar'/);
    const searchIndex = headerContent.indexOf('<PortalSearchBar role={user.role} />');
    const themeIndex = headerContent.indexOf('onClick={toggleTheme}');
    assert.ok(searchIndex !== -1, 'PortalSearchBar must be rendered in Header');
    assert.ok(themeIndex !== -1, 'Theme toggle must be rendered in Header');
    assert.ok(
      searchIndex < themeIndex,
      'PortalSearchBar must be placed before the theme toggle control'
    );
  });
});

test('2. Student Portal Search Bar Contract', async (t) => {
  const studentSearchContent = readProjectFile('frontend/src/components/common/search/StudentSearchBar.jsx');

  await t.test('2.1 Student search bar uses exact placeholder "Search assessments, submissions..."', () => {
    assert.match(studentSearchContent, /placeholder="Search assessments, submissions\.\.\."/);
  });

  await t.test('2.2 Student search queries only student-authorized assessments, submissions, and student pages', () => {
    assert.match(studentSearchContent, /assessmentService\.getAssessments\(\{ search: trimmed, limit: 5 \}\)/);
    assert.match(studentSearchContent, /submissionService\.getStudentSubmissions\(\)/);
    assert.match(studentSearchContent, /\/student\/catalog/);
    assert.match(studentSearchContent, /\/student\/submissions/);
    assert.match(studentSearchContent, /\/student\/dashboard/);
    assert.match(studentSearchContent, /\/student\/profile/);
  });

  await t.test('2.3 Student search never queries administrative or instructor APIs', () => {
    assert.doesNotMatch(studentSearchContent, /adminService/);
    assert.doesNotMatch(studentSearchContent, /\/admin\//);
    assert.doesNotMatch(studentSearchContent, /\/question-bank/);
  });

  await t.test('2.4 Student search supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', () => {
    assert.match(studentSearchContent, /e\.key === 'ArrowDown'/);
    assert.match(studentSearchContent, /e\.key === 'ArrowUp'/);
    assert.match(studentSearchContent, /e\.key === 'Enter'/);
    assert.match(studentSearchContent, /e\.key === 'Escape'/);
  });

  await t.test('2.5 Student search provides loading, empty, and error states', () => {
    assert.match(studentSearchContent, /Searching student workspace\.\.\./);
    assert.match(studentSearchContent, /No matching assessments or records found/);
    assert.match(studentSearchContent, /Unable to load search results/);
  });
});

test('3. Admin Portal Search Bar Contract', async (t) => {
  const adminSearchContent = readProjectFile('frontend/src/components/common/search/AdminSearchBar.jsx');

  await t.test('3.1 Admin search bar uses exact placeholder "Search users, assessments..."', () => {
    assert.match(adminSearchContent, /placeholder="Search users, assessments\.\.\."/);
  });

  await t.test('3.2 Admin search queries authorized admin resources (users, pending, assessments, registries, logs, pages)', () => {
    assert.match(adminSearchContent, /adminService\.getUsers\(\{ search: trimmed, limit: 4 \}\)/);
    assert.match(adminSearchContent, /adminService\.getPendingUsers\(\{ search: trimmed \}\)/);
    assert.match(adminSearchContent, /adminService\.getAssessments\(\{ search: trimmed, limit: 4 \}\)/);
    assert.match(adminSearchContent, /adminService\.getStudentRegistry\(\{ search: trimmed, limit: 3 \}\)/);
    assert.match(adminSearchContent, /adminService\.getFacultyRegistry\(\{ search: trimmed, limit: 3 \}\)/);
    assert.match(adminSearchContent, /adminService\.getLogs\(\{ page: 1, limit: 4, action: trimmed/);
  });

  await t.test('3.3 Admin search results navigate to correct authorized routes without exposing sensitive credentials', () => {
    assert.match(adminSearchContent, /\/admin\/users\?applicantId=/);
    assert.match(adminSearchContent, /\/admin\/assessments/);
    assert.match(adminSearchContent, /\/admin\/student-registry/);
    assert.match(adminSearchContent, /\/admin\/faculty-registry/);
    assert.match(adminSearchContent, /\/admin\/logs/);
    // Preserves credential security - does not map password or token
    assert.doesNotMatch(adminSearchContent, /u\.password/);
    assert.doesNotMatch(adminSearchContent, /u\.refreshToken/);
    assert.doesNotMatch(adminSearchContent, /u\.mfaSecret/);
  });

  await t.test('3.4 Admin search supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', () => {
    assert.match(adminSearchContent, /e\.key === 'ArrowDown'/);
    assert.match(adminSearchContent, /e\.key === 'ArrowUp'/);
    assert.match(adminSearchContent, /e\.key === 'Enter'/);
    assert.match(adminSearchContent, /e\.key === 'Escape'/);
  });

  await t.test('3.5 Admin search provides loading, empty, and error states', () => {
    assert.match(adminSearchContent, /Searching administrative resources\.\.\./);
    assert.match(adminSearchContent, /No matching administrative records found/);
    assert.match(adminSearchContent, /Unable to load administrative search results/);
  });
});

test('4. Instructor Portal Search Bar Contract', async (t) => {
  const instructorSearchContent = readProjectFile('frontend/src/components/common/search/InstructorSearchBar.jsx');

  await t.test('4.1 Instructor search bar uses exact placeholder "Search assessments, students..."', () => {
    assert.match(instructorSearchContent, /placeholder="Search assessments, students\.\.\."/);
  });

  await t.test('4.2 Instructor search queries authorized instructor resources (assessments, question bank, students, submissions, pages)', () => {
    assert.match(instructorSearchContent, /api\.get\('\/assessments', \{ params: \{ search: trimmed, limit: 4 \} \}\)/);
    assert.match(instructorSearchContent, /questionBankService\.getQuestions\(\{ search: trimmed, limit: 4 \}\)/);
    assert.match(instructorSearchContent, /api\.get\('\/users\/students', \{ params: \{ search: trimmed \} \}\)/);
    assert.match(instructorSearchContent, /api\.get\('\/evaluations\/instructor\/submissions'/);
  });

  await t.test('4.3 Instructor search does not expose unauthorized admin APIs or cross-role data', () => {
    assert.doesNotMatch(instructorSearchContent, /adminService/);
    assert.doesNotMatch(instructorSearchContent, /\/admin\//);
  });

  await t.test('4.4 Instructor search supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', () => {
    assert.match(instructorSearchContent, /e\.key === 'ArrowDown'/);
    assert.match(instructorSearchContent, /e\.key === 'ArrowUp'/);
    assert.match(instructorSearchContent, /e\.key === 'Enter'/);
    assert.match(instructorSearchContent, /e\.key === 'Escape'/);
  });

  await t.test('4.5 Instructor search provides loading, empty, and error states', () => {
    assert.match(instructorSearchContent, /Searching instructor workspace\.\.\./);
    assert.match(instructorSearchContent, /No matching items found/);
    assert.match(instructorSearchContent, /Unable to load search results/);
  });
});

test('5. Removal of Duplicate Search Fields & Preservation of Local Table Filters', async (t) => {
  await t.test('5.1 Prominent duplicate search cards removed from Instructor page bodies', () => {
    const queueContent = readProjectFile('frontend/src/pages/instructor/SubmissionsQueue.jsx');
    const asmtContent = readProjectFile('frontend/src/pages/instructor/AssessmentsList.jsx');
    const studContent = readProjectFile('frontend/src/pages/instructor/StudentsList.jsx');
    const dashContent = readProjectFile('frontend/src/pages/instructor/Dashboard.jsx');

    assert.doesNotMatch(queueContent, /<InstructorSearchBar/);
    assert.doesNotMatch(asmtContent, /<InstructorSearchBar/);
    assert.doesNotMatch(studContent, /<InstructorSearchBar/);
    assert.doesNotMatch(dashContent, /<InstructorSearchBar/);
  });

  await t.test('5.2 Essential local table filters and tabs retained in Instructor SubmissionsQueue', () => {
    const queueContent = readProjectFile('frontend/src/pages/instructor/SubmissionsQueue.jsx');
    assert.match(queueContent, /Needs Review/);
    assert.match(queueContent, /Evaluated/);
    assert.doesNotMatch(queueContent, /placeholder="Search queue\.\.\."/);
    assert.doesNotMatch(queueContent, /<Search/);
  });

  await t.test('5.3 Essential local table filters retained in Instructor AssessmentsList', () => {
    const asmtContent = readProjectFile('frontend/src/pages/instructor/AssessmentsList.jsx');
    assert.match(asmtContent, /All Status/);
    assert.match(asmtContent, /Published/);
    assert.match(asmtContent, /Drafts/);
    assert.doesNotMatch(asmtContent, /placeholder="Filter list\.\.\."/);
    assert.doesNotMatch(asmtContent, /<Search/);
  });

  await t.test('5.4 Page-level search input removed from Instructor StudentsList', () => {
    const studContent = readProjectFile('frontend/src/pages/instructor/StudentsList.jsx');
    assert.doesNotMatch(studContent, /placeholder="Search students\.\.\."/);
    assert.doesNotMatch(studContent, /<Search/);
  });

  await t.test('5.5 Page-level search input removed from Student Dashboard catalog view', () => {
    const studentDash = readProjectFile('frontend/src/pages/student/Dashboard.jsx');
    assert.doesNotMatch(studentDash, /placeholder="Search (catalog|assessments)\.\.\."/);
    assert.doesNotMatch(studentDash, /<Search/);
  });

  await t.test('5.6 Page-level search input removed from Instructor QuestionBankList', () => {
    const qbContent = readProjectFile('frontend/src/pages/instructor/QuestionBankList.jsx');
    assert.doesNotMatch(qbContent, /placeholder="Search by question text/);
    assert.doesNotMatch(qbContent, /<Search/);
    assert.match(qbContent, /All Categories/);
    assert.match(qbContent, /All Types/);
  });

  await t.test('5.7 Redundant page-level search inputs and standalone search buttons removed from Admin views', () => {
    const adminDash = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
    const studReg = readProjectFile('frontend/src/pages/admin/StudentRegistry.jsx');
    const facReg = readProjectFile('frontend/src/pages/admin/FacultyRegistry.jsx');
    const studMgmt = readProjectFile('frontend/src/pages/admin/StudentsManagement.jsx');
    const facMgmt = readProjectFile('frontend/src/pages/admin/FacultyManagement.jsx');

    // All Platform Accounts
    assert.doesNotMatch(adminDash, /placeholder="Search by name, email, or code\.\.\."/);
    assert.doesNotMatch(adminDash, /aria-label="Search users"/);

    // Student Registry tab & page
    assert.doesNotMatch(adminDash, /placeholder="Search by student ID, name, or institutional email\.\.\."/);
    assert.doesNotMatch(adminDash, /aria-label="Search registry"/);
    assert.doesNotMatch(studReg, /placeholder="Search by ID, name, or email\.\.\."/);

    // Faculty Registry page
    assert.doesNotMatch(facReg, /placeholder="Search by ID, name, or email\.\.\."/);

    // Platform Assessment Oversight
    assert.doesNotMatch(adminDash, /placeholder="Search assessments by title, description, or category\.\.\."/);

    // Audit Logs
    assert.doesNotMatch(adminDash, /placeholder="Search by action, username, email, or role\.\.\."/);

    // Standalone Students & Faculty Management
    assert.doesNotMatch(studMgmt, /placeholder="Search by name, email, or Student ID\.\.\."/);
    assert.doesNotMatch(facMgmt, /placeholder="Search by name, email, or Faculty ID\.\.\."/);
  });

  await t.test('5.8 Role filters, status filters, action filters, bulk actions, and refresh controls preserved', () => {
    const adminDash = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
    const studReg = readProjectFile('frontend/src/pages/admin/StudentRegistry.jsx');
    const facReg = readProjectFile('frontend/src/pages/admin/FacultyRegistry.jsx');
    const studMgmt = readProjectFile('frontend/src/pages/admin/StudentsManagement.jsx');
    const facMgmt = readProjectFile('frontend/src/pages/admin/FacultyManagement.jsx');

    // Pending Queue role filter and bulk actions
    assert.match(adminDash, /id="pendingRoleFilterSelect"/);
    assert.match(adminDash, /Approve Selected/);
    assert.match(adminDash, /Reject Selected/);

    // All Accounts filters and bulk actions
    assert.match(adminDash, /userRoleFilter/);
    assert.match(adminDash, /userStatusFilter/);
    assert.match(adminDash, /selectAllUsers/);

    // Registry status filters and actions
    assert.match(adminDash, /registryStatusFilter/);
    assert.match(studReg, /statusFilter/);
    assert.match(facReg, /statusFilter/);

    // Assessment & Log filters
    assert.match(adminDash, /assessmentStatusFilter/);
    assert.match(adminDash, /logActionFilter/);

    // Management page status filters
    assert.match(studMgmt, /statusFilter/);
    assert.match(facMgmt, /statusFilter/);
  });
});

test('6. Visual Design Specifications & Responsive Geometry Contract', async (t) => {
  const searchComponents = [
    readProjectFile('frontend/src/components/common/search/StudentSearchBar.jsx'),
    readProjectFile('frontend/src/components/common/search/AdminSearchBar.jsx'),
    readProjectFile('frontend/src/components/common/search/InstructorSearchBar.jsx'),
  ];

  await t.test('6.1 Desktop geometry matches specifications (width ~200-230px, height ~38-42px)', () => {
    for (const comp of searchComponents) {
      assert.match(comp, /h-\[38px\]/);
      assert.match(comp, /xl:w-\[230px\]/);
      assert.match(comp, /rounded-xl/);
    }
  });

  await t.test('6.2 Mobile viewports (< 640px) use compact search toggle button preventing overflow', () => {
    for (const comp of searchComponents) {
      assert.match(comp, /className="sm:hidden p-1\.5 rounded-lg/);
      assert.match(comp, /className="hidden sm:relative sm:flex sm:items-center"/);
      assert.match(comp, /fixed inset-x-2 top-2 z-50 flex flex-col sm:hidden/);
    }
  });

  await t.test('6.3 Subtle border, theme background, and left icon present on all search bars', () => {
    for (const comp of searchComponents) {
      assert.match(comp, /border-surface-light-border dark:border-surface-dark-border/);
      assert.match(comp, /bg-slate-50\/90 dark:bg-surface-dark-muted\/70/);
      assert.match(comp, /pl-8 pr-7/);
      assert.match(comp, /<Search/);
    }
  });
});

test('7. Removal of User-Facing Version Labels', async (t) => {
  await t.test('7.1 Sidebar workspace headers do not render v1.0 or version badges', () => {
    const sidebarContent = readProjectFile('frontend/src/components/common/Sidebar.jsx');
    assert.doesNotMatch(sidebarContent, /v1\.0/);
    assert.doesNotMatch(sidebarContent, /Version badge/);
  });

  await t.test('7.2 No user-facing v1 or v1.0 badges remain in shared navigation components', () => {
    const headerContent = readProjectFile('frontend/src/components/common/Header.jsx');
    const footerContent = readProjectFile('frontend/src/components/common/Footer.jsx');
    const appFooterContent = readProjectFile('frontend/src/components/common/AppFooter.jsx');
    assert.doesNotMatch(headerContent, /\bv1(\.0)?\b/i);
    assert.doesNotMatch(footerContent, /\bv1(\.0)?\b/i);
    assert.doesNotMatch(appFooterContent, /\bv1(\.0)?\b/i);
  });
});

test('8. Removal of Profile Upload Icon and Profile-Image Controls', async (t) => {
  const uploaderContent = readProjectFile('frontend/src/components/common/ProfilePhotoUploader.jsx');
  const adminProfileContent = readProjectFile('frontend/src/pages/admin/Profile.jsx');
  const instructorProfileContent = readProjectFile('frontend/src/pages/instructor/Profile.jsx');
  const studentProfileContent = readProjectFile('frontend/src/pages/student/Profile.jsx');
  const adminDashContent = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');

  await t.test('8.1 Shared ProfilePhotoUploader removes floating upload icon and upload badge', () => {
    assert.doesNotMatch(uploaderContent, /<button[^>]*onClick=\{handleActionClick\}/);
    assert.doesNotMatch(uploaderContent, /Upload className/);
    assert.doesNotMatch(uploaderContent, /title=\{avatar \? 'Upload\/Change Image' : 'Upload Image'\}/);
    assert.doesNotMatch(uploaderContent, /-bottom-1\.5/);
  });

  await t.test('8.2 Shared ProfilePhotoUploader removes separate Upload Image / Remove buttons and file input', () => {
    assert.doesNotMatch(uploaderContent, /Upload Image/);
    assert.doesNotMatch(uploaderContent, /Upload\/Change Image/);
    assert.doesNotMatch(uploaderContent, /<input[^>]*type="file"/);
    assert.doesNotMatch(uploaderContent, /authService\.uploadAvatar/);
  });

  await t.test('8.3 Shared ProfilePhotoUploader preserves avatar image and initials fallback with role themes', () => {
    assert.match(uploaderContent, /getInitials/);
    assert.match(uploaderContent, /student:/);
    assert.match(uploaderContent, /instructor:/);
    assert.match(uploaderContent, /admin:/);
    assert.match(uploaderContent, /border-brand-peach/);
    assert.match(uploaderContent, /border-brand-sage/);
    assert.match(uploaderContent, /border-indigo-400\/40/);
    assert.match(uploaderContent, /rounded-3xl/);
    assert.match(uploaderContent, /w-24 h-24/);
  });

  await t.test('8.4 Role-specific profile pages mount shared ProfilePhotoUploader cleanly without local upload controls', () => {
    for (const pageContent of [adminProfileContent, instructorProfileContent, studentProfileContent]) {
      assert.match(pageContent, /<ProfilePhotoUploader/);
      assert.doesNotMatch(pageContent, /Upload Image/);
      assert.doesNotMatch(pageContent, /input type="file"/);
    }
    assert.doesNotMatch(adminDashContent, /<ProfilePhotoUploader/);
  });
});

test('9. Admin Refresh Data Button Contract', async (t) => {
  const adminDash = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
  const buttonContent = readProjectFile('frontend/src/components/ui/Button.jsx');

  await t.test('9.1 Button component supports iconClassName for spinning animation', () => {
    assert.match(buttonContent, /iconClassName = ''/);
    assert.match(buttonContent, /\${iconClassName}/);
  });

  await t.test('9.2 Refresh Data button renders spinning icon, Refreshing... label, and disabled state during refresh', () => {
    assert.match(adminDash, /id="adminRefreshDataBtn"/);
    assert.match(adminDash, /icon=\{RefreshCw\}/);
    assert.match(adminDash, /iconClassName=\{isRefreshing \? 'animate-spin' : ''\}/);
    assert.match(adminDash, /disabled=\{isRefreshing\}/);
    assert.match(adminDash, /\{isRefreshing \? 'Refreshing\.\.\.' : 'Refresh Data'\}/);
    assert.match(adminDash, /className="min-w-\[135px\] justify-center"/);
  });

  await t.test('9.3 handleRefreshData refreshes core telemetry and current tab datasets with stale-request protection', () => {
    assert.match(adminDash, /const handleRefreshData = useCallback\(async \(\) =>/);
    assert.match(adminDash, /if \(isRefreshing\) return;/);
    assert.match(adminDash, /const reqId = \+\+refreshRequestIdRef\.current;/);
    assert.match(adminDash, /const refreshPromises = \[loadDashboardData\(\)\];/);
    assert.match(adminDash, /toast\.success\('Admin dashboard data refreshed successfully'\)/);
    assert.match(adminDash, /toast\.error\(err\?\.message/);
    assert.match(adminDash, /setIsRefreshing\(false\)/);
  });
});
