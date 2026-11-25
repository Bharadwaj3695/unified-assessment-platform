const { QuestionBank, Question, AuditLog } = require('../models');

class QuestionBankGroupService {
  /**
   * Create a new Question Bank collection
   */
  async createBank(user, data) {
    const code = (data.code || data.title.slice(0, 6)).trim().toUpperCase().replace(/\s+/g, '-');
    const existing = await QuestionBank.findOne({ code });
    if (existing) {
      const err = new Error(`Question bank with code "${code}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    const bank = await QuestionBank.create({
      title: data.title,
      code,
      description: data.description || '',
      subjectId: data.subjectId,
      examCategory: data.examCategory || 'INSTITUTIONAL',
      examId: data.examId || '',
      ownerFacultyId: user._id || user.id,
      questionIds: data.questionIds || [],
      questionCount: Array.isArray(data.questionIds) ? data.questionIds.length : 0,
      tags: data.tags || [],
      visibility: data.visibility || 'INSTITUTIONAL',
    });

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'QUESTION_BANK_CREATED',
      entityType: 'QuestionBank',
      entityId: bank._id.toString(),
      details: { title: bank.title, code: bank.code },
    });

    return bank;
  }

  /**
   * Get question banks with filtering
   */
  async getBanks(query = {}, user) {
    const filter = { isArchived: false };
    if (query.subjectId) {
      filter.subjectId = query.subjectId;
    }
    if (query.examCategory) {
      filter.examCategory = query.examCategory;
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
        { tags: { $regex: query.search, $options: 'i' } },
      ];
    }

    return QuestionBank.find(filter)
      .populate('subjectId', 'name code')
      .populate('ownerFacultyId', 'fullName email')
      .sort({ createdAt: -1 });
  }

  /**
   * Get single question bank by ID
   */
  async getBankById(id, user) {
    const bank = await QuestionBank.findById(id)
      .populate('subjectId', 'name code')
      .populate('ownerFacultyId', 'fullName email')
      .populate({
        path: 'questionIds',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'topicIds', select: 'name code' },
        ],
      });

    if (!bank || bank.isArchived) {
      const err = new Error('Question bank not found');
      err.statusCode = 404;
      throw err;
    }

    return bank;
  }

  /**
   * Add questions to a question bank
   */
  async addQuestionsToBank(bankId, questionIds, user) {
    const bank = await QuestionBank.findById(bankId);
    if (!bank) {
      const err = new Error('Question bank not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = (user._id || user.id).toString();
    if (user.role !== 'admin' && bank.ownerFacultyId && bank.ownerFacultyId.toString() !== userId) {
      const err = new Error('Access denied. You do not own this question bank.');
      err.statusCode = 403;
      throw err;
    }

    const currentSet = new Set(bank.questionIds.map((id) => id.toString()));
    const validQuestions = await Question.find({ _id: { $in: questionIds } }).select('_id');

    validQuestions.forEach((q) => {
      currentSet.add(q._id.toString());
    });

    bank.questionIds = Array.from(currentSet);
    bank.questionCount = bank.questionIds.length;
    await bank.save();

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'QUESTION_BANK_UPDATED',
      entityType: 'QuestionBank',
      entityId: bank._id.toString(),
      details: { addedCount: validQuestions.length, total: bank.questionCount },
    });

    return bank;
  }
}

module.exports = new QuestionBankGroupService();
