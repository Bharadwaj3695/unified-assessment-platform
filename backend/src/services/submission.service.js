const mongoose = require('mongoose');
const { Submission, Assessment, Question, User, Evaluation, Notification, ProctoringSession, ProctoringEvent } = require('../models');
const emailService = require('./email.service');
const proctoringService = require('./proctoring.service');
const storageService = require('./storage.service');
const executionClient = require('./executionClient.service');
const { resolveGrade } = require('../utils/gradingScheme');

class SubmissionService {
  async startAttempt(studentId, assessmentId) {
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const error = new Error('Invalid assessment ID');
      error.statusCode = 400;
      throw error;
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    // Access rule check: must be published
    if (assessment.status !== 'published') {
      const error = new Error('This assessment is not open for attempts');
      error.statusCode = 403;
      throw error;
    }

    // Access rule check: check if scheduled start time is in the future
    if (assessment.scheduledAt && new Date(assessment.scheduledAt) > new Date()) {
      const error = new Error('This assessment is scheduled for a future date and is not yet open for attempts.');
      error.statusCode = 403;
      throw error;
    }

    // Access rule check: check if assessment-level hard deadline has passed
    if (assessment.deadlineAt && new Date(assessment.deadlineAt) <= new Date()) {
      const error = new Error('This assessment deadline has passed and is no longer open for attempts.');
      error.statusCode = 403;
      throw error;
    }

    // Access rule check: if restricted, student must be assigned
    if (assessment.accessType === 'restricted') {
      const isAssigned =
        assessment.assignedStudents &&
        assessment.assignedStudents.some((id) => id.toString() === studentId.toString());
      if (!isAssigned) {
        const error = new Error('You are not authorized to attempt this restricted assessment.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Check existing attempt for this student and assessment
    let existing = await Submission.findOne({
      studentId,
      assessmentId,
    });

    if (existing) {
      // If already submitted or evaluated, strictly block second attempt
      if (existing.status === 'submitted' || existing.status === 'evaluated') {
        const error = new Error('You have already completed an attempt for this assessment. Only one attempt is permitted.');
        error.statusCode = 400;
        throw error;
      }

      // If in_progress, check server-authoritative timer expiry
      if (existing.status === 'in_progress') {
        const now = Date.now();
        const deadlineTime = existing.deadlineAt ? new Date(existing.deadlineAt).getTime() : null;

        if (deadlineTime && now > deadlineTime) {
          // Time has expired: auto-close attempt
          existing.status = 'submitted';
          existing.submittedReason = 'TIME_EXPIRED';
          existing.submittedAt = new Date(deadlineTime);
          existing.timeSpentSeconds = Math.max(
            0,
            Math.round((deadlineTime - new Date(existing.startedAt).getTime()) / 1000)
          );
          await existing.save();

          try {
            const activeSession = await ProctoringSession.findOne({
              submissionId: existing._id,
              status: 'active',
            });
            if (activeSession) {
              await proctoringService.endSession(activeSession._id, studentId, 'TIME_EXPIRED');
            }
          } catch (pErr) {
            console.warn('[SubmissionService] Proctoring close on expiry error:', pErr.message);
          }

          const error = new Error('The allotted time limit for this attempt has expired.');
          error.statusCode = 400;
          throw error;
        }

        if (assessment.proctoringEnabled) {
          let session = await ProctoringSession.findOne({ submissionId: existing._id });
          if (!session) {
            session = await proctoringService.createSession({
              submissionId: existing._id,
              studentId,
              assessmentId: assessment._id,
              cameraRequired: assessment.cameraRequired,
            });
            existing.proctoringSessionId = session._id;
            await existing.save();
          }
        }

        return existing;
      }
    }

    // Compute server-authoritative timing
    const startedAt = new Date();
    const durationMinutes = parseInt(assessment.durationMinutes, 10) || 60;
    let deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    // If assessment has a scheduled platform-wide deadline and it is sooner, respect it
    if (assessment.deadlineAt) {
      const hardDeadline = new Date(assessment.deadlineAt);
      if (hardDeadline > startedAt && hardDeadline < deadlineAt) {
        deadlineAt = hardDeadline;
      }
    }

    // Determine assigned questions and stable ordering (randomization support)
    const allQuestions = await Question.find({ assessmentId: assessment._id }).sort({ orderIndex: 1 });
    let assignedQuestions = [...allQuestions];

    if (assessment.randomization?.enabled && allQuestions.length > 0) {
      if (
        assessment.randomization.poolCount &&
        assessment.randomization.poolCount > 0 &&
        assessment.randomization.poolCount < allQuestions.length
      ) {
        // Randomly select poolCount questions
        const shuffledPool = [...allQuestions];
        for (let i = shuffledPool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
        }
        assignedQuestions = shuffledPool.slice(0, assessment.randomization.poolCount);
      }

      if (assessment.randomization.shuffleOrder) {
        for (let i = assignedQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [assignedQuestions[i], assignedQuestions[j]] = [assignedQuestions[j], assignedQuestions[i]];
        }
      }
    }

    const assignedQuestionIds = assignedQuestions.map((q) => q._id);
    const calculatedTotalPoints =
      assignedQuestions.length > 0
        ? assignedQuestions.reduce((sum, q) => sum + (q.points || 5), 0)
        : assessment.totalPoints || 100;

    const submission = await Submission.create({
      studentId,
      assessmentId,
      answers: {},
      score: 0,
      autoScore: 0,
      manualScore: 0,
      finalScore: 0,
      totalPoints: calculatedTotalPoints,
      percentage: 0,
      passed: false,
      status: 'in_progress',
      resultStatus: 'pending_evaluation',
      evaluationStatus: 'pending',
      startedAt,
      deadlineAt,
      assignedQuestionIds,
    });

    if (assessment.proctoringEnabled) {
      const session = await proctoringService.createSession({
        submissionId: submission._id,
        studentId,
        assessmentId: assessment._id,
        cameraRequired: assessment.cameraRequired,
      });
      submission.proctoringSessionId = session._id;
      await submission.save();
    }

    return submission;
  }

  async autosaveAnswer(submissionId, studentId, questionId, answer) {
    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID format');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    // Ownership verification
    if (submission.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this submission.');
      error.statusCode = 403;
      throw error;
    }

    // Status check
    if (submission.status !== 'in_progress') {
      const error = new Error('Cannot update answers on a finalized or submitted assessment.');
      error.statusCode = 400;
      throw error;
    }

    // Server-authoritative timer check (with 30s network drift grace period)
    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      submission.status = 'submitted';
      submission.submittedReason = 'TIME_EXPIRED';
      submission.submittedAt = new Date(deadlineTime);
      await submission.save();

      try {
        const activeSession = await ProctoringSession.findOne({
          submissionId: submission._id,
          status: 'active',
        });
        if (activeSession) {
          await proctoringService.endSession(activeSession._id, studentId, 'TIME_EXPIRED');
        }
      } catch (pErr) {
        console.warn('[SubmissionService] Proctoring close on autosave expiry error:', pErr.message);
      }

      const error = new Error('Assessment deadline has expired. Your attempt has been closed.');
      error.statusCode = 400;
      throw error;
    }

    // Verify question belongs to the assessment
    const question = await Question.findOne({
      _id: questionId,
      assessmentId: submission.assessmentId,
    });

    if (!question) {
      const error = new Error('Question does not belong to this assessment.');
      error.statusCode = 400;
      throw error;
    }

    // Update answer
    if (submission.answers instanceof Map) {
      submission.answers.set(questionId.toString(), answer);
    } else {
      submission.answers = {
        ...(submission.answers || {}),
        [questionId.toString()]: answer,
      };
    }

    // Authoritative elapsed time calculation
    if (submission.startedAt) {
      submission.timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(submission.startedAt).getTime()) / 1000)
      );
    }

    await submission.save();

    return {
      success: true,
      savedAt: new Date(),
      questionId,
      answer,
    };
  }

  /**
   * Securely execute student source code or SQL query during an active attempt
   * POST /api/submissions/:submissionId/run-code
   */
  async runCode(submissionId, studentId, { questionId, code, language, customStdin = '' }) {
    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID format');
      error.statusCode = 400;
      throw error;
    }

    if (typeof code !== 'string' || !code.trim()) {
      const error = new Error('Source code cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    if (code.length > 65536) {
      const error = new Error('Source code exceeds maximum size limit (64KB)');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    // Ownership verification
    if (submission.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this submission attempt.');
      error.statusCode = 403;
      throw error;
    }

    // Attempt status check
    if (submission.status !== 'in_progress') {
      const error = new Error('Cannot execute code on a submitted or finalized assessment.');
      error.statusCode = 400;
      throw error;
    }

    // Server-authoritative timer deadline check (with 30s network drift grace period)
    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      const error = new Error('Assessment deadline has expired.');
      error.statusCode = 400;
      throw error;
    }

    const question = await Question.findById(questionId);
    if (!question || question.assessmentId.toString() !== submission.assessmentId.toString()) {
      const error = new Error('Question not found in this assessment');
      error.statusCode = 404;
      throw error;
    }

    // Verify question is assigned to this attempt if randomized pool is active
    if (submission.assignedQuestionIds && submission.assignedQuestionIds.length > 0) {
      const isAssigned = submission.assignedQuestionIds.some((id) => id.toString() === questionId.toString());
      if (!isAssigned) {
        const error = new Error('Question is not assigned to this student attempt');
        error.statusCode = 403;
        throw error;
      }
    }

    if (!['code', 'sql'].includes(question.type)) {
      const error = new Error('Code execution is only supported for coding and SQL questions');
      error.statusCode = 400;
      throw error;
    }

    const codingCfg = question.codingConfig || {};
    const executionCategory = codingCfg.executionCategory || (question.type === 'sql' ? 'sql' : 'code');
    const selectedLang = (language || '').toLowerCase().trim();

    const timeoutMs = Math.min(codingCfg.cpuTimeLimitMs || 2000, 5000);
    const memoryLimitMb = Math.min(codingCfg.memoryLimitMb || 256, 512);

    if (executionCategory === 'code') {
      const allowedLangs = (codingCfg.allowedLanguages || ['python', 'javascript']).filter((l) =>
        ['python', 'javascript'].includes(l)
      );
      if (!allowedLangs.includes(selectedLang)) {
        const error = new Error(`Language '${selectedLang}' is not permitted for this question. Allowed: ${allowedLangs.join(', ')}`);
        error.statusCode = 400;
        throw error;
      }

      // If student provided custom stdin, execute single run
      if (typeof customStdin === 'string' && customStdin.trim().length > 0) {
        const clientRes = await executionClient.executeCode({
          language: selectedLang,
          code,
          stdin: customStdin,
          timeoutMs,
          memoryLimitMb,
        });

        if (!clientRes.ok || !clientRes.data?.success) {
          const error = new Error(clientRes.data?.message || 'Code execution service error');
          error.statusCode = clientRes.status || 500;
          throw error;
        }

        const runRes = clientRes.data.data;

        return {
          verdict: runRes.verdict,
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: runRes.executionTimeMs,
          customRun: true,
        };
      }

      // Evaluate against public sample test cases (strictly !isHidden)
      const publicCases = (codingCfg.testCases || []).filter((tc) => !tc.isHidden);

      if (publicCases.length === 0) {
        const clientRes = await executionClient.executeCode({
          language: selectedLang,
          code,
          stdin: '',
          timeoutMs,
          memoryLimitMb,
        });

        if (!clientRes.ok || !clientRes.data?.success) {
          const error = new Error(clientRes.data?.message || 'Code execution service error');
          error.statusCode = clientRes.status || 500;
          throw error;
        }

        const runRes = clientRes.data.data;

        return {
          verdict: runRes.verdict,
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: runRes.executionTimeMs,
        };
      }

      // Run suite over public sample cases
      const clientRes = await executionClient.executeSuite({
        language: selectedLang,
        code,
        testCases: publicCases.map((tc) => ({
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: false,
          weight: tc.weight || 1,
        })),
        timeoutMs,
        memoryLimitMb,
      });

      if (!clientRes.ok || !clientRes.data?.success) {
        const error = new Error(clientRes.data?.message || 'Code execution service error');
        error.statusCode = clientRes.status || 500;
        throw error;
      }

      const suiteRes = clientRes.data.data;

      const firstFail = (suiteRes.testCases || []).find((tc) => !tc.passed);
      const overallVerdict = suiteRes.verdict || (firstFail ? firstFail.verdict : 'ACCEPTED');

      return {
        verdict: overallVerdict,
        passedCount: suiteRes.passedCount,
        totalCount: suiteRes.totalCount,
        stdout: firstFail ? firstFail.actualOutput : (suiteRes.testCases?.[0]?.actualOutput || ''),
        stderr: firstFail?.stderr || '',
        executionTimeMs: suiteRes.testCases?.[0]?.executionTimeMs || 0,
        sampleResults: (suiteRes.testCases || []).map((stc, idx) => ({
          sampleIndex: idx + 1,
          passed: stc.passed,
          verdict: stc.verdict,
          input: publicCases[idx]?.input || '',
          expectedOutput: publicCases[idx]?.expectedOutput || '',
          actualOutput: stc.actualOutput,
          executionTimeMs: stc.executionTimeMs,
          explanation: publicCases[idx]?.explanation || '',
        })),
      };
    } else {
      // executionCategory === 'sql'
      const dialect = (selectedLang || codingCfg.sqlDialect || 'sqlite').toLowerCase();
      if (['postgresql', 'postgres', 'mysql'].includes(dialect)) {
        const error = new Error(`SQL dialect '${dialect}' is rejected at API boundary. Active SQL examination is restricted to SQLite only.`);
        error.statusCode = 400;
        throw error;
      }
      if (dialect !== 'sqlite') {
        const error = new Error(`SQL dialect '${dialect}' is not supported. Permitted: sqlite`);
        error.statusCode = 400;
        throw error;
      }

      const publicCases = (codingCfg.testCases || []).filter((tc) => !tc.isHidden);
      const casesToRun = publicCases.length > 0 ? publicCases : [null];
      const sampleResults = [];
      let overallVerdict = 'ACCEPTED';
      let lastSqlRes = null;

      for (let idx = 0; idx < casesToRun.length; idx++) {
        const tc = casesToRun[idx];
        let expectedOutput = null;
        if (tc) {
          if (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0) {
            expectedOutput = {
              columns: tc.expectedColumns || [],
              rows: tc.expectedRows || [],
            };
          } else if (tc.expectedOutput) {
            expectedOutput = tc.expectedOutput;
          }
        }

        let ddl = codingCfg.schemaDdl || '';
        if (tc && tc.input && tc.input.trim()) {
          ddl = `${ddl}\n${tc.input.trim()}`;
        }

        const clientRes = await executionClient.executeSql({
          dialect,
          schemaDdl: ddl,
          query: code,
          expectedOutput,
          timeoutMs,
        });

        if (!clientRes.ok || !clientRes.data?.success) {
          const error = new Error(clientRes.data?.message || 'SQL execution service error');
          error.statusCode = clientRes.status || 500;
          throw error;
        }

        const sqlRes = clientRes.data.data;
        if (!lastSqlRes) lastSqlRes = sqlRes;
        const passed = sqlRes.verdict === 'ACCEPTED';
        if (!passed && overallVerdict === 'ACCEPTED') {
          overallVerdict = sqlRes.verdict;
        }

        if (tc) {
          sampleResults.push({
            sampleIndex: idx + 1,
            passed,
            verdict: sqlRes.verdict,
            expectedColumns: tc.expectedColumns,
            expectedRows: tc.expectedRows,
            actualColumns: sqlRes.columns,
            actualRows: sqlRes.rows,
            explanation: tc.explanation || `Sample query evaluation ${idx + 1}`,
          });
        }
      }

      return {
        verdict: overallVerdict,
        passedCount: sampleResults.filter((s) => s.passed).length,
        totalCount: sampleResults.length,
        stdout: lastSqlRes?.stdout || '',
        stderr: lastSqlRes?.stderr || '',
        exitCode: lastSqlRes?.exitCode || 0,
        columns: lastSqlRes?.columns || [],
        rows: lastSqlRes?.rows || [],
        rowCount: lastSqlRes?.rowCount || 0,
        executionTimeMs: lastSqlRes?.executionTimeMs || 0,
        sampleResults: sampleResults.length > 0 ? sampleResults : undefined,
      };
    }
  }

  async saveProgress(submissionId, studentId, answers) {
    const submission = await Submission.findOne({
      _id: submissionId,
      studentId,
      status: 'in_progress',
    });

    if (!submission) {
      const error = new Error('Active submission not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    // Check timer
    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      submission.status = 'submitted';
      submission.submittedReason = 'TIME_EXPIRED';
      submission.submittedAt = new Date(deadlineTime);
      await submission.save();

      const error = new Error('Assessment deadline has expired.');
      error.statusCode = 400;
      throw error;
    }

    let normalizedAnswers = answers || {};
    if (Array.isArray(answers)) {
      normalizedAnswers = {};
      for (const item of answers) {
        if (item && item.questionId) {
          normalizedAnswers[item.questionId.toString()] = item.answer;
        }
      }
    }

    submission.answers = normalizedAnswers;

    if (submission.startedAt) {
      submission.timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(submission.startedAt).getTime()) / 1000)
      );
    }

    await submission.save();
    return submission;
  }

  async submitAssessment(submissionId, studentId, answers = null) {
    // Atomic CAS transition: ensure only ONE concurrent request can transition and submit this attempt
    const submission = await Submission.findOneAndUpdate(
      {
        _id: submissionId,
        studentId,
        status: 'in_progress',
      },
      {
        $set: {
          status: 'submitted',
          submittedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!submission) {
      const existing = await Submission.findOne({ _id: submissionId, studentId });
      if (!existing) {
        const error = new Error('Submission not found');
        error.statusCode = 404;
        throw error;
      }
      const error = new Error('This assessment has already been submitted');
      error.statusCode = 400;
      throw error;
    }

    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    const isExpired = deadlineTime && now > deadlineTime + 30000;

    const assessment = await Assessment.findById(submission.assessmentId);
    let questions;
    if (submission.assignedQuestionIds && submission.assignedQuestionIds.length > 0) {
      questions = await Question.find({ _id: { $in: submission.assignedQuestionIds } });
    } else {
      questions = await Question.find({ assessmentId: submission.assessmentId });
    }

    let normalizedAnswers = answers;
    if (Array.isArray(answers)) {
      normalizedAnswers = {};
      for (const item of answers) {
        if (item && item.questionId) {
          normalizedAnswers[item.questionId.toString()] = item.answer;
        }
      }
    }

    const currentAnswers = submission.answers instanceof Map
      ? Object.fromEntries(submission.answers)
      : (submission.answers || {});
    const finalAnswers = normalizedAnswers !== null && normalizedAnswers !== undefined ? normalizedAnswers : currentAnswers;

    let autoScore = 0;
    let totalPoints = 0;
    let hasSubjective = false;

    questions.forEach((q) => {
      totalPoints += q.points;
      const studentAnswer = finalAnswers[q._id.toString()];

      if (q.type === 'mcq' || q.type === 'true_false') {
        if (
          studentAnswer !== undefined &&
          String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
        ) {
          autoScore += q.points;
        }
      } else if (q.type === 'short_answer' || q.type === 'long_answer' || q.type === 'code' || q.type === 'sql' || q.type === 'file_upload') {
        hasSubjective = true;
      }
    });

    submission.answers = finalAnswers;
    submission.submittedAt = new Date();
    submission.submittedReason = isExpired ? 'TIME_EXPIRED' : 'USER_SUBMITTED';
    submission.timeSpentSeconds = Math.max(
      0,
      Math.round((submission.submittedAt.getTime() - new Date(submission.startedAt).getTime()) / 1000)
    );
    submission.autoScore = autoScore;
    submission.totalPoints = totalPoints || assessment.totalPoints || 100;

    if (hasSubjective) {
      // Subjective answers are pending instructor manual grading
      submission.manualScore = 0;
      submission.score = autoScore; // provisional score from objective
      submission.finalScore = autoScore;
      submission.percentage = Math.round((autoScore / submission.totalPoints) * 100 * 100) / 100;
      submission.passed = false;
      submission.status = 'submitted';
      submission.resultStatus = 'pending_evaluation';
      submission.evaluationStatus = 'pending';
    } else {
      // 100% objective questions - result can be finalized immediately
      const finalPercentage = submission.totalPoints > 0
        ? Math.round((autoScore / submission.totalPoints) * 100 * 100) / 100
        : 0;

      // Distinguish assessment passing score from certification eligibility threshold
      const assessmentPassingScore = typeof assessment.passingScore === 'number'
        ? assessment.passingScore
        : 60;
      const passed = finalPercentage >= assessmentPassingScore;

      // Certification eligibility evaluated strictly against explicit certification rules
      const certEnabled = Boolean(assessment.certification && assessment.certification.enabled);
      const certPassingPercentage = (assessment.certification && typeof assessment.certification.passingPercentage === 'number')
        ? assessment.certification.passingPercentage
        : 50;
      const certificateEligible = certEnabled && (finalPercentage >= certPassingPercentage);

      // Authoritative grade resolution against configured grading scheme and assessment threshold
      const gradeResolution = resolveGrade(
        finalPercentage,
        assessment.certification?.gradingScheme,
        assessmentPassingScore
      );

      submission.manualScore = 0;
      submission.score = autoScore;
      submission.finalScore = autoScore;
      submission.percentage = finalPercentage;
      submission.passed = passed;
      submission.status = 'evaluated';
      submission.resultStatus = passed ? 'passed' : 'failed';
      submission.evaluationStatus = 'completed';

      // Create automatic evaluation record
      const evaluation = await Evaluation.create({
        submissionId: submission._id,
        evaluatorId: assessment.instructorId,
        questionFeedback: {},
        generalFeedback: 'Automated objective evaluation completed.',
        finalScore: autoScore,
        percentage: finalPercentage,
        grade: gradeResolution.grade,
        gradeLabel: gradeResolution.label,
        passed,
        certificateEligible,
        outcomeFeedback: gradeResolution.outcomeFeedback,
        status: 'completed',
        gradedAt: new Date(),
      });

      // Automatically issue certificate if eligible
      if (certificateEligible) {
        try {
          const certificateService = require('./certificate.service');
          const studentUser = await User.findById(studentId);
          await certificateService.issueCertificateForEvaluation(
            evaluation,
            submission,
            assessment,
            studentUser
          );
        } catch (certErr) {
          console.warn('[SubmissionService] Non-fatal certificate issuance error:', certErr.message);
        }
      }
    }

    await submission.save();

    // Automatically conclude any active proctoring session
    try {
      const activeSession = await ProctoringSession.findOne({
        submissionId: submission._id,
        status: 'active',
      });
      if (activeSession) {
        await proctoringService.endSession(
          activeSession._id,
          studentId,
          isExpired ? 'TIME_EXPIRED' : 'USER_SUBMITTED'
        );
      }
    } catch (procErr) {
      console.warn('[SubmissionService] Non-fatal proctoring session completion error:', procErr.message);
    }

    // Notify instructor of new submission
    await Notification.create({
      userId: assessment.instructorId,
      title: 'New Assessment Submission',
      message: `A student has submitted "${assessment.title}".`,
      type: 'assessment',
      link: `/instructor/evaluate/${submission._id}`,
    });

    try {
      const [instructorUser, studentUser] = await Promise.all([
        User.findById(assessment.instructorId),
        User.findById(studentId),
      ]);
      if (instructorUser && studentUser) {
        await emailService.sendSubmissionReceivedEmail(
          instructorUser,
          studentUser,
          assessment,
          submission
        );
      }
      if (submission.status === 'evaluated' && studentUser) {
        await emailService.sendGradeReleasedEmail(studentUser, assessment, submission);
      }
    } catch (err) {
      console.warn('[SubmissionService] Non-fatal notification error on submit:', err.message);
    }

    return submission;
  }

  async getStudentSubmissions(studentId) {
    const submissions = await Submission.find({ studentId })
      .populate('assessmentId', 'title category totalPoints passingScore durationMinutes deadlineAt scheduledAt status accessType certification')
      .populate('evaluation')
      .sort({ createdAt: -1 });

    const now = Date.now();
    for (const sub of submissions) {
      if (sub.status === 'in_progress' && sub.deadlineAt) {
        const deadlineTime = new Date(sub.deadlineAt).getTime();
        if (now > deadlineTime) {
          sub.status = 'submitted';
          sub.submittedReason = 'TIME_EXPIRED';
          sub.submittedAt = new Date(deadlineTime);
          sub.timeSpentSeconds = Math.max(
            0,
            Math.round((deadlineTime - new Date(sub.startedAt).getTime()) / 1000)
          );
          await sub.save();

          try {
            const activeSession = await ProctoringSession.findOne({
              submissionId: sub._id,
              status: 'active',
            });
            if (activeSession) {
              await proctoringService.endSession(activeSession._id, studentId, 'TIME_EXPIRED');
            }
          } catch (pErr) {
            console.warn('[SubmissionService] Proctoring close on expiry error:', pErr.message);
          }
        }
      }
    }

    // Attach any earned certificates for this student
    const { Certificate } = require('../models');
    let certMap = new Map();
    try {
      const certificates = await Certificate.find({ studentId }).select(
        '_id certificateId assessmentId status issuedAt verificationCode'
      );
      for (const c of certificates) {
        if (c.assessmentId) {
          certMap.set(c.assessmentId.toString(), {
            id: c._id.toString(),
            _id: c._id.toString(),
            certificateId: c.certificateId,
            status: c.status,
            issuedAt: c.issuedAt,
            verificationCode: c.verificationCode,
          });
        }
      }
    } catch (cErr) {
      console.warn('[SubmissionService] Non-fatal certificate lookup error:', cErr.message);
    }

    return submissions.map((sub) => {
      const json = sub.toJSON();
      json.assessment = json.assessmentId;
      delete json.assessmentId;
      const asmtId = (json.assessment?._id || json.assessment?.id || json.assessment)?.toString();
      json.certificate = asmtId ? (certMap.get(asmtId) || null) : null;
      return json;
    });
  }

  async getSubmissionById(submissionId, userId, role) {
    const submission = await Submission.findById(submissionId)
      .populate('assessmentId')
      .populate('studentId', 'name email avatar studentId department instituteCode')
      .populate({
        path: 'evaluation',
        populate: { path: 'evaluatorId', select: 'name email avatar facultyId department' },
      });

    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    if (role === 'student' && submission.studentId._id.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this submission');
      error.statusCode = 403;
      throw error;
    }

    if (role === 'instructor') {
      const assessmentOwnerId = (
        submission.assessmentId?.instructorId?._id || submission.assessmentId?.instructorId
      )?.toString();
      if (assessmentOwnerId && assessmentOwnerId !== userId.toString()) {
        const error = new Error('Access denied. You do not own the assessment for this submission.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Query questions ordered by assessment index
    const rawQuestions = await Question.find({ assessmentId: submission.assessmentId._id })
      .sort({ orderIndex: 1 });

    const json = submission.toJSON();
    json.assessment = json.assessmentId;

    // Student privacy: student callers must NEVER receive internal evaluator rubrics/metadata ('explanation'),
    // correct answer keys ('correctAnswer'), or hidden test cases.
    if (json.assessment) {
      json.assessment.questions = rawQuestions.map((q) => {
        const qObj = q.toJSON();
        if (role === 'student') {
          delete qObj.correctAnswer;
          delete qObj.explanation;
          if (qObj.codingConfig && Array.isArray(qObj.codingConfig.testCases)) {
            // Strictly filter out hidden test cases for student callers
            qObj.codingConfig.testCases = qObj.codingConfig.testCases.filter((tc) => !tc.isHidden);
          }
        }
        return qObj;
      });
    }

    // Ensure evaluated submissions have pointsAwarded populated for objective questions in questionFeedback
    if (submission.status === 'evaluated' && json.evaluation) {
      const qFb = json.evaluation.questionFeedback || {};
      const answersMap = submission.answers instanceof Map
        ? Object.fromEntries(submission.answers)
        : (submission.answers || {});

      rawQuestions.forEach((q) => {
        const qId = q._id.toString();
        if (q.type === 'mcq' || q.type === 'true_false') {
          if (!qFb[qId] || qFb[qId].pointsAwarded === undefined) {
            const studentAns = answersMap[qId];
            const isCorrect =
              studentAns !== undefined &&
              q.correctAnswer !== undefined &&
              q.correctAnswer !== null &&
              String(studentAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
            qFb[qId] = {
              ...(qFb[qId] || {}),
              pointsAwarded: isCorrect ? q.points : 0,
              comment: qFb[qId]?.comment || '',
            };
          }
        }
      });
      json.evaluation.questionFeedback = qFb;
    }

    json.student = json.studentId;
    delete json.assessmentId;
    delete json.studentId;

    // Attach proctoring details for read-only visibility
    try {
      const proctoringSession = await ProctoringSession.findOne({ submissionId: submission._id });
      if (proctoringSession) {
        const events = await ProctoringEvent.find({ sessionId: proctoringSession._id }).sort({ timestamp: 1 });
        json.proctoring = {
          session: proctoringSession,
          events,
        };
      }
    } catch (procErr) {
      console.warn('[SubmissionService] Non-fatal proctoring retrieval error:', procErr.message);
    }

    return json;
  }

  /**
   * Upload an answer document file for a FILE_UPLOAD question.
   * Does NOT trigger final submission. Replaces any existing draft file safely.
   */
  async uploadAnswerFile(submissionId, studentId, questionId, file) {
    if (!file || !file.buffer) {
      const error = new Error('No document file uploaded');
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    // Ownership check
    if (submission.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this submission.');
      error.statusCode = 403;
      throw error;
    }

    // Status check
    if (submission.status !== 'in_progress') {
      const error = new Error('Cannot upload document answers on a finalized or submitted assessment');
      error.statusCode = 400;
      throw error;
    }

    // Timer and deadline check
    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      submission.status = 'submitted';
      submission.submittedReason = 'TIME_EXPIRED';
      submission.submittedAt = new Date(deadlineTime);
      await submission.save();

      const error = new Error('Assessment deadline has expired. Your attempt has been closed.');
      error.statusCode = 400;
      throw error;
    }

    // Question check
    const question = await Question.findOne({
      _id: questionId,
      assessmentId: submission.assessmentId,
    });

    if (!question) {
      const error = new Error('Question does not belong to this assessment');
      error.statusCode = 400;
      throw error;
    }

    if (question.type !== 'file_upload') {
      const error = new Error('This question does not accept file uploads');
      error.statusCode = 400;
      throw error;
    }

    // Question-level max size check
    const maxMb = question.fileUploadConfig?.maxFileSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      const error = new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of ${maxMb}MB`);
      error.statusCode = 413;
      throw error;
    }

    const allowedExtensions = question.fileUploadConfig?.allowedFileTypes || ['pdf', 'doc', 'docx'];

    // Clean up previous file if student is replacing a draft file
    const currentAnswers = submission.answers instanceof Map ? Object.fromEntries(submission.answers) : (submission.answers || {});
    const previousAnswer = currentAnswers[questionId.toString()];
    if (previousAnswer && previousAnswer.type === 'file' && previousAnswer.fileKey) {
      await storageService.deleteDocumentFile(previousAnswer.fileKey);
    }

    // Save file via storageService
    const savedMetadata = await storageService.saveDocumentFile({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      submissionId,
      questionId,
      allowedExtensions,
    });

    // Update submission answer
    if (submission.answers instanceof Map) {
      submission.answers.set(questionId.toString(), savedMetadata);
    } else {
      submission.answers = {
        ...(submission.answers || {}),
        [questionId.toString()]: savedMetadata,
      };
    }

    if (submission.startedAt) {
      submission.timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(submission.startedAt).getTime()) / 1000)
      );
    }

    await submission.save();

    return {
      success: true,
      questionId,
      answer: savedMetadata,
    };
  }

  /**
   * Attach a Google Docs URL for a FILE_UPLOAD question.
   * Does NOT trigger final submission. Replaces any existing draft answer safely.
   */
  async attachGoogleDocsUrl(submissionId, studentId, questionId, googleDocsUrl) {
    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    if (submission.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this submission.');
      error.statusCode = 403;
      throw error;
    }

    if (submission.status !== 'in_progress') {
      const error = new Error('Cannot update answers on a finalized or submitted assessment');
      error.statusCode = 400;
      throw error;
    }

    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      submission.status = 'submitted';
      submission.submittedReason = 'TIME_EXPIRED';
      submission.submittedAt = new Date(deadlineTime);
      await submission.save();

      const error = new Error('Assessment deadline has expired. Your attempt has been closed.');
      error.statusCode = 400;
      throw error;
    }

    const question = await Question.findOne({
      _id: questionId,
      assessmentId: submission.assessmentId,
    });

    if (!question) {
      const error = new Error('Question does not belong to this assessment');
      error.statusCode = 400;
      throw error;
    }

    if (question.type !== 'file_upload') {
      const error = new Error('This question does not accept document submissions');
      error.statusCode = 400;
      throw error;
    }

    if (question.fileUploadConfig && question.fileUploadConfig.allowGoogleDocs === false) {
      const error = new Error('Google Docs submissions are not allowed for this question');
      error.statusCode = 400;
      throw error;
    }

    // Validate Google Docs URL strictly (format, domain, SSRF safe)
    const docsMetadata = storageService.validateGoogleDocsUrl(googleDocsUrl);

    // Clean up previous file if present
    const currentAnswers = submission.answers instanceof Map ? Object.fromEntries(submission.answers) : (submission.answers || {});
    const previousAnswer = currentAnswers[questionId.toString()];
    if (previousAnswer && previousAnswer.type === 'file' && previousAnswer.fileKey) {
      await storageService.deleteDocumentFile(previousAnswer.fileKey);
    }

    // Set Google Docs answer
    if (submission.answers instanceof Map) {
      submission.answers.set(questionId.toString(), docsMetadata);
    } else {
      submission.answers = {
        ...(submission.answers || {}),
        [questionId.toString()]: docsMetadata,
      };
    }

    if (submission.startedAt) {
      submission.timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(submission.startedAt).getTime()) / 1000)
      );
    }

    await submission.save();

    return {
      success: true,
      questionId,
      answer: docsMetadata,
    };
  }

  /**
   * Remove/clear a draft answer file for a FILE_UPLOAD question before final submission.
   */
  async removeAnswerFile(submissionId, studentId, questionId) {
    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    if (submission.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this submission.');
      error.statusCode = 403;
      throw error;
    }

    if (submission.status !== 'in_progress') {
      const error = new Error('Cannot remove submitted files after final submission');
      error.statusCode = 400;
      throw error;
    }

    const currentAnswers = submission.answers instanceof Map ? Object.fromEntries(submission.answers) : (submission.answers || {});
    const existing = currentAnswers[questionId.toString()];
    if (existing && existing.type === 'file' && existing.fileKey) {
      await storageService.deleteDocumentFile(existing.fileKey);
    }

    if (submission.answers instanceof Map) {
      submission.answers.delete(questionId.toString());
    } else {
      delete submission.answers[questionId.toString()];
    }

    await submission.save();

    return {
      success: true,
      questionId,
      message: 'Draft answer file removed successfully',
    };
  }

  /**
   * Retrieve secure document file for streaming/download.
   * Enforces role-based and ownership-based authorization.
   */
  async getAnswerFile(submissionId, userId, role, questionId) {
    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId).populate('assessmentId');
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    // Role-based authorization:
    // Student: only their own submission
    if (role === 'student' && submission.studentId.toString() !== userId.toString()) {
      const error = new Error('Access denied. You can only view documents from your own submissions.');
      error.statusCode = 403;
      throw error;
    }

    // Instructor: only assessments they own
    if (role === 'instructor') {
      const assessmentOwnerId = (
        submission.assessmentId?.instructorId?._id || submission.assessmentId?.instructorId
      )?.toString();
      if (assessmentOwnerId && assessmentOwnerId !== userId.toString()) {
        const error = new Error('Access denied. You do not own the assessment for this submission.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Retrieve question answer
    const currentAnswers = submission.answers instanceof Map ? Object.fromEntries(submission.answers) : (submission.answers || {});
    const answer = currentAnswers[questionId.toString()];

    if (!answer || answer.type !== 'file' || !answer.fileKey) {
      const error = new Error('No file submission found for this question');
      error.statusCode = 404;
      throw error;
    }

    const filePath = storageService.getDocumentFilePath(answer.fileKey);

    return {
      filePath,
      originalFilename: answer.originalFilename || 'document.pdf',
      mimeType: answer.mimeType || 'application/pdf',
      size: answer.size,
    };
  }
}

module.exports = new SubmissionService();
