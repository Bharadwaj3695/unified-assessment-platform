const submissionService = require('../services/submission.service');
const { successResponse } = require('../utils/response');

class SubmissionController {
  async startAttempt(req, res, next) {
    try {
      const { assessmentId } = req.body;
      const submission = await submissionService.startAttempt(req.user.id, assessmentId);
      return successResponse(res, 'Assessment attempt started', submission);
    } catch (err) {
      next(err);
    }
  }

  async autosaveAnswer(req, res, next) {
    try {
      const { submissionId, questionId } = req.params;
      const { answer } = req.body;
      const result = await submissionService.autosaveAnswer(
        submissionId,
        req.user.id,
        questionId,
        answer
      );
      return successResponse(res, 'Answer autosaved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async saveProgress(req, res, next) {
    try {
      const { answers } = req.body;
      const submission = await submissionService.saveProgress(
        req.params.id,
        req.user.id,
        answers
      );
      return successResponse(res, 'Progress saved successfully', submission);
    } catch (err) {
      next(err);
    }
  }

  async submitAssessment(req, res, next) {
    try {
      const { answers, timeSpentSeconds } = req.body;
      const submission = await submissionService.submitAssessment(
        req.params.id,
        req.user.id,
        answers,
        timeSpentSeconds
      );
      return successResponse(res, 'Assessment submitted successfully', submission);
    } catch (err) {
      next(err);
    }
  }

  async getStudentSubmissions(req, res, next) {
    try {
      const submissions = await submissionService.getStudentSubmissions(req.user.id);
      return successResponse(res, 'Submissions retrieved successfully', submissions);
    } catch (err) {
      next(err);
    }
  }

  async getSubmissionById(req, res, next) {
    try {
      const submission = await submissionService.getSubmissionById(
        req.params.id,
        req.user.id,
        req.user.role
      );
      return successResponse(res, 'Submission retrieved successfully', submission);
    } catch (err) {
      next(err);
    }
  }

  async uploadAnswerFile(req, res, next) {
    try {
      const { submissionId, questionId } = req.params;
      const result = await submissionService.uploadAnswerFile(
        submissionId,
        req.user.id,
        questionId,
        req.file
      );
      return successResponse(res, 'Document answer uploaded successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async attachGoogleDocsUrl(req, res, next) {
    try {
      const { submissionId, questionId } = req.params;
      const { googleDocsUrl } = req.body;
      const result = await submissionService.attachGoogleDocsUrl(
        submissionId,
        req.user.id,
        questionId,
        googleDocsUrl
      );
      return successResponse(res, 'Google Docs link attached successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async removeAnswerFile(req, res, next) {
    try {
      const { submissionId, questionId } = req.params;
      const result = await submissionService.removeAnswerFile(
        submissionId,
        req.user.id,
        questionId
      );
      return successResponse(res, 'Draft answer file removed successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getAnswerFile(req, res, next) {
    try {
      const { submissionId, questionId } = req.params;
      const download = req.query.download === 'true';
      const fileData = await submissionService.getAnswerFile(
        submissionId,
        req.user.id,
        req.user.role,
        questionId
      );

      res.setHeader('Content-Type', fileData.mimeType);
      const disposition = download ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileData.originalFilename)}"`);
      return res.sendFile(fileData.filePath);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SubmissionController();
