const mongoose = require('mongoose');
const { Assessment, Question, User, Notification } = require('../models');
const emailService = require('./email.service');

class AssessmentService {
  async validateAssignedStudents(assignedStudents) {
    if (!assignedStudents || !Array.isArray(assignedStudents) || assignedStudents.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(assignedStudents.map((id) => id.toString()))];
    for (const id of uniqueIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error(`Invalid student ID format: ${id}`);
        error.statusCode = 400;
        throw error;
      }
    }

    const validStudents = await User.find({
      _id: { $in: uniqueIds },
      role: 'student',
    }).select('_id');

    if (validStudents.length !== uniqueIds.length) {
      const error = new Error('One or more assigned users do not exist or are not registered students.');
      error.statusCode = 400;
      throw error;
    }

    return validStudents.map((u) => u._id);
  }

  async createAssessment(instructorId, assessmentData) {
    const {
      title,
      description,
      category,
      durationMinutes,
      passingScore,
      scheduledAt,
      deadlineAt,
      allowReview,
      accessType = 'public',
      assignedStudents = [],
      questions = [],
      status = 'draft',
    } = assessmentData;

    let validatedStudents = [];
    if (accessType === 'restricted') {
      validatedStudents = await this.validateAssignedStudents(assignedStudents);
    }

    let totalPoints = 0;
    if (questions && questions.length > 0) {
      totalPoints = questions.reduce((sum, q) => sum + (parseInt(q.points, 10) || 5), 0);
    }

    const assessment = await Assessment.create({
      title,
      description,
      category: category || 'General',
      instructorId,
      durationMinutes: durationMinutes || 60,
      totalPoints: totalPoints || 100,
      passingScore: passingScore || 60,
      status: status === 'published' ? 'published' : 'draft',
      scheduledAt,
      deadlineAt,
      allowReview: allowReview !== undefined ? allowReview : true,
      accessType: accessType === 'restricted' ? 'restricted' : 'public',
      assignedStudents: validatedStudents,
    });

    if (questions && questions.length > 0) {
      const questionDocs = questions.map((q, idx) => ({
        assessmentId: assessment._id,
        questionText: q.questionText,
        type: q.type || 'mcq',
        options: q.options || [],
        correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : null,
        explanation: q.explanation || null,
        points: parseInt(q.points, 10) || 5,
        orderIndex: idx,
      }));
      await Question.insertMany(questionDocs);
    }

    if (assessment.status === 'published' && assessment.accessType === 'restricted' && assessment.assignedStudents?.length > 0) {
      try {
        const studentUsers = await User.find({ _id: { $in: assessment.assignedStudents } });
        for (const student of studentUsers) {
          await emailService.sendAssessmentPublishedEmail(student, assessment);
          await Notification.create({
            userId: student._id,
            title: 'New Assessment Assigned',
            message: `You have been assigned to "${assessment.title}". Duration: ${assessment.durationMinutes} mins.`,
            type: 'assessment',
            link: `/student/attempt/${assessment._id}`,
          });
        }
      } catch (err) {
        console.warn('[AssessmentService] Non-fatal notification error on create:', err.message);
      }
    }

    return this.getAssessmentById(assessment._id, { id: instructorId, role: 'instructor' });
  }

  async updateAssessment(assessmentId, instructorId, updateData, isAdmin = false) {
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    if (!isAdmin && assessment.instructorId.toString() !== instructorId.toString()) {
      const error = new Error('Access denied. You do not own this assessment.');
      error.statusCode = 403;
      throw error;
    }

    const { questions, instructorId: ignoredInstructorId, assignedStudents, accessType, ...fields } = updateData;
    Object.assign(assessment, fields);

    if (accessType !== undefined) {
      assessment.accessType = accessType === 'restricted' ? 'restricted' : 'public';
    }

    if (assignedStudents !== undefined) {
      if (assessment.accessType === 'restricted') {
        assessment.assignedStudents = await this.validateAssignedStudents(assignedStudents);
      } else {
        assessment.assignedStudents = [];
      }
    }

    if (questions && Array.isArray(questions)) {
      await Question.deleteMany({ assessmentId });

      let calculatedPoints = 0;
      const questionDocs = questions.map((q, idx) => {
        const pts = parseInt(q.points, 10) || 5;
        calculatedPoints += pts;
        return {
          assessmentId: assessment._id,
          questionText: q.questionText,
          type: q.type || 'mcq',
          options: q.options || [],
          correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : null,
          explanation: q.explanation || null,
          points: pts,
          orderIndex: idx,
        };
      });

      await Question.insertMany(questionDocs);
      assessment.totalPoints = calculatedPoints;
    }

    await assessment.save();

    if (assessment.status === 'published' && assessment.accessType === 'restricted' && assessment.assignedStudents?.length > 0) {
      try {
        const studentUsers = await User.find({ _id: { $in: assessment.assignedStudents } });
        for (const student of studentUsers) {
          await emailService.sendAssessmentPublishedEmail(student, assessment);
          await Notification.create({
            userId: student._id,
            title: 'New Assessment Assigned',
            message: `You have been assigned to "${assessment.title}". Duration: ${assessment.durationMinutes} mins.`,
            type: 'assessment',
            link: `/student/attempt/${assessment._id}`,
          });
        }
      } catch (err) {
        console.warn('[AssessmentService] Non-fatal notification error on update:', err.message);
      }
    }

    return this.getAssessmentById(assessmentId, { id: instructorId, role: isAdmin ? 'admin' : 'instructor' });
  }

  async getAssessments({ role, userId, status, category, search, page = 1, limit = 10 }) {
    const query = {};

    if (role === 'student') {
      query.status = 'published';
      query.$or = [
        { accessType: 'public' },
        { accessType: { $exists: false } },
        { accessType: 'restricted', assignedStudents: userId },
      ];
    } else if (role === 'instructor') {
      query.instructorId = userId;
      if (status) query.status = status;
    } else if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      const searchCondition = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    const skip = (page - 1) * limit;
    const total = await Assessment.countDocuments(query);
    const assessments = await Assessment.find(query)
      .populate('instructorId', 'name email avatar')
      .populate('questions', 'id points type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    return { total, assessments };
  }

  async getAssessmentById(id, requestingUser = null) {
    const assessment = await Assessment.findById(id)
      .populate('instructorId', 'name email avatar')
      .populate('assignedStudents', 'name email avatar');
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    const isStudent = requestingUser && requestingUser.role === 'student';
    const isInstructor = requestingUser && requestingUser.role === 'instructor';
    const isAdmin = requestingUser && requestingUser.role === 'admin';

    // Student authorization and access control
    if (isStudent) {
      if (assessment.status !== 'published') {
        const error = new Error('This assessment is not open for student access.');
        error.statusCode = 403;
        throw error;
      }

      if (assessment.accessType === 'restricted') {
        const isAssigned =
          assessment.assignedStudents &&
          assessment.assignedStudents.some((s) => {
            const sId = s._id ? s._id.toString() : s.toString();
            return sId === requestingUser.id.toString();
          });
        if (!isAssigned) {
          const error = new Error('You are not authorized to view or attempt this restricted assessment.');
          error.statusCode = 403;
          throw error;
        }
      }
    } else if (isInstructor && !isAdmin) {
      // Instructor can only view their own assessment
      const ownerId = (assessment.instructorId?._id || assessment.instructorId)?.toString();
      if (ownerId !== requestingUser.id.toString()) {
        const error = new Error('Access denied. You do not own this assessment.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Unconditional sanitization: student callers must NEVER receive correctAnswer or explanation
    const questionProjection = isStudent ? '-correctAnswer -explanation' : '';
    const questions = await Question.find({ assessmentId: id })
      .select(questionProjection)
      .sort({ orderIndex: 1 });

    const assessmentJson = assessment.toJSON();
    assessmentJson.questions = questions;
    return assessmentJson;
  }

  async deleteAssessment(assessmentId, instructorId, isAdmin = false) {
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    if (!isAdmin && assessment.instructorId.toString() !== instructorId.toString()) {
      const error = new Error('Unauthorized to delete this assessment');
      error.statusCode = 403;
      throw error;
    }

    await Question.deleteMany({ assessmentId });
    await Assessment.findByIdAndDelete(assessmentId);
    return { message: 'Assessment and associated questions deleted successfully' };
  }
}

module.exports = new AssessmentService();
