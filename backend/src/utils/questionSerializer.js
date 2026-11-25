/**
 * Question Serialization & Security Protection Layer
 * Enforces strict separation between student and faculty responses.
 */

/**
 * Serialize question for faculty/admin: preserves full answerKey, explanation, and test cases.
 */
function serializeQuestionForFaculty(question) {
  if (!question) return null;
  const raw = typeof question.toObject === 'function' ? question.toObject() : { ...question };
  raw.id = raw._id ? raw._id.toString() : raw.id;
  return raw;
}

/**
 * Serialize question for student: strictly protects answer keys, isCorrect flags, and hidden test cases.
 */
function serializeQuestionForStudent(question, { showExplanation = false } = {}) {
  if (!question) return null;
  const raw = typeof question.toObject === 'function' ? question.toObject() : { ...question };

  // Always strip authoritative answer key
  delete raw.answerKey;
  delete raw.correctAnswer;

  // Protect multiple choice options: strip isCorrect
  if (Array.isArray(raw.options)) {
    raw.options = raw.options.map((opt) => {
      const sanitized = { ...opt };
      delete sanitized.isCorrect;
      if (!showExplanation) {
        delete sanitized.explanation;
      }
      return sanitized;
    });
  }

  // Protect explanation unless permitted
  if (!showExplanation) {
    delete raw.explanation;
  }

  // Protect test cases in evaluationConfig / codingConfig: remove all isHidden test cases
  if (raw.evaluationConfig && Array.isArray(raw.evaluationConfig.testCases)) {
    raw.evaluationConfig = {
      ...raw.evaluationConfig,
      testCases: raw.evaluationConfig.testCases
        .filter((tc) => !tc.isHidden)
        .map((tc) => ({
          id: tc._id || tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          expectedColumns: tc.expectedColumns || [],
          expectedRows: tc.expectedRows || [],
          weight: tc.weight,
          description: tc.description,
          explanation: showExplanation ? tc.explanation : undefined,
          isHidden: false,
        })),
    };
  }

  if (raw.codingConfig && Array.isArray(raw.codingConfig.testCases)) {
    raw.codingConfig = {
      ...raw.codingConfig,
      testCases: raw.codingConfig.testCases
        .filter((tc) => !tc.isHidden)
        .map((tc) => ({
          id: tc._id || tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          expectedColumns: tc.expectedColumns || [],
          expectedRows: tc.expectedRows || [],
          weight: tc.weight,
          description: tc.description,
          explanation: showExplanation ? tc.explanation : undefined,
          isHidden: false,
        })),
    };
  }

  raw.id = raw._id ? raw._id.toString() : raw.id;
  return raw;
}

module.exports = {
  serializeQuestionForFaculty,
  serializeQuestionForStudent,
};
