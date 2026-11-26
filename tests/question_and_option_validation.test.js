import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  formatEmptyOptionMessage,
  formatEmptyQuestionMessage,
  validateQuestion,
  validateQuestions,
} from '../frontend/src/utils/questionValidation.js';

const require = createRequire(import.meta.url);
const assessmentService = require('../backend/src/services/assessment.service.js');
const { validateQuestionObject } = require('../backend/src/validators/question.validator.js');

const makeValidMcq = (id, statement = 'Valid question?') => ({
  clientId: id,
  questionType: 'SINGLE_MCQ',
  statement,
  options: [
    { id: 'opt_1', text: 'Alpha', isCorrect: true },
    { id: 'opt_2', text: 'Beta', isCorrect: false },
    { id: 'opt_3', text: 'Gamma', isCorrect: false },
    { id: 'opt_4', text: 'Delta', isCorrect: false },
  ],
  answerKey: 'opt_1',
});

test('Extended Question & Answer Option Validation Utility', async (t) => {
  await t.test('1. Empty question statement flags statement error and summary item', () => {
    const q = makeValidMcq('q1', '   ');
    const result = validateQuestions([q]);

    assert.equal(result.valid, false);
    assert.equal(result.firstInvalidId, 'q1');
    assert.equal(result.summaryHeader, 'Question 1 has incomplete fields.');
    assert.equal(result.errorsById.q1.statementError, formatEmptyQuestionMessage(1));
    assert.deepEqual(
      result.summaryItems.map((i) => i.message),
      ['Question 1: Question statement is empty.']
    );
  });

  await t.test('2 & 3. Multiple empty MCQ options in Question 2 display exact Option B & D messages', () => {
    const q1 = makeValidMcq('q1', 'Question 1 statement');
    const q2 = {
      clientId: 'q2',
      questionType: 'SINGLE_MCQ',
      statement: 'Question 2 statement',
      options: [
        { id: 'opt_1', text: 'Filled A', isCorrect: true },
        { id: 'opt_2', text: '   ', isCorrect: false },
        { id: 'opt_3', text: 'Filled C', isCorrect: false },
        { id: 'opt_4', text: '', isCorrect: false },
      ],
    };

    const result = validateQuestions([q1, q2]);
    assert.equal(result.valid, false);
    assert.equal(result.firstInvalidId, 'q2');
    assert.equal(result.summaryHeader, 'Question 2 has incomplete fields.');
    assert.equal(result.errorsById.q2.optionErrors[1], formatEmptyOptionMessage(1));
    assert.equal(result.errorsById.q2.optionErrors[1], 'Option B is empty. Please enter the answer option.');
    assert.equal(result.errorsById.q2.optionErrors[3], 'Option D is empty. Please enter the answer option.');
    assert.equal(result.errorsById.q2.optionErrors[0], undefined);
    assert.equal(result.errorsById.q2.optionErrors[2], undefined);
    assert.deepEqual(
      result.summaryItems.map((i) => i.message),
      ['Question 2: Option B is empty.', 'Question 2: Option D is empty.']
    );
  });

  await t.test('4. Empty option in Question 3 of a five-question test identifies Question 3', () => {
    const questions = [
      makeValidMcq('q1', 'Q1?'),
      makeValidMcq('q2', 'Q2?'),
      {
        ...makeValidMcq('q3', 'Q3?'),
        options: [
          { id: 'opt_1', text: 'A', isCorrect: true },
          { id: 'opt_2', text: '\t  ', isCorrect: false },
        ],
      },
      makeValidMcq('q4', 'Q4?'),
      makeValidMcq('q5', 'Q5?'),
    ];

    const result = validateQuestions(questions);
    assert.equal(result.valid, false);
    assert.equal(result.firstInvalidId, 'q3');
    assert.equal(result.summaryHeader, 'Question 3 has incomplete fields.');
    assert.deepEqual(
      result.summaryItems.map((i) => i.message),
      ['Question 3: Option B is empty.']
    );
  });

  await t.test('5. Missing correct answer selection is flagged for SINGLE_MCQ and MULTI_SELECT', () => {
    const singleNoKey = {
      clientId: 's1',
      questionType: 'SINGLE_MCQ',
      statement: 'Pick one',
      options: [
        { id: 'opt_1', text: 'Yes', isCorrect: false },
        { id: 'opt_2', text: 'No', isCorrect: false },
      ],
    };
    const multiNoKey = {
      clientId: 'm1',
      questionType: 'MULTI_SELECT',
      statement: 'Pick many',
      options: [
        { id: 'opt_1', text: 'One', isCorrect: false },
        { id: 'opt_2', text: 'Two', isCorrect: false },
      ],
    };

    const res1 = validateQuestions([singleNoKey]);
    assert.equal(res1.valid, false);
    assert.equal(res1.errorsById.s1.correctAnswerError, 'Please select a correct answer.');

    const res2 = validateQuestions([multiNoKey]);
    assert.equal(res2.valid, false);
    assert.equal(res2.errorsById.m1.correctAnswerError, 'Please select at least one correct answer.');
  });

  await t.test('6. Intentionally removed options are not required while minimum 2 options rule is enforced', () => {
    const twoValidOpts = {
      clientId: 'q_two',
      questionType: 'SINGLE_MCQ',
      statement: 'Two options remaining',
      options: [
        { id: 'opt_1', text: 'True-ish', isCorrect: true },
        { id: 'opt_3', text: 'False-ish', isCorrect: false },
      ],
    };
    assert.equal(validateQuestions([twoValidOpts]).valid, true);

    const oneOptOnly = {
      clientId: 'q_one',
      questionType: 'SINGLE_MCQ',
      statement: 'Too few options',
      options: [{ id: 'opt_1', text: 'Only one', isCorrect: true }],
    };
    const res = validateQuestions([oneOptOnly]);
    assert.equal(res.valid, false);
    assert.match(res.errorsById.q_one.configErrors[0], /at least 2 options/i);
  });

  await t.test('7. Coding, SQL, Descriptive, Short Answer, Fill Blank do not run MCQ option validation', () => {
    const emptyOptions = [
      { id: 'opt_1', text: '', isCorrect: false },
      { id: 'opt_2', text: '', isCorrect: false },
    ];

    const codingValid = {
      clientId: 'c1',
      questionType: 'CODING',
      statement: 'Sum two integers',
      options: emptyOptions,
      evaluationConfig: {
        allowedLanguages: ['python'],
        testCases: [{ input: '1 2', expectedOutput: '3', isEnabled: true }],
      },
    };
    const sqlValid = {
      clientId: 'sql1',
      questionType: 'SQL',
      statement: 'Select all users',
      options: emptyOptions,
      evaluationConfig: {
        allowedLanguages: ['sqlite'],
        testCases: [{ input: '', expectedOutput: 'Alice', isEnabled: true }],
      },
    };
    const descriptiveValid = {
      clientId: 'd1',
      questionType: 'DESCRIPTIVE',
      statement: 'Discuss CAP theorem.',
      options: emptyOptions,
      evaluationConfig: { rubric: [] },
    };

    const result = validateQuestions([codingValid, sqlValid, descriptiveValid]);
    assert.equal(result.valid, true);

    // Coding without test cases fails coding validation (not option validation)
    const codingInvalid = {
      clientId: 'c2',
      questionType: 'CODING',
      statement: 'Write merge sort',
      options: emptyOptions,
      evaluationConfig: {
        allowedLanguages: ['python'],
        testCases: [],
      },
    };
    const codingRes = validateQuestion(codingInvalid, 0);
    assert.equal(codingRes.valid, false);
    assert.deepEqual(codingRes.optionErrors, {});
    assert.match(codingRes.configErrors[0], /at least one enabled test case/i);
  });
});

test('Backend MCQ Option & Correct Answer Validation', async (t) => {
  await t.test('AssessmentService validateQuestionForPublish rejects empty MCQ option and missing correct answer', () => {
    assert.throws(
      () =>
        assessmentService.validateQuestionForPublish(
          {
            questionText: 'Valid question?',
            type: 'mcq',
            options: [
              { id: 'opt_1', text: 'A', isCorrect: true },
              { id: 'opt_2', text: '   ', isCorrect: false },
            ],
          },
          1
        ),
      (err) =>
        err.statusCode === 400 &&
        err.message === 'Question 2: Option B is empty. Please enter the answer option.'
    );

    assert.throws(
      () =>
        assessmentService.validateQuestionForPublish(
          {
            questionText: 'Valid question?',
            type: 'mcq',
            options: [
              { id: 'opt_1', text: 'A', isCorrect: false },
              { id: 'opt_2', text: 'B', isCorrect: false },
            ],
          },
          0
        ),
      (err) =>
        err.statusCode === 400 &&
        /correct answer/i.test(err.message)
    );
  });

  await t.test('validateQuestionObject rejects empty option text for MULTI_SELECT', () => {
    const res = validateQuestionObject({
      statement: 'Select prime numbers',
      questionType: 'MULTI_SELECT',
      marks: 2,
      options: [
        { id: 'opt_1', text: '2', isCorrect: true },
        { id: 'opt_2', text: '  ', isCorrect: false },
      ],
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.includes('All options must have non-empty text.'));
  });
});
