import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  getQuestionStableId,
  isQuestionStatementEmpty,
  formatEmptyQuestionMessage,
  validateQuestionStatements,
} from '../frontend/src/utils/questionValidation.js';

const require = createRequire(import.meta.url);
const assessmentService = require('../backend/src/services/assessment.service.js');

test('Question Statement Validation Utility', async (t) => {
  await t.test('flags empty and whitespace-only statements and identifies exact 1-based number', () => {
    const questions = [
      { clientId: 'q_1', statement: 'What is TCP?' },
      { clientId: 'q_2', statement: 'Explain DNS.' },
      { clientId: 'q_3', statement: '   \n\t  ' },
      { clientId: 'q_4', statement: 'What is HTTP?' },
      { clientId: 'q_5', statement: 'Define TLS.' },
    ];

    const result = validateQuestionStatements(questions);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.firstInvalidId, 'q_3');
    assert.deepEqual(result.errors[0], {
      id: 'q_3',
      number: 3,
      message: 'Question 3 is empty. Please enter the question statement.',
    });
    assert.equal(
      result.errorsById.q_3,
      'Question 3 is empty. Please enter the question statement.'
    );
    assert.equal(
      result.summaryMessage,
      'Question 3 is empty. Please enter the question statement.'
    );
  });

  await t.test('lists multiple empty questions in order and points firstInvalidId to earliest', () => {
    const questions = [
      { clientId: 'id_a', statement: 'Valid 1' },
      { clientId: 'id_b', statement: '' },
      { clientId: 'id_c', statement: 'Valid 3' },
      { clientId: 'id_d', statement: '   ' },
    ];

    const result = validateQuestionStatements(questions);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 2);
    assert.equal(result.firstInvalidId, 'id_b');
    assert.equal(result.errors[0].message, 'Question 2 is empty. Please enter the question statement.');
    assert.equal(result.errors[1].message, 'Question 4 is empty. Please enter the question statement.');
    assert.equal(
      result.summaryMessage,
      'Questions Q2, Q4 are empty. Please enter the question statement.'
    );
  });

  await t.test('uses stable IDs across reordering and deletion', () => {
    const q1 = { clientId: 'stable_1', statement: 'Q1' };
    const q2 = { clientId: 'stable_2', statement: 'Q2' };
    const q3 = { clientId: 'stable_3', statement: '' };

    const initial = validateQuestionStatements([q1, q2, q3]);
    assert.equal(initial.firstInvalidId, 'stable_3');
    assert.equal(initial.errorsById.stable_3, formatEmptyQuestionMessage(3));

    // Move q3 to first position
    const reordered = validateQuestionStatements([q3, q1, q2]);
    assert.equal(reordered.firstInvalidId, 'stable_3');
    assert.equal(reordered.errorsById.stable_3, formatEmptyQuestionMessage(1));
    assert.equal(getQuestionStableId({ _id: 'mongo_123' }, 0), 'mongo_123');
    assert.equal(isQuestionStatementEmpty({ statement: 'ok' }), false);
    assert.equal(isQuestionStatementEmpty({ statement: '  ' }), true);
  });

  await t.test('passes when all question statements contain non-whitespace characters', () => {
    const questions = [
      { clientId: 'q_1', statement: 'Question one' },
      { clientId: 'q_2', statement: 'Question two' },
    ];
    const result = validateQuestionStatements(questions);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.firstInvalidId, null);
  });
});

test('Backend AssessmentService publish statement validation', async (t) => {
  await t.test('throws exact error message when Question 3 is empty on publish', () => {
    const questions = [
      { questionText: 'Q1 text' },
      { questionText: 'Q2 text' },
      { questionText: '   ' },
      { questionText: 'Q4 text' },
      { questionText: 'Q5 text' },
    ];

    assert.throws(
      () => assessmentService.validateQuestionStatementsForPublish(questions),
      (err) =>
        err.statusCode === 400 &&
        err.message === 'Question 3 is empty. Please enter the question statement.'
    );
  });

  await t.test('lists multiple empty questions on publish', () => {
    const questions = [
      { questionText: '' },
      { questionText: 'Q2 text' },
      { questionText: '\t' },
    ];

    assert.throws(
      () => assessmentService.validateQuestionStatementsForPublish(questions),
      (err) =>
        err.statusCode === 400 &&
        err.message === 'Questions Q1, Q3 are empty. Please enter the question statement.'
    );
  });
});
