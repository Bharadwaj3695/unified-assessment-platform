const mongoose = require('mongoose');
const { Assessment, Question, User, Notification } = require('../models');
const emailService = require('./email.service');
const executionClient = require('./executionClient.service');
const { validateGradingScheme, DEFAULT_GRADING_SCHEME } = require('../utils/gradingScheme');

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
      proctoringEnabled = false,
      cameraRequired = false,
      randomization = { enabled: false },
      certification,
    } = assessmentData;

    let validatedCertification = { enabled: false };
    if (certification && typeof certification === 'object') {
      const enabled = Boolean(certification.enabled);
      const passingPercentage = certification.passingPercentage !== undefined
        ? Number(certification.passingPercentage)
        : 50;
      if (isNaN(passingPercentage) || passingPercentage < 0 || passingPercentage > 100) {
        const error = new Error('Certification passing percentage must be between 0 and 100');
        error.statusCode = 400;
        throw error;
      }

      let gradingScheme = DEFAULT_GRADING_SCHEME;
      if (certification.gradingScheme && Array.isArray(certification.gradingScheme)) {
        const schemeVal = validateGradingScheme(certification.gradingScheme);
        if (!schemeVal.valid) {
          const error = new Error(schemeVal.error);
          error.statusCode = 400;
          throw error;
        }
        gradingScheme = schemeVal.normalizedScheme;
      }

      validatedCertification = {
        enabled,
        passingPercentage,
        gradingScheme,
        templateId: certification.templateId || null,
        certificateTitle: (certification.certificateTitle || '').trim(),
        signatoryName: (certification.signatoryName || '').trim(),
        signatoryTitle: (certification.signatoryTitle || 'Dean of Academic Affairs').trim(),
      };
    }

    let validatedStudents = [];
    if (accessType === 'restricted') {
      validatedStudents = await this.validateAssignedStudents(assignedStudents);
    }

    if (scheduledAt && deadlineAt && new Date(deadlineAt) <= new Date(scheduledAt)) {
      const error = new Error('Assessment deadline must be after scheduled start time');
      error.statusCode = 400;
      throw error;
    }

    let totalPoints = 0;
    if (questions && questions.length > 0) {
      if (status === 'published') {
        questions.forEach((q, idx) => this.validateQuestionForPublish(q, idx));
      }
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
      proctoringEnabled: Boolean(proctoringEnabled),
      cameraRequired: Boolean(cameraRequired),
      randomization: randomization || { enabled: false },
      certification: validatedCertification,
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
        fileUploadConfig: q.fileUploadConfig || undefined,
        codingConfig: q.codingConfig || undefined,
        bankQuestionId: q.bankQuestionId || null,
        questionBankId: q.questionBankId || null,
        questionBankVersion: q.questionBankVersion || null,
        difficulty: q.difficulty || null,
        bloomLevel: q.bloomLevel || null,
        tags: Array.isArray(q.tags) ? q.tags : [],
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

    const { questions, instructorId: ignoredInstructorId, assignedStudents, accessType, certification, ...fields } = updateData;
    
    const effectiveScheduled = fields.scheduledAt !== undefined ? fields.scheduledAt : assessment.scheduledAt;
    const effectiveDeadline = fields.deadlineAt !== undefined ? fields.deadlineAt : assessment.deadlineAt;
    if (effectiveScheduled && effectiveDeadline && new Date(effectiveDeadline) <= new Date(effectiveScheduled)) {
      const error = new Error('Assessment deadline must be after scheduled start time');
      error.statusCode = 400;
      throw error;
    }

    if (certification && typeof certification === 'object') {
      const currentCert = assessment.certification || { enabled: false, passingPercentage: 50 };
      const enabled = certification.enabled !== undefined ? Boolean(certification.enabled) : currentCert.enabled;
      const passingPercentage = certification.passingPercentage !== undefined
        ? Number(certification.passingPercentage)
        : currentCert.passingPercentage;

      if (isNaN(passingPercentage) || passingPercentage < 0 || passingPercentage > 100) {
        const error = new Error('Certification passing percentage must be between 0 and 100');
        error.statusCode = 400;
        throw error;
      }

      let gradingScheme = currentCert.gradingScheme || DEFAULT_GRADING_SCHEME;
      if (certification.gradingScheme && Array.isArray(certification.gradingScheme)) {
        const schemeVal = validateGradingScheme(certification.gradingScheme);
        if (!schemeVal.valid) {
          const error = new Error(schemeVal.error);
          error.statusCode = 400;
          throw error;
        }
        gradingScheme = schemeVal.normalizedScheme;
      }

      assessment.certification = {
        enabled,
        passingPercentage,
        gradingScheme,
        templateId: certification.templateId !== undefined ? certification.templateId : currentCert.templateId,
        certificateTitle: certification.certificateTitle !== undefined ? String(certification.certificateTitle).trim() : currentCert.certificateTitle,
        signatoryName: certification.signatoryName !== undefined ? String(certification.signatoryName).trim() : currentCert.signatoryName,
        signatoryTitle: certification.signatoryTitle !== undefined ? String(certification.signatoryTitle).trim() : currentCert.signatoryTitle,
      };
    }

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
      const isPublishing = assessment.status === 'published' || fields.status === 'published';
      if (isPublishing) {
        questions.forEach((q, idx) => this.validateQuestionForPublish(q, idx));
      }
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
          fileUploadConfig: q.fileUploadConfig || undefined,
          codingConfig: q.codingConfig || undefined,
          bankQuestionId: q.bankQuestionId || null,
          questionBankId: q.questionBankId || null,
          questionBankVersion: q.questionBankVersion || null,
          difficulty: q.difficulty || null,
          bloomLevel: q.bloomLevel || null,
          tags: Array.isArray(q.tags) ? q.tags : [],
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

  async getAssessments({ role, userId, status, category, search, dateFilter, page = 1, limit = 10, includePast = false }) {
    const query = {};

    if (dateFilter) {
      const now = new Date();
      let dateThreshold = null;
      if (dateFilter === 'recent') {
        dateThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      } else if (dateFilter === 'last_week') {
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === 'last_month') {
        dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (dateThreshold) {
        query.createdAt = { $gte: dateThreshold };
      }
    }

    if (role === 'student') {
      query.status = 'published';
      const userObjId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;
      const accessConditions = [
        { accessType: 'public' },
        { accessType: { $exists: false } },
        { accessType: 'restricted', assignedStudents: { $in: [userObjId, userId.toString()] } },
      ];
      if (includePast) {
        query.$and = [{ $or: accessConditions }];
      } else {
        const deadlineConditions = [
          { deadlineAt: null },
          { deadlineAt: { $exists: false } },
          { deadlineAt: { $gt: new Date() } },
        ];
        query.$and = [{ $or: accessConditions }, { $or: deadlineConditions }];
      }
    } else if (role === 'instructor') {
      query.instructorId = userId;
      if (status) query.status = status;
    } else if (status) {
      query.status = status;
    }

    if (category && category.trim() !== '' && category.trim() !== 'All') {
      const escapedCategory = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.category = { $regex: new RegExp(`^\\s*${escapedCategory}\\s*$`, 'i') };
    }

    if (search && search.trim() !== '') {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchCondition = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { category: { $regex: escapedSearch, $options: 'i' } },
      ];
      if (query.$and) {
        query.$and.push({ $or: searchCondition });
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    const parsedLimit = parseInt(limit, 10);
    const limitNum = isNaN(parsedLimit) || parsedLimit <= 0 ? 10 : parsedLimit;
    const parsedPage = parseInt(page, 10);
    const pageNum = isNaN(parsedPage) || parsedPage <= 0 ? 1 : parsedPage;
    const skip = (pageNum - 1) * limitNum;

    const total = await Assessment.countDocuments(query);
    const assessments = await Assessment.find(query)
      .populate('instructorId', 'name email avatar')
      .populate('questions', 'id points type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

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
    // Furthermore, if assessment is scheduled in the future, do NOT leak questions before exam opens
    let questions = [];
    const isFutureScheduled = isStudent && assessment.scheduledAt && new Date(assessment.scheduledAt) > new Date();
    if (!isFutureScheduled) {
      const questionProjection = isStudent ? '-correctAnswer -explanation' : '';
      if (isStudent && requestingUser?.id) {
        const Submission = mongoose.model('Submission');
        const sub = await Submission.findOne({ assessmentId: id, studentId: requestingUser.id });
        if (sub && sub.assignedQuestionIds && sub.assignedQuestionIds.length > 0) {
          const fetched = await Question.find({ _id: { $in: sub.assignedQuestionIds } }).select(questionProjection);
          const qMap = new Map(fetched.map((q) => [q._id.toString(), q]));
          questions = sub.assignedQuestionIds.map((qId) => qMap.get(qId.toString())).filter(Boolean);
        } else {
          questions = await Question.find({ assessmentId: id })
            .select(questionProjection)
            .sort({ orderIndex: 1 });
        }
      } else {
        questions = await Question.find({ assessmentId: id })
          .select(questionProjection)
          .sort({ orderIndex: 1 });
      }
    }

    const assessmentJson = assessment.toJSON();
    if (isStudent && questions.length > 0) {
      questions = questions.map((q) => {
        const qObj = q.toObject ? q.toObject() : (q.toJSON ? q.toJSON() : { ...q });
        if (qObj.codingConfig && Array.isArray(qObj.codingConfig.testCases)) {
          // Strictly strip hidden test cases for student callers to prevent cheating
          qObj.codingConfig.testCases = qObj.codingConfig.testCases.filter((tc) => !tc.isHidden);
        }
        return qObj;
      });
    }
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

  /**
   * Validate a coding question before publication to ensure test cases and environments are consistent
   */
  validateQuestionForPublish(q, idx = 0) {
    const qName = q.questionText ? `"${q.questionText.slice(0, 30)}..."` : `Question ${idx + 1}`;
    if (!q.questionText || !q.questionText.trim()) {
      const err = new Error(`Problem statement/question text is required for ${qName}`);
      err.statusCode = 400;
      throw err;
    }

    if (q.type === 'code' || q.type === 'sql') {
      const cfg = q.codingConfig || {};
      const testCases = cfg.testCases || [];
      const enabledCases = testCases.filter((tc) => tc && tc.isEnabled !== false);
      if (enabledCases.length === 0) {
        const err = new Error(`Coding question ${qName} requires at least one valid enabled test case before publishing.`);
        err.statusCode = 400;
        throw err;
      }

      for (let i = 0; i < enabledCases.length; i++) {
        const tc = enabledCases[i];
        const isSql = q.type === 'sql' || cfg.executionCategory === 'sql';
        const hasExpected = (tc.expectedOutput && String(tc.expectedOutput).trim().length > 0) ||
          (isSql && (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0));
        if (!hasExpected) {
          const err = new Error(`Test case ${i + 1} for ${qName} is missing expected output.`);
          err.statusCode = 400;
          throw err;
        }
      }

      const langs = cfg.allowedLanguages || [];
      const approved = ['python', 'javascript', 'sqlite'];
      if (!langs.some((l) => approved.includes(String(l).toLowerCase()))) {
        const err = new Error(`Coding question ${qName} must enable at least one supported language (${approved.join(', ')}).`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  /**
   * Secure faculty test code execution for IDE validation
   */
  async testFacultyCode(user, { language, code, stdin = '', schemaDdl = '', testCase = null, testCases = null, timeoutMs = 2000, memoryLimitMb = 256 }) {
    if (!code || typeof code !== 'string' || !code.trim()) {
      const error = new Error('Source code cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    const lang = (language || 'python').toLowerCase().trim();
    const approvedLanguages = ['python', 'javascript', 'sqlite'];
    if (!approvedLanguages.includes(lang)) {
      const error = new Error(`Language '${language}' is not permitted. Permitted: ${approvedLanguages.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }

    const tMs = Math.max(500, Math.min(10000, Number(timeoutMs) || 2000));
    const mMb = Math.max(64, Math.min(512, Number(memoryLimitMb) || 256));

    // Case 1: Run All Test Cases (Suite)
    if (Array.isArray(testCases) && testCases.length > 0) {
      const enabledCases = testCases.filter((tc) => tc && tc.isEnabled !== false);
      if (enabledCases.length === 0) {
        return {
          verdict: 'NO_TESTS',
          totalCount: 0,
          passedCount: 0,
          failedCount: 0,
          testCases: [],
          message: 'No enabled test cases to run.',
        };
      }

      if (lang === 'sqlite') {
        const results = [];
        let passedCount = 0;
        let totalWeight = 0;
        let passedWeight = 0;

        for (let i = 0; i < enabledCases.length; i++) {
          const tc = enabledCases[i];
          const weight = typeof tc.weight === 'number' && tc.weight > 0 ? tc.weight : 1;
          totalWeight += weight;

          let expectedOut = null;
          if (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0) {
            expectedOut = {
              columns: tc.expectedColumns || [],
              rows: tc.expectedRows || [],
            };
          } else if (tc.expectedOutput) {
            expectedOut = tc.expectedOutput;
          }

          let ddl = schemaDdl || '';
          if (tc.input && tc.input.trim()) {
            ddl = ddl ? `${ddl}\n${tc.input.trim()}` : tc.input.trim();
          }

          const clientRes = await executionClient.executeSql({
            dialect: 'sqlite',
            schemaDdl: ddl,
            query: code,
            expectedOutput: expectedOut,
            timeoutMs: tMs,
          });

          if (!clientRes.ok || !clientRes.data?.success) {
            const error = new Error(clientRes.data?.message || 'SQL execution failed');
            error.statusCode = clientRes.status || 500;
            throw error;
          }

          const sqlRes = clientRes.data.data;
          const passed = sqlRes.verdict === 'ACCEPTED';
          if (passed) {
            passedCount++;
            passedWeight += weight;
          }

          results.push({
            testCaseId: tc.id || tc._id || `tc-${i + 1}`,
            testCaseIndex: i + 1,
            description: tc.description || tc.explanation || `Test Case ${i + 1}`,
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            expectedColumns: tc.expectedColumns || [],
            expectedRows: tc.expectedRows || [],
            actualOutput: sqlRes.rows ? JSON.stringify(sqlRes.rows) : '',
            actualColumns: sqlRes.columns || [],
            actualRows: sqlRes.rows || [],
            passed,
            verdict: sqlRes.verdict,
            executionTimeMs: sqlRes.executionTimeMs || 0,
            stderr: sqlRes.stderr || '',
            weight,
            isHidden: Boolean(tc.isHidden),
          });
        }

        const overallVerdict =
          passedCount === enabledCases.length
            ? 'ACCEPTED'
            : passedCount === 0
            ? results[0]?.verdict || 'WRONG_ANSWER'
            : 'PARTIAL_SUCCESS';

        return {
          verdict: overallVerdict,
          totalCount: enabledCases.length,
          passedCount,
          failedCount: enabledCases.length - passedCount,
          totalWeight,
          passedWeight,
          testCases: results,
        };
      }

      // Python / JavaScript suite execution with full faculty visibility
      const clientRes = await executionClient.executeSuite({
        language: lang,
        code,
        schemaDdl,
        testCases: enabledCases.map((tc) => ({
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: false, // Disclose actual vs expected to authoring faculty
          weight: tc.weight || 1,
        })),
        timeoutMs: tMs,
        memoryLimitMb: mMb,
        isFaculty: true,
      });

      if (!clientRes.ok || !clientRes.data?.success) {
        const error = new Error(clientRes.data?.message || 'Execution failed');
        error.statusCode = clientRes.status || 500;
        throw error;
      }

      const suiteData = clientRes.data.data;
      const mappedTestCases = (suiteData.testCases || []).map((stc, idx) => {
        const originalTc = enabledCases[idx] || {};
        return {
          testCaseId: originalTc.id || originalTc._id || `tc-${idx + 1}`,
          testCaseIndex: idx + 1,
          description: originalTc.description || originalTc.explanation || `Test Case ${idx + 1}`,
          input: originalTc.input || '',
          expectedOutput: originalTc.expectedOutput || '',
          actualOutput: stc.actualOutput !== undefined ? stc.actualOutput : '',
          stderr: stc.stderr || '',
          passed: Boolean(stc.passed),
          verdict: stc.verdict || (stc.passed ? 'ACCEPTED' : 'WRONG_ANSWER'),
          executionTimeMs: stc.executionTimeMs || 0,
          weight: originalTc.weight || 1,
          isHidden: Boolean(originalTc.isHidden),
        };
      });

      return {
        verdict: suiteData.verdict,
        totalCount: enabledCases.length,
        passedCount: suiteData.passedCount,
        failedCount: enabledCases.length - suiteData.passedCount,
        totalWeight: suiteData.totalWeight,
        passedWeight: suiteData.passedWeight,
        testCases: mappedTestCases,
      };
    }

    // Case 2: Run Individual Test Case
    if (testCase && typeof testCase === 'object') {
      if (lang === 'sqlite') {
        let expectedOut = null;
        if (testCase.expectedColumns?.length > 0 || testCase.expectedRows?.length > 0) {
          expectedOut = {
            columns: testCase.expectedColumns || [],
            rows: testCase.expectedRows || [],
          };
        } else if (testCase.expectedOutput) {
          expectedOut = testCase.expectedOutput;
        }

        let ddl = schemaDdl || '';
        if (testCase.input && testCase.input.trim()) {
          ddl = ddl ? `${ddl}\n${testCase.input.trim()}` : testCase.input.trim();
        }

        const clientRes = await executionClient.executeSql({
          dialect: 'sqlite',
          schemaDdl: ddl,
          query: code,
          expectedOutput: expectedOut,
          timeoutMs: tMs,
        });

        if (!clientRes.ok || !clientRes.data?.success) {
          const error = new Error(clientRes.data?.message || 'SQL execution failed');
          error.statusCode = clientRes.status || 500;
          throw error;
        }

        const sqlRes = clientRes.data.data;
        return {
          verdict: sqlRes.verdict,
          passed: sqlRes.verdict === 'ACCEPTED',
          stdout: sqlRes.rows ? JSON.stringify(sqlRes.rows, null, 2) : '',
          stderr: sqlRes.stderr || '',
          columns: sqlRes.columns || [],
          rows: sqlRes.rows || [],
          executionTimeMs: sqlRes.executionTimeMs || 0,
          actualOutput: sqlRes.rows ? JSON.stringify(sqlRes.rows) : '',
          expectedOutput: testCase.expectedOutput || '',
        };
      }

      const clientRes = await executionClient.executeCode({
        language: lang,
        code,
        stdin: testCase.input || '',
        expectedOutput: testCase.expectedOutput || null,
        timeoutMs: tMs,
        memoryLimitMb: mMb,
      });

      if (!clientRes.ok || !clientRes.data?.success) {
        const error = new Error(clientRes.data?.message || 'Code execution failed');
        error.statusCode = clientRes.status || 500;
        throw error;
      }

      const runRes = clientRes.data.data;
      return {
        verdict: runRes.verdict,
        passed: runRes.verdict === 'ACCEPTED',
        stdout: runRes.stdout || '',
        stderr: runRes.stderr || '',
        exitCode: runRes.exitCode,
        executionTimeMs: runRes.executionTimeMs || 0,
        actualOutput: runRes.stdout || '',
        expectedOutput: testCase.expectedOutput || '',
      };
    }

    // Case 3: Ad-hoc Run with custom stdin or default
    if (lang === 'sqlite') {
      const clientRes = await executionClient.executeSql({
        dialect: 'sqlite',
        schemaDdl: schemaDdl || '',
        query: code,
        timeoutMs: tMs,
      });

      if (!clientRes.ok || !clientRes.data?.success) {
        const error = new Error(clientRes.data?.message || 'SQL execution failed');
        error.statusCode = clientRes.status || 500;
        throw error;
      }

      const sqlRes = clientRes.data.data;
      return {
        verdict: sqlRes.verdict,
        stdout: sqlRes.rows ? JSON.stringify(sqlRes.rows, null, 2) : '',
        stderr: sqlRes.stderr || '',
        columns: sqlRes.columns || [],
        rows: sqlRes.rows || [],
        executionTimeMs: sqlRes.executionTimeMs || 0,
      };
    }

    const clientRes = await executionClient.executeCode({
      language: lang,
      code,
      stdin: stdin || '',
      timeoutMs: tMs,
      memoryLimitMb: mMb,
    });

    if (!clientRes.ok || !clientRes.data?.success) {
      const error = new Error(clientRes.data?.message || 'Code execution failed');
      error.statusCode = clientRes.status || 500;
      throw error;
    }

    const runRes = clientRes.data.data;
    return {
      verdict: runRes.verdict,
      stdout: runRes.stdout || '',
      stderr: runRes.stderr || '',
      exitCode: runRes.exitCode,
      executionTimeMs: runRes.executionTimeMs || 0,
    };
  }

  /**
   * Question validation utility returning detailed audit report
   */
  async validateQuestion(user, question) {
    const errors = [];
    const warnings = [];

    if (!question || typeof question !== 'object') {
      return { valid: false, errors: ['Question payload is required'], warnings: [] };
    }

    if (!question.questionText || !question.questionText.trim()) {
      errors.push('Problem statement / question prompt is required.');
    }

    if (question.type === 'code' || question.type === 'sql') {
      const cfg = question.codingConfig || {};
      const testCases = cfg.testCases || [];
      const enabledCases = testCases.filter((tc) => tc && tc.isEnabled !== false);

      if (enabledCases.length === 0) {
        errors.push('At least one enabled test case is required.');
      }

      const hasHidden = enabledCases.some((tc) => Boolean(tc.isHidden));
      if (!hasHidden) {
        warnings.push('No hidden test cases are configured. Adding hidden test cases is recommended for secure grading.');
      }

      const langs = cfg.allowedLanguages || [];
      const approved = ['python', 'javascript', 'sqlite'];
      if (!langs.some((l) => approved.includes(String(l).toLowerCase()))) {
        errors.push(`At least one supported language (${approved.join(', ')}) must be enabled.`);
      }

      testCases.forEach((tc, idx) => {
        const isSql = question.type === 'sql' || cfg.executionCategory === 'sql';
        const hasOut = (tc.expectedOutput && String(tc.expectedOutput).trim().length > 0) ||
          (isSql && (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0));
        if (!hasOut) {
          errors.push(`Test case #${idx + 1} is missing an expected output.`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async getApprovedTemplates() {
    const { CertificateTemplate } = require('../models');
    return await CertificateTemplate.find({
      status: 'published',
    })
      .select('_id title name description orientation pageSize isDefault version')
      .sort({ isDefault: -1, title: 1 });
  }
}

module.exports = new AssessmentService();
