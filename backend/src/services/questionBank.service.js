const mongoose = require('mongoose');
const BankQuestion = require('../models/BankQuestion');
const Question = require('../models/Question');
const logger = require('../utils/logger');

function normalizeQuestionText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

class QuestionBankService {
  normalizeText(text) {
    return normalizeQuestionText(text);
  }

  /**
   * Check for possible duplicate question
   */
  async checkDuplicate(questionText, instructorId) {
    const normalized = normalizeQuestionText(questionText);
    if (!normalized || normalized.length < 5) return null;

    const query = {
      normalizedText: normalized,
      isLatest: true,
      isActive: true,
    };
    if (instructorId) {
      query.createdBy = instructorId;
    }

    const existing = await BankQuestion.findOne(query);
    return existing;
  }

  /**
   * Create a Question in the Bank manually
   */
  async createQuestion(instructorId, questionData, options = {}) {
    const {
      questionText,
      type = 'mcq',
      options: choices = [],
      correctAnswer = null,
      explanation = null,
      points = 5,
      difficulty = 'MEDIUM',
      bloomLevel = 'UNDERSTAND',
      tags = [],
      category = 'General',
      status = 'APPROVED',
      source = 'MANUAL',
      sourceMetadata = {},
      classificationConfidence = null,
      classificationSource = 'MANUAL',
      allowDuplicate = false,
    } = questionData;

    if (!questionText || !questionText.trim()) {
      const err = new Error('Question text prompt is required');
      err.statusCode = 400;
      throw err;
    }

    const normalizedText = normalizeQuestionText(questionText);

    // Duplicate detection check
    const existingDup = await this.checkDuplicate(questionText, instructorId);
    if (existingDup && !allowDuplicate) {
      const err = new Error('A question with identical content already exists in your Question Bank.');
      err.statusCode = 409;
      err.duplicateQuestion = existingDup;
      throw err;
    }

    const questionBankId = `qb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const newQuestion = await BankQuestion.create({
      questionBankId,
      version: 1,
      isLatest: true,
      questionText: questionText.trim(),
      normalizedText,
      type,
      options: Array.isArray(choices) ? choices : [],
      correctAnswer: correctAnswer ? String(correctAnswer).trim() : null,
      explanation: explanation ? String(explanation).trim() : null,
      points: parseInt(points, 10) || 5,
      difficulty: difficulty.toUpperCase(),
      bloomLevel: bloomLevel.toUpperCase(),
      tags: Array.isArray(tags) ? tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      category: category ? category.trim() : 'General',
      status,
      source,
      sourceMetadata,
      createdBy: instructorId,
      reviewedBy: instructorId,
      reviewedAt: new Date(),
      classificationConfidence,
      classificationSource,
      isActive: true,
    });

    logger.info('question_approved', {
      questionId: newQuestion._id,
      questionBankId,
      version: 1,
      instructorId,
    });

    return newQuestion;
  }

  /**
   * Search and filter Question Bank
   */
  async getQuestions({
    requestingUser,
    type,
    difficulty,
    bloomLevel,
    category,
    tags,
    source,
    status,
    search,
    includeHistory = false,
    page = 1,
    limit = 20,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { isActive: true };

    if (!includeHistory) {
      query.isLatest = true;
    }

    // RBAC: Instructors can access their own questions or approved public questions
    if (requestingUser.role === 'instructor') {
      query.createdBy = requestingUser.id;
    } else if (requestingUser.role === 'student') {
      const err = new Error('Access denied. Students cannot access the Question Bank.');
      err.statusCode = 403;
      throw err;
    }

    if (type && type !== 'All') {
      query.type = type.toLowerCase();
    }
    if (difficulty && difficulty !== 'All') {
      query.difficulty = difficulty.toUpperCase();
    }
    if (bloomLevel && bloomLevel !== 'All') {
      query.bloomLevel = bloomLevel.toUpperCase();
    }
    if (source && source !== 'All') {
      query.source = source.toUpperCase();
    }
    if (status && status !== 'All') {
      query.status = status.toUpperCase();
    }
    if (category && category !== 'All') {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim().toLowerCase());
      query.tags = { $in: tagList };
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { questionText: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [total, questions] = await Promise.all([
      BankQuestion.countDocuments(query),
      BankQuestion.find(query)
        .populate('createdBy', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    return {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      questions,
    };
  }

  /**
   * Retrieve a single question with its version history
   */
  async getQuestionById(id, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error('Invalid Question Bank ID');
      err.statusCode = 400;
      throw err;
    }

    const question = await BankQuestion.findById(id).populate('createdBy', 'name email');
    if (!question || !question.isActive) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    if (
      requestingUser.role === 'instructor' &&
      question.createdBy._id.toString() !== requestingUser.id.toString()
    ) {
      const err = new Error('Access denied. You do not own this Question Bank question.');
      err.statusCode = 403;
      throw err;
    }

    // Retrieve all versions of this question family
    const versions = await BankQuestion.find({
      questionBankId: question.questionBankId,
      isActive: true,
    })
      .select('version points difficulty bloomLevel createdAt isLatest')
      .sort({ version: -1 });

    const questionObj = question.toJSON();
    questionObj.versionHistory = versions;

    return questionObj;
  }

  /**
   * Update question with real versioning
   * If the question has been referenced in an assessment, creates a new version
   * rather than mutating the historical record.
   */
  async updateQuestion(id, instructorId, updateData, isAdmin = false) {
    const existing = await BankQuestion.findById(id);
    if (!existing || !existing.isActive) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    if (!isAdmin && existing.createdBy.toString() !== instructorId.toString()) {
      const err = new Error('Access denied. You do not own this question.');
      err.statusCode = 403;
      throw err;
    }

    // Check if this question is referenced in any assessment
    const isReferenced = await Question.exists({
      $or: [
        { bankQuestionId: existing._id },
        { questionBankId: existing.questionBankId },
      ],
    });

    const normalizedText = updateData.questionText
      ? normalizeQuestionText(updateData.questionText)
      : existing.normalizedText;

    // If referenced in an assessment, strictly create a NEW VERSION (Version 2, 3, etc.)
    if (isReferenced) {
      // Mark old version as no longer latest
      existing.isLatest = false;
      await existing.save();

      const newVersionDoc = await BankQuestion.create({
        questionBankId: existing.questionBankId,
        version: existing.version + 1,
        isLatest: true,
        questionText: updateData.questionText ? updateData.questionText.trim() : existing.questionText,
        normalizedText,
        type: updateData.type || existing.type,
        options: updateData.options !== undefined ? updateData.options : existing.options,
        correctAnswer:
          updateData.correctAnswer !== undefined ? updateData.correctAnswer : existing.correctAnswer,
        explanation:
          updateData.explanation !== undefined ? updateData.explanation : existing.explanation,
        points: updateData.points !== undefined ? updateData.points : existing.points,
        difficulty: updateData.difficulty ? updateData.difficulty.toUpperCase() : existing.difficulty,
        bloomLevel: updateData.bloomLevel ? updateData.bloomLevel.toUpperCase() : existing.bloomLevel,
        tags: updateData.tags !== undefined ? updateData.tags : existing.tags,
        category: updateData.category || existing.category,
        status: updateData.status || 'APPROVED',
        source: existing.source,
        sourceMetadata: existing.sourceMetadata,
        createdBy: existing.createdBy,
        reviewedBy: instructorId,
        reviewedAt: new Date(),
        classificationConfidence: existing.classificationConfidence,
        classificationSource: existing.classificationSource,
        isActive: true,
      });

      logger.info('question_version_created', {
        questionBankId: existing.questionBankId,
        previousVersion: existing.version,
        newVersion: newVersionDoc.version,
        instructorId,
      });

      return newVersionDoc;
    }

    // If not referenced in any assessment, update in-place
    if (updateData.questionText) {
      existing.questionText = updateData.questionText.trim();
      existing.normalizedText = normalizedText;
    }
    if (updateData.type) existing.type = updateData.type;
    if (updateData.options !== undefined) existing.options = updateData.options;
    if (updateData.correctAnswer !== undefined) existing.correctAnswer = updateData.correctAnswer;
    if (updateData.explanation !== undefined) existing.explanation = updateData.explanation;
    if (updateData.points !== undefined) existing.points = updateData.points;
    if (updateData.difficulty) existing.difficulty = updateData.difficulty.toUpperCase();
    if (updateData.bloomLevel) existing.bloomLevel = updateData.bloomLevel.toUpperCase();
    if (updateData.tags !== undefined) existing.tags = updateData.tags;
    if (updateData.category) existing.category = updateData.category;
    if (updateData.status) existing.status = updateData.status;

    await existing.save();
    return existing;
  }

  /**
   * Delete / Archive a question
   */
  async deleteQuestion(id, instructorId, isAdmin = false) {
    const existing = await BankQuestion.findById(id);
    if (!existing || !existing.isActive) {
      const err = new Error('Question not found');
      err.statusCode = 404;
      throw err;
    }

    if (!isAdmin && existing.createdBy.toString() !== instructorId.toString()) {
      const err = new Error('Access denied. You do not own this question.');
      err.statusCode = 403;
      throw err;
    }

    // Soft delete / archive to never break historical assessment snapshots
    existing.isActive = false;
    existing.status = 'ARCHIVED';
    await existing.save();

    logger.info('question_archived', {
      questionId: id,
      questionBankId: existing.questionBankId,
      instructorId,
    });

    return { message: 'Question successfully archived from Question Bank' };
  }

  /**
   * Get distinct categories
   */
  async getCategories(instructorId) {
    const query = { isActive: true, isLatest: true };
    if (instructorId) query.createdBy = instructorId;
    const categories = await BankQuestion.distinct('category', query);
    return categories.filter(Boolean).sort();
  }

  /**
   * Get distinct tags
   */
  async getTags(instructorId) {
    const query = { isActive: true, isLatest: true };
    if (instructorId) query.createdBy = instructorId;
    const tags = await BankQuestion.distinct('tags', query);
    return tags.filter(Boolean).sort();
  }
}

module.exports = new QuestionBankService();
