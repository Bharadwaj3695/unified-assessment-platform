const xlsx = require('xlsx');
const { QuestionImportJob, Question, Subject, Topic, AuditLog } = require('../models');
const { validateQuestionObject } = require('../validators/question.validator');
const questionManagementService = require('./questionManagement.service');

class QuestionBulkImportService {
  /**
   * Process uploaded CSV, XLSX, or JSON file into staging records
   */
  async processImportUpload(user, file, body = {}) {
    const facultyId = user._id || user.id;

    if (!file && !body.jsonData) {
      const err = new Error('No file or JSON data provided for import.');
      err.statusCode = 400;
      throw err;
    }

    let parsedRows = [];
    const filename = file ? file.originalname : 'direct_json_payload.json';

    if (body.jsonData) {
      parsedRows = typeof body.jsonData === 'string' ? JSON.parse(body.jsonData) : body.jsonData;
    } else if (file) {
      const ext = filename.split('.').pop().toLowerCase();
      if (ext === 'json') {
        const content = file.buffer ? file.buffer.toString('utf8') : require('fs').readFileSync(file.path, 'utf8');
        parsedRows = JSON.parse(content);
      } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        const workbook = file.buffer
          ? xlsx.read(file.buffer, { type: 'buffer' })
          : xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        parsedRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else {
        const err = new Error('Unsupported file format. Please upload CSV, XLSX, or JSON.');
        err.statusCode = 400;
        throw err;
      }
    }

    if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
      const err = new Error('Uploaded file contains no valid question records.');
      err.statusCode = 422;
      throw err;
    }

    // Default subject mapping if provided in upload
    const subjectId = body.subjectId || null;

    // Validate and identify valid rows, errors, and duplicates
    const extractedQuestions = [];
    let validCount = 0;
    let errorCount = 0;

    for (let idx = 0; idx < parsedRows.length; idx++) {
      const row = parsedRows[idx];
      const statement = (row.statement || row.questionText || row.Question || '').trim();

      // Options parsing for CSV/XLSX
      let options = [];
      if (Array.isArray(row.options)) {
        options = row.options;
      } else if (row.OptionA || row.optionA || row['Option 1']) {
        const optA = row.OptionA || row.optionA || row['Option 1'];
        const optB = row.OptionB || row.optionB || row['Option 2'];
        const optC = row.OptionC || row.optionC || row['Option 3'];
        const optD = row.OptionD || row.optionD || row['Option 4'];
        const answer = (row.Answer || row.answer || row.correctAnswer || '').toString().trim().toUpperCase();

        if (optA) options.push({ id: 'opt_1', text: String(optA), isCorrect: answer === 'A' || answer === '1' });
        if (optB) options.push({ id: 'opt_2', text: String(optB), isCorrect: answer === 'B' || answer === '2' });
        if (optC) options.push({ id: 'opt_3', text: String(optC), isCorrect: answer === 'C' || answer === '3' });
        if (optD) options.push({ id: 'opt_4', text: String(optD), isCorrect: answer === 'D' || answer === '4' });
      }

      const qType = (row.questionType || row.type || (options.length > 0 ? 'SINGLE_MCQ' : 'SHORT_ANSWER')).toUpperCase();
      const difficulty = (row.difficulty || 'MEDIUM').toUpperCase();
      const marks = Number(row.marks || row.points || 1);

      const normalizedCandidate = {
        statement,
        questionType: qType,
        difficulty,
        options,
        answerKey: row.answerKey || row.correctAnswer || (options.find((o) => o.isCorrect)?.id) || null,
        explanation: row.explanation || '',
        evaluationConfig: row.evaluationConfig || row.codingConfig || {},
        marks,
        negativeMarks: Number(row.negativeMarks || 0),
        conceptTags: Array.isArray(row.conceptTags)
          ? row.conceptTags
          : typeof row.conceptTags === 'string'
          ? row.conceptTags.split(',').map((s) => s.trim())
          : [],
        subjectId,
      };

      const validation = validateQuestionObject(normalizedCandidate, { isPublishing: false });
      const isValid = validation.valid;
      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      extractedQuestions.push({
        tempId: `tmp_${idx}_${Date.now()}`,
        questionText: statement,
        type: qType === 'SINGLE_MCQ' || qType === 'MULTI_SELECT' || qType === 'TRUE_FALSE' ? 'mcq' : 'short_answer',
        options: options.map((o) => ({ id: o.id, text: o.text })),
        correctAnswer: typeof normalizedCandidate.answerKey === 'string' ? normalizedCandidate.answerKey : null,
        points: marks,
        explanation: normalizedCandidate.explanation,
        difficulty: normalizedCandidate.difficulty || 'MEDIUM',
        reviewStatus: isValid ? 'PENDING' : 'REJECTED',
      });
    }

    const rawExt = filename.split('.').pop().toUpperCase();
    const sourceType = ['CSV', 'XLSX', 'JSON'].includes(rawExt) ? rawExt : 'JSON';

    // Save Import Job
    const job = await QuestionImportJob.create({
      instructorId: facultyId,
      sourceType,
      sourceFilename: filename,
      status: 'REVIEW_REQUIRED',
      totalDetected: parsedRows.length,
      extractedQuestions,
    });

    await AuditLog.create({
      userId: facultyId,
      action: 'BULK_IMPORT_STAGED',
      entityType: 'QuestionImportJob',
      entityId: job._id.toString(),
      details: { total: parsedRows.length, validCount, errorCount, filename },
    });

    return job;
  }

  /**
   * Get staged import preview with diagnostics
   */
  async getImportJobPreview(jobId, user) {
    const job = await QuestionImportJob.findById(jobId);
    if (!job) {
      const err = new Error('Import job not found');
      err.statusCode = 404;
      throw err;
    }

    if (user && user.role === 'instructor') {
      const userId = (user._id || user.id).toString();
      if (job.instructorId && job.instructorId.toString() !== userId) {
        const err = new Error('Access denied. You do not own this import job.');
        err.statusCode = 403;
        throw err;
      }
    }

    return job;
  }

  /**
   * Commit valid staged questions into Question Bank
   */
  async commitImportJob(jobId, user, options = {}) {
    const job = await this.getImportJobPreview(jobId, user);
    if (job.status === 'COMPLETED') {
      const err = new Error('Import job has already been committed.');
      err.statusCode = 400;
      throw err;
    }

    const createdQuestions = [];
    const targetSubjectId = options.subjectId || null;

    for (const item of job.extractedQuestions) {
      if (item.reviewStatus === 'REJECTED') continue;

      const payload = {
        statement: item.questionText,
        questionType: item.type === 'mcq' ? 'SINGLE_MCQ' : 'SHORT_ANSWER',
        options: item.options,
        answerKey: item.correctAnswer,
        marks: item.points || 1,
        explanation: item.explanation,
        difficulty: item.difficulty || 'MEDIUM',
        subjectId: targetSubjectId,
        source: 'BULK_IMPORT',
        importJobId: job._id,
      };

      const created = await questionManagementService.createQuestion(user, payload);
      createdQuestions.push(created);
      item.reviewStatus = 'ACCEPTED';
    }

    job.status = 'COMPLETED';
    job.totalAccepted = createdQuestions.length;
    await job.save();

    await AuditLog.create({
      userId: user._id || user.id,
      action: 'BULK_IMPORT_COMMITTED',
      entityType: 'QuestionImportJob',
      entityId: job._id.toString(),
      details: { committedCount: createdQuestions.length },
    });

    return {
      message: `Successfully imported ${createdQuestions.length} questions into Question Bank drafts.`,
      committedCount: createdQuestions.length,
      questions: createdQuestions,
    };
  }
}

module.exports = new QuestionBulkImportService();
