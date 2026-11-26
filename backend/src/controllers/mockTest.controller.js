const mockTestService = require('../services/mockTest.service');
const { paginatedResponse } = require('../utils/response');

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
      const result = await mockTestService.getMockTests(req.query, req.user);
      if (Array.isArray(result)) {
        return res.status(200).json({
          success: true,
          data: result,
        });
      }
      return paginatedResponse(
        res,
        'Mock tests retrieved successfully',
        result.tests,
        result.page,
        result.limit,
        result.total
      );
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
      const { status: requestedStatus, ...rest } = req.body;
      if (rest.examination !== undefined) {
        rest.examination = rest.examination === null ? '' : String(rest.examination).trim();
      }
      Object.assign(test, rest);
      if (Array.isArray(req.body.draftQuestions)) {
        const hasEmpty = req.body.draftQuestions.some((q) => !String(q?.statement ?? q?.questionText ?? '').trim());
        test.isIncomplete = Boolean(req.body.isIncomplete) || hasEmpty;
        test.draftStatus = test.isIncomplete ? 'INCOMPLETE' : 'READY';
      } else if (req.body.isIncomplete !== undefined) {
        test.isIncomplete = Boolean(req.body.isIncomplete);
        test.draftStatus = test.isIncomplete ? 'INCOMPLETE' : 'READY';
      }
      if (requestedStatus === 'PUBLISHED' && test.isIncomplete) {
        return res.status(400).json({ success: false, message: 'Cannot publish an incomplete mock test draft.' });
      }
      if (requestedStatus && requestedStatus !== 'PUBLISHED') {
        test.status = requestedStatus;
      }
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
      const result = await mockTestService.getMockTestAttempts(req.params.id, req.user, req.query);
      if (Array.isArray(result)) {
        return res.status(200).json({
          success: true,
          data: result,
        });
      }
      return paginatedResponse(
        res,
        'Mock test attempts retrieved successfully',
        result.attempts,
        result.page,
        result.limit,
        result.total
      );
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
