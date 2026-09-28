const questionImportService = require('../services/questionImport.service');

class QuestionImportController {
  async importFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a PDF, DOC, or DOCX document to import questions.',
        });
      }

      const job = await questionImportService.createFileImportJob(req.user.id, req.file);
      return res.status(202).json({
        success: true,
        message: 'Question import job initiated. Processing document...',
        jobId: job._id,
        status: job.status,
      });
    } catch (err) {
      next(err);
    }
  }

  async importGoogleForms(req, res, next) {
    try {
      const { formsUrlOrId, accessToken } = req.body;
      const job = await questionImportService.createGoogleFormsImportJob(
        req.user.id,
        formsUrlOrId,
        { accessToken }
      );
      return res.status(202).json({
        success: true,
        message: 'Google Forms import initiated. Processing form questions...',
        jobId: job._id,
        status: job.status,
      });
    } catch (err) {
      next(err);
    }
  }

  async getJobs(req, res, next) {
    try {
      const jobs = await questionImportService.getJobs(req.user.id);
      return res.status(200).json({
        success: true,
        data: jobs,
      });
    } catch (err) {
      next(err);
    }
  }

  async getJobById(req, res, next) {
    try {
      const job = await questionImportService.getJobById(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  async getJobPreview(req, res, next) {
    try {
      const job = await questionImportService.getJobById(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        jobId: job._id,
        status: job.status,
        progress: job.progress,
        totalDetected: job.totalDetected,
        totalAccepted: job.totalAccepted,
        totalRejected: job.totalRejected,
        errors: job.errors,
        questions: job.extractedQuestions,
      });
    } catch (err) {
      next(err);
    }
  }

  async reviewQuestion(req, res, next) {
    try {
      const { action, reviewData } = req.body;
      const result = await questionImportService.reviewQuestion(
        req.params.id,
        req.user.id,
        req.params.tempId,
        action,
        reviewData
      );
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async bulkReview(req, res, next) {
    try {
      const { tempIds, action } = req.body;
      const result = await questionImportService.bulkReview(req.params.id, req.user.id, {
        tempIds,
        action,
      });
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new QuestionImportController();
