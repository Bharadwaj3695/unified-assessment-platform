import {
  LayoutDashboard,
  BookOpen,
  FileCheck2,
  User,
  PlusCircle,
  Users,
  ShieldCheck,
  Activity,
  Database,
  UploadCloud,
} from 'lucide-react';

/**
 * Structured Role-Aware Navigation Configuration
 * 
 * Each role has logically grouped sections.
 * All route paths correspond strictly to actual existing routes in AppRoutes.jsx.
 * Dynamic child routes and nested flows map to their authoritative parent items.
 */

export const studentNavigation = {
  role: 'student',
  workspaceLabel: 'Student Workspace',
  sections: [
    {
      id: 'student-workspace',
      title: 'Workspace',
      collapsible: false,
      items: [
        {
          id: 'student-dashboard',
          name: 'Dashboard',
          path: '/student/dashboard',
          icon: LayoutDashboard,
          matchPatterns: ['/student/dashboard', '/student'],
          description: 'Overview of courses, metrics, streaks, and upcoming deadlines',
        },
      ],
    },
    {
      id: 'student-academics',
      title: 'Academic Suite',
      collapsible: true,
      items: [
        {
          id: 'student-assessments',
          name: 'Assessments',
          path: '/student/catalog',
          icon: BookOpen,
          matchPatterns: ['/student/catalog', '/student/attempt', '/student/assessments'],
          description: 'Browse available course exams, quizzes, and timed tests',
        },
        {
          id: 'student-submissions',
          name: 'Submissions',
          path: '/student/submissions',
          icon: FileCheck2,
          matchPatterns: ['/student/submissions'],
          description: 'Review submitted attempts, evaluated scores, and instructor feedback',
        },
      ],
    },
    {
      id: 'student-account',
      title: 'Account',
      collapsible: true,
      items: [
        {
          id: 'student-profile',
          name: 'Profile',
          path: '/student/profile',
          icon: User,
          matchPatterns: ['/student/profile'],
          description: 'Personal details, student credentials, and two-factor authentication',
        },
      ],
    },
  ],
};

export const instructorNavigation = {
  role: 'instructor',
  workspaceLabel: 'instructor Workspace',
  sections: [
    {
      id: 'instructor-workspace',
      title: 'Workspace',
      collapsible: false,
      items: [
        {
          id: 'instructor-dashboard',
          name: 'Dashboard',
          path: '/instructor/dashboard',
          icon: LayoutDashboard,
          matchPatterns: ['/instructor/dashboard', '/instructor'],
          description: 'Instructor dashboard metrics, pending evaluations, and recent activity',
        },
      ],
    },
    {
      id: 'instructor-assessments-section',
      title: 'Assessments & Content',
      collapsible: true,
      items: [
        {
          id: 'instructor-assessments',
          name: 'My Assessments',
          path: '/instructor/assessments',
          icon: BookOpen,
          matchPatterns: [
            '/instructor/assessments',
            '/instructor/edit',
            '/instructor/analytics',
          ],
          description: 'Manage, edit, publish, and inspect analytics for course assessments',
        },
        {
          id: 'instructor-create',
          name: 'Create Assessment',
          path: '/instructor/create',
          icon: PlusCircle,
          matchPatterns: ['/instructor/create'],
          description: 'Compose new examinations, configure rules, and set grading rubrics',
        },
        {
          id: 'instructor-question-bank',
          name: 'Question Bank',
          path: '/instructor/question-bank',
          icon: Database,
          matchPatterns: ['/instructor/question-bank'],
          description: 'Reusable question repository categorized by discipline and difficulty',
        },
        {
          id: 'instructor-question-import',
          name: 'Import Questions',
          path: '/instructor/question-import',
          icon: UploadCloud,
          matchPatterns: ['/instructor/question-import'],
          description: 'Bulk import questions from formatted documents or structured spreadsheets',
        },
      ],
    },
    {
      id: 'instructor-evaluation-section',
      title: 'Evaluation & Cohorts',
      collapsible: true,
      items: [
        {
          id: 'instructor-submissions',
          name: 'Submissions & Grading',
          path: '/instructor/submissions',
          icon: FileCheck2,
          matchPatterns: [
            '/instructor/submissions',
            '/instructor/evaluate',
          ],
          description: 'Grade student submissions, provide rubric feedback, and verify results',
        },
        {
          id: 'instructor-students',
          name: 'Students',
          path: '/instructor/students',
          icon: Users,
          matchPatterns: ['/instructor/students'],
          description: 'Enrolled students roster, performance history, and cohort assignment',
        },
      ],
    },
    {
      id: 'instructor-account',
      title: 'Account',
      collapsible: true,
      items: [
        {
          id: 'instructor-profile',
          name: 'Profile',
          path: '/instructor/profile',
          icon: User,
          matchPatterns: ['/instructor/profile'],
          description: 'Faculty profile details, department affiliation, and security settings',
        },
      ],
    },
  ],
};

export const adminNavigation = {
  role: 'admin',
  workspaceLabel: 'admin Workspace',
  sections: [
    {
      id: 'admin-workspace',
      title: 'Workspace',
      collapsible: false,
      items: [
        {
          id: 'admin-dashboard',
          name: 'System Overview',
          path: '/admin/dashboard',
          icon: LayoutDashboard,
          matchPatterns: ['/admin/dashboard', '/admin'],
          description: 'System telemetry, platform performance metrics, and operational overview',
        },
      ],
    },
    {
      id: 'admin-management-section',
      title: 'Platform Administration',
      collapsible: true,
      items: [
        {
          id: 'admin-users',
          name: 'User Management',
          path: '/admin/users',
          icon: Users,
          matchPatterns: ['/admin/users'],
          description: 'Manage platform accounts, approve applicants, and revoke access',
        },
        {
          id: 'admin-assessments',
          name: 'All Assessments',
          path: '/admin/assessments',
          icon: BookOpen,
          matchPatterns: ['/admin/assessments'],
          description: 'Institutional assessment repository, review status, and oversight',
        },
      ],
    },
    {
      id: 'admin-governance-section',
      title: 'Security & Governance',
      collapsible: true,
      items: [
        {
          id: 'admin-logs',
          name: 'Audit Logs',
          path: '/admin/logs',
          icon: Activity,
          matchPatterns: ['/admin/logs'],
          description: 'Immutable system audit trail, security events, and compliance telemetry',
        },
        {
          id: 'admin-settings',
          name: 'Settings',
          path: '/admin/settings',
          icon: ShieldCheck,
          matchPatterns: ['/admin/settings', '/admin/profile'],
          description: 'Platform configuration, registration switches, and master admin 2FA',
        },
      ],
    },
  ],
};

/**
 * Returns structured navigation configuration for authenticated role.
 * Role is strictly derived from user auth state (never from email address).
 */
export const getNavigationForRole = (role) => {
  switch (role) {
    case 'instructor':
      return instructorNavigation;
    case 'admin':
      return adminNavigation;
    case 'student':
    default:
      return studentNavigation;
  }
};

/**
 * Checks if a specific navigation item is active for the current pathname.
 * Handles exact paths, subpaths, dynamic prefixes, and role-root redirects.
 */
export const isNavigationItemActive = (item, currentPath) => {
  if (!item || !currentPath) return false;

  // 1. Exact match
  if (currentPath === item.path) return true;

  // 2. Subpath matching: e.g. /admin/users/123 matches /admin/users
  if (currentPath.startsWith(`${item.path}/`)) return true;

  // 3. Match patterns for dynamic or nested flows
  if (item.matchPatterns && Array.isArray(item.matchPatterns)) {
    for (const pattern of item.matchPatterns) {
      if (currentPath === pattern) return true;
      if (currentPath.startsWith(`${pattern}/`)) return true;
    }
  }

  // 4. Role root redirects: e.g. /student or /instructor matching /.../dashboard
  if (item.path.endsWith('/dashboard')) {
    const rolePrefix = item.path.replace('/dashboard', '');
    if (currentPath === rolePrefix || currentPath === `${rolePrefix}/`) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if any item inside a section is currently active.
 */
export const isSectionActive = (section, currentPath) => {
  if (!section || !section.items || !currentPath) return false;
  return section.items.some((item) => isNavigationItemActive(item, currentPath));
};
