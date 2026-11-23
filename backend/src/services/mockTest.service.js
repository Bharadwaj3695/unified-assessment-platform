const { MockTest, MockTestAttempt, Question, QuestionVersion, Subject, Topic, AuditLog } = require('../models');
const { serializeQuestionForStudent, serializeQuestionForFaculty } = require('../utils/questionSerializer');
const executionClient = require('./executionClient.service');
const storageService = require('./storage.service');

function parseBooleanToken(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1 ? true : val === 0 ? false : null;
  if (typeof val !== 'string') return null;
  const s = val.trim().toLowerCase();
  if (['true', 't', 'yes', '1'].includes(s)) return true;
  if (['false', 'f', 'no', '0'].includes(s)) return false;
  return null;
}

function normalizeTextAnswer(str, caseSensitive = false, exactMatch = false) {
  if (str === null || str === undefined) return '';
  let s = String(str).trim();
  if (!exactMatch) {
    s = s.replace(/\s+/g, ' ');
  }
  if (!caseSensitive) {
    s = s.toLowerCase();
  }
  return s;
}

class MockTestService {
  /**
   * Create a new Mock Test draft
   */
  async createMockTest(user, data) {
    const facultyId = user._id || user.id;

    const mockTest = await MockTest.create({
      title: data.title,
      description: data.description || '',
      examination: data.examination || 'GATE',
      subjectId: data.subjectId,
      topicIds: data.topicIds || [],
      durationMinutes: data.durationMinutes || 60,
      totalMarks: data.totalMarks || 100,
      questionCount: data.questionCount || 0,
      difficultyDistribution: data.difficultyDistribution || { easy: 30, medium: 50, hard: 20 },
      questionTypeDistribution: data.questionTypeDistribution || {},
      negativeMarking: Boolean(data.negativeMarking),
      negativeMarkingRatio: data.negativeMarkingRatio !== undefined ? Number(data.negativeMarkingRatio) : 0.33,
      availabilityWindow: data.availabilityWindow || {},
      attemptLimits: data.attemptLimits || 1,
      randomizationRules: data.randomizationRules || {},
      selectionMode: data.selectionMode || 'BLUEPRINT',
      blueprint: data.blueprint || { rules: [] },
      status: 'DRAFT',
      ownerFacultyId: facultyId,
    });

    await AuditLog.create({
      userId: facultyId,
      action: 'MOCK_TEST_CREATED',
      entityType: 'MockTest',
      entityId: mockTest._id.toString(),
      details: { title: mockTest.title, examination: mockTest.examination },
    });

    return mockTest;
  }

  /**
   * Get mock tests list
   */
  async getMockTests(query = {}, user) {
    const filter = {};
    if (user.role === 'student') {
      filter.status = 'PUBLISHED';
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.subjectId) {
      filter.subjectId = query.subjectId;
    }
    if (query.examination) {
      filter.examination = query.examination;
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    return MockTest.find(filter)
      .populate('subjectId', 'name code')
      .populate('ownerFacultyId', 'fullName email')
      .sort({ createdAt: -1 });
  }

  /**
   * Get mock test by ID
   */
  async getMockTestById(id, user) {
    const mockTest = await MockTest.findById(id)
      .populate('subjectId', 'name code')
      .populate('topicIds', 'name code')
      .populate('ownerFacultyId', 'fullName email');

    if (!mockTest) {
      const err = new Error('Mock test not found');
      err.statusCode = 404;
      throw err;
    }

    if (user.role === 'student') {
      if (mockTest.status !== 'PUBLISHED') {
        const err = new Error('Access denied. Test is not published.');
        err.statusCode = 403;
        throw err;
      }

      const sanitized = mockTest.toObject();
      sanitized.resolvedQuestions = sanitized.resolvedQuestions.map((rq) => ({
        ...rq,
        questionSnapshot: serializeQuestionForStudent(rq.questionSnapshot),
      }));
      return sanitized;
    }

    return mockTest;
  }

  /**
   * Generate question selection from Blueprint criteria
   */
  async generateFromBlueprint(id, user) {
    const mockTest = await MockTest.findById(id);
    if (!mockTest) {
      const err = new Error('Mock test not found');
      err.statusCode = 404;
      throw err;
    }

    // Must select only PUBLISHED questions
    const candidateQuery = {
      status: 'PUBLISHED',
      subjectId: mockTest.subjectId,
    };
    if (mockTest.topicIds?.length) {
      candidateQuery.topicIds = { $in: mockTest.topicIds };
    }

    const availableQuestions = await Question.find(candidateQuery).lean();

    if (availableQuestions.length === 0) {
      const err = new Error('No published questions found matching the subject and topics criteria.');
      err.statusCode = 422;
      throw err;
    }

    const selectedQuestionMap = new Map();

    // If explicit blueprint rules configured
    const rules = mockTest.blueprint?.rules || [];
    if (rules.length > 0) {
      for (const rule of rules) {
        let pool = availableQuestions.filter((q) => !selectedQuestionMap.has(q._id.toString()));
        if (rule.topicId) {
          pool = pool.filter((q) => q.topicIds?.some((tid) => tid.toString() === rule.topicId.toString()));
        }
        if (rule.difficulty && rule.difficulty !== 'ANY') {
          pool = pool.filter((q) => q.difficulty === rule.difficulty);
        }
        if (rule.questionType && rule.questionType !== 'ANY') {
          pool = pool.filter((q) => q.questionType === rule.questionType);
        }

        const countToTake = Math.min(pool.length, rule.count || 1);
        for (let i = 0; i < countToTake; i++) {
          const q = pool[i];
          selectedQuestionMap.set(q._id.toString(), {
            question: q,
            marks: rule.marksPerQuestion || q.marks || 1,
          });
        }
      }
    }

    // If more questions needed or default generation
    if (selectedQuestionMap.size === 0) {
      const targetCount = mockTest.questionCount || Math.min(availableQuestions.length, 10);
      for (let i = 0; i < Math.min(availableQuestions.length, targetCount); i++) {
        const q = availableQuestions[i];
        selectedQuestionMap.set(q._id.toString(), {
          question: q,
          marks: q.marks || 1,
        });
      }
    }

    // Resolve immutable snapshots
    const resolvedQuestions = [];
    let order = 0;
    let computedTotalMarks = 0;

    for (const [qId, item] of selectedQuestionMap.entries()) {
      const q = item.question;
      const latestVersionDoc = await QuestionVersion.findOne({
        questionId: q._id,
        versionNumber: q.currentVersion || 1,
      });

      const questionSnapshot = latestVersionDoc ? latestVersionDoc.questionSnapshot : q;
      const marks = item.marks || q.marks || 1;
      const negativeMarks = mockTest.negativeMarking
        ? marks * (mockTest.negativeMarkingRatio || 0.33)
        : q.negativeMarks || 0;

      resolvedQuestions.push({
        questionId: q._id,
        versionNumber: q.currentVersion || 1,
        questionSnapshot,
        marks,
        negativeMarks,
        orderIndex: order++,
      });

      computedTotalMarks += marks;
    }

    mockTest.resolvedQuestions = resolvedQuestions;
    mockTest.questionCount = resolvedQuestions.length;
    mockTest.totalMarks = computedTotalMarks;
    await mockTest.save();

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'MOCK_TEST_BLUEPRINT_GENERATED',
      entityType: 'MockTest',
      entityId: mockTest._id.toString(),
      details: { questionCount: resolvedQuestions.length, totalMarks: computedTotalMarks },
    });

    return mockTest;
  }

  /**
   * Publish Mock Test: locks the resolved questions into immutable snapshots
   */
  async publishMockTest(id, user) {
    const mockTest = await MockTest.findById(id);
    if (!mockTest) {
      const err = new Error('Mock test not found');
      err.statusCode = 404;
      throw err;
    }

    if (!mockTest.resolvedQuestions || mockTest.resolvedQuestions.length === 0) {
      // Auto-generate if empty
      await this.generateFromBlueprint(id, user);
    }

    mockTest.status = 'PUBLISHED';
    mockTest.publishedAt = new Date();
    await mockTest.save();

    // Mark usage in each question
    for (const rq of mockTest.resolvedQuestions) {
      await Question.findByIdAndUpdate(rq.questionId, {
        $inc: { historicalUsageCount: 1 },
        $push: {
          usedInTests: {
            testId: mockTest._id,
            testTitle: mockTest.title,
            versionUsed: rq.versionNumber,
            addedAt: new Date(),
          },
        },
      });
    }

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'MOCK_TEST_PUBLISHED',
      entityType: 'MockTest',
      entityId: mockTest._id.toString(),
      details: { questionCount: mockTest.resolvedQuestions.length },
    });

    return mockTest;
  }

  /**
   * Student starts an active attempt on a published Mock Test
   */
  async startAttempt(testId, studentUser) {
    const mockTest = await MockTest.findById(testId);
    if (!mockTest || mockTest.status !== 'PUBLISHED') {
      const err = new Error('Mock test is not available for attempts.');
      err.statusCode = 404;
      throw err;
    }

    const now = Date.now();

    // Check availability window
    if (mockTest.availabilityWindow?.startDate && new Date(mockTest.availabilityWindow.startDate).getTime() > now) {
      const err = new Error('This mock test is scheduled for a future date and is not yet open for attempts.');
      err.statusCode = 403;
      throw err;
    }

    if (mockTest.availabilityWindow?.endDate && new Date(mockTest.availabilityWindow.endDate).getTime() <= now) {
      const err = new Error('This mock test availability window has ended and is no longer open for attempts.');
      err.statusCode = 403;
      throw err;
    }

    const studentId = studentUser._id || studentUser.id;

    // Check active in-progress attempt if exists
    let attempt = await MockTestAttempt.findOne({
      mockTestId: testId,
      studentId,
      status: 'IN_PROGRESS',
    });

    if (attempt) {
      const durationMinutes = mockTest.durationMinutes || 60;
      const deadlineTime = attempt.deadlineAt
        ? new Date(attempt.deadlineAt).getTime()
        : new Date(attempt.startedAt).getTime() + durationMinutes * 60 * 1000;

      if (now > deadlineTime) {
        attempt.status = 'SUBMITTED';
        attempt.submittedReason = 'TIME_EXPIRED';
        attempt.submittedAt = new Date(deadlineTime);
        attempt.timeSpentSeconds = Math.max(
          0,
          Math.round((deadlineTime - new Date(attempt.startedAt).getTime()) / 1000)
        );
        await attempt.save();

        const err = new Error('The allotted time limit for this attempt has expired.');
        err.statusCode = 400;
        throw err;
      }
    } else {
      // Check attempt limits
      const previousAttempts = await MockTestAttempt.countDocuments({
        mockTestId: testId,
        studentId,
        status: { $in: ['SUBMITTED', 'EVALUATED'] },
      });

      const maxAllowed = mockTest.attemptLimits || 1;
      if (previousAttempts >= maxAllowed) {
        const err = new Error(`You have reached the maximum attempt limit (${maxAllowed}) for this test.`);
        err.statusCode = 400;
        throw err;
      }

      const startedAt = new Date();
      const durationMinutes = mockTest.durationMinutes || 60;
      let deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
      if (mockTest.availabilityWindow?.endDate) {
        const hardEnd = new Date(mockTest.availabilityWindow.endDate);
        if (hardEnd > startedAt && hardEnd < deadlineAt) {
          deadlineAt = hardEnd;
        }
      }

      // Initialize response items corresponding to resolvedQuestions
      const initialResponses = mockTest.resolvedQuestions.map((rq) => ({
        questionId: rq.questionId,
        versionNumber: rq.versionNumber,
        maxMarks: rq.marks,
        scoreAwarded: 0,
        timeSpentSeconds: 0,
      }));

      try {
        attempt = await MockTestAttempt.create({
          mockTestId: testId,
          studentId,
          status: 'IN_PROGRESS',
          startedAt,
          deadlineAt,
          totalMarks: mockTest.totalMarks,
          responses: initialResponses,
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          attempt = await MockTestAttempt.findOne({
            mockTestId: testId,
            studentId,
            status: 'IN_PROGRESS',
          });
          if (!attempt) {
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }
    }

    // Return sanitized test with protected student serializers
    const sanitizedQuestions = mockTest.resolvedQuestions.map((rq) => ({
      questionId: rq.questionId,
      versionNumber: rq.versionNumber,
      marks: rq.marks,
      negativeMarks: rq.negativeMarks,
      orderIndex: rq.orderIndex,
      questionSnapshot: serializeQuestionForStudent(rq.questionSnapshot),
    }));

    return {
      attemptId: attempt._id,
      mockTest: {
        id: mockTest._id,
        title: mockTest.title,
        description: mockTest.description,
        examination: mockTest.examination,
        durationMinutes: mockTest.durationMinutes,
        totalMarks: mockTest.totalMarks,
        questionCount: mockTest.questionCount,
        negativeMarking: mockTest.negativeMarking,
        questions: sanitizedQuestions,
      },
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
    };
  }

  /**
   * Submit mock test attempt and calculate concept-wise performance analytics
   */
  async submitAttempt(attemptId, studentUser, submissionPayload = {}) {
    const attempt = await MockTestAttempt.findById(attemptId);
    if (!attempt) {
      const err = new Error('Attempt not found');
      err.statusCode = 404;
      throw err;
    }

    const studentId = (studentUser._id || studentUser.id).toString();
    if (attempt.studentId.toString() !== studentId) {
      const err = new Error('Access denied. You do not own this attempt.');
      err.statusCode = 403;
      throw err;
    }

    if (attempt.status !== 'IN_PROGRESS') {
      const err = new Error('This attempt has already been submitted.');
      err.statusCode = 400;
      throw err;
    }

    const mockTest = await MockTest.findById(attempt.mockTestId);
    const now = Date.now();
    const durationMinutes = mockTest.durationMinutes || 60;
    const deadlineTime = attempt.deadlineAt
      ? new Date(attempt.deadlineAt).getTime()
      : new Date(attempt.startedAt).getTime() + durationMinutes * 60 * 1000;
    const isExpired = now > deadlineTime + 30000;

    const resolvedQuestionsMap = new Map();
    mockTest.resolvedQuestions.forEach((rq) => {
      resolvedQuestionsMap.set(rq.questionId.toString(), rq);
    });

    const submittedResponses = submissionPayload.responses || [];
    const submittedResponseMap = new Map();
    for (const res of submittedResponses) {
      if (!res || !res.questionId) continue;
      const qIdStr = res.questionId.toString();
      if (!resolvedQuestionsMap.has(qIdStr)) {
        const err = new Error(`Unknown question ID: ${qIdStr}`);
        err.statusCode = 400;
        throw err;
      }
      if (submittedResponseMap.has(qIdStr)) {
        const err = new Error(`Duplicate response detected for question ID: ${qIdStr}`);
        err.statusCode = 400;
        throw err;
      }
      submittedResponseMap.set(qIdStr, res);
    }

    const existingDraftResponseMap = new Map();
    (attempt.responses || []).forEach((r) => {
      if (r && r.questionId) {
        existingDraftResponseMap.set(r.questionId.toString(), r);
      }
    });

    let autoScoreTotal = 0;
    let totalEarned = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const evaluatedResponses = [];
    const topicStats = new Map();
    const conceptStats = new Map();
    const difficultyStats = {
      easy: { total: 0, correct: 0, score: 0 },
      medium: { total: 0, correct: 0, score: 0 },
      hard: { total: 0, correct: 0, score: 0 },
    };

    for (const rq of mockTest.resolvedQuestions) {
      const qId = rq.questionId.toString();
      const userRes = submittedResponseMap.get(qId) || {};
      const snapshot = rq.questionSnapshot;

      let rawQType = (snapshot.questionType || snapshot.type || 'SINGLE_MCQ').toUpperCase();
      if (rawQType === 'MCQ') rawQType = 'SINGLE_MCQ';
      if (rawQType === 'LONG_ANSWER') rawQType = 'DESCRIPTIVE';
      if (rawQType === 'CODE') rawQType = 'CODING';

      const codingCfg = snapshot.codingConfig || snapshot.evaluationConfig || {};
      const isSql = rawQType === 'SQL' || codingCfg.executionCategory === 'sql';
      const isCoding = !isSql && (rawQType === 'CODING');

      const difficulty = (snapshot.difficulty || 'MEDIUM').toLowerCase();
      const maxMarks = typeof rq.marks === 'number'
        ? rq.marks
        : typeof snapshot.marks === 'number'
        ? snapshot.marks
        : 1;
      const negativeMarks = typeof rq.negativeMarks === 'number'
        ? rq.negativeMarks
        : typeof snapshot.negativeMarks === 'number'
        ? snapshot.negativeMarks
        : (mockTest.negativeMarking
            ? maxMarks * (mockTest.negativeMarkingRatio !== undefined ? mockTest.negativeMarkingRatio : 0.33)
            : 0);

      // Track difficulty
      if (difficultyStats[difficulty]) {
        difficultyStats[difficulty].total++;
      }

      // Track topic & concept
      const topicId = snapshot.topicIds?.[0]?.toString() || 'general';
      if (!topicStats.has(topicId)) {
        topicStats.set(topicId, { topicId, topicName: 'Topic', totalQuestions: 0, correctCount: 0 });
      }
      topicStats.get(topicId).totalQuestions++;

      const concepts = snapshot.conceptTags || [];
      concepts.forEach((concept) => {
        if (!conceptStats.has(concept)) {
          conceptStats.set(concept, { concept, questionsAttempted: 0, correctCount: 0 });
        }
        conceptStats.get(concept).questionsAttempted++;
      });

      // Evaluation logic (Objective, Coding, SQL, Descriptive, File Upload)
      let isCorrect = false;
      let score = 0;
      let negScore = 0;
      let feedback = '';
      let executionResult = null;
      let evaluationStatus = 'AUTOMATIC';
      let rubricScores = [];
      let fileAnswer = null;

      const authoritativeKey =
        snapshot.answerKey !== undefined && snapshot.answerKey !== null
          ? snapshot.answerKey
          : snapshot.correctAnswer;

      if (rawQType === 'SINGLE_MCQ') {
        const studentChoice = userRes.selectedOption;
        if (!studentChoice) {
          unansweredCount++;
        } else {
          const validOptions = snapshot.options || [];
          const chosenOpt = validOptions.find((o) => o.id === studentChoice);
          if (!chosenOpt) {
            isCorrect = false;
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Invalid option selection.';
          } else {
            const correctOpt = validOptions.find((o) => o.isCorrect)?.id;
            const expectedKey = authoritativeKey || correctOpt;
            const isMatch = String(studentChoice).trim() === String(expectedKey).trim();

            if (isMatch) {
              isCorrect = true;
              score = maxMarks;
              correctCount++;
              if (difficultyStats[difficulty]) {
                difficultyStats[difficulty].correct++;
                difficultyStats[difficulty].score += score;
              }
              topicStats.get(topicId).correctCount++;
              concepts.forEach((c) => conceptStats.get(c).correctCount++);
              feedback = 'Correct answer.';
            } else {
              incorrectCount++;
              negScore = negativeMarks;
              score = negScore > 0 ? -negScore : 0;
              feedback = 'Incorrect answer.';
            }
          }
        }
      } else if (rawQType === 'MULTI_SELECT') {
        const studentChoices = Array.isArray(userRes.selectedOptions) ? userRes.selectedOptions : [];
        if (studentChoices.length === 0) {
          unansweredCount++;
        } else {
          const uniqueChoices = [...new Set(studentChoices)];
          const validOptions = snapshot.options || [];
          const validOptionIds = new Set(validOptions.map((o) => o.id));
          const hasInvalidId = uniqueChoices.some((id) => !validOptionIds.has(id));

          if (hasInvalidId) {
            isCorrect = false;
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Invalid option selection.';
          } else {
            let correctKeys = [];
            if (Array.isArray(authoritativeKey)) {
              correctKeys = authoritativeKey;
            } else if (snapshot.options) {
              correctKeys = snapshot.options.filter((o) => o.isCorrect).map((o) => o.id);
            }

            const correctSet = new Set(correctKeys);
            const studentSet = new Set(uniqueChoices);

            let correctSelected = 0;
            let incorrectSelected = 0;
            for (const optId of studentSet) {
              if (correctSet.has(optId)) {
                correctSelected++;
              } else {
                incorrectSelected++;
              }
            }

            const isExact = studentSet.size === correctSet.size && correctSelected === correctSet.size;
            const policy = (snapshot.evaluationConfig?.partialCreditPolicy || 'ALL_OR_NOTHING').toUpperCase();

            if (policy === 'PROPORTIONAL_NO_PENALTY') {
              if (isExact) {
                isCorrect = true;
                score = maxMarks;
                correctCount++;
                if (difficultyStats[difficulty]) difficultyStats[difficulty].correct++;
                topicStats.get(topicId).correctCount++;
                concepts.forEach((c) => conceptStats.get(c).correctCount++);
                feedback = 'Correct multiple selection.';
              } else if (incorrectSelected > 0 || correctSelected === 0) {
                isCorrect = false;
                incorrectCount++;
                negScore = negativeMarks;
                score = negScore > 0 ? -negScore : 0;
                feedback = 'Incorrect multiple selection.';
              } else {
                isCorrect = false;
                const fraction = correctSet.size > 0 ? correctSelected / correctSet.size : 0;
                score = Math.round(maxMarks * fraction * 100) / 100;
                negScore = 0;
                feedback = `Partially correct selection (${correctSelected}/${correctSet.size} correct).`;
              }
            } else if (policy === 'PROPORTIONAL_WITH_PENALTY') {
              if (isExact) {
                isCorrect = true;
                score = maxMarks;
                correctCount++;
                if (difficultyStats[difficulty]) difficultyStats[difficulty].correct++;
                topicStats.get(topicId).correctCount++;
                concepts.forEach((c) => conceptStats.get(c).correctCount++);
                feedback = 'Correct multiple selection.';
              } else {
                const totalCorrect = correctSet.size || 1;
                const totalIncorrect = Math.max(1, validOptionIds.size - correctSet.size);
                const credit = correctSelected / totalCorrect;
                const penalty = incorrectSelected / totalIncorrect;
                const netFraction = Math.max(0, credit - penalty);
                if (netFraction > 0) {
                  score = Math.round(maxMarks * netFraction * 100) / 100;
                  negScore = 0;
                  isCorrect = false;
                  feedback = 'Partially correct selection.';
                } else {
                  isCorrect = false;
                  incorrectCount++;
                  negScore = negativeMarks;
                  score = negScore > 0 ? -negScore : 0;
                  feedback = 'Incorrect multiple selection.';
                }
              }
            } else {
              // ALL_OR_NOTHING (default)
              if (isExact) {
                isCorrect = true;
                score = maxMarks;
                correctCount++;
                if (difficultyStats[difficulty]) difficultyStats[difficulty].correct++;
                topicStats.get(topicId).correctCount++;
                concepts.forEach((c) => conceptStats.get(c).correctCount++);
                feedback = 'Correct multiple selection.';
              } else {
                isCorrect = false;
                incorrectCount++;
                negScore = negativeMarks;
                score = negScore > 0 ? -negScore : 0;
                feedback = 'Incorrect multiple selection.';
              }
            }
          }
        }
      } else if (rawQType === 'TRUE_FALSE') {
        const rawChoice = userRes.selectedOption !== undefined && userRes.selectedOption !== null
          ? userRes.selectedOption
          : userRes.textAnswer;

        if (rawChoice === null || rawChoice === undefined || String(rawChoice).trim() === '') {
          unansweredCount++;
        } else {
          let studentBool = null;
          if (snapshot.options && Array.isArray(snapshot.options) && snapshot.options.length > 0) {
            const chosenOpt = snapshot.options.find((o) => o.id === String(rawChoice).trim());
            if (chosenOpt) {
              studentBool = parseBooleanToken(chosenOpt.text) !== null
                ? parseBooleanToken(chosenOpt.text)
                : parseBooleanToken(chosenOpt.id);
            }
          }
          if (studentBool === null) {
            studentBool = parseBooleanToken(rawChoice);
          }

          let expectedBool = parseBooleanToken(authoritativeKey);
          if (expectedBool === null && snapshot.options && Array.isArray(snapshot.options)) {
            const correctOpt = snapshot.options.find((o) => o.isCorrect);
            if (correctOpt) {
              expectedBool = parseBooleanToken(correctOpt.text) !== null
                ? parseBooleanToken(correctOpt.text)
                : parseBooleanToken(correctOpt.id);
            }
          }

          if (studentBool === null) {
            isCorrect = false;
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Invalid boolean response.';
          } else if (expectedBool !== null && studentBool === expectedBool) {
            isCorrect = true;
            score = maxMarks;
            correctCount++;
            if (difficultyStats[difficulty]) {
              difficultyStats[difficulty].correct++;
              difficultyStats[difficulty].score += score;
            }
            topicStats.get(topicId).correctCount++;
            concepts.forEach((c) => conceptStats.get(c).correctCount++);
            feedback = 'Correct answer.';
          } else {
            isCorrect = false;
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Incorrect answer.';
          }
        }
      } else if (isCoding) {
        const code = (userRes.code || userRes.textAnswer || '').trim();
        if (!code) {
          unansweredCount++;
        } else {
          // Trusted test cases
          const rawTestCases = (codingCfg.testCases && Array.isArray(codingCfg.testCases) && codingCfg.testCases.length > 0)
            ? codingCfg.testCases
            : (snapshot.testCases && Array.isArray(snapshot.testCases))
            ? snapshot.testCases
            : (snapshot.evaluationConfig?.testCases && Array.isArray(snapshot.evaluationConfig.testCases))
            ? snapshot.evaluationConfig.testCases
            : [];
          const enabledCases = rawTestCases.filter((tc) => tc.isEnabled !== false);

          if (enabledCases.length === 0) {
            // Requirement 10: No test cases configured: must not automatically award full marks
            isCorrect = false;
            score = 0;
            negScore = 0;
            incorrectCount++;
            feedback = 'No automated test cases configured for this question.';
            executionResult = {
              verdict: 'NO_TEST_CASES',
              totalCount: 0,
              passedCount: 0,
              totalWeight: 0,
              passedWeight: 0,
              scoreFraction: 0,
              testCases: [],
            };
          } else {
            // Validate language
            const allowedLangs = (codingCfg.allowedLanguages && Array.isArray(codingCfg.allowedLanguages) && codingCfg.allowedLanguages.length > 0
              ? codingCfg.allowedLanguages
              : ['python', 'javascript']
            ).map((l) => l.toLowerCase());
            const supportedRuntimes = ['python', 'javascript'];
            const studentLang = (userRes.language || codingCfg.defaultLanguage || 'python').toLowerCase();

            if (!supportedRuntimes.includes(studentLang) || !allowedLangs.includes(studentLang)) {
              isCorrect = false;
              negScore = negativeMarks;
              score = negScore > 0 ? -negScore : 0;
              incorrectCount++;
              feedback = `Language '${studentLang}' is not permitted for this question. Allowed: ${allowedLangs.join(', ')}`;
              executionResult = {
                verdict: 'INVALID_LANGUAGE',
                totalCount: enabledCases.length,
                passedCount: 0,
                totalWeight: 0,
                passedWeight: 0,
                scoreFraction: 0,
                testCases: [],
              };
            } else {
              const timeoutMs = codingCfg.cpuTimeLimitMs || codingCfg.timeoutMs || snapshot.timeoutMs || 2000;
              const memoryLimitMb = codingCfg.memoryLimitMb || snapshot.memoryLimitMb || 256;
              const schemaDdl = codingCfg.schemaDdl || snapshot.schemaDdl || '';

              const suiteCases = enabledCases.map((tc) => ({
                input: tc.input || '',
                expectedOutput: tc.expectedOutput || '',
                isHidden: Boolean(tc.isHidden),
                weight: typeof tc.weight === 'number' && tc.weight > 0 ? tc.weight : 1,
              }));

              const clientRes = await executionClient.executeSuite({
                language: studentLang,
                code,
                testCases: suiteCases,
                schemaDdl,
                timeoutMs,
                memoryLimitMb,
                isFaculty: false, // CRITICAL: student-safe evaluation!
              });

              if (!clientRes.ok || !clientRes.data?.success) {
                // If infrastructure failure (HTTP 503 or 500 error from executor service)
                const errorMsg = clientRes.data?.message || 'Execution service communication failure';
                const status = clientRes.status || 503;
                const err = new Error(errorMsg);
                err.statusCode = status;
                throw err;
              }

              const suiteData = clientRes.data.data;
              const totalWeight = typeof suiteData.totalWeight === 'number' && suiteData.totalWeight > 0
                ? suiteData.totalWeight
                : suiteCases.reduce((sum, tc) => sum + tc.weight, 0);
              const passedWeight = typeof suiteData.passedWeight === 'number' ? suiteData.passedWeight : 0;
              const passedCount = typeof suiteData.passedCount === 'number' ? suiteData.passedCount : 0;

              // Scoring: earnedMarks = questionMarks * (passedWeight / totalWeight)
              if (passedWeight === totalWeight && totalWeight > 0) {
                isCorrect = true;
                score = maxMarks;
                negScore = 0;
                correctCount++;
                if (difficultyStats[difficulty]) {
                  difficultyStats[difficulty].correct++;
                  difficultyStats[difficulty].score += score;
                }
                topicStats.get(topicId).correctCount++;
                concepts.forEach((c) => conceptStats.get(c).correctCount++);
                feedback = 'All test cases passed.';
              } else if (passedWeight > 0) {
                isCorrect = false;
                score = totalWeight > 0 ? Math.round(((maxMarks * passedWeight) / totalWeight) * 100) / 100 : 0;
                negScore = 0;
                incorrectCount++;
                feedback = `Partially passed (${passedCount}/${enabledCases.length} test cases).`;
              } else {
                isCorrect = false;
                negScore = negativeMarks;
                score = negScore > 0 ? -negScore : 0;
                incorrectCount++;
                feedback = suiteData.verdict || 'Code failed all test cases.';
              }

              // Sanitize student-safe test case results for storage
              const sanitizedTestCases = (suiteData.testCases || []).map((stc, idx) => {
                const orig = enabledCases[idx] || {};
                const isHidden = Boolean(orig.isHidden);
                return {
                  testCaseIndex: idx,
                  passed: Boolean(stc.passed),
                  verdict: stc.verdict || (stc.passed ? 'ACCEPTED' : 'WRONG_ANSWER'),
                  executionTimeMs: stc.executionTimeMs || 0,
                  memoryUsedBytes: stc.memoryUsedBytes,
                  weight: orig.weight || 1,
                  isHidden,
                  input: isHidden ? '[HIDDEN]' : (stc.input || orig.input || ''),
                  expectedOutput: isHidden ? '[HIDDEN]' : (stc.expectedOutput || orig.expectedOutput || ''),
                  actualOutput: isHidden ? (stc.passed ? '[HIDDEN]' : 'Output differed') : stc.actualOutput,
                  stderr: isHidden ? '' : (stc.stderr || ''),
                  description: isHidden ? `Hidden Test Case ${idx + 1}` : (orig.description || `Test Case ${idx + 1}`),
                };
              });

              executionResult = {
                verdict: suiteData.verdict,
                totalCount: enabledCases.length,
                passedCount,
                totalWeight,
                passedWeight,
                scoreFraction: totalWeight > 0 ? passedWeight / totalWeight : 0,
                testCases: sanitizedTestCases,
              };
            }
          }
        }
      } else if (isSql) {
        const sqlQuery = (userRes.sqlQuery || userRes.code || userRes.textAnswer || '').trim();
        if (!sqlQuery) {
          unansweredCount++;
        } else {
          // Trusted test cases
          const rawTestCases = (codingCfg.testCases && Array.isArray(codingCfg.testCases) && codingCfg.testCases.length > 0)
            ? codingCfg.testCases
            : (snapshot.testCases && Array.isArray(snapshot.testCases))
            ? snapshot.testCases
            : (snapshot.evaluationConfig?.testCases && Array.isArray(snapshot.evaluationConfig.testCases))
            ? snapshot.evaluationConfig.testCases
            : [];
          const enabledCases = rawTestCases.filter((tc) => tc.isEnabled !== false);

          if (enabledCases.length === 0) {
            isCorrect = false;
            score = 0;
            negScore = 0;
            incorrectCount++;
            feedback = 'No automated test cases configured for this question.';
            executionResult = {
              verdict: 'NO_TEST_CASES',
              totalCount: 0,
              passedCount: 0,
              totalWeight: 0,
              passedWeight: 0,
              scoreFraction: 0,
              testCases: [],
            };
          } else {
            // Validate dialect (SQLite only)
            const studentDialect = (userRes.language || codingCfg.sqlDialect || 'sqlite').toLowerCase();
            if (studentDialect !== 'sqlite') {
              isCorrect = false;
              negScore = negativeMarks;
              score = negScore > 0 ? -negScore : 0;
              incorrectCount++;
              feedback = `SQL dialect '${studentDialect}' is not supported. Active SQL examination is restricted to SQLite only.`;
              executionResult = {
                verdict: 'INVALID_DIALECT',
                totalCount: enabledCases.length,
                passedCount: 0,
                totalWeight: 0,
                passedWeight: 0,
                scoreFraction: 0,
                testCases: [],
              };
            } else {
              const timeoutMs = codingCfg.cpuTimeLimitMs || codingCfg.timeoutMs || snapshot.timeoutMs || 2000;
              const baseDdl = codingCfg.schemaDdl || snapshot.schemaDdl || '';

              let passedCount = 0;
              let totalWeight = 0;
              let passedWeight = 0;
              const sqlCaseResults = [];

              for (let i = 0; i < enabledCases.length; i++) {
                const tc = enabledCases[i];
                const weight = typeof tc.weight === 'number' && tc.weight > 0 ? tc.weight : 1;
                totalWeight += weight;

                let expectedOut = null;
                if (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0) {
                  expectedOut = {
                    columns: tc.expectedColumns || [],
                    rows: tc.expectedRows || [],
                  };
                } else if (tc.expectedOutput) {
                  expectedOut = tc.expectedOutput;
                }

                let ddl = baseDdl || '';
                if (tc.input && tc.input.trim()) {
                  ddl = ddl ? `${ddl}\n${tc.input.trim()}` : tc.input.trim();
                }

                const clientRes = await executionClient.executeSql({
                  dialect: 'sqlite',
                  schemaDdl: ddl,
                  query: sqlQuery,
                  expectedOutput: expectedOut,
                  timeoutMs,
                });

                if (!clientRes.ok) {
                  if (clientRes.status >= 500 || clientRes.status === 503) {
                    const errorMsg = clientRes.data?.message || 'SQL execution service communication failure';
                    const err = new Error(errorMsg);
                    err.statusCode = clientRes.status || 503;
                    throw err;
                  }
                }

                const sqlRes = clientRes.data?.data || {};
                const passed = sqlRes.verdict === 'ACCEPTED';
                if (passed) {
                  passedCount++;
                  passedWeight += weight;
                }

                const isHidden = Boolean(tc.isHidden);
                sqlCaseResults.push({
                  testCaseIndex: i,
                  passed,
                  verdict: sqlRes.verdict || (passed ? 'ACCEPTED' : 'WRONG_ANSWER'),
                  executionTimeMs: sqlRes.executionTimeMs || 0,
                  weight,
                  isHidden,
                  input: isHidden ? '[HIDDEN]' : (tc.input || ''),
                  expectedOutput: isHidden ? '[HIDDEN]' : (typeof tc.expectedOutput === 'string' ? tc.expectedOutput : JSON.stringify(expectedOut)),
                  actualOutput: isHidden ? (passed ? '[HIDDEN]' : 'Output differed') : (sqlRes.stdout || JSON.stringify(sqlRes.rows || [])),
                  stderr: isHidden ? '' : (sqlRes.stderr || ''),
                  description: isHidden ? `Hidden Test Case ${i + 1}` : (tc.description || `Test Case ${i + 1}`),
                });
              }

              if (passedWeight === totalWeight && totalWeight > 0) {
                isCorrect = true;
                score = maxMarks;
                negScore = 0;
                correctCount++;
                if (difficultyStats[difficulty]) {
                  difficultyStats[difficulty].correct++;
                  difficultyStats[difficulty].score += score;
                }
                topicStats.get(topicId).correctCount++;
                concepts.forEach((c) => conceptStats.get(c).correctCount++);
                feedback = 'All SQL test cases passed.';
              } else if (passedWeight > 0) {
                isCorrect = false;
                score = totalWeight > 0 ? Math.round(((maxMarks * passedWeight) / totalWeight) * 100) / 100 : 0;
                negScore = 0;
                incorrectCount++;
                feedback = `Partially passed (${passedCount}/${enabledCases.length} SQL test cases).`;
              } else {
                isCorrect = false;
                negScore = negativeMarks;
                score = negScore > 0 ? -negScore : 0;
                incorrectCount++;
                feedback = sqlCaseResults[0]?.verdict || 'SQL query failed test cases.';
              }

              const overallVerdict =
                passedCount === enabledCases.length
                  ? 'ACCEPTED'
                  : passedCount === 0
                  ? sqlCaseResults[0]?.verdict || 'WRONG_ANSWER'
                  : 'PARTIAL_SUCCESS';

              executionResult = {
                verdict: overallVerdict,
                totalCount: enabledCases.length,
                passedCount,
                totalWeight,
                passedWeight,
                scoreFraction: totalWeight > 0 ? passedWeight / totalWeight : 0,
                testCases: sqlCaseResults,
              };
            }
          }
        }
      } else if (rawQType === 'FILL_BLANK') {
        const rawAns = userRes.textAnswer;
        if (rawAns === null || rawAns === undefined || String(rawAns).trim() === '') {
          unansweredCount++;
        } else {
          const evalCfg = snapshot.evaluationConfig || {};
          let acceptedList = [];
          if (Array.isArray(evalCfg.acceptedAnswers) && evalCfg.acceptedAnswers.length > 0) {
            acceptedList = evalCfg.acceptedAnswers;
          } else if (Array.isArray(authoritativeKey)) {
            acceptedList = authoritativeKey;
          } else if (typeof authoritativeKey === 'string' && authoritativeKey.trim()) {
            acceptedList = authoritativeKey.split(',').map((s) => s.trim());
          } else if (snapshot.correctAnswer) {
            acceptedList = [snapshot.correctAnswer];
          }

          const isCaseSensitive = evalCfg.caseSensitive === true;
          const isExactMatch = evalCfg.exactMatch === true;

          const studentNorm = normalizeTextAnswer(rawAns, isCaseSensitive, isExactMatch);
          const isMatch = acceptedList.some(
            (acc) => normalizeTextAnswer(acc, isCaseSensitive, isExactMatch) === studentNorm
          );

          if (isMatch) {
            isCorrect = true;
            score = maxMarks;
            correctCount++;
            if (difficultyStats[difficulty]) difficultyStats[difficulty].correct++;
            topicStats.get(topicId).correctCount++;
            concepts.forEach((c) => conceptStats.get(c).correctCount++);
            feedback = 'Correct answer.';
          } else {
            isCorrect = false;
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Incorrect answer.';
          }
        }
      } else if (rawQType === 'SHORT_ANSWER') {
        const evalCfg = snapshot.evaluationConfig || {};
        let acceptedList = [];
        if (Array.isArray(evalCfg.acceptedAnswers) && evalCfg.acceptedAnswers.length > 0) {
          acceptedList = evalCfg.acceptedAnswers;
        } else if (Array.isArray(authoritativeKey)) {
          acceptedList = authoritativeKey;
        } else if (typeof authoritativeKey === 'string' && authoritativeKey.trim()) {
          acceptedList = authoritativeKey.split(',').map((s) => s.trim());
        } else if (snapshot.correctAnswer) {
          acceptedList = [snapshot.correctAnswer];
        }

        const requiresManual =
          evalCfg.requiresManualReview === true ||
          evalCfg.evaluationMode === 'MANUAL' ||
          acceptedList.length === 0;

        const rawAns = userRes.textAnswer;
        if (rawAns === null || rawAns === undefined || String(rawAns).trim() === '') {
          unansweredCount++;
        }

        if (requiresManual) {
          evaluationStatus = 'PENDING_MANUAL_REVIEW';
          isCorrect = false;
          score = 0;
          negScore = 0;
          feedback = 'Pending instructor evaluation';
        } else if (rawAns && String(rawAns).trim() !== '') {
          const isCaseSensitive = evalCfg.caseSensitive === true;
          const isExactMatch = evalCfg.exactMatch === true;

          const studentNorm = normalizeTextAnswer(rawAns, isCaseSensitive, isExactMatch);
          const isMatch = acceptedList.some(
            (acc) => normalizeTextAnswer(acc, isCaseSensitive, isExactMatch) === studentNorm
          );

          if (isMatch) {
            isCorrect = true;
            score = maxMarks;
            correctCount++;
            if (difficultyStats[difficulty]) difficultyStats[difficulty].correct++;
            topicStats.get(topicId).correctCount++;
            concepts.forEach((c) => conceptStats.get(c).correctCount++);
            feedback = 'Correct answer.';
          } else {
            isCorrect = false;
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Incorrect answer.';
          }
        }
      } else if (rawQType === 'DESCRIPTIVE') {
        const rawAns = userRes.textAnswer;
        if (rawAns === null || rawAns === undefined || String(rawAns).trim() === '') {
          unansweredCount++;
        }
        evaluationStatus = 'PENDING_MANUAL_REVIEW';
        isCorrect = false;
        score = 0;
        negScore = 0;
        feedback = 'Pending instructor evaluation';
        rubricScores = (snapshot.evaluationConfig?.rubric || []).map((r) => ({
          criterion: r.criteria || r.criterion || '',
          score: 0,
          maxMarks: r.maxMarks || 0,
          comment: '',
        }));
      } else if (rawQType === 'FILE_UPLOAD') {
        const existingDraft = existingDraftResponseMap.get(qId);
        fileAnswer = userRes.fileAnswer || existingDraft?.fileAnswer || null;
        if (!fileAnswer || !fileAnswer.fileKey) {
          unansweredCount++;
        }
        evaluationStatus = 'PENDING_MANUAL_REVIEW';
        isCorrect = false;
        score = 0;
        negScore = 0;
        feedback = 'Pending instructor evaluation';
      } else {
        // Fallback for any other custom type
        const ans = (userRes.textAnswer || '').trim().toLowerCase();
        if (!ans) {
          unansweredCount++;
        } else {
          const expected = String(authoritativeKey || '').trim().toLowerCase();
          if (expected && ans === expected) {
            isCorrect = true;
            score = maxMarks;
            correctCount++;
            if (difficultyStats[difficulty]) difficultyStats[difficulty].correct++;
            topicStats.get(topicId).correctCount++;
            concepts.forEach((c) => conceptStats.get(c).correctCount++);
            feedback = 'Correct answer.';
          } else {
            incorrectCount++;
            negScore = negativeMarks;
            score = negScore > 0 ? -negScore : 0;
            feedback = 'Incorrect answer.';
          }
        }
      }

      if (evaluationStatus === 'AUTOMATIC') {
        autoScoreTotal += score;
      }
      totalEarned += score;

      evaluatedResponses.push({
        questionId: rq.questionId,
        versionNumber: rq.versionNumber,
        selectedOption: userRes.selectedOption || null,
        selectedOptions: userRes.selectedOptions || [],
        textAnswer: userRes.textAnswer || null,
        code: userRes.code || null,
        language: userRes.language || null,
        sqlQuery: userRes.sqlQuery || null,
        timeSpentSeconds: userRes.timeSpentSeconds || 0,
        fileAnswer: fileAnswer || null,
        evaluationStatus,
        rubricScores: rubricScores || [],
        evaluatorComment: '',
        isCorrect,
        scoreAwarded: score,
        negativeMarksAwarded: negScore,
        maxMarks,
        executionResult: executionResult || null,
        feedback,
      });
    }

    const hasPendingManual = evaluatedResponses.some((r) => r.evaluationStatus === 'PENDING_MANUAL_REVIEW');
    const targetStatus = hasPendingManual ? 'SUBMITTED' : 'EVALUATED';
    const targetEvalStatus = hasPendingManual ? 'PENDING_MANUAL_REVIEW' : 'COMPLETED';

    const autoScoreCapped = Math.max(0, Math.round(autoScoreTotal * 100) / 100);
    const earnedCapped = autoScoreCapped;
    const percentage = mockTest.totalMarks > 0 ? Math.round((earnedCapped / mockTest.totalMarks) * 10000) / 100 : 0;

    // Build Topic analytics
    const topicWiseAnalytics = Array.from(topicStats.values()).map((t) => ({
      topicId: t.topicId !== 'general' ? t.topicId : null,
      topicName: t.topicName,
      totalQuestions: t.totalQuestions,
      correctCount: t.correctCount,
      accuracyPercentage: t.totalQuestions > 0 ? Math.round((t.correctCount / t.totalQuestions) * 100) : 0,
    }));

    // Build Concept analytics with confidence / evidence scoring (Section 14)
    const conceptWiseAnalytics = Array.from(conceptStats.values()).map((c) => {
      const accuracy = c.questionsAttempted > 0 ? Math.round((c.correctCount / c.questionsAttempted) * 100) : 0;
      let confidenceScore = 'LOW';
      if (c.questionsAttempted >= 4) {
        confidenceScore = 'HIGH';
      } else if (c.questionsAttempted >= 2) {
        confidenceScore = 'MEDIUM';
      }
      return {
        concept: c.concept,
        questionsAttempted: c.questionsAttempted,
        correctCount: c.correctCount,
        accuracyPercentage: accuracy,
        confidenceScore,
      };
    });

    const updatedAttempt = await MockTestAttempt.findOneAndUpdate(
      { _id: attemptId, status: 'IN_PROGRESS' },
      {
        $set: {
          status: targetStatus,
          evaluationStatus: targetEvalStatus,
          submittedAt: new Date(),
          submittedReason: isExpired ? 'TIME_EXPIRED' : 'USER_SUBMITTED',
          autoScore: autoScoreCapped,
          manualScore: 0,
          earnedMarks: earnedCapped,
          percentage,
          correctCount,
          incorrectCount,
          unansweredCount,
          responses: evaluatedResponses,
          topicWiseAnalytics,
          conceptWiseAnalytics,
          difficultyWiseAnalytics: difficultyStats,
        },
      },
      { new: true }
    );

    if (!updatedAttempt) {
      const err = new Error('This attempt has already been submitted.');
      err.statusCode = 400;
      throw err;
    }

    await AuditLog.create({
      userId: studentId,
      action: 'MOCK_TEST_SUBMITTED',
      entityType: 'MockTestAttempt',
      entityId: updatedAttempt._id.toString(),
      details: {
        autoScore: autoScoreCapped,
        earnedMarks: earnedCapped,
        percentage,
        status: targetStatus,
        evaluationStatus: targetEvalStatus,
      },
    });

    return {
      message: hasPendingManual
        ? 'Mock test submitted successfully. Awaiting manual evaluation for subjective questions.'
        : 'Mock test evaluated successfully.',
      attemptId: updatedAttempt._id,
      status: updatedAttempt.status,
      evaluationStatus: updatedAttempt.evaluationStatus,
      score: earnedCapped,
      autoScore: autoScoreCapped,
      manualScore: 0,
      totalMarks: mockTest.totalMarks,
      percentage,
      correctCount,
      incorrectCount,
      unansweredCount,
      topicWiseAnalytics,
      conceptWiseAnalytics,
      difficultyWiseAnalytics: difficultyStats,
    };
  }

  /**
   * Upload a file answer for a FILE_UPLOAD question during an attempt
   */
  async uploadAttemptFile(attemptId, questionId, studentUser, file) {
    const studentId = (studentUser._id || studentUser.id).toString();

    const attempt = await MockTestAttempt.findById(attemptId);
    if (!attempt) {
      const err = new Error('Attempt not found');
      err.statusCode = 404;
      throw err;
    }

    if (attempt.studentId.toString() !== studentId) {
      const err = new Error('Access denied. You do not own this attempt.');
      err.statusCode = 403;
      throw err;
    }

    if (attempt.status !== 'IN_PROGRESS') {
      const err = new Error('Cannot upload file. This attempt has already been submitted.');
      err.statusCode = 400;
      throw err;
    }

    const mockTest = await MockTest.findById(attempt.mockTestId);
    if (!mockTest) {
      const err = new Error('Mock test not found');
      err.statusCode = 404;
      throw err;
    }

    const rq = mockTest.resolvedQuestions.find(
      (q) => q.questionId.toString() === questionId.toString()
    );
    if (!rq) {
      const err = new Error('Question not found in this mock test.');
      err.statusCode = 404;
      throw err;
    }

    const qSnapshot = rq.questionSnapshot || {};
    const qType = (qSnapshot.questionType || qSnapshot.type || '').toUpperCase();
    if (qType !== 'FILE_UPLOAD') {
      const err = new Error('This question does not accept file uploads.');
      err.statusCode = 400;
      throw err;
    }

    if (!file || !file.buffer) {
      const err = new Error('No file provided for upload.');
      err.statusCode = 400;
      throw err;
    }

    const cfg = qSnapshot.fileUploadConfig || {};
    const maxMb = cfg.maxFileSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      const err = new Error(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of ${maxMb}MB`
      );
      err.statusCode = 413;
      throw err;
    }

    const allowedExtensions = cfg.allowedFileTypes || ['pdf', 'doc', 'docx'];

    // Clean up previous file if student re-uploads
    const existingRespIdx = attempt.responses.findIndex(
      (r) => r.questionId.toString() === questionId.toString()
    );
    if (existingRespIdx >= 0) {
      const prev = attempt.responses[existingRespIdx];
      if (prev.fileAnswer && prev.fileAnswer.fileKey) {
        await storageService.deleteDocumentFile(prev.fileAnswer.fileKey);
      }
    }

    const savedMetadata = await storageService.saveDocumentFile({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      submissionId: attemptId.toString(),
      questionId: questionId.toString(),
      allowedExtensions,
    });

    if (existingRespIdx >= 0) {
      attempt.responses[existingRespIdx].fileAnswer = savedMetadata;
      attempt.responses[existingRespIdx].evaluationStatus = 'PENDING_MANUAL_REVIEW';
    } else {
      attempt.responses.push({
        questionId: rq.questionId,
        versionNumber: rq.versionNumber,
        fileAnswer: savedMetadata,
        evaluationStatus: 'PENDING_MANUAL_REVIEW',
        maxMarks: typeof rq.marks === 'number' ? rq.marks : qSnapshot.marks || 1,
      });
    }

    await attempt.save();

    return {
      message: 'File uploaded successfully',
      questionId,
      fileAnswer: savedMetadata,
    };
  }

  /**
   * Evaluate a mock test attempt manually by faculty
   */
  async evaluateAttempt(attemptId, evaluatorUser, payload = {}) {
    const evaluatorId = (evaluatorUser._id || evaluatorUser.id).toString();

    if (evaluatorUser.role !== 'instructor' && evaluatorUser.role !== 'admin') {
      const err = new Error('Access denied. Only instructors or administrators can evaluate attempts.');
      err.statusCode = 403;
      throw err;
    }

    const attempt = await MockTestAttempt.findById(attemptId);
    if (!attempt) {
      const err = new Error('Attempt not found');
      err.statusCode = 404;
      throw err;
    }

    if (attempt.status === 'IN_PROGRESS') {
      const err = new Error('Cannot evaluate an attempt that is still in progress.');
      err.statusCode = 400;
      throw err;
    }

    if (attempt.status === 'EVALUATED' && attempt.evaluationStatus === 'COMPLETED') {
      const err = new Error('This attempt has already been evaluated.');
      err.statusCode = 400;
      throw err;
    }

    const mockTest = await MockTest.findById(attempt.mockTestId);
    if (!mockTest) {
      const err = new Error('Mock test not found');
      err.statusCode = 404;
      throw err;
    }

    // Verify faculty ownership or admin
    if (evaluatorUser.role !== 'admin' && mockTest.ownerFacultyId.toString() !== evaluatorId) {
      const err = new Error('Access denied. You are not authorized to evaluate this mock test.');
      err.statusCode = 403;
      throw err;
    }

    const rawFeedback = payload.responsesFeedback || [];
    const feedbackList = Array.isArray(rawFeedback)
      ? rawFeedback
      : Object.entries(rawFeedback).map(([qId, val]) => ({ questionId: qId, ...val }));

    const feedbackMap = new Map();
    for (const item of feedbackList) {
      if (item && item.questionId) {
        feedbackMap.set(item.questionId.toString(), item);
      }
    }

    // Check all questions awaiting manual review
    const pendingQuestions = attempt.responses.filter(
      (r) => r.evaluationStatus === 'PENDING_MANUAL_REVIEW'
    );

    for (const pq of pendingQuestions) {
      const qIdStr = pq.questionId.toString();
      if (!feedbackMap.has(qIdStr)) {
        const err = new Error(`Manual evaluation missing for question ID: ${qIdStr}. All pending questions must be evaluated.`);
        err.statusCode = 400;
        throw err;
      }
      const item = feedbackMap.get(qIdStr);
      const marksAwarded = Number(item.marksAwarded);
      if (isNaN(marksAwarded) || marksAwarded < 0) {
        const err = new Error(`Marks awarded for question ${qIdStr} must be a non-negative number.`);
        err.statusCode = 400;
        throw err;
      }
      if (marksAwarded > pq.maxMarks) {
        const err = new Error(`Marks awarded (${marksAwarded}) cannot exceed maximum marks (${pq.maxMarks}) for question ${qIdStr}.`);
        err.statusCode = 400;
        throw err;
      }
    }

    let additionalManualScore = 0;
    let newCorrectCount = attempt.correctCount || 0;
    let newIncorrectCount = attempt.incorrectCount || 0;

    const updatedResponses = attempt.responses.map((resp) => {
      const qIdStr = resp.questionId.toString();
      if (resp.evaluationStatus === 'PENDING_MANUAL_REVIEW' && feedbackMap.has(qIdStr)) {
        const item = feedbackMap.get(qIdStr);
        const marks = Number(item.marksAwarded);
        additionalManualScore += marks;
        const isCorrect = marks === resp.maxMarks;
        if (isCorrect) {
          newCorrectCount++;
        } else {
          newIncorrectCount++;
        }

        const respObj = typeof resp.toObject === 'function' ? resp.toObject() : { ...resp };
        return {
          ...respObj,
          scoreAwarded: marks,
          isCorrect,
          evaluationStatus: 'MANUALLY_EVALUATED',
          evaluatorComment: item.comment || '',
          feedback: item.comment || 'Evaluated by instructor',
          rubricScores: Array.isArray(item.rubricScores) ? item.rubricScores : resp.rubricScores || [],
        };
      }
      return resp;
    });

    const manualScore = Math.round(additionalManualScore * 100) / 100;
    const autoScore = attempt.autoScore || 0;
    const finalEarned = Math.max(0, Math.round((autoScore + manualScore) * 100) / 100);
    const percentage = mockTest.totalMarks > 0 ? Math.round((finalEarned / mockTest.totalMarks) * 10000) / 100 : 0;

    const finalizedAttempt = await MockTestAttempt.findOneAndUpdate(
      { _id: attemptId, status: 'SUBMITTED' },
      {
        $set: {
          status: 'EVALUATED',
          evaluationStatus: 'COMPLETED',
          manualScore,
          earnedMarks: finalEarned,
          percentage,
          correctCount: newCorrectCount,
          incorrectCount: newIncorrectCount,
          evaluatorId,
          gradedAt: new Date(),
          generalFeedback: payload.generalFeedback || '',
          responses: updatedResponses,
        },
      },
      { new: true }
    );

    if (!finalizedAttempt) {
      const err = new Error('Attempt evaluation conflict. This attempt may have already been evaluated.');
      err.statusCode = 409;
      throw err;
    }

    await AuditLog.create({
      userId: evaluatorId,
      action: 'MOCK_TEST_EVALUATED',
      entityType: 'MockTestAttempt',
      entityId: finalizedAttempt._id.toString(),
      details: { autoScore, manualScore, earnedMarks: finalEarned, percentage },
    });

    return {
      message: 'Mock test attempt manually evaluated and finalized successfully.',
      attemptId: finalizedAttempt._id,
      status: finalizedAttempt.status,
      evaluationStatus: finalizedAttempt.evaluationStatus,
      autoScore,
      manualScore,
      score: finalEarned,
      totalMarks: mockTest.totalMarks,
      percentage,
      correctCount: newCorrectCount,
      incorrectCount: newIncorrectCount,
      unansweredCount: finalizedAttempt.unansweredCount,
      gradedAt: finalizedAttempt.gradedAt,
    };
  }

  /**
   * Get attempt analytics report
   */
  async getAttemptAnalytics(attemptId, user) {
    const attempt = await MockTestAttempt.findById(attemptId).populate('mockTestId', 'title examination durationMinutes totalMarks');
    if (!attempt) {
      const err = new Error('Attempt not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    if (user.role === 'student' && attempt.studentId.toString() !== userId) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    if (user.role === 'instructor') {
      const mockTest = await MockTest.findById(attempt.mockTestId);
      if (!mockTest || (mockTest.ownerFacultyId && mockTest.ownerFacultyId.toString() !== userId)) {
        const err = new Error('Access denied. You do not own this mock test.');
        err.statusCode = 403;
        throw err;
      }
    }

    if (user.role !== 'admin' && user.role !== 'instructor' && user.role !== 'student') {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    if (user.role === 'student') {
      const sanitized = attempt.toObject();
      if (Array.isArray(sanitized.responses)) {
        sanitized.responses = sanitized.responses.map((resp) => {
          if (resp.executionResult && Array.isArray(resp.executionResult.testCases)) {
            resp.executionResult = {
              ...resp.executionResult,
              testCases: resp.executionResult.testCases.map((tc) => {
                if (tc.isHidden) {
                  return {
                    testCaseIndex: tc.testCaseIndex,
                    passed: tc.passed,
                    verdict: tc.verdict,
                    executionTimeMs: tc.executionTimeMs,
                    weight: tc.weight,
                    isHidden: true,
                    input: '[HIDDEN]',
                    expectedOutput: '[HIDDEN]',
                    actualOutput: tc.passed ? '[HIDDEN]' : 'Output differed',
                    stderr: '',
                    description: 'Hidden Test Case',
                  };
                }
                return tc;
              }),
            };
          }
          return resp;
        });
      }
      return sanitized;
    }

    return attempt;
  }

  /**
   * Get all student attempts for a mock test (Faculty/Admin only)
   */
  async getMockTestAttempts(mockTestId, user) {
    const mockTest = await MockTest.findById(mockTestId);
    if (!mockTest) {
      const err = new Error('Mock test not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    if (user.role !== 'admin' && mockTest.ownerFacultyId.toString() !== userId) {
      const err = new Error('Access denied. You do not own this mock test.');
      err.statusCode = 403;
      throw err;
    }

    const attempts = await MockTestAttempt.find({ mockTestId })
      .populate('studentId', 'name email rollNumber')
      .sort({ createdAt: -1 });

    return attempts;
  }

  /**
   * Get an attempt enriched with question snapshots for faculty manual review
   */
  async getAttemptForReview(attemptId, user) {
    const attempt = await MockTestAttempt.findById(attemptId)
      .populate('mockTestId')
      .populate('studentId', 'name email rollNumber');
    if (!attempt) {
      const err = new Error('Attempt not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    const mockTest = attempt.mockTestId;
    if (user.role !== 'admin' && mockTest.ownerFacultyId.toString() !== userId) {
      const err = new Error('Access denied. You are not authorized to review or grade this mock test.');
      err.statusCode = 403;
      throw err;
    }

    const questionMap = new Map();
    (mockTest.resolvedQuestions || []).forEach((rq) => {
      questionMap.set(rq.questionId.toString(), rq);
    });

    const enrichedResponses = (attempt.responses || []).map((resp) => {
      const rq = questionMap.get(resp.questionId.toString());
      const snapshot = rq?.questionSnapshot || {};
      const respObj = typeof resp.toObject === 'function' ? resp.toObject() : { ...resp };
      return {
        ...respObj,
        questionStatement: snapshot.statement || snapshot.questionText || '',
        questionType: (snapshot.questionType || snapshot.type || 'SINGLE_MCQ').toUpperCase(),
        maxMarks: typeof rq?.marks === 'number' ? rq.marks : snapshot.marks || resp.maxMarks || 1,
        rubric: snapshot.evaluationConfig?.rubric || [],
        fileUploadConfig: snapshot.fileUploadConfig || {},
        options: snapshot.options || [],
      };
    });

    return {
      attemptId: attempt._id,
      mockTestId: mockTest._id,
      mockTestTitle: mockTest.title,
      examination: mockTest.examination,
      student: {
        id: attempt.studentId?._id,
        name: attempt.studentId?.name,
        email: attempt.studentId?.email,
        rollNumber: attempt.studentId?.rollNumber,
      },
      status: attempt.status,
      evaluationStatus: attempt.evaluationStatus,
      autoScore: attempt.autoScore || 0,
      manualScore: attempt.manualScore || 0,
      earnedMarks: attempt.earnedMarks || 0,
      totalMarks: mockTest.totalMarks,
      percentage: attempt.percentage || 0,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      generalFeedback: attempt.generalFeedback || '',
      responses: enrichedResponses,
    };
  }

  /**
   * Securely retrieve an uploaded document file for an attempt response
   */
  async getAttemptDocumentFile(attemptId, questionId, user) {
    const attempt = await MockTestAttempt.findById(attemptId);
    if (!attempt) {
      const err = new Error('Attempt not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    const mockTest = await MockTest.findById(attempt.mockTestId);
    const isOwner = mockTest && mockTest.ownerFacultyId.toString() === userId;
    const isCandidate = attempt.studentId.toString() === userId;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isCandidate && !isAdmin) {
      const err = new Error('Access denied. You are not authorized to view this document.');
      err.statusCode = 403;
      throw err;
    }

    const resp = attempt.responses.find(
      (r) => r.questionId.toString() === questionId.toString()
    );
    if (!resp || !resp.fileAnswer || !resp.fileAnswer.fileKey) {
      const err = new Error('No uploaded file found for this question');
      err.statusCode = 404;
      throw err;
    }

    const filePath = storageService.getDocumentFilePath(resp.fileAnswer.fileKey);
    return {
      filePath,
      originalFilename: resp.fileAnswer.originalFilename || 'document.pdf',
      mimeType: resp.fileAnswer.mimeType || 'application/pdf',
      size: resp.fileAnswer.size,
    };
  }
}

module.exports = new MockTestService();
