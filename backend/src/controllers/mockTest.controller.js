const mockTestService = require('../services/mockTest.service');

class MockTestController {
  async createMockTest(req, res, next) {
    try {
      const mockTest = await mockTestService.createMockTest(req.user, req.body);
      res.status(201).json({
        success: true,
        message: 'Mock test created successfully',
        data: mockTest,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMockTests(req, res, next) {
    try {
      const tests = await mockTestService.getMockTests(req.query, req.user);
      res.status(200).json({
        success: true,
        data: tests,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMockTestById(req, res, next) {
    try {
      const test = await mockTestService.getMockTestById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: test,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateMockTest(req, res, next) {
    try {
      const test = await mockTestService.getMockTestById(req.params.id, req.user);
      if (test.ownerFacultyId?._id?.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      Object.assign(test, req.body);
      await test.save();
      res.status(200).json({
        success: true,
        message: 'Mock test updated successfully',
        data: test,
      });
    } catch (err) {
      next(err);
    }
  }

  async generateFromBlueprint(req, res, next) {
    try {
      const test = await mockTestService.generateFromBlueprint(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Questions resolved from blueprint successfully',
        data: test,
      });
    } catch (err) {
      next(err);
    }
  }

  async publishMockTest(req, res, next) {
    try {
      const published = await mockTestService.publishMockTest(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Mock test published successfully',
        data: published,
      });
    } catch (err) {
      next(err);
    }
  }

  async startAttempt(req, res, next) {
    try {
      const attemptData = await mockTestService.startAttempt(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Mock test attempt started',
        data: attemptData,
      });
    } catch (err) {
      next(err);
    }
  }

  async submitAttempt(req, res, next) {
    try {
      const attemptId = req.params.attemptId || req.body.attemptId;
      const result = await mockTestService.submitAttempt(attemptId, req.user, req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadAttemptFile(req, res, next) {
    try {
      const { attemptId, questionId } = req.params;
      const result = await mockTestService.uploadAttemptFile(
        attemptId,
        questionId,
        req.user,
        req.file
      );
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async evaluateAttempt(req, res, next) {
    try {
      const attemptId = req.params.attemptId || req.body.attemptId;
      const result = await mockTestService.evaluateAttempt(attemptId, req.user, req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAttemptAnalytics(req, res, next) {
    try {
      const analytics = await mockTestService.getAttemptAnalytics(req.params.attemptId, req.user);
      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMockTestAttempts(req, res, next) {
    try {
      const attempts = await mockTestService.getMockTestAttempts(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: attempts,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAttemptForReview(req, res, next) {
    try {
      const reviewData = await mockTestService.getAttemptForReview(req.params.attemptId, req.user);
      res.status(200).json({
        success: true,
        data: reviewData,
      });
    } catch (err) {
      next(err);
    }
  }

  async downloadAttemptFile(req, res, next) {
    try {
      const { attemptId, questionId } = req.params;
      const doc = await mockTestService.getAttemptDocumentFile(attemptId, questionId, req.user);
      res.setHeader('Content-Type', doc.mimeType);
      res.download(doc.filePath, doc.originalFilename);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MockTestController();
