const subjectTopicService = require('../services/subjectTopic.service');

class SubjectTopicController {
  async createSubject(req, res, next) {
    try {
      const subject = await subjectTopicService.createSubject(req.user.id || req.user._id, req.body);
      res.status(201).json({
        success: true,
        message: 'Subject created successfully',
        data: subject,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSubjects(req, res, next) {
    try {
      const subjects = await subjectTopicService.getSubjects(req.query);
      res.status(200).json({
        success: true,
        data: subjects,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSubjectById(req, res, next) {
    try {
      const subject = await subjectTopicService.getSubjectById(req.params.id);
      res.status(200).json({
        success: true,
        data: subject,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSubject(req, res, next) {
    try {
      const subject = await subjectTopicService.updateSubject(req.user.id || req.user._id, req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Subject updated successfully',
        data: subject,
      });
    } catch (err) {
      next(err);
    }
  }

  async createTopic(req, res, next) {
    try {
      const topicData = {
        ...req.body,
        subjectId: req.params.subjectId || req.body.subjectId,
      };
      const topic = await subjectTopicService.createTopic(req.user.id || req.user._id, topicData);
      res.status(201).json({
        success: true,
        message: 'Topic created successfully',
        data: topic,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTopics(req, res, next) {
    try {
      const query = {
        ...req.query,
      };
      if (req.params.subjectId) {
        query.subjectId = req.params.subjectId;
      }
      const topics = await subjectTopicService.getTopics(query);
      res.status(200).json({
        success: true,
        data: topics,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTopicHierarchy(req, res, next) {
    try {
      const hierarchy = await subjectTopicService.getTopicHierarchy(req.params.subjectId);
      res.status(200).json({
        success: true,
        data: hierarchy,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SubjectTopicController();
