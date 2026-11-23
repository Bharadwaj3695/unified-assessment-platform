const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');

/**
 * Pure function to validate a question data object according to technical architecture rules
 */
function validateQuestionObject(data, { isPublishing = false } = {}) {
  const errors = [];
  const warnings = [];

  const statement = (data.statement || data.questionText || '').trim();
  if (!statement) {
    errors.push('Question statement is required.');
  } else if (statement.length < 5) {
    errors.push('Question statement must be at least 5 characters long.');
  }

  const validTypes = [
    'SINGLE_MCQ',
    'MULTI_SELECT',
    'TRUE_FALSE',
    'FILL_BLANK',
    'SHORT_ANSWER',
    'DESCRIPTIVE',
    'CODING',
    'SQL',
    'FILE_UPLOAD',
  ];

  const qType = data.questionType || (data.type ? data.type.toUpperCase() : 'SINGLE_MCQ');
  const normalizedType =
    qType === 'MCQ'
      ? 'SINGLE_MCQ'
      : qType === 'CODE'
      ? 'CODING'
      : qType === 'SHORT_ANSWER'
      ? 'SHORT_ANSWER'
      : qType === 'LONG_ANSWER'
      ? 'DESCRIPTIVE'
      : qType;

  if (!validTypes.includes(normalizedType)) {
    errors.push(`Invalid question type: ${data.questionType || data.type}`);
  }

  const marks = data.marks !== undefined ? Number(data.marks) : Number(data.points || 1);
  if (isNaN(marks) || marks <= 0) {
    errors.push('Question marks must be a positive number greater than 0.');
  }

  if (isPublishing) {
    const hasSubject = Boolean(
      (data.subject && typeof data.subject === 'string' && data.subject.trim()) ||
      (data.subjectId && (mongoose.isValidObjectId(data.subjectId) || (typeof data.subjectId === 'string' && data.subjectId.trim())))
    );
    if (!hasSubject) {
      errors.push('Subject mapping (subjectId or subject) is mandatory for published questions.');
    }
    const hasTopics = Boolean(
      (Array.isArray(data.topics) && data.topics.length > 0) ||
      (Array.isArray(data.topicIds) && data.topicIds.length > 0)
    );
    if (!hasTopics) {
      warnings.push('Topic mapping is optional but recommended before publishing.');
    }
    if (!Array.isArray(data.conceptTags) || data.conceptTags.length === 0) {
      warnings.push('Concept mapping (conceptTags) is strongly recommended for curriculum analytics.');
    }
  }

  // Type-specific validations
  if (normalizedType === 'SINGLE_MCQ') {
    const options = Array.isArray(data.options) ? data.options : [];
    if (options.length < 2) {
      errors.push('SINGLE_MCQ must have at least 2 choice options.');
    }
    const hasEmptyOption = options.some((opt) => !opt.text || !opt.text.trim());
    if (hasEmptyOption) {
      errors.push('All options must have non-empty text.');
    }

    const correctOptions = options.filter((opt) => opt.isCorrect === true);
    const hasAnswerKey = Boolean(data.answerKey || data.correctAnswer);
    if (isPublishing && correctOptions.length !== 1 && !hasAnswerKey) {
      errors.push('SINGLE_MCQ must have exactly one correct option configured.');
    }
  } else if (normalizedType === 'MULTI_SELECT') {
    const options = Array.isArray(data.options) ? data.options : [];
    if (options.length < 2) {
      errors.push('MULTI_SELECT must have at least 2 choice options.');
    }
    const correctOptions = options.filter((opt) => opt.isCorrect === true);
    const hasAnswerKey = Array.isArray(data.answerKey) && data.answerKey.length > 0;
    if (isPublishing && correctOptions.length < 1 && !hasAnswerKey) {
      errors.push('MULTI_SELECT must have at least one correct option configured.');
    }
  } else if (normalizedType === 'TRUE_FALSE') {
    const hasKey =
      data.answerKey !== undefined &&
      data.answerKey !== null &&
      (typeof data.answerKey === 'boolean' ||
        data.answerKey === 'true' ||
        data.answerKey === 'false' ||
        data.answerKey === 'True' ||
        data.answerKey === 'False');
    if (isPublishing && !hasKey && !data.correctAnswer) {
      errors.push('TRUE_FALSE question requires a valid True/False answerKey.');
    }
  } else if (normalizedType === 'FILL_BLANK') {
    const hasAnswer =
      (typeof data.answerKey === 'string' && data.answerKey.trim().length > 0) ||
      (Array.isArray(data.answerKey) && data.answerKey.length > 0) ||
      Boolean(data.correctAnswer);
    if (isPublishing && !hasAnswer) {
      errors.push('FILL_BLANK question requires at least one acceptable answer string in answerKey.');
    }
  } else if (normalizedType === 'SHORT_ANSWER') {
    if (isPublishing && !data.answerKey && !data.correctAnswer && !data.explanation) {
      warnings.push('SHORT_ANSWER questions should include a sample answer or keywords.');
    }
  } else if (normalizedType === 'DESCRIPTIVE') {
    const config = data.evaluationConfig || {};
    if (isPublishing && (!config.rubric || !Array.isArray(config.rubric) || config.rubric.length === 0)) {
      warnings.push('DESCRIPTIVE questions benefit from configuring a structured scoring rubric.');
    }
  } else if (normalizedType === 'CODING') {
    const config = data.evaluationConfig || data.codingConfig || {};
    const testCases = Array.isArray(config.testCases) ? config.testCases : [];
    if (isPublishing) {
      if (testCases.length === 0) {
        errors.push('CODING question must have at least one test case configured.');
      } else {
        const hasPublic = testCases.some((tc) => !tc.isHidden);
        const hasHidden = testCases.some((tc) => tc.isHidden);
        if (!hasPublic) {
          warnings.push('CODING question should include at least one public sample test case.');
        }
        if (!hasHidden) {
          warnings.push('CODING question should include hidden test cases for secure automated scoring.');
        }
      }
    }
  } else if (normalizedType === 'SQL') {
    const config = data.evaluationConfig || data.codingConfig || {};
    if (isPublishing && !config.schemaDdl && !config.starterCode) {
      warnings.push('SQL question should supply schema DDL table definitions.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Express middleware for question creation validation
 */
const validateCreateQuestion = [
  check('statement')
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage('Statement must be at least 5 characters if provided.'),
  (req, res, next) => {
    const validationRes = validateQuestionObject(req.body, { isPublishing: false });
    if (!validationRes.valid) {
      return res.status(422).json({
        success: false,
        message: 'Question validation failed',
        errors: validationRes.errors,
        warnings: validationRes.warnings,
      });
    }
    req.validationWarnings = validationRes.warnings;
    next();
  },
];

module.exports = {
  validateQuestionObject,
  validateCreateQuestion,
};
