const mongoose = require('mongoose');
const { Question, QuestionVersion, QuestionBank, Subject, Topic, AuditLog } = require('../models');
const { validateQuestionObject } = require('../validators/question.validator');
const {
  serializeQuestionForFaculty,
  serializeQuestionForStudent,
} = require('../utils/questionSerializer');
const { parsePaginationParams, resolvePageBounds, buildSortSpec } = require('../utils/pagination');

class QuestionManagementService {
  /**
   * Create a new Question in the centralized Question Bank
   */
  async createQuestion(user, data) {
    const ownerFacultyId = user._id || user.id;

    // Normalize statement and type
    const statement = (data.statement || data.questionText || '').trim();
    const qType = (data.questionType || data.type || 'SINGLE_MCQ').toUpperCase();

    // Support both ID references and manual plain text metadata
    const isSubjectIdValid = data.subjectId && mongoose.isValidObjectId(data.subjectId);
    const subjectId = isSubjectIdValid ? data.subjectId : null;
    const subject = (data.subject || (!isSubjectIdValid && typeof data.subjectId === 'string' ? data.subjectId : '')).trim();

    const validTopicIds = Array.isArray(data.topicIds)
      ? data.topicIds.filter((id) => id && mongoose.isValidObjectId(id))
      : [];
    const topics = Array.isArray(data.topics)
      ? data.topics.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
      : Array.isArray(data.topicIds)
      ? data.topicIds.filter((t) => typeof t === 'string' && !mongoose.isValidObjectId(t)).map((t) => t.trim()).filter(Boolean)
      : [];

    // Create question document
    const question = new Question({
      ownerFacultyId,
      subjectId,
      subject,
      topicIds: validTopicIds,
      topics,
      conceptTags: data.conceptTags || [],
      examCategory: data.examCategory || 'INSTITUTIONAL',
      examId: data.examId || '',
      questionType: qType,
      difficulty: data.difficulty || 'MEDIUM',
      statement,
      attachments: data.attachments || [],
      options: data.options || [],
      answerKey: data.answerKey !== undefined ? data.answerKey : data.correctAnswer || null,
      explanation: data.explanation || '',
      evaluationConfig: data.evaluationConfig || data.codingConfig || {},
      marks: Number(data.marks || data.points || 1),
      negativeMarks: Number(data.negativeMarks || 0),
      estimatedTimeSeconds: Number(data.estimatedTimeSeconds || 60),
      status: data.status === 'PUBLISHED' ? 'DRAFT' : data.status || 'DRAFT',
      currentVersion: 1,
      visibility: data.visibility || 'INSTITUTIONAL',
      source: data.source || 'MANUAL',
    });

    await question.save();

    // Create immutable Version 1 snapshot
    await QuestionVersion.create({
      questionId: question._id,
      versionNumber: 1,
      questionSnapshot: question.toObject(),
      answerKeySnapshot: question.answerKey,
      evaluationConfigSnapshot: question.evaluationConfig,
      changeSummary: 'Initial version creation',
      changedBy: ownerFacultyId,
    });

    await AuditLog.create({
      userId: ownerFacultyId,
      action: 'QUESTION_CREATED',
      entityType: 'Question',
      entityId: question._id.toString(),
      details: {
        questionCode: question.questionCode,
        questionType: question.questionType,
        subjectId: question.subjectId,
        subject: question.subject,
      },
    });

    return serializeQuestionForFaculty(question);
  }

  /**
   * Query and list questions with multi-dimensional filtering, pagination, and sorting
   */
  async getQuestions(query = {}, user) {
    const filter = { assessmentId: null };
    const andConditions = [];

    // Search dimensions
    if (query.subjectId) {
      if (mongoose.isValidObjectId(query.subjectId)) {
        andConditions.push({
          $or: [
            { subjectId: query.subjectId },
            { subject: { $regex: query.subjectId, $options: 'i' } },
          ],
        });
      } else {
        filter.subject = { $regex: query.subjectId, $options: 'i' };
      }
    }
    if (query.subject) {
      filter.subject = { $regex: query.subject, $options: 'i' };
    }
    if (query.topicId) {
      if (mongoose.isValidObjectId(query.topicId)) {
        andConditions.push({
          $or: [
            { topicIds: query.topicId },
            { topics: { $regex: query.topicId, $options: 'i' } },
          ],
        });
      } else {
        filter.topics = { $regex: query.topicId, $options: 'i' };
      }
    }
    if (query.topic) {
      filter.topics = { $regex: query.topic, $options: 'i' };
    }
    if (query.concept) {
      filter.conceptTags = { $regex: query.concept, $options: 'i' };
    }
    if (query.examCategory) {
      filter.examCategory = query.examCategory;
    }
    if (query.examId) {
      filter.examId = query.examId;
    }
    if (query.questionType) {
      filter.questionType = query.questionType;
    }
    if (query.difficulty) {
      filter.difficulty = query.difficulty;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.facultyId) {
      filter.ownerFacultyId = query.facultyId;
    }

    const bankId = query.bankId || query.questionBankId;
    if (bankId && mongoose.isValidObjectId(bankId)) {
      const bankDoc = await QuestionBank.findById(bankId).select('questionIds').lean();
      const bankQuestionIds = Array.isArray(bankDoc?.questionIds) ? bankDoc.questionIds : [];
      filter._id = { $in: bankQuestionIds };
    }

    if (query.search && String(query.search).trim()) {
      const escapedSearch = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { statement: { $regex: escapedSearch, $options: 'i' } },
          { questionText: { $regex: escapedSearch, $options: 'i' } },
          { questionCode: { $regex: escapedSearch, $options: 'i' } },
          { conceptTags: { $regex: escapedSearch, $options: 'i' } },
          { subject: { $regex: escapedSearch, $options: 'i' } },
          { topics: { $regex: escapedSearch, $options: 'i' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Role-based visibility
    if (user.role === 'student') {
      filter.status = 'PUBLISHED';
    }

    const { page: requestedPage, limit: parsedLimit } = parsePaginationParams(query, 20, 100);
    const total = await Question.countDocuments(filter);
    const { page, limit, totalPages, skip } = resolvePageBounds(requestedPage, parsedLimit, total);

    const sortSpec = buildSortSpec(
      query.sortBy,
      query.sortOrder,
      {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        difficulty: 'difficulty',
        marks: 'marks',
        questionCode: 'questionCode',
      },
      'createdAt',
      -1
    );

    const questions = await Question.find(filter)
      .populate('subjectId', 'name code')
      .populate('topicIds', 'name code')
      .populate('ownerFacultyId', 'fullName email')
      .sort(sortSpec)
      .skip(skip)
      .limit(limit);

    const serialized = questions.map((q) =>
      user.role === 'student' ? serializeQuestionForStudent(q) : serializeQuestionForFaculty(q)
    );

    return {
      questions: serialized,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single question by ID
   */
  async getQuestionById(id, user) {
    const question = await Question.findById(id)
      .populate('subjectId', 'name code')
      .populate('topicIds', 'name code')
      .populate('ownerFacultyId', 'fullName email');

    if (!question) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    if (user.role === 'student') {
      if (question.status !== 'PUBLISHED') {
        const err = new Error('Access denied. Question is not published.');
        err.statusCode = 403;
        throw err;
      }
      return serializeQuestionForStudent(question);
    }

    return serializeQuestionForFaculty(question);
  }

  /**
   * Update existing question: if already published, editing creates an immutable new version!
   */
  async updateQuestion(id, user, data) {
    const question = await Question.findById(id);
    if (!question) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check (only owner faculty or admin)
    const userId = (user._id || user.id).toString();
    const isOwner = question.ownerFacultyId && question.ownerFacultyId.toString() === userId;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      const err = new Error('Access denied. You do not own this question.');
      err.statusCode = 403;
      throw err;
    }

    const wasPublished = question.status === 'PUBLISHED';

    // Apply updates
    if (data.statement !== undefined) question.statement = data.statement;
    if (data.questionText !== undefined) question.questionText = data.questionText;
    if (data.subjectId !== undefined) {
      if (data.subjectId && mongoose.isValidObjectId(data.subjectId)) {
        question.subjectId = data.subjectId;
      } else if (!data.subjectId) {
        question.subjectId = null;
      } else if (typeof data.subjectId === 'string') {
        question.subject = data.subjectId.trim();
        question.subjectId = null;
      }
    }
    if (data.subject !== undefined) {
      question.subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    }
    if (data.topicIds !== undefined) {
      if (Array.isArray(data.topicIds)) {
        question.topicIds = data.topicIds.filter((id) => id && mongoose.isValidObjectId(id));
        const manualFromTopicIds = data.topicIds.filter((t) => typeof t === 'string' && !mongoose.isValidObjectId(t));
        if (manualFromTopicIds.length > 0 && (!data.topics || data.topics.length === 0)) {
          question.topics = manualFromTopicIds.map((t) => t.trim()).filter(Boolean);
        }
      }
    }
    if (data.topics !== undefined) {
      question.topics = Array.isArray(data.topics)
        ? data.topics.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
        : [];
    }
    if (data.conceptTags !== undefined) question.conceptTags = data.conceptTags;
    if (data.difficulty !== undefined) question.difficulty = data.difficulty;
    if (data.options !== undefined) question.options = data.options;
    if (data.answerKey !== undefined) question.answerKey = data.answerKey;
    if (data.explanation !== undefined) question.explanation = data.explanation;
    if (data.evaluationConfig !== undefined) question.evaluationConfig = data.evaluationConfig;
    if (data.marks !== undefined) question.marks = Number(data.marks);
    if (data.negativeMarks !== undefined) question.negativeMarks = Number(data.negativeMarks);
    if (data.estimatedTimeSeconds !== undefined)
      question.estimatedTimeSeconds = Number(data.estimatedTimeSeconds);
    if (data.visibility !== undefined) question.visibility = data.visibility;

    // If published, increment version and create new QuestionVersion record
    if (wasPublished) {
      question.currentVersion += 1;
      await question.save();

      await QuestionVersion.create({
        questionId: question._id,
        versionNumber: question.currentVersion,
        questionSnapshot: question.toObject(),
        answerKeySnapshot: question.answerKey,
        evaluationConfigSnapshot: question.evaluationConfig,
        changeSummary: data.changeSummary || `Updated to version ${question.currentVersion}`,
        changedBy: user._id || user.id,
      });

      await AuditLog.create({
        userId: user._id || user.id,
        action: 'QUESTION_VERSIONED',
        entityType: 'Question',
        entityId: question._id.toString(),
        details: { newVersion: question.currentVersion, changeSummary: data.changeSummary },
      });
    } else {
      await question.save();

      await AuditLog.create({
        userId: user._id || user.id,
        action: 'QUESTION_UPDATED',
        entityType: 'Question',
        entityId: question._id.toString(),
        details: { status: question.status },
      });
    }

    return serializeQuestionForFaculty(question);
  }

  /**
   * Validate a question before publishing
   */
  async validateQuestion(id) {
    const question = await Question.findById(id);
    if (!question) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    const report = validateQuestionObject(question.toObject(), { isPublishing: true });
    return report;
  }

  /**
   * Publish an approved question: mandatory validation check before publication!
   */
  async publishQuestion(id, user) {
    const question = await Question.findById(id);
    if (!question) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    const isOwner = question.ownerFacultyId && question.ownerFacultyId.toString() === userId;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      const err = new Error('Access denied. You do not own this question.');
      err.statusCode = 403;
      throw err;
    }

    // Run strict publication validation
    const report = validateQuestionObject(question.toObject(), { isPublishing: true });
    if (!report.valid) {
      const err = new Error(`Cannot publish question: ${report.errors.join(' ')}`);
      err.statusCode = 422;
      err.validationErrors = report.errors;
      throw err;
    }

    question.status = 'PUBLISHED';
    await question.save();

    // Ensure QuestionVersion exists
    const existingVersion = await QuestionVersion.findOne({
      questionId: question._id,
      versionNumber: question.currentVersion,
    });

    if (!existingVersion) {
      await QuestionVersion.create({
        questionId: question._id,
        versionNumber: question.currentVersion,
        questionSnapshot: question.toObject(),
        answerKeySnapshot: question.answerKey,
        evaluationConfigSnapshot: question.evaluationConfig,
        changeSummary: 'Published version',
        changedBy: user._id || user.id,
      });
    }

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'QUESTION_PUBLISHED',
      entityType: 'Question',
      entityId: question._id.toString(),
      details: {
        questionCode: question.questionCode,
        version: question.currentVersion,
      },
    });

    return serializeQuestionForFaculty(question);
  }

  /**
   * Archive question
   */
  async archiveQuestion(id, user) {
    const question = await Question.findById(id);
    if (!question) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    const isOwner = question.ownerFacultyId && question.ownerFacultyId.toString() === userId;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      const err = new Error('Access denied. You do not own this question.');
      err.statusCode = 403;
      throw err;
    }

    question.status = 'ARCHIVED';
    await question.save();

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'QUESTION_ARCHIVED',
      entityType: 'Question',
      entityId: question._id.toString(),
      details: { historicalUsageCount: question.historicalUsageCount },
    });

    return serializeQuestionForFaculty(question);
  }

  /**
   * Get version history for a question
   */
  async getQuestionVersions(id, user) {
    const question = await Question.findById(id);
    if (!question) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    if (user && user.role === 'instructor') {
      const userId = (user._id || user.id).toString();
      if (question.ownerFacultyId && question.ownerFacultyId.toString() !== userId) {
        const err = new Error('Access denied. You do not own this question.');
        err.statusCode = 403;
        throw err;
      }
    }

    const versions = await QuestionVersion.find({ questionId: id })
      .populate('changedBy', 'fullName email')
      .sort({ versionNumber: -1 });

    return versions;
  }
}

module.exports = new QuestionManagementService();
