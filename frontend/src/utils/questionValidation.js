/**
 * Pure question statement, option, and type-specific validation helpers
 * for Test Creator Studio and Mock Bank Studio.
 * Uses stable question IDs so validation errors survive reordering and deletion.
 */

export function getQuestionStableId(question, fallbackIndex = 0) {
  if (question?.clientId) return String(question.clientId);
  if (question?._id) return String(question._id);
  if (question?.id) return String(question.id);
  return `q_idx_${fallbackIndex}`;
}

export function normalizeQuestionType(question) {
  const raw = String(question?.questionType || question?.type || 'SINGLE_MCQ').trim().toUpperCase();
  if (raw === 'MCQ') return 'SINGLE_MCQ';
  if (raw === 'CODE') return 'CODING';
  if (raw === 'LONG_ANSWER') return 'DESCRIPTIVE';
  return raw;
}

export function getOptionLetter(optionIndex = 0) {
  return String.fromCharCode(65 + optionIndex);
}

export function isQuestionStatementEmpty(question) {
  return !String(question?.statement ?? question?.questionText ?? '').trim();
}

export function formatEmptyQuestionMessage(questionNumber) {
  return `Question ${questionNumber} is empty. Please enter the question statement.`;
}

export function formatEmptyOptionMessage(optionIndex) {
  const letter = getOptionLetter(optionIndex);
  return `Option ${letter} is empty. Please enter the answer option.`;
}

export function validateQuestionStatements(questions = []) {
  const list = Array.isArray(questions) ? questions : [];
  const errors = [];
  const errorsById = {};

  list.forEach((question, idx) => {
    if (isQuestionStatementEmpty(question)) {
      const id = getQuestionStableId(question, idx);
      const number = idx + 1;
      const message = formatEmptyQuestionMessage(number);
      errors.push({ id, number, message });
      errorsById[id] = message;
    }
  });

  let summaryMessage = '';
  if (errors.length === 1) {
    summaryMessage = errors[0].message;
  } else if (errors.length > 1) {
    const nums = errors.map((e) => `Q${e.number}`).join(', ');
    summaryMessage = `Questions ${nums} are empty. Please enter the question statement.`;
  }

  return {
    valid: errors.length === 0,
    errors,
    errorsById,
    firstInvalidId: errors[0]?.id || null,
    summaryMessage,
  };
}

/**
 * Validate an individual question according to its question type.
 * Only validates fields required by that question type (never optional fields).
 */
export function validateQuestion(question, index = 0, config = {}) {
  const {
    minStatementLength = 0,
    isPublishing = false,
    requireSubjectOnPublish = false,
    requirePositiveMarks = false,
  } = config;

  const id = getQuestionStableId(question, index);
  const number = index + 1;
  const qType = normalizeQuestionType(question);
  const statementText = String(question?.statement ?? question?.questionText ?? '').trim();

  let statementError = null;
  const optionErrors = {};
  const optionErrorsById = {};
  let correctAnswerError = null;
  const configErrors = [];
  const fieldErrors = [];

  if (!statementText) {
    statementError = formatEmptyQuestionMessage(number);
    fieldErrors.push({
      field: 'statement',
      inlineMessage: statementError,
      summaryMessage: `Question ${number}: Question statement is empty.`,
    });
  } else if (minStatementLength > 0 && statementText.length < minStatementLength) {
    statementError = `Question statement must be at least ${minStatementLength} characters long.`;
    fieldErrors.push({
      field: 'statement',
      inlineMessage: statementError,
      summaryMessage: `Question ${number}: ${statementError}`,
    });
  }

  if (requirePositiveMarks) {
    const marks = Number(question?.marks);
    if (Number.isNaN(marks) || marks <= 0) {
      const msg = 'Marks must be greater than 0.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'marks',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: ${msg}`,
      });
    }
  }

  if (requireSubjectOnPublish && isPublishing) {
    const hasSubject = Boolean(
      (question?.subject && String(question.subject).trim()) || question?.subjectId
    );
    if (!hasSubject) {
      const msg = 'Subject must be entered before publishing.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'subject',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: ${msg}`,
      });
    }
  }

  // Type-specific validation
  if (qType === 'SINGLE_MCQ' || qType === 'MULTI_SELECT') {
    const options = Array.isArray(question?.options) ? question.options : [];
    if (options.length < 2) {
      const msg =
        qType === 'SINGLE_MCQ'
          ? 'Multiple-choice questions require at least 2 options.'
          : 'Multiple-select questions require at least 2 options.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'optionsCount',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: At least 2 answer options are required.`,
      });
    }

    options.forEach((opt, optIdx) => {
      const optText = String(opt?.text ?? '').trim();
      if (!optText) {
        const letter = getOptionLetter(optIdx);
        const inlineMessage = formatEmptyOptionMessage(optIdx);
        optionErrors[optIdx] = inlineMessage;
        if (opt?.id) {
          optionErrorsById[opt.id] = inlineMessage;
        }
        fieldErrors.push({
          field: 'option',
          optionIndex: optIdx,
          optionLetter: letter,
          inlineMessage,
          summaryMessage: `Question ${number}: Option ${letter} is empty.`,
        });
      }
    });

    const correctOptions = options.filter((opt) => Boolean(opt?.isCorrect));
    if (qType === 'SINGLE_MCQ') {
      if (correctOptions.length === 0) {
        correctAnswerError = 'Please select a correct answer.';
        fieldErrors.push({
          field: 'correctAnswer',
          inlineMessage: correctAnswerError,
          summaryMessage: `Question ${number}: No correct answer selected.`,
        });
      } else if (correctOptions.length > 1) {
        correctAnswerError = 'Single Choice (MCQ) must have exactly one correct answer selected.';
        fieldErrors.push({
          field: 'correctAnswer',
          inlineMessage: correctAnswerError,
          summaryMessage: `Question ${number}: Multiple correct answers selected for single-choice question.`,
        });
      }
    } else if (correctOptions.length < 1) {
      correctAnswerError = 'Please select at least one correct answer.';
      fieldErrors.push({
        field: 'correctAnswer',
        inlineMessage: correctAnswerError,
        summaryMessage: `Question ${number}: No correct answer selected.`,
      });
    }
  } else if (qType === 'TRUE_FALSE') {
    const options = Array.isArray(question?.options) ? question.options : [];
    const hasOptionCorrect = options.some((opt) => Boolean(opt?.isCorrect));
    const rawKey = question?.answerKey ?? question?.correctAnswer;
    const validKeys = new Set(['True', 'False', 'true', 'false', 'opt_true', 'opt_false']);
    const hasValidKey = typeof rawKey === 'boolean' || validKeys.has(String(rawKey));
    if (!hasValidKey && !hasOptionCorrect) {
      correctAnswerError = 'Please select True or False as the correct answer.';
      fieldErrors.push({
        field: 'correctAnswer',
        inlineMessage: correctAnswerError,
        summaryMessage: `Question ${number}: No correct answer selected.`,
      });
    }
  } else if (qType === 'CODING' || qType === 'SQL') {
    const cfg = question?.evaluationConfig || question?.codingConfig || {};
    const testCases = Array.isArray(cfg.testCases) ? cfg.testCases : [];
    const enabledCases = testCases.filter((tc) => tc && tc.isEnabled !== false);
    const isSql = qType === 'SQL' || cfg.executionCategory === 'sql';

    if (enabledCases.length === 0) {
      const msg =
        qType === 'SQL'
          ? 'SQL question must have at least one enabled test case.'
          : 'Coding question must have at least one enabled test case.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'testCases',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: ${msg}`,
      });
    } else {
      enabledCases.forEach((tc, tcIdx) => {
        const hasExpected =
          Boolean(tc?.expectedOutput && String(tc.expectedOutput).trim()) ||
          (isSql && ((tc?.expectedColumns?.length || 0) > 0 || (tc?.expectedRows?.length || 0) > 0));
        if (!hasExpected) {
          const msg = `Test case ${tcIdx + 1} is missing expected output.`;
          configErrors.push(msg);
          fieldErrors.push({
            field: 'testCases',
            inlineMessage: msg,
            summaryMessage: `Question ${number}: ${msg}`,
          });
        }
      });
    }

    const allowedLangs = Array.isArray(cfg.allowedLanguages) ? cfg.allowedLanguages : [];
    if (allowedLangs.length === 0) {
      const msg =
        qType === 'SQL'
          ? 'SQL question must enable at least one supported dialect.'
          : 'Coding question must enable at least one supported language.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'languages',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: ${msg}`,
      });
    }
  } else if (qType === 'FILE_UPLOAD') {
    const allowed = question?.evaluationConfig?.fileUploadConfig?.allowedFileTypes || [];
    if (allowed.length === 0) {
      const msg = 'Please select at least one allowed file type extension.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'fileTypes',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: ${msg}`,
      });
    }
  } else if (qType === 'FILL_BLANK' && isPublishing) {
    const hasAnswer =
      (typeof question?.answerKey === 'string' && question.answerKey.trim().length > 0) ||
      (Array.isArray(question?.evaluationConfig?.acceptedAnswers) &&
        question.evaluationConfig.acceptedAnswers.length > 0);
    if (!hasAnswer) {
      const msg = 'Please provide at least one accepted answer string.';
      configErrors.push(msg);
      fieldErrors.push({
        field: 'answerKey',
        inlineMessage: msg,
        summaryMessage: `Question ${number}: ${msg}`,
      });
    }
  }

  const firstEmptyOptionIdx = Object.keys(optionErrors).length > 0
    ? Number(Object.keys(optionErrors)[0])
    : null;

  return {
    id,
    number,
    questionType: qType,
    valid: fieldErrors.length === 0,
    statementError,
    optionErrors,
    optionErrorsById,
    correctAnswerError,
    configErrors,
    fieldErrors,
    firstEmptyOptionIdx,
    headerMessage: `Question ${number} has incomplete fields.`,
  };
}

/**
 * Validate an array of questions and produce per-question details plus summary metadata.
 */
export function validateQuestions(questions = [], config = {}) {
  const list = Array.isArray(questions) ? questions : [];
  const questionResults = list.map((q, idx) => validateQuestion(q, idx, config));
  const invalidQuestions = questionResults.filter((r) => !r.valid);

  const errorsById = {};
  invalidQuestions.forEach((res) => {
    errorsById[res.id] = res;
  });

  const summaryItems = [];
  invalidQuestions.forEach((res) => {
    res.fieldErrors.forEach((fe) => {
      summaryItems.push({
        id: res.id,
        number: res.number,
        field: fe.field,
        optionIndex: fe.optionIndex,
        message: fe.summaryMessage,
      });
    });
  });

  let summaryHeader = '';
  let summaryMessage = '';
  if (invalidQuestions.length === 1) {
    summaryHeader = invalidQuestions[0].headerMessage;
    summaryMessage =
      invalidQuestions[0].fieldErrors.length === 1 && invalidQuestions[0].statementError
        ? invalidQuestions[0].statementError
        : summaryHeader;
  } else if (invalidQuestions.length > 1) {
    summaryHeader = `${invalidQuestions.length} questions have incomplete fields.`;
    const nums = invalidQuestions.map((q) => `Q${q.number}`).join(', ');
    summaryMessage = `Questions ${nums} have incomplete fields.`;
  }

  return {
    valid: invalidQuestions.length === 0,
    questionResults,
    invalidQuestions,
    errorsById,
    firstInvalidId: invalidQuestions[0]?.id || null,
    summaryHeader,
    summaryItems,
    summaryMessage,
  };
}
