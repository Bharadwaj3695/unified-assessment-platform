const { Subject, Topic, AuditLog } = require('../models');

class SubjectTopicService {
  /**
   * Create new Subject record
   */
  async createSubject(userId, data) {
    const code = (data.code || data.name.slice(0, 4)).trim().toUpperCase();
    const existing = await Subject.findOne({ code });
    if (existing) {
      const err = new Error(`Subject with code "${code}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    const subject = await Subject.create({
      name: data.name,
      code,
      description: data.description || '',
      department: data.department || 'Computer Science & Engineering',
      examCategories: data.examCategories || ['INSTITUTIONAL'],
      examIds: data.examIds || [],
      units: data.units || [],
      createdBy: userId,
    });

    await AuditLog.create({
      userId,
      action: 'SUBJECT_CREATED',
      entityType: 'Subject',
      entityId: subject._id.toString(),
      details: { code: subject.code, name: subject.name },
    });

    return subject;
  }

  /**
   * Get all active subjects with optional filtering
   */
  async getSubjects(query = {}) {
    const filter = { isActive: true };
    if (query.examCategory) {
      filter.examCategories = query.examCategory;
    }
    if (query.examId) {
      filter.examIds = query.examId;
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ];
    }
    return Subject.find(filter).sort({ name: 1 });
  }

  /**
   * Get subject by ID
   */
  async getSubjectById(id) {
    const subject = await Subject.findById(id);
    if (!subject || !subject.isActive) {
      const err = new Error('Subject not found');
      err.statusCode = 404;
      throw err;
    }
    return subject;
  }

  /**
   * Update subject
   */
  async updateSubject(userId, id, data) {
    const subject = await this.getSubjectById(id);
    if (data.name) subject.name = data.name;
    if (data.description !== undefined) subject.description = data.description;
    if (data.department) subject.department = data.department;
    if (data.examCategories) subject.examCategories = data.examCategories;
    if (data.examIds) subject.examIds = data.examIds;
    if (data.units) subject.units = data.units;

    await subject.save();

    await AuditLog.create({
      userId,
      action: 'SUBJECT_UPDATED',
      entityType: 'Subject',
      entityId: subject._id.toString(),
      details: { name: subject.name },
    });

    return subject;
  }

  /**
   * Create Topic under a Subject
   */
  async createTopic(userId, data) {
    await this.getSubjectById(data.subjectId);

    const topic = await Topic.create({
      name: data.name,
      code: data.code || '',
      subjectId: data.subjectId,
      unitNumber: data.unitNumber || 1,
      parentTopicId: data.parentTopicId || null,
      concepts: data.concepts || [],
      conceptTags: data.conceptTags || (data.concepts ? data.concepts.map((c) => c.name) : []),
      description: data.description || '',
      orderIndex: data.orderIndex || 0,
      createdBy: userId,
    });

    await AuditLog.create({
      userId,
      action: 'TOPIC_CREATED',
      entityType: 'Topic',
      entityId: topic._id.toString(),
      details: { name: topic.name, subjectId: data.subjectId },
    });

    return topic;
  }

  /**
   * Get topics for a subject or general query
   */
  async getTopics(query = {}) {
    const filter = { isActive: true };
    if (query.subjectId) {
      filter.subjectId = query.subjectId;
    }
    if (query.parentTopicId !== undefined) {
      filter.parentTopicId = query.parentTopicId === 'null' ? null : query.parentTopicId;
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
        { conceptTags: { $regex: query.search, $options: 'i' } },
      ];
    }
    return Topic.find(filter).populate('subjectId', 'name code').sort({ orderIndex: 1, name: 1 });
  }

  /**
   * Get hierarchical topics (Units -> Topics -> Subtopics & Concepts)
   */
  async getTopicHierarchy(subjectId) {
    const subject = await this.getSubjectById(subjectId);
    const allTopics = await Topic.find({ subjectId, isActive: true }).lean();

    const parentTopics = allTopics.filter((t) => !t.parentTopicId);
    const subTopicsMap = new Map();

    allTopics.forEach((t) => {
      if (t.parentTopicId) {
        const pId = t.parentTopicId.toString();
        if (!subTopicsMap.has(pId)) {
          subTopicsMap.set(pId, []);
        }
        subTopicsMap.get(pId).push(t);
      }
    });

    const hierarchy = parentTopics.map((pt) => ({
      ...pt,
      id: pt._id.toString(),
      subtopics: (subTopicsMap.get(pt._id.toString()) || []).map((st) => ({
        ...st,
        id: st._id.toString(),
      })),
    }));

    return {
      subject,
      topics: hierarchy,
    };
  }
}

module.exports = new SubjectTopicService();
