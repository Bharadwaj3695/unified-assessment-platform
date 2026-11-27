const questionBulkImportService = require('../services/questionBulkImport.service');

class QuestionBulkImportController {
  async uploadFile(req, res, next) {
    try {
      const job = await questionBulkImportService.processImportUpload(req.user, req.file, req.body);
      res.status(201).json({
        success: true,
        message: 'Import file uploaded and parsed into staging records.',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  async getJobPreview(req, res, next) {
    try {
      const job = await questionBulkImportService.getImportJobPreview(req.params.jobId, req.user);
      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  async commitJob(req, res, next) {
    try {
      const result = await questionBulkImportService.commitImportJob(req.params.jobId, req.user, req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new QuestionBulkImportController();
