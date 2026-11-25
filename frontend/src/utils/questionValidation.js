/**
 * Pure question statement validation helpers for Test Creator Studio.
 * Uses stable question IDs so validation errors survive reordering and deletion.
 */

export function getQuestionStableId(question, fallbackIndex = 0) {
  if (question?.clientId) return String(question.clientId);
  if (question?._id) return String(question._id);
  if (question?.id) return String(question.id);
  return `q_idx_${fallbackIndex}`;
}

export function isQuestionStatementEmpty(question) {
  return !String(question?.statement ?? '').trim();
}

export function formatEmptyQuestionMessage(questionNumber) {
  return `Question ${questionNumber} is empty. Please enter the question statement.`;
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
