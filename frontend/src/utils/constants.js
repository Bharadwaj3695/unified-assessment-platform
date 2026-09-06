export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
};
