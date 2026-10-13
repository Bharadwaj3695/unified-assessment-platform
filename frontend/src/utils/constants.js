export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';

export const ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
};

// Mandatory question types required by specification
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  SHORT_ANSWER: 'short_answer',
  LONG_ANSWER: 'long_answer',
  TRUE_FALSE: 'true_false',
  CODE: 'code',
};

export const QUESTION_TYPE_LABELS = {
  [QUESTION_TYPES.MCQ]: 'Multiple Choice (MCQ)',
  [QUESTION_TYPES.SHORT_ANSWER]: 'Short Answer',
  [QUESTION_TYPES.LONG_ANSWER]: 'Long Answer',
  [QUESTION_TYPES.TRUE_FALSE]: 'True / False',
  [QUESTION_TYPES.CODE]: 'Code Implementation',
};

export const ASSESSMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

export const SUBMISSION_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EVALUATED: 'evaluated',
};

export const STORAGE_KEYS = {
  TOKEN: 'uap_access_token',
  REFRESH_TOKEN: 'uap_refresh_token',
  USER: 'uap_user',
  THEME: 'uap_theme',
  ADMIN_SIDEBAR_COLLAPSED: 'uap_admin_sidebar_collapsed',
  STUDENT_SIDEBAR_COLLAPSED: 'uap_student_sidebar_collapsed',
  INSTRUCTOR_SIDEBAR_COLLAPSED: 'uap_instructor_sidebar_collapsed',
};

// Designated minimum presentation duration (2500ms = ~2.5 seconds) for initial application-entry and post-login branded transitions
export const BRANDED_TRANSITION_MIN_DURATION_MS =
  typeof window !== 'undefined' && window.__UAP_TRANSITION_MIN_DURATION_MS !== undefined
    ? Number(window.__UAP_TRANSITION_MIN_DURATION_MS)
    : 2500;


