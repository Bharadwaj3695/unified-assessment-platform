const mongoose = require('mongoose');
const QuestionImportJob = require('../models/QuestionImportJob');
const questionParserService = require('./questionParser.service');
const googleFormsService = require('./googleForms.service');
const aiClassificationService = require('./aiClassification.service');
const questionBankService = require('./questionBank.service');
const logger = require('../utils/logger');

class QuestionImportService {
  /**
   * Initialize a file-based question import job (PDF, DOCX, DOC)
   */
  async createFileImportJob(instructorId, file) {
    if (!file || !file.buffer) {
      const err = new Error('No valid file uploaded for question import');
      err.statusCode = 400;
      throw err;
    }

    const filename = file.originalname || 'document.pdf';
    const ext = filename.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'docx', 'doc'];

    if (!allowedExts.includes(ext)) {
      const err = new Error(`Unsupported file format .${ext}. Allowed formats: PDF, DOC, DOCX.`);
      err.statusCode = 400;
      throw err;
    }

    let sourceType = 'PDF';
    if (ext === 'docx') sourceType = 'DOCX';
    if (ext === 'doc') sourceType = 'DOC';

    const job = await QuestionImportJob.create({
      instructorId,
      sourceType,
      sourceFilename: filename,
      status: 'QUEUED',
      progress: 0,
    });

    logger.info('question_import_started', {
      jobId: job._id,
      sourceType,
      filename,
      instructorId,
    });

    // Run processing worker asynchronously (or directly)
    this.processFileJob(job._id, file.buffer, filename).catch((err) => {
      logger.error('question_import_worker_unhandled', { jobId: job._id, error: err.message });
    });

    return job;
  }

  /**
   * Initialize Google Forms question import job
   */
  async createGoogleFormsImportJob(instructorId, formsUrlOrId, options = {}) {
    if (!formsUrlOrId) {
      const err = new Error('Google Form URL or Form ID is required for import.');
      err.statusCode = 400;
      throw err;
    }

    const job = await QuestionImportJob.create({
      instructorId,
      sourceType: 'GOOGLE_FORMS',
      sourceReference: typeof formsUrlOrId === 'string' ? formsUrlOrId : 'JSON payload',
      status: 'QUEUED',
      progress: 0,
    });

    logger.info('question_import_started', {
      jobId: job._id,
      sourceType: 'GOOGLE_FORMS',
      instructorId,
    });

    this.processGoogleFormsJob(job._id, formsUrlOrId, options).catch((err) => {
      logger.error('google_forms_worker_unhandled', { jobId: job._id, error: err.message });
    });

    return job;
  }

  /**
   * In-process worker: Process file document parsing & AI classification
   */
  async processFileJob(jobId, buffer, filename) {
    const job = await QuestionImportJob.findById(jobId);
    if (!job) return;

    try {
      job.status = 'PROCESSING';
      job.progress = 20;
      await job.save();

      // 1. Text Extraction
      const rawText = await questionParserService.extractTextFromFile(buffer, filename);
      job.progress = 45;
      await job.save();

      // 2. Question Parsing
      const detected = questionParserService.parseTextToQuestions(rawText);
      if (!detected || detected.length === 0) {
        job.status = 'FAILED';
        job.progress = 100;
        job.errors.push('No valid questions could be detected or parsed from the uploaded document.');
        await job.save();
        logger.warn('question_import_failed', { jobId, reason: 'No questions detected' });
        return;
      }

      job.progress = 60;
      await job.save();

      // 3. AI / Heuristic Classification & Duplicate Detection
      const processedQuestions = [];
      for (const q of detected) {
        const aiResult = await aiClassificationService.classifyQuestion({
          questionText: q.questionText,
          options: q.options,
          rawText: q.rawBlock,
        });

        const duplicate = await questionBankService.checkDuplicate(q.questionText, job.instructorId);

        processedQuestions.push({
          tempId: q.tempId,
          questionText: q.questionText,
          normalizedText: questionBankService.normalizeText(q.questionText),
          type: q.type || aiResult.type,
          options: q.options || [],
          correctAnswer: q.correctAnswer || null,
          explanation: q.explanation || null,
          points: q.points || 5,
          difficulty: aiResult.difficulty,
          bloomLevel: aiResult.bloomLevel,
          confidence: aiResult.confidence,
          tags: [],
          category: 'General',
          reviewStatus: 'PENDING',
          isDuplicate: Boolean(duplicate),
          duplicateQuestionId: duplicate?._id || null,
          isUnsupported: false,
          unsupportedReason: null,
        });
      }

      job.extractedQuestions = processedQuestions;
      job.totalDetected = processedQuestions.length;
      job.status = 'REVIEW_REQUIRED';
      job.progress = 100;
      await job.save();

      logger.info('question_import_completed', {
        jobId,
        totalDetected: processedQuestions.length,
      });
    } catch (err) {
      job.status = 'FAILED';
      job.progress = 100;
      job.errors.push(err.message || 'File parsing failure.');
      await job.save();
      logger.error('question_import_failed', { jobId, error: err.message });
    }
  }

  /**
   * In-process worker: Process Google Forms import
   */
  async processGoogleFormsJob(jobId, formsUrlOrId, options = {}) {
    const job = await QuestionImportJob.findById(jobId);
    if (!job) return;

    try {
      job.status = 'PROCESSING';
      job.progress = 20;
      await job.save();

      // 1. Fetch Form
      const formData = await googleFormsService.fetchForm(formsUrlOrId, options);
      job.progress = 50;
      await job.save();

      // 2. Normalize Questions
      const { questions } = googleFormsService.normalizeGoogleForm(formData);
      if (!questions || questions.length === 0) {
        job.status = 'FAILED';
        job.progress = 100;
        job.errors.push('No questions found in Google Form.');
        await job.save();
        logger.warn('question_import_failed', { jobId, reason: 'Empty Google Form' });
        return;
      }

      // 3. AI / Heuristic Classification & Duplicate Detection
      const processedQuestions = [];
      for (const q of questions) {
        const aiResult = await aiClassificationService.classifyQuestion({
          questionText: q.questionText,
          options: q.options,
        });

        const duplicate = await questionBankService.checkDuplicate(q.questionText, job.instructorId);

        processedQuestions.push({
          tempId: q.tempId,
          questionText: q.questionText,
          normalizedText: questionBankService.normalizeText(q.questionText),
          type: q.type,
          options: q.options || [],
          correctAnswer: q.correctAnswer || null,
          explanation: q.explanation || null,
          points: q.points || 5,
          difficulty: aiResult.difficulty,
          bloomLevel: aiResult.bloomLevel,
          confidence: aiResult.confidence,
          tags: [],
          category: 'General',
          reviewStatus: 'PENDING',
          isDuplicate: Boolean(duplicate),
          duplicateQuestionId: duplicate?._id || null,
          isUnsupported: Boolean(q.isUnsupported),
          unsupportedReason: q.unsupportedReason || null,
        });
      }

      job.extractedQuestions = processedQuestions;
      job.totalDetected = processedQuestions.length;
      job.status = 'REVIEW_REQUIRED';
      job.progress = 100;
      await job.save();

      logger.info('question_import_completed', {
        jobId,
        totalDetected: processedQuestions.length,
      });
    } catch (err) {
      job.status = 'FAILED';
      job.progress = 100;
      job.errors.push(err.message || 'Google Forms parsing failure.');
      await job.save();
      logger.error('question_import_failed', { jobId, error: err.message });
    }
  }

  /**
   * Faculty review: Accept or Reject individual question with edits
   */
  async reviewQuestion(jobId, instructorId, tempId, action, reviewData = {}) {
    const job = await QuestionImportJob.findById(jobId);
    if (!job) {
      const err = new Error('Import job not found');
      err.statusCode = 404;
      throw err;
    }

    if (job.instructorId.toString() !== instructorId.toString()) {
      const err = new Error('Access denied. You do not own this import job.');
      err.statusCode = 403;
      throw err;
    }

    const question = job.extractedQuestions.find((q) => q.tempId === tempId);
    if (!question) {
      const err = new Error('Question not found in import job.');
      err.statusCode = 404;
      throw err;
    }

    if (question.reviewStatus !== 'PENDING') {
      const err = new Error(`This question has already been reviewed (${question.reviewStatus}).`);
      err.statusCode = 400;
      throw err;
    }

    const upperAction = String(action || '').toUpperCase();
    let approvedBankQuestion = null;

    if (upperAction === 'ACCEPT') {
      const finalPrompt = reviewData.questionText || question.questionText;
      const finalType = reviewData.type || question.type;
      const finalOptions = reviewData.options !== undefined ? reviewData.options : question.options;
      const finalAnswer = reviewData.correctAnswer !== undefined ? reviewData.correctAnswer : question.correctAnswer;
      const finalExplanation = reviewData.explanation !== undefined ? reviewData.explanation : question.explanation;
      const finalPoints = reviewData.points !== undefined ? reviewData.points : question.points;
      const finalDifficulty = reviewData.difficulty || question.difficulty;
      const finalBloom = reviewData.bloomLevel || question.bloomLevel;
      const finalTags = reviewData.tags || question.tags;
      const finalCategory = reviewData.category || question.category || 'General';

      approvedBankQuestion = await questionBankService.createQuestion(
        instructorId,
        {
          questionText: finalPrompt,
          type: finalType,
          options: finalOptions,
          correctAnswer: finalAnswer,
          explanation: finalExplanation,
          points: finalPoints,
          difficulty: finalDifficulty,
          bloomLevel: finalBloom,
          tags: finalTags,
          category: finalCategory,
          status: 'APPROVED',
          source: job.sourceType,
          sourceMetadata: {
            importJobId: job._id,
            originalFilename: job.sourceFilename,
            formsUrl: job.sourceReference,
          },
          classificationConfidence: question.confidence,
          classificationSource: 'AI',
        },
        { allowDuplicate: true }
      );

      question.reviewStatus = 'ACCEPTED';
      job.totalAccepted++;
      logger.info('question_reviewed', { jobId, tempId, action: 'ACCEPTED' });
    } else if (upperAction === 'REJECT') {
      question.reviewStatus = 'REJECTED';
      job.totalRejected++;
      logger.info('question_reviewed', { jobId, tempId, action: 'REJECTED' });
    } else {
      const err = new Error('Invalid review action. Must be ACCEPT or REJECT.');
      err.statusCode = 400;
      throw err;
    }

    // If all questions are reviewed, mark job completed
    const remainingPending = job.extractedQuestions.filter((q) => q.reviewStatus === 'PENDING');
    if (remainingPending.length === 0) {
      job.status = 'COMPLETED';
      job.completedAt = new Date();
    }

    await job.save();

    return {
      message: `Question ${upperAction.toLowerCase()}ed successfully`,
      action: upperAction,
      bankQuestionId: approvedBankQuestion ? approvedBankQuestion._id : null,
      question,
      approvedBankQuestion,
      jobStatus: job.status,
      totalAccepted: job.totalAccepted,
      totalRejected: job.totalRejected,
    };
  }

  /**
   * Bulk review questions (Accept or Reject selected)
   */
  async bulkReview(jobId, instructorId, { tempIds = [], action }) {
    const job = await QuestionImportJob.findById(jobId);
    if (!job) {
      const err = new Error('Import job not found');
      err.statusCode = 404;
      throw err;
    }

    if (job.instructorId.toString() !== instructorId.toString()) {
      const err = new Error('Access denied. You do not own this import job.');
      err.statusCode = 403;
      throw err;
    }

    const upperAction = String(action || '').toUpperCase();
    if (upperAction !== 'ACCEPT' && upperAction !== 'REJECT') {
      const err = new Error('Invalid action. Must be ACCEPT or REJECT.');
      err.statusCode = 400;
      throw err;
    }

    const targetSet = new Set(tempIds);
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const q of job.extractedQuestions) {
      if (targetSet.has(q.tempId) && q.reviewStatus === 'PENDING') {
        if (upperAction === 'ACCEPT') {
          await questionBankService.createQuestion(
            instructorId,
            {
              questionText: q.questionText,
              type: q.type,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              points: q.points,
              difficulty: q.difficulty,
              bloomLevel: q.bloomLevel,
              tags: q.tags,
              category: q.category || 'General',
              status: 'APPROVED',
              source: job.sourceType,
              sourceMetadata: {
                importJobId: job._id,
                originalFilename: job.sourceFilename,
              },
              classificationConfidence: q.confidence,
              classificationSource: 'AI',
            },
            { allowDuplicate: true }
          );

          q.reviewStatus = 'ACCEPTED';
          acceptedCount++;
          job.totalAccepted++;
        } else {
          q.reviewStatus = 'REJECTED';
          rejectedCount++;
          job.totalRejected++;
        }
      }
    }

    const remainingPending = job.extractedQuestions.filter((q) => q.reviewStatus === 'PENDING');
    if (remainingPending.length === 0) {
      job.status = 'COMPLETED';
      job.completedAt = new Date();
    }

    await job.save();

    return {
      message: `Bulk review applied: ${acceptedCount} accepted, ${rejectedCount} rejected.`,
      processedCount: acceptedCount + rejectedCount,
      acceptedCount,
      rejectedCount,
      jobStatus: job.status,
      totalAccepted: job.totalAccepted,
      totalRejected: job.totalRejected,
    };
  }

  /**
   * Get job by ID with authorization check
   */
  async getJobById(jobId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      const err = new Error('Invalid import job ID format');
      err.statusCode = 400;
      throw err;
    }

    const job = await QuestionImportJob.findById(jobId).populate('instructorId', 'name email');
    if (!job) {
      const err = new Error('Import job not found');
      err.statusCode = 404;
      throw err;
    }

    if (
      requestingUser.role === 'instructor' &&
      job.instructorId._id.toString() !== requestingUser.id.toString()
    ) {
      const err = new Error('Access denied. You do not own this import job.');
      err.statusCode = 403;
      throw err;
    }

    return job;
  }

  /**
   * List jobs for instructor
   */
  async getJobs(instructorId) {
    const jobs = await QuestionImportJob.find({ instructorId })
      .sort({ createdAt: -1 })
      .limit(30);
    return jobs;
  }
}

module.exports = new QuestionImportService();
