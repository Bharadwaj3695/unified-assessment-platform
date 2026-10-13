/**
 * Centralized Notification Routing Resolver
 * Maps notifications to authorized, validated destination routes across Admin, Instructor, and Student roles.
 * Enforces strict RBAC route boundary integrity and graceful fallbacks for missing/malformed references.
 */

// Safe fallback dashboard routes for each role
export const ROLE_DEFAULT_ROUTES = {
  admin: '/admin/dashboard',
  instructor: '/instructor/dashboard',
  student: '/student/dashboard',
};

/**
 * Extracts an applicant email address from notification message body
 * e.g., "Alex Johnson (alex@uap.edu) submitted a registration application for role 'student'."
 *
 * @param {string} message - Notification message string
 * @returns {string|null} - Extracted email or null
 */
export const extractApplicantEmail = (message) => {
  if (!message || typeof message !== 'string') return null;

  // Primary match: parenthesized email address: (user@domain.com)
  const parenMatch = message.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
  if (parenMatch && parenMatch[1]) return parenMatch[1].trim();

  // Secondary fallback match: any valid email format in the text
  const generalMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return generalMatch ? generalMatch[0].trim() : null;
};

/**
 * Resolves the authoritative destination route for a given notification and user role.
 * Guarantees RBAC route boundary protection and graceful fallbacks.
 *
 * @param {Object} notification - Notification document/payload
 * @param {string} userRole - Active user role ('admin', 'instructor', 'student')
 * @returns {string|null} - Destination route path, or null if purely informational
 */
export const resolveNotificationRoute = (notification, userRole) => {
  if (!notification || typeof notification !== 'object') {
    return userRole && ROLE_DEFAULT_ROUTES[userRole] ? ROLE_DEFAULT_ROUTES[userRole] : null;
  }

  const role = userRole ? userRole.toLowerCase() : null;
  const rawLink = notification.link && typeof notification.link === 'string' ? notification.link.trim() : null;
  const title = (notification.title || '').toLowerCase();
  const message = notification.message || '';
  const type = (notification.type || '').toLowerCase();

  // Block dangerous schemes or external redirects
  if (rawLink && (rawLink.startsWith('http:') || rawLink.startsWith('https:') || rawLink.startsWith('//') || rawLink.includes(':'))) {
    return role && ROLE_DEFAULT_ROUTES[role] ? ROLE_DEFAULT_ROUTES[role] : null;
  }

  // =========================================================================
  // 1. ADMIN NOTIFICATION ROUTING
  // =========================================================================
  if (role === 'admin') {
    // A. Applicant Registration / Pending Approvals
    const isApplicantNotification =
      title.includes('applicant') ||
      title.includes('registration') ||
      message.toLowerCase().includes('registration application') ||
      message.toLowerCase().includes('registered via google');

    if (isApplicantNotification) {
      // If notification contains an explicit applicant ID in payload or metadata
      const explicitApplicantId =
        notification.applicantId ||
        notification.metadata?.applicantId ||
        notification.entityId;

      if (explicitApplicantId) {
        return `/admin/users?applicantId=${encodeURIComponent(explicitApplicantId)}`;
      }

      // If rawLink already contains an applicantId or userId, preserve it
      if (rawLink && rawLink.includes('/admin/users') && (rawLink.includes('applicantId=') || rawLink.includes('userId='))) {
        return rawLink;
      }

      // If rawLink already contains an applicantEmail
      if (rawLink && rawLink.includes('/admin/users') && rawLink.includes('applicantEmail=')) {
        return rawLink;
      }

      // Extract applicant email from message text if available
      const applicantEmail = extractApplicantEmail(message);
      if (applicantEmail) {
        return `/admin/users?applicantEmail=${encodeURIComponent(applicantEmail)}`;
      }

      // Safe fallback for applicant notification: open pending queue in users directory
      return '/admin/users';
    }

    // B. Assessment Administration
    if (title.includes('assessment') || title.includes('exam')) {
      const explicitAssessmentId = notification.assessmentId || notification.metadata?.assessmentId;
      if (rawLink && rawLink.startsWith('/admin/assessments')) {
        return rawLink;
      }
      if (explicitAssessmentId) {
        return `/admin/assessments?assessmentId=${encodeURIComponent(explicitAssessmentId)}`;
      }
      return '/admin/assessments';
    }

    // C. Audit & Security Alerts
    if (title.includes('audit') || title.includes('security') || title.includes('alert') || type === 'system') {
      if (rawLink && rawLink.startsWith('/admin/logs')) {
        return rawLink;
      }
      if (rawLink && rawLink.startsWith('/admin/')) {
        return rawLink;
      }
      return '/admin/logs';
    }

    // D. Valid admin link provided
    if (rawLink && rawLink.startsWith('/admin/')) {
      return rawLink;
    }

    // Safe Admin default fallback
    return '/admin/dashboard';
  }

  // =========================================================================
  // 2. INSTRUCTOR NOTIFICATION ROUTING
  // =========================================================================
  if (role === 'instructor') {
    // Check for explicit submission ID
    const explicitSubId =
      notification.submissionId ||
      notification.metadata?.submissionId ||
      (notification.entityType === 'submission' ? notification.entityId : null);

    if (explicitSubId && (title.includes('submission') || title.includes('evaluate') || title.includes('grading') || rawLink?.includes('/instructor/evaluate'))) {
      return `/instructor/evaluate/${encodeURIComponent(explicitSubId)}`;
    }

    // If rawLink is a valid instructor path, honor it
    if (rawLink && rawLink.startsWith('/instructor/')) {
      return rawLink;
    }

    // Submission / Evaluation notifications
    if (title.includes('submission') || title.includes('evaluate') || title.includes('grading')) {
      return '/instructor/submissions';
    }

    // Assessment creation / management
    if (title.includes('assessment') || title.includes('exam')) {
      return '/instructor/assessments';
    }

    // Question Bank
    if (title.includes('question') || title.includes('bank') || title.includes('import')) {
      return '/instructor/question-bank';
    }

    // Safe Instructor default fallback
    return '/instructor/dashboard';
  }

  // =========================================================================
  // 3. STUDENT NOTIFICATION ROUTING
  // =========================================================================
  if (role === 'student') {
    // Check for explicit submission ID
    const explicitSubId =
      notification.submissionId ||
      notification.metadata?.submissionId ||
      (notification.entityType === 'submission' ? notification.entityId : null);

    if (explicitSubId && (title.includes('grade') || title.includes('evaluated') || title.includes('feedback') || title.includes('submission') || type === 'grade')) {
      return `/student/submissions?submissionId=${encodeURIComponent(explicitSubId)}`;
    }

    // Handle legacy student submission/result routes:
    // e.g. /student/submissions/:id or /student/results/:id -> /student/submissions?submissionId=:id
    if (rawLink) {
      const submissionMatch = rawLink.match(/^\/student\/(?:submissions|results)\/([a-zA-Z0-9_-]+)/);
      if (submissionMatch && submissionMatch[1]) {
        return `/student/submissions?submissionId=${submissionMatch[1]}`;
      }

      // If already formatted with query param
      if (rawLink.startsWith('/student/submissions')) {
        return rawLink;
      }

      // Catalog or attempt
      if (rawLink.startsWith('/student/catalog') || rawLink.startsWith('/student/attempt/')) {
        return rawLink;
      }

      // Profile
      if (rawLink.startsWith('/student/profile')) {
        return rawLink;
      }

      // If link is /auth/login (account verified/approved), student is already logged in
      if (rawLink === '/auth/login' || rawLink.startsWith('/auth/')) {
        return '/student/dashboard';
      }

      // Valid student path
      if (rawLink.startsWith('/student/')) {
        return rawLink;
      }
    }

    // Evaluation or Grade notifications
    if (title.includes('grade') || title.includes('evaluated') || title.includes('feedback') || type === 'grade') {
      return '/student/submissions';
    }

    // Assessment availability
    if (title.includes('assessment') || title.includes('exam') || type === 'assessment') {
      return '/student/catalog';
    }

    // Safe Student default fallback
    return '/student/dashboard';
  }

  // =========================================================================
  // 4. UNAUTHENTICATED OR UNKNOWN ROLE
  // =========================================================================
  if (rawLink && rawLink.startsWith('/')) {
    return rawLink;
  }
  return '/auth/login';
};
