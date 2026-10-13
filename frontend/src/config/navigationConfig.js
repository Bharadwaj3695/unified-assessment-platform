// Import icons from the lucide-react icon library used across navigation menus
import {
  // Icon for dashboard overview sections
  LayoutDashboard,
  // Icon for academics and catalog sections
  BookOpen,
  // Icon for submissions and evaluated exams
  FileCheck2,
  // Icon for user profile and personal settings
  User,
  // Icon for assessment creation actions
  PlusCircle,
  // Icon for student and user rosters
  Users,
  // Icon for security, settings, and governance
  ShieldCheck,
  // Icon for audit logs and system telemetry
  Activity,
  // Icon for master databases and registries
  Database,
  // Icon for bulk file upload and data import actions
  UploadCloud,
// Conclude lucide-react icon imports
} from 'lucide-react';

/**
 * Structured Role-Aware Navigation Configuration
 * 
 * Each role has logically grouped sections.
 * All route paths correspond strictly to actual existing routes in AppRoutes.jsx.
 * Dynamic child routes and nested flows map to their authoritative parent items.
 */

// Export the complete navigation configuration structure for the student role
export const studentNavigation = {
  // Define the target role identifier for this navigation set
  role: 'student',
  // Human-readable header label for the student sidebar workspace
  workspaceLabel: 'Student Workspace',
  // List of grouped sidebar navigation sections available to students
  sections: [
    // Primary workspace section containing main dashboard link
    {
      // Unique section identifier
      id: 'student-workspace',
      // Section header title text
      title: 'Workspace',
      // Flag preventing section from being collapsed in sidebar
      collapsible: false,
      // Array of navigation link items belonging to this section
      items: [
        // Navigation item linking to the student dashboard
        {
          // Unique item identifier
          id: 'student-dashboard',
          // Display title in navigation list
          name: 'Dashboard',
          // Primary target URL path for routing
          path: '/student/dashboard',
          // Lucide icon component to render next to title
          icon: LayoutDashboard,
          // URL paths that mark this item active in the UI
          matchPatterns: ['/student/dashboard', '/student'],
          // Explanatory tooltip or aria description of section purpose
          description: 'Overview of courses, metrics, streaks, and upcoming deadlines',
        // Conclude student-dashboard item definition
        },
      // Conclude items array
      ],
    // Conclude student-workspace section
    },
    // Academic suite section containing assessments and submissions
    {
      // Unique section identifier
      id: 'student-academics',
      // Section header title text
      title: 'Academic Suite',
      // Flag allowing the section to be collapsed or expanded
      collapsible: true,
      // Array of navigation items for academics
      items: [
        // Navigation item linking to assessment exam catalog
        {
          // Unique item identifier
          id: 'student-assessments',
          // Display label in navigation menu
          name: 'Assessments',
          // Target URL path to assessment catalog
          path: '/student/catalog',
          // Lucide icon representing courses and examinations
          icon: BookOpen,
          // URL prefix patterns matching catalog, active exam attempt, and legacy aliases
          matchPatterns: ['/student/catalog', '/student/attempt', '/student/assessments'],
          // Description of assessment section contents
          description: 'Browse available course exams, quizzes, and timed tests',
        // Conclude student-assessments item definition
        },
        // Navigation item linking to exam submissions history
        {
          // Unique item identifier
          id: 'student-submissions',
          // Display label in navigation menu
          name: 'Submissions',
          // Target URL path to submissions list
          path: '/student/submissions',
          // Lucide icon representing graded files and evaluations
          icon: FileCheck2,
          // URL patterns matching submission history view
          matchPatterns: ['/student/submissions'],
          // Description of submission history features
          description: 'Review submitted attempts, evaluated scores, and instructor feedback',
        // Conclude student-submissions item definition
        },
      // Conclude items array
      ],
    // Conclude student-academics section
    },
    // Account section containing student profile and settings
    {
      // Unique section identifier
      id: 'student-account',
      // Section header title text
      title: 'Account',
      // Flag allowing user to collapse this section
      collapsible: true,
      // Array of navigation items for student account
      items: [
        // Navigation item linking to student profile
        {
          // Unique item identifier
          id: 'student-profile',
          // Display label for profile link
          name: 'Profile',
          // Target URL path to student profile
          path: '/student/profile',
          // Lucide user icon
          icon: User,
          // URL pattern matching student profile path
          matchPatterns: ['/student/profile'],
          // Description of profile settings and security options
          description: 'Personal details, student credentials, and two-factor authentication',
        // Conclude student-profile item definition
        },
      // Conclude items array
      ],
    // Conclude student-account section
    },
  // Conclude student sections array
  ],
// Conclude studentNavigation object definition
};

// Export the complete navigation configuration structure for the instructor role
export const instructorNavigation = {
  // Define the target role identifier for instructor navigation
  role: 'instructor',
  // Human-readable header label for instructor sidebar
  workspaceLabel: 'instructor Workspace',
  // List of grouped sidebar navigation sections available to instructors
  sections: [
    // Primary workspace section containing main dashboard link
    {
      // Unique section identifier
      id: 'instructor-workspace',
      // Section header title text
      title: 'Workspace',
      // Flag preventing section from being collapsed
      collapsible: false,
      // Array of navigation items for instructor workspace
      items: [
        // Navigation item linking to instructor dashboard
        {
          // Unique item identifier
          id: 'instructor-dashboard',
          // Display title in navigation list
          name: 'Dashboard',
          // Target URL path to instructor dashboard
          path: '/instructor/dashboard',
          // Lucide dashboard layout icon
          icon: LayoutDashboard,
          // URL patterns matching instructor dashboard and root instructor route
          matchPatterns: ['/instructor/dashboard', '/instructor'],
          // Description of instructor dashboard features
          description: 'Instructor dashboard metrics, pending evaluations, and recent activity',
        // Conclude instructor-dashboard item definition
        },
      // Conclude items array
      ],
    // Conclude instructor-workspace section
    },
    // Assessments and content authoring section
    {
      // Unique section identifier
      id: 'instructor-assessments-section',
      // Section header title text
      title: 'Assessments & Content',
      // Flag allowing the section to be collapsed
      collapsible: true,
      // Array of navigation items for assessments management
      items: [
        // Navigation item linking to assessment list
        {
          // Unique item identifier
          id: 'instructor-assessments',
          // Display label in navigation menu
          name: 'My Assessments',
          // Target URL path for assessment list
          path: '/instructor/assessments',
          // Lucide book icon
          icon: BookOpen,
          // URL patterns covering assessments list, editing, and analytics views
          matchPatterns: [
            // Matches assessments list view
            '/instructor/assessments',
            // Matches assessment builder edit mode
            '/instructor/edit',
            // Matches assessment analytics report
            '/instructor/analytics',
          // Conclude matchPatterns array
          ],
          // Description of assessments management features
          description: 'Manage, edit, publish, and inspect analytics for course assessments',
        // Conclude instructor-assessments item definition
        },
        // Navigation item linking to assessment creation builder
        {
          // Unique item identifier
          id: 'instructor-create',
          // Display label in navigation menu
          name: 'Create Assessment',
          // Target URL path for assessment creation
          path: '/instructor/create',
          // Lucide plus icon for new item creation
          icon: PlusCircle,
          // URL patterns matching assessment builder create mode
          matchPatterns: ['/instructor/create'],
          // Description of assessment creation builder
          description: 'Compose new examinations, configure rules, and set grading rubrics',
        // Conclude instructor-create item definition
        },
        // Navigation item linking to question bank repository
        {
          // Unique item identifier
          id: 'instructor-question-bank',
          // Display label in navigation menu
          name: 'Question Bank',
          // Target URL path to question bank
          path: '/instructor/question-bank',
          // Lucide database icon
          icon: Database,
          // URL patterns matching question bank management
          matchPatterns: ['/instructor/question-bank'],
          // Description of question bank repository
          description: 'Reusable question repository categorized by discipline and difficulty',
        // Conclude instructor-question-bank item definition
        },
        // Navigation item linking to question bulk import tool
        {
          // Unique item identifier
          id: 'instructor-question-import',
          // Display label in navigation menu
          name: 'Import Questions',
          // Target URL path to question import
          path: '/instructor/question-import',
          // Lucide cloud upload icon
          icon: UploadCloud,
          // URL patterns matching question bulk import views
          matchPatterns: ['/instructor/question-import'],
          // Description of question bulk import utility
          description: 'Bulk import questions from formatted documents or structured spreadsheets',
        // Conclude instructor-question-import item definition
        },
      // Conclude items array
      ],
    // Conclude instructor-assessments-section
    },
    // Evaluation and student cohorts section
    {
      // Unique section identifier
      id: 'instructor-evaluation-section',
      // Section header title text
      title: 'Evaluation & Cohorts',
      // Flag allowing section collapse
      collapsible: true,
      // Array of navigation items for student grading and roster
      items: [
        // Navigation item linking to student submissions queue
        {
          // Unique item identifier
          id: 'instructor-submissions',
          // Display label in navigation menu
          name: 'Submissions & Grading',
          // Target URL path to submissions queue
          path: '/instructor/submissions',
          // Lucide file check icon
          icon: FileCheck2,
          // URL patterns covering submissions queue and evaluation studio
          matchPatterns: [
            // Matches submissions queue overview
            '/instructor/submissions',
            // Matches evaluation studio grading screen
            '/instructor/evaluate',
          // Conclude matchPatterns array
          ],
          // Description of grading workflow features
          description: 'Grade student submissions, provide rubric feedback, and verify results',
        // Conclude instructor-submissions item definition
        },
        // Navigation item linking to enrolled students roster
        {
          // Unique item identifier
          id: 'instructor-students',
          // Display label in navigation menu
          name: 'Students',
          // Target URL path to enrolled students roster
          path: '/instructor/students',
          // Lucide group users icon
          icon: Users,
          // URL pattern matching students roster view
          matchPatterns: ['/instructor/students'],
          // Description of student roster management
          description: 'Enrolled students roster, performance history, and cohort assignment',
        // Conclude instructor-students item definition
        },
      // Conclude items array
      ],
    // Conclude instructor-evaluation-section
    },
    // Faculty account management section
    {
      // Unique section identifier
      id: 'instructor-account',
      // Section header title text
      title: 'Account',
      // Flag allowing collapse
      collapsible: true,
      // Array of navigation items for instructor account
      items: [
        // Navigation item linking to faculty profile
        {
          // Unique item identifier
          id: 'instructor-profile',
          // Display label for profile link
          name: 'Profile',
          // Target URL path to instructor profile
          path: '/instructor/profile',
          // Lucide user icon
          icon: User,
          // URL pattern matching instructor profile
          matchPatterns: ['/instructor/profile'],
          // Description of instructor profile settings
          description: 'Faculty profile details, department affiliation, and security settings',
        // Conclude instructor-profile item definition
        },
      // Conclude items array
      ],
    // Conclude instructor-account section
    },
  // Conclude instructor sections array
  ],
// Conclude instructorNavigation object definition
};

// Export the complete navigation configuration structure for the admin role
export const adminNavigation = {
  // Define target role identifier for administrator navigation
  role: 'admin',
  // Human-readable header label for admin sidebar
  workspaceLabel: 'admin Workspace',
  // List of grouped sidebar navigation sections available to administrators
  sections: [
    // Primary workspace section containing system dashboard link
    {
      // Unique section identifier
      id: 'admin-workspace',
      // Section header title text
      title: 'Workspace',
      // Flag preventing section from being collapsed
      collapsible: false,
      // Array of navigation items for admin workspace
      items: [
        // Navigation item linking to system overview dashboard
        {
          // Unique item identifier
          id: 'admin-dashboard',
          // Display label in navigation menu
          name: 'System Overview',
          // Target URL path for admin dashboard
          path: '/admin/dashboard',
          // Lucide dashboard layout icon
          icon: LayoutDashboard,
          // URL patterns matching admin dashboard and root admin route
          matchPatterns: ['/admin/dashboard', '/admin'],
          // Description of system overview dashboard
          description: 'System telemetry, platform performance metrics, and operational overview',
        // Conclude admin-dashboard item definition
        },
      // Conclude items array
      ],
    // Conclude admin-workspace section
    },
    // User management section for registration reviews
    {
      // Unique section identifier
      id: 'admin-user-management-section',
      // Section header title text
      title: 'User Management',
      // Flag allowing collapse
      collapsible: true,
      // Array of navigation items for user management
      items: [
        // Navigation item linking to user approval queue
        {
          // Unique item identifier
          id: 'admin-users',
          // Display label in navigation menu
          name: 'Approval Queue',
          // Target URL path to pending users queue
          path: '/admin/users',
          // Lucide users icon
          icon: Users,
          // URL patterns matching user approval views
          matchPatterns: ['/admin/users'],
          // Description of user verification and role management
          description: 'Review pending registration applications, verify credentials, and manage roles',
        // Conclude admin-users item definition
        },
      // Conclude items array
      ],
    // Conclude admin-user-management-section
    },
    // Registries section for authoritative master academic data
    {
      // Unique section identifier
      id: 'admin-registries-section',
      // Section header title text
      title: 'Registries',
      // Flag allowing collapse
      collapsible: true,
      // Array of navigation items for authoritative registries
      items: [
        // Navigation item linking to student master registry
        {
          // Unique item identifier
          id: 'admin-student-registry',
          // Display label in navigation menu
          name: 'Student Registry',
          // Target URL path to student master registry
          path: '/admin/student-registry',
          // Lucide database icon
          icon: Database,
          // URL patterns matching student registry views
          matchPatterns: ['/admin/student-registry'],
          // Description of student master records
          description: 'Authoritative student master data, institutional IDs, and DOB verification records',
        // Conclude admin-student-registry item definition
        },
        // Navigation item linking to faculty master registry
        {
          // Unique item identifier
          id: 'admin-faculty-registry',
          // Display label in navigation menu
          name: 'Faculty Registry',
          // Target URL path to faculty master registry
          path: '/admin/faculty-registry',
          // Lucide book icon
          icon: BookOpen,
          // URL patterns matching faculty registry views
          matchPatterns: ['/admin/faculty-registry'],
          // Description of faculty master records
          description: 'Authoritative faculty master data and institutional staff IDs',
        // Conclude admin-faculty-registry item definition
        },
      // Conclude items array
      ],
    // Conclude admin-registries-section
    },
    // Platform administration section for global assessments oversight
    {
      // Unique section identifier
      id: 'admin-management-section',
      // Section header title text
      title: 'Platform Administration',
      // Flag allowing collapse
      collapsible: true,
      // Array of navigation items for platform administration
      items: [
        // Navigation item linking to institutional assessments overview
        {
          // Unique item identifier
          id: 'admin-assessments',
          // Display label in navigation menu
          name: 'All Assessments',
          // Target URL path to all assessments view
          path: '/admin/assessments',
          // Lucide book icon
          icon: BookOpen,
          // URL patterns matching admin assessment oversight
          matchPatterns: ['/admin/assessments'],
          // Description of assessment oversight features
          description: 'Institutional assessment repository, review status, and oversight',
        // Conclude admin-assessments item definition
        },
      // Conclude items array
      ],
    // Conclude admin-management-section
    },
    // Security and governance section for audit trails and settings
    {
      // Unique section identifier
      id: 'admin-governance-section',
      // Section header title text
      title: 'Security & Governance',
      // Flag allowing collapse
      collapsible: true,
      // Array of navigation items for security and system configuration
      items: [
        // Navigation item linking to system audit logs
        {
          // Unique item identifier
          id: 'admin-logs',
          // Display label in navigation menu
          name: 'Audit Logs',
          // Target URL path to audit logs
          path: '/admin/logs',
          // Lucide activity monitor icon
          icon: Activity,
          // URL patterns matching system audit log views
          matchPatterns: ['/admin/logs'],
          // Description of audit log trail
          description: 'Immutable system audit trail, security events, and compliance telemetry',
        // Conclude admin-logs item definition
        },
        // Navigation item linking to system settings
        {
          // Unique item identifier
          id: 'admin-settings',
          // Display label in navigation menu
          name: 'Settings',
          // Target URL path to platform configuration settings
          path: '/admin/settings',
          // Lucide shield check icon
          icon: ShieldCheck,
          // URL patterns matching settings and profile redirects
          matchPatterns: ['/admin/settings', '/admin/profile'],
          // Description of global platform settings
          description: 'Platform configuration, registration switches, and master admin 2FA',
        // Conclude admin-settings item definition
        },
      // Conclude items array
      ],
    // Conclude admin-governance-section
    },
  // Conclude admin sections array
  ],
// Conclude adminNavigation object definition
};

/**
 * Returns structured navigation configuration for authenticated role.
 * Role is strictly derived from user auth state (never from email address).
 */
// Export helper function to retrieve the appropriate navigation object based on user role
export const getNavigationForRole = (role) => {
  // Evaluate the provided user role string using a switch statement
  switch (role) {
    // If role is instructor, return instructor navigation configuration
    case 'instructor':
      // Return instructor navigation structure
      return instructorNavigation;
    // If role is admin, return administrator navigation configuration
    case 'admin':
      // Return administrator navigation structure
      return adminNavigation;
    // If role is student or unrecognized, default to student navigation configuration
    case 'student':
    // Default fallback branch
    default:
      // Return student navigation structure
      return studentNavigation;
  // Conclude switch statement
  }
// Conclude getNavigationForRole function
};

/**
 * Checks if a specific navigation item is active for the current pathname.
 * Handles exact paths, subpaths, dynamic prefixes, and role-root redirects.
 */
// Export helper function to test if a given navigation item matches the current URL path
export const isNavigationItemActive = (item, currentPath) => {
  // Return false if either item or currentPath is null, undefined, or empty
  if (!item || !currentPath) return false;

  // 1. Exact match comparison between current path and item path
  if (currentPath === item.path) return true;

  // 2. Subpath matching: e.g. /admin/users/123 matches parent /admin/users
  if (currentPath.startsWith(`${item.path}/`)) return true;

  // 3. Match patterns check for dynamic or nested flows configured on the item
  if (item.matchPatterns && Array.isArray(item.matchPatterns)) {
    // Iterate over each declared match pattern in the array
    for (const pattern of item.matchPatterns) {
      // Return true if current path exactly equals the pattern
      if (currentPath === pattern) return true;
      // Do not treat root role prefixes (e.g. '/student', '/instructor', '/admin') as prefix matches for child routes
      const isRootRolePattern = /^\/(student|instructor|admin)$/.test(pattern);
      if (!isRootRolePattern && currentPath.startsWith(`${pattern}/`)) return true;
    // Conclude matchPatterns loop
    }
  // Conclude matchPatterns presence check
  }

  // 4. Role root redirects: e.g. /student or /instructor matching /.../dashboard
  if (item.path.endsWith('/dashboard')) {
    // Derive role root prefix by stripping /dashboard suffix from item path
    const rolePrefix = item.path.replace('/dashboard', '');
    // Check if current path matches role prefix with or without trailing slash
    if (currentPath === rolePrefix || currentPath === `${rolePrefix}/`) {
      // Return true if role root matches dashboard target
      return true;
    // Conclude role prefix check
    }
  // Conclude dashboard endsWith check
  }

  // Return false if no matching condition was met
  return false;
// Conclude isNavigationItemActive function
};

/**
 * Checks if any item inside a section is currently active.
 */
// Export helper function to test if any navigation item inside a section is active
export const isSectionActive = (section, currentPath) => {
  // Return false if section or section items or currentPath is missing
  if (!section || !section.items || !currentPath) return false;
  // Test if some item in section items evaluates to active using isNavigationItemActive
  return section.items.some((item) => isNavigationItemActive(item, currentPath));
// Conclude isSectionActive function
};
