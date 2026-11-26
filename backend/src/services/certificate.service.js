// Import crypto module for generating cryptographically secure random certificate identifiers and verification tokens
const crypto = require('crypto');
// Import Mongoose models required for certificate lifecycle and academic snapshots
const {
  Certificate,
  CertificateTemplate,
  Assessment,
  Submission,
  Evaluation,
  User,
  SystemSetting,
  AuditLog,
  Notification,
} = require('../models');
// Import PDF generator, storage, and email services
const pdfGenerator = require('../utils/pdfGenerator');
const storageService = require('./storage.service');
const emailService = require('./email.service');
const { parsePaginationParams, paginateInMemory } = require('../utils/pagination');

/**
 * Service managing student certificate retrieval, automatic issuance for eligible submissions,
 * PDF generation, secure storage, email dispatch, and administrative Certification Studio actions.
 */
class CertificateService {
  /**
   * Generates a unique certificate identifier string.
   * e.g. CERT-2026-A1B2C3
   */
  generateCertificateId() {
    const year = new Date().getFullYear();
    const token = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CERT-${year}-${token}`;
  }

  /**
   * Generates a tamper-evident verification code.
   * e.g. VERIFY-7F89E0B1C2D3
   */
  generateVerificationCode() {
    const token = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `VERIFY-${token}`;
  }

  /**
   * Ensures a valid published CertificateTemplate exists, resolving assessment-specific
   * overrides first (if published), falling back to the institutional default published template,
   * or creating an accredited system default template if none exist.
   */
  async resolveTemplate(templateId, instructorId) {
    // 1. Try assessment-specific template override (must be published)
    if (templateId) {
      const template = await CertificateTemplate.findOne({ _id: templateId, status: 'published' });
      if (template) return template;
    }

    // 2. Try system-wide published default template
    let template = await CertificateTemplate.findOne({ isDefault: true, status: 'published' });
    if (template) return template;

    // 3. Try any published template
    template = await CertificateTemplate.findOne({ status: 'published' }).sort({ createdAt: -1 });
    if (template) return template;

    // 4. Fallback: create accredited system default template
    template = await CertificateTemplate.create({
      title: 'Institutional Certificate of Completion',
      name: 'Institutional Certificate of Completion',
      description: 'Standard institutional credential template for certified assessment completion',
      orientation: 'landscape',
      pageSize: 'A4',
      status: 'published',
      isDefault: true,
      createdBy: instructorId || null,
      canvas: {
        backgroundColor: '#FFFFFF',
        borderStyle: 'classic-gold',
        borderColor: '#D4AF37',
        borderWidth: 8,
      },
      branding: {
        institutionName: 'Unified Assessment Platform',
        signatoryName: 'Dr. Jane Smith',
        signatoryTitle: 'Dean of Academic Affairs',
      },
      elements: [
        { id: 'el-title', type: 'text', content: 'Certificate of Achievement' },
        { id: 'el-body', type: 'text', content: 'This certifies satisfactory completion of the curriculum.' },
      ],
    });

    return template;
  }

  /**
   * Automatically issues a Certificate for an eligible evaluated submission if one does not already exist.
   * Guarantees idempotency via compound uniqueness on { studentId, assessmentId }.
   * Generates print-ready PDF, persists secure storage metadata, and dispatches transactional email.
   */
  async issueCertificateForEvaluation(evaluation, submission, assessment, studentUser) {
    if (!evaluation || !submission || !assessment || !studentUser) return null;
    if (!evaluation.certificateEligible) return null;

    // Resilient parameter resolution in case model IDs were passed
    let student = studentUser;
    if (!student?.name || !student?._id) {
      student = await User.findById(studentUser._id || studentUser);
    }
    if (!student) return null;

    let asmt = assessment;
    if (!asmt?.title || !asmt?._id) {
      asmt = await Assessment.findById(assessment._id || assessment);
    }
    if (!asmt) return null;

    let sub = submission;
    if (!sub?._id) {
      sub = await Submission.findById(submission._id || submission);
    }
    if (!sub) return null;

    // Check if certificate already exists (idempotent lookup)
    let certDoc = await Certificate.findOne({
      studentId: student._id,
      assessmentId: asmt._id,
    });

    if (certDoc) {
      // If certificate exists but PDF is missing, try generating it
      if (!certDoc.pdf?.fileKey) {
        await this.generateAndStorePdf(certDoc, asmt, student);
      }
      return certDoc;
    }

    try {
      const template = await this.resolveTemplate(
        asmt.certification?.templateId,
        asmt.instructorId
      );

      const instructor = asmt.instructorId
        ? await User.findById(asmt.instructorId).select('name')
        : null;

      const certificateId = this.generateCertificateId();
      const verificationCode = this.generateVerificationCode();

      certDoc = await Certificate.create({
        certificateId,
        studentId: student._id,
        assessmentId: asmt._id,
        submissionId: sub._id,
        evaluationId: evaluation._id,
        templateId: template._id,
        templateVersion: template.version || 1,
        templateSnapshot: {
          title: template.title,
          orientation: template.orientation || 'landscape',
          pageSize: template.pageSize || 'A4',
          canvas: template.canvas || {},
          branding: template.branding || {},
          elements: template.elements || [],
        },
        academicSnapshot: {
          studentName: student.name || 'Student',
          studentIdNumber: student.studentId || '',
          studentEmail: student.email,
          assessmentTitle: asmt.title,
          certificateTitle:
            asmt.certification?.certificateTitle?.trim() ||
            `${asmt.title} — Certificate of Completion`,
          category: asmt.category || 'General',
          score: evaluation.finalScore !== undefined ? evaluation.finalScore : (sub.finalScore || 0),
          totalPoints: asmt.totalPoints || 100,
          percentage: evaluation.percentage !== undefined ? evaluation.percentage : (sub.percentage || 0),
          grade: evaluation.grade || 'Pass',
          gradeLabel: evaluation.gradeLabel || '',
          passingPercentage: asmt.certification?.passingPercentage || 50,
          instructorName: instructor?.name || '',
          signatoryName: asmt.certification?.signatoryName || template.branding?.signatoryName || '',
          signatoryTitle: asmt.certification?.signatoryTitle || template.branding?.signatoryTitle || 'Dean of Academic Affairs',
        },
        status: 'active',
        verificationCode,
        issuedAt: evaluation.gradedAt || new Date(),
        issuance: {
          status: 'issued',
          failureReason: null,
          retryCount: 0,
          lastAttemptAt: new Date(),
        },
        emailDelivery: {
          status: 'pending',
          sentAt: null,
          error: null,
          retryCount: 0,
          lastAttemptAt: null,
        },
      });

      // Generate PDF, save to storage, and dispatch transactional email
      await this.generateAndStorePdf(certDoc, asmt, student, template);

      // Create in-app notification for student
      try {
        await Notification.create({
          userId: student._id,
          title: 'Certificate of Achievement Awarded!',
          message: `Congratulations! You earned an accredited certificate for "${asmt.title}".`,
          type: 'grade',
          link: '/student/certifications',
        });
      } catch (notifErr) {
        console.warn('[CertificateService] Non-fatal notification error:', notifErr.message);
      }

      return certDoc;
    } catch (err) {
      // If concurrent request created it first, fetch the created record
      if (err.code === 11000 || /duplicate/i.test(err.message)) {
        return await Certificate.findOne({
          studentId: student._id,
          assessmentId: asmt._id,
        });
      }
      console.warn('[CertificateService] Non-fatal auto-issuance error:', err.message);
      return null;
    }
  }

  /**
   * Helper generating PDF buffer, persisting to storage, and sending email notification.
   */
  async generateAndStorePdf(certDoc, assessment, student, templateDoc) {
    try {
      const template = templateDoc || (certDoc.templateId ? await CertificateTemplate.findById(certDoc.templateId) : null);
      const systemSetting = await SystemSetting.findOne();

      const pdfBuffer = await pdfGenerator.generateCertificatePdf({
        certificate: certDoc,
        template: certDoc.templateSnapshot || template,
        systemSetting,
      });

      const savedPdf = await storageService.saveCertificatePdf({
        certificateId: certDoc.certificateId,
        buffer: pdfBuffer,
      });

      certDoc.pdf = {
        fileKey: savedPdf.fileKey,
        filePath: savedPdf.filePath,
        fileSize: savedPdf.fileSize,
        generatedAt: savedPdf.generatedAt,
      };
      certDoc.issuance.status = 'issued';
      certDoc.issuance.lastAttemptAt = new Date();
      await certDoc.save();

      // Dispatch Transactional Email with PDF attachment
      const autoEmail = systemSetting?.certification?.autoEmailCertificates !== false;
      if (autoEmail && student?.email) {
        try {
          const emailRes = await emailService.sendCertificateAwardedEmail({
            student,
            certificate: certDoc,
            assessment,
            pdfBuffer,
          });

          if (emailRes.success) {
            certDoc.emailDelivery = {
              status: 'sent',
              sentAt: new Date(),
              error: null,
              retryCount: certDoc.emailDelivery?.retryCount || 0,
              lastAttemptAt: new Date(),
            };
          } else {
            certDoc.emailDelivery = {
              status: 'failed',
              sentAt: null,
              error: emailRes.error || 'Failed to dispatch email',
              retryCount: (certDoc.emailDelivery?.retryCount || 0) + 1,
              lastAttemptAt: new Date(),
            };
          }
          await certDoc.save();
        } catch (emailErr) {
          certDoc.emailDelivery = {
            status: 'failed',
            sentAt: null,
            error: emailErr.message,
            retryCount: (certDoc.emailDelivery?.retryCount || 0) + 1,
            lastAttemptAt: new Date(),
          };
          await certDoc.save();
        }
      }

      return pdfBuffer;
    } catch (pdfErr) {
      console.error('[CertificateService] PDF generation or storage failed:', pdfErr.message);
      certDoc.issuance = {
        status: 'failed',
        failureReason: pdfErr.message,
        retryCount: (certDoc.issuance?.retryCount || 0) + 1,
        lastAttemptAt: new Date(),
      };
      await certDoc.save();
      return null;
    }
  }

  /**
   * Retrieves all certificates earned by the authenticated student.
   * Derives ownership strictly from the verified authenticated student ID.
   */
  async getStudentCertificates(studentId, options = {}) {
    const hasPagination = options.page !== undefined || options.limit !== undefined;
    if (!studentId) {
      return hasPagination
        ? { certificates: [], total: 0, page: 1, limit: 10, totalPages: 1 }
        : [];
    }

    const studentUser = await User.findById(studentId);
    if (!studentUser) {
      return hasPagination
        ? { certificates: [], total: 0, page: 1, limit: 10, totalPages: 1 }
        : [];
    }

    // Query authoritative issued certificates owned by this student
    const certificates = await Certificate.find({
      studentId,
      $or: [{ 'issuance.status': 'issued' }, { 'issuance.status': { $exists: false } }],
    })
      .populate('assessmentId', 'title category totalPoints passingScore status accessType')
      .populate('submissionId', 'status evaluationStatus passed')
      .populate('evaluationId', 'status passed certificateEligible')
      .sort({ issuedAt: -1, _id: -1 });

    // Exclude any certificate linked to a pending, failed, or non-eligible submission/evaluation
    const eligibleCertificates = certificates.filter((cert) => {
      if (cert.submissionId && typeof cert.submissionId === 'object' && cert.submissionId.status) {
        if (
          cert.submissionId.status !== 'evaluated' ||
          cert.submissionId.evaluationStatus === 'pending' ||
          !cert.submissionId.passed
        ) {
          return false;
        }
      }
      if (cert.evaluationId && typeof cert.evaluationId === 'object' && cert.evaluationId.status) {
        if (cert.evaluationId.status !== 'completed' || !cert.evaluationId.certificateEligible) {
          return false;
        }
      }
      return true;
    });

    // Format clean response representation for frontend consumption
    let formatted = eligibleCertificates.map((cert) => {
      const snap = cert.academicSnapshot || {};
      const certStatus = cert.status || 'active';
      return {
        id: cert._id.toString(),
        _id: cert._id.toString(),
        certificateId: cert.certificateId,
        verificationCode: cert.verificationCode,
        verificationStatus: certStatus === 'revoked' ? 'revoked' : 'verified',
        title: snap.certificateTitle || `${snap.assessmentTitle || 'Course'} Certificate`,
        certificateTitle: snap.certificateTitle || `${snap.assessmentTitle || 'Course'} Certificate`,
        assessmentName: snap.assessmentTitle || cert.assessmentId?.title || 'Assessment',
        assessmentTitle: snap.assessmentTitle || cert.assessmentId?.title || 'Assessment',
        assessmentId: cert.assessmentId?._id ? cert.assessmentId._id.toString() : cert.assessmentId?.toString(),
        category: snap.category || cert.assessmentId?.category || 'General',
        studentName: snap.studentName || studentUser.name,
        studentEmail: snap.studentEmail || studentUser.email,
        studentIdNumber: snap.studentIdNumber || studentUser.studentId || '',
        score: snap.score,
        totalPoints: snap.totalPoints,
        percentage: typeof snap.percentage === 'number' ? snap.percentage : null,
        grade: snap.grade || null,
        gradeLabel: snap.gradeLabel || '',
        status: certStatus,
        revocation: certStatus === 'revoked' ? cert.revocation : null,
        issuedAt: cert.issuedAt,
        downloadAvailable: certStatus !== 'revoked',
        supportedFormats: ['pdf', 'png', 'jpg'],
        pdfKey: cert.pdf?.fileKey || null,
        emailStatus: cert.emailDelivery?.status || 'pending',
      };
    });

    if (!hasPagination && !options.search && !options.status) {
      return formatted;
    }

    const totalAll = formatted.length;
    if (options.status && options.status !== 'all') {
      formatted = formatted.filter((c) => c.status === options.status);
    }

    if (options.search && String(options.search).trim()) {
      const q = String(options.search).trim().toLowerCase();
      formatted = formatted.filter((cert) => {
        const title = (cert.title || cert.certificateTitle || '').toLowerCase();
        const assessment = (cert.assessmentName || cert.assessmentTitle || '').toLowerCase();
        const certId = (cert.certificateId || '').toLowerCase();
        const code = (cert.verificationCode || '').toLowerCase();
        const category = (cert.category || '').toLowerCase();
        return (
          title.includes(q) ||
          assessment.includes(q) ||
          certId.includes(q) ||
          code.includes(q) ||
          category.includes(q)
        );
      });
    }

    if (options.sortBy) {
      const dir = String(options.sortOrder || '').toLowerCase() === 'asc' ? 1 : -1;
      formatted.sort((a, b) => {
        if (options.sortBy === 'title') {
          return dir * (a.title || '').localeCompare(b.title || '') || a.id.localeCompare(b.id);
        }
        const diff = new Date(a.issuedAt || 0) - new Date(b.issuedAt || 0);
        return dir * diff || a.id.localeCompare(b.id);
      });
    }

    if (!hasPagination) {
      return formatted;
    }

    const parsed = parsePaginationParams(options, 10, 200);
    const paged = paginateInMemory(formatted, parsed.page, parsed.limit);
    return {
      certificates: paged.items,
      total: paged.total,
      page: paged.page,
      limit: paged.limit,
      totalPages: paged.totalPages,
      totalAll,
    };
  }

  /**
   * Retrieves single certificate details by MongoDB ID or certificateId string.
   * Strictly enforces caller student authorization.
   */
  async getCertificateById(identifier, studentId) {
    if (!identifier || !studentId) {
      const err = new Error('Certificate ID and authenticated student identity are required');
      err.statusCode = 400;
      throw err;
    }

    // Try finding by MongoDB ObjectId or public certificateId
    const query = identifier.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: identifier }
      : { certificateId: identifier.toUpperCase().trim() };

    const cert = await Certificate.findOne(query)
      .populate('assessmentId', 'title category totalPoints passingScore')
      .populate('templateId', 'title orientation pageSize elements branding canvas');

    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    // Strict ownership verification: student can only access their own certificate
    if (cert.studentId.toString() !== studentId.toString()) {
      const err = new Error('Access denied: You are not authorized to view this certificate');
      err.statusCode = 403;
      throw err;
    }

    return cert;
  }

  /**
   * Handles certificate download request in PDF, PNG, or JPG/JPEG format.
   * Uses the same authoritative certificate record and enforces caller authorization.
   */
  async downloadCertificate(identifier, requestingUser, options = {}) {
    if (!identifier || !requestingUser) {
      const err = new Error('Certificate ID and authenticated user are required');
      err.statusCode = 400;
      throw err;
    }

    const format = String(options.format || 'pdf').toLowerCase().trim();
    if (!['pdf', 'png', 'jpg', 'jpeg'].includes(format)) {
      const err = new Error('Unsupported certificate format. Allowed formats: pdf, png, jpg, jpeg.');
      err.statusCode = 400;
      throw err;
    }

    const query = identifier.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: identifier }
      : { certificateId: identifier.toUpperCase().trim() };

    const cert = await Certificate.findOne(query)
      .populate('assessmentId', 'title category totalPoints passingScore certification')
      .populate('templateId');

    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    // Authorization: Admin can download any; student can only download their own
    const isAdmin = requestingUser.role === 'admin';
    const isOwner = requestingUser.id && cert.studentId.toString() === requestingUser.id.toString();

    if (!isAdmin && !isOwner) {
      const err = new Error('Access denied: You are not authorized to download this certificate');
      err.statusCode = 403;
      throw err;
    }

    if (cert.issuance?.status && cert.issuance.status !== 'issued') {
      const err = new Error('Certificate is not issued yet and cannot be downloaded.');
      err.statusCode = 409;
      throw err;
    }

    if (format === 'png' || format === 'jpg' || format === 'jpeg') {
      const systemSetting = await SystemSetting.findOne();
      const buffer = await pdfGenerator.generateCertificateImage({
        certificate: cert,
        template: cert.templateSnapshot || cert.templateId,
        systemSetting,
        format,
      });
      const ext = format === 'jpeg' ? 'jpg' : format;
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      return {
        buffer,
        filename: `${cert.certificateId}.${ext}`,
        contentType,
        certificate: cert,
      };
    }

    // Check if PDF is already stored
    let buffer = null;
    if (cert.pdf?.fileKey) {
      try {
        buffer = await storageService.getCertificatePdfBuffer(cert.pdf.fileKey);
      } catch (e) {
        console.warn('[CertificateService] Stored PDF not found on disk, re-rendering:', e.message);
      }
    }

    // If PDF is not yet generated or missing from disk, render on-the-fly and save
    if (!buffer) {
      const studentUser = await User.findById(cert.studentId);
      const systemSetting = await SystemSetting.findOne();
      buffer = await pdfGenerator.generateCertificatePdf({
        certificate: cert,
        template: cert.templateSnapshot || cert.templateId,
        systemSetting,
      });

      try {
        const saved = await storageService.saveCertificatePdf({
          certificateId: cert.certificateId,
          buffer,
        });
        cert.pdf = {
          fileKey: saved.fileKey,
          filePath: saved.filePath,
          fileSize: saved.fileSize,
          generatedAt: saved.generatedAt,
        };
        cert.issuance.status = 'issued';
        await cert.save();
      } catch (saveErr) {
        console.warn('[CertificateService] Non-fatal save error during on-the-fly PDF download:', saveErr.message);
      }
    }

    return {
      buffer,
      filename: `${cert.certificateId}.pdf`,
      contentType: 'application/pdf',
      certificate: cert,
    };
  }

  /**
   * Public verification endpoint verifying credential authenticity without leaking confidential PII.
   * Matches either by cryptographically secure verificationCode or public certificateId.
   */
  async verifyCertificate(codeOrId) {
    if (!codeOrId || typeof codeOrId !== 'string') {
      return { valid: false, message: 'Invalid verification token format' };
    }

    const clean = codeOrId.trim();
    const query = clean.toUpperCase().startsWith('VERIFY-')
      ? { verificationCode: clean.toUpperCase() }
      : { certificateId: clean.toUpperCase() };

    const cert = await Certificate.findOne(query);
    if (!cert) {
      return { valid: false, message: 'No accredited credential found matching the supplied verification code.' };
    }

    const snap = cert.academicSnapshot || {};
    return {
      valid: true,
      status: cert.status, // 'active' | 'revoked'
      certificateId: cert.certificateId,
      verificationCode: cert.verificationCode,
      studentName: snap.studentName,
      assessmentTitle: snap.assessmentTitle,
      certificateTitle: snap.certificateTitle,
      category: snap.category,
      grade: snap.grade,
      gradeLabel: snap.gradeLabel,
      issuedAt: cert.issuedAt,
      revocation: cert.status === 'revoked' ? {
        revokedAt: cert.revocation?.revokedAt,
        reason: cert.revocation?.reason,
      } : null,
    };
  }

  /**
   * Administrator certificate registry inspection with filtering, search, and pagination.
   */
  async getAllCertificatesAdmin({ search, status, assessmentId, emailStatus, page = 1, limit = 20 }) {
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (assessmentId && assessmentId !== 'all') {
      query.assessmentId = assessmentId;
    }

    if (emailStatus && emailStatus !== 'all') {
      query['emailDelivery.status'] = emailStatus;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = { $regex: q, $options: 'i' };
      query.$or = [
        { certificateId: regex },
        { verificationCode: regex },
        { 'academicSnapshot.studentName': regex },
        { 'academicSnapshot.studentEmail': regex },
        { 'academicSnapshot.studentIdNumber': regex },
        { 'academicSnapshot.assessmentTitle': regex },
        { 'academicSnapshot.certificateTitle': regex },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);
    const total = await Certificate.countDocuments(query);
    const certificates = await Certificate.find(query)
      .populate('studentId', 'name email studentId avatar department')
      .populate('assessmentId', 'title category totalPoints passingScore status accessType')
      .populate('templateId', 'title isDefault status version')
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    return {
      total,
      page: parseInt(page, 10),
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
      certificates,
    };
  }

  /**
   * Administrator detailed certificate inspection.
   */
  async getCertificateDetailsAdmin(identifier) {
    const query = identifier.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: identifier }
      : { certificateId: identifier.toUpperCase().trim() };

    const cert = await Certificate.findOne(query)
      .populate('studentId', 'name email studentId avatar department')
      .populate('assessmentId', 'title category totalPoints passingScore status durationMinutes accessType certification')
      .populate('submissionId')
      .populate('evaluationId')
      .populate('templateId')
      .populate('revocation.revokedBy', 'name email role');

    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    return cert;
  }

  /**
   * Administrator certificate revocation with mandatory reason and immutable audit trail.
   */
  async revokeCertificate(identifier, adminUserId, reason) {
    if (!reason || !reason.trim()) {
      const err = new Error('Revocation reason is required');
      err.statusCode = 400;
      throw err;
    }

    const query = identifier.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: identifier }
      : { certificateId: identifier.toUpperCase().trim() };

    const cert = await Certificate.findOne(query);
    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    cert.status = 'revoked';
    cert.revocation = {
      revokedAt: new Date(),
      revokedBy: adminUserId,
      reason: reason.trim(),
    };

    await cert.save();

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: 'CERTIFICATE_REVOKED',
        entityType: 'Certificate',
        entityId: cert._id.toString(),
        details: {
          certificateId: cert.certificateId,
          studentId: cert.studentId,
          assessmentId: cert.assessmentId,
          reason: cert.revocation.reason,
        },
      });
    } catch (auditErr) {
      console.warn('[CertificateService] Non-fatal audit log error on revocation:', auditErr.message);
    }

    return cert;
  }

  /**
   * Administrator certificate template listing.
   */
  async getTemplatesAdmin({ status }) {
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    return await CertificateTemplate.find(query)
      .populate('createdBy', 'name email')
      .sort({ isDefault: -1, createdAt: -1 });
  }

  /**
   * Administrator single template inspection.
   */
  async getTemplateByIdAdmin(id) {
    const template = await CertificateTemplate.findById(id).populate('createdBy', 'name email');
    if (!template) {
      const err = new Error('Certificate template not found');
      err.statusCode = 404;
      throw err;
    }
    return template;
  }

  /**
   * Administrator certificate template creation.
   */
  async createTemplateAdmin(adminUserId, data) {
    // If set as default, demote any other default templates
    if (data.isDefault) {
      await CertificateTemplate.updateMany({}, { isDefault: false });
    }

    const template = await CertificateTemplate.create({
      ...data,
      createdBy: adminUserId,
      status: data.status || 'draft',
      version: 1,
      publishedAt: data.status === 'published' ? new Date() : null,
    });

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: 'CERTIFICATE_TEMPLATE_CREATED',
        entityType: 'CertificateTemplate',
        entityId: template._id.toString(),
        details: { title: template.title, status: template.status, isDefault: template.isDefault },
      });
    } catch (e) {
      console.warn('[CertificateService] Audit log error:', e.message);
    }

    return template;
  }

  /**
   * Administrator certificate template modification (increments version on published updates).
   */
  async updateTemplateAdmin(id, adminUserId, data) {
    const template = await CertificateTemplate.findById(id);
    if (!template) {
      const err = new Error('Certificate template not found');
      err.statusCode = 404;
      throw err;
    }

    // If marked as default, atomically demote all others
    if (data.isDefault && !template.isDefault) {
      await CertificateTemplate.updateMany({ _id: { $ne: template._id } }, { isDefault: false });
    }

    // Increment version if template was already published or is being published
    if (template.status === 'published' || data.status === 'published') {
      template.version = (template.version || 1) + 1;
    }

    if (data.status === 'published' && template.status !== 'published') {
      template.publishedAt = new Date();
    } else if (data.status === 'archived' && template.status !== 'archived') {
      template.archivedAt = new Date();
    }

    Object.assign(template, data);
    await template.save();

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: 'CERTIFICATE_TEMPLATE_UPDATED',
        entityType: 'CertificateTemplate',
        entityId: template._id.toString(),
        details: { title: template.title, version: template.version, status: template.status },
      });
    } catch (e) {
      console.warn('[CertificateService] Audit log error:', e.message);
    }

    return template;
  }

  /**
   * Administrator set template as system-wide default.
   */
  async setDefaultTemplateAdmin(id, adminUserId) {
    const template = await CertificateTemplate.findById(id);
    if (!template) {
      const err = new Error('Certificate template not found');
      err.statusCode = 404;
      throw err;
    }

    // Demote all others atomically
    await CertificateTemplate.updateMany({}, { isDefault: false });

    template.isDefault = true;
    template.status = 'published';
    if (!template.publishedAt) {
      template.publishedAt = new Date();
    }
    await template.save();

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: 'CERTIFICATE_TEMPLATE_DEFAULT_SET',
        entityType: 'CertificateTemplate',
        entityId: template._id.toString(),
        details: { title: template.title },
      });
    } catch (e) {
      console.warn('[CertificateService] Audit log error:', e.message);
    }

    return template;
  }

  /**
   * Live template preview rendering with dummy placeholder data.
   */
  async previewTemplate(templateData) {
    const dummyCert = {
      certificateId: 'CERT-2026-PREVIEW',
      verificationCode: 'VERIFY-PREVIEW-000',
      issuedAt: new Date(),
      academicSnapshot: {
        studentName: 'Alex Mercer',
        studentIdNumber: 'STU-2026-888',
        studentEmail: 'alex.mercer@uap.edu',
        assessmentTitle: 'Advanced Cloud Security & Architecture',
        certificateTitle: templateData.title || 'Certificate of Excellence',
        category: 'Cloud Engineering',
        score: 94,
        totalPoints: 100,
        percentage: 94,
        grade: 'A+',
        gradeLabel: 'Outstanding',
        passingPercentage: 60,
        instructorName: 'Dr. Gregory House',
        signatoryName: templateData.branding?.signatoryName || 'Dr. Jane Smith',
        signatoryTitle: templateData.branding?.signatoryTitle || 'Dean of Academic Affairs',
      },
    };

    const systemSetting = await SystemSetting.findOne();
    return await pdfGenerator.generateCertificatePdf({
      certificate: dummyCert,
      template: templateData,
      systemSetting,
      verificationUrl: 'https://uap.edu/verify/VERIFY-PREVIEW-000',
    });
  }

  /**
   * Administrator Certificate Issuance & Delivery Analytics.
   */
  async getIssuanceAnalyticsAdmin() {
    const totalCertificates = await Certificate.countDocuments();
    const activeCertificates = await Certificate.countDocuments({ status: 'active' });
    const revokedCertificates = await Certificate.countDocuments({ status: 'revoked' });

    const emailSent = await Certificate.countDocuments({ 'emailDelivery.status': 'sent' });
    const emailFailed = await Certificate.countDocuments({ 'emailDelivery.status': 'failed' });
    const emailPending = await Certificate.countDocuments({ 'emailDelivery.status': 'pending' });

    const totalTemplates = await CertificateTemplate.countDocuments();
    const publishedTemplates = await CertificateTemplate.countDocuments({ status: 'published' });
    const draftTemplates = await CertificateTemplate.countDocuments({ status: 'draft' });

    // Top assessments by issued certificates
    const topAssessments = await Certificate.aggregate([
      { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'assessments',
          localField: '_id',
          foreignField: '_id',
          as: 'assessment',
        },
      },
      { $unwind: { path: '$assessment', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          count: 1,
          title: '$assessment.title',
          category: '$assessment.category',
        },
      },
    ]);

    return {
      overview: {
        totalCertificates,
        activeCertificates,
        revokedCertificates,
        emailDeliveryRate: totalCertificates > 0 ? Math.round((emailSent / totalCertificates) * 100) : 0,
      },
      emailDelivery: {
        sent: emailSent,
        failed: emailFailed,
        pending: emailPending,
      },
      templates: {
        total: totalTemplates,
        published: publishedTemplates,
        draft: draftTemplates,
      },
      topAssessments,
    };
  }

  /**
   * Retry sending email notification for an issued certificate.
   */
  async retryEmailDeliveryAdmin(certificateId, adminUserId) {
    const query = certificateId.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: certificateId }
      : { certificateId: certificateId.toUpperCase().trim() };

    const cert = await Certificate.findOne(query).populate('assessmentId');
    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    const student = await User.findById(cert.studentId);
    if (!student || !student.email) {
      const err = new Error('Recipient student email not found on record');
      err.statusCode = 404;
      throw err;
    }

    // Resolve or generate PDF buffer
    let pdfBuffer = null;
    if (cert.pdf?.fileKey) {
      try {
        pdfBuffer = await storageService.getCertificatePdfBuffer(cert.pdf.fileKey);
      } catch (e) {
        console.warn('[CertificateService] Stored PDF not found on retry, re-rendering:', e.message);
      }
    }

    if (!pdfBuffer) {
      const systemSetting = await SystemSetting.findOne();
      pdfBuffer = await pdfGenerator.generateCertificatePdf({
        certificate: cert,
        template: cert.templateSnapshot,
        systemSetting,
      });
      const saved = await storageService.saveCertificatePdf({
        certificateId: cert.certificateId,
        buffer: pdfBuffer,
      });
      cert.pdf = {
        fileKey: saved.fileKey,
        filePath: saved.filePath,
        fileSize: saved.fileSize,
        generatedAt: saved.generatedAt,
      };
    }

    const emailRes = await emailService.sendCertificateAwardedEmail({
      student,
      certificate: cert,
      assessment: cert.assessmentId,
      pdfBuffer,
    });

    cert.emailDelivery.retryCount = (cert.emailDelivery?.retryCount || 0) + 1;
    cert.emailDelivery.lastAttemptAt = new Date();

    if (emailRes.success) {
      cert.emailDelivery.status = 'sent';
      cert.emailDelivery.sentAt = new Date();
      cert.emailDelivery.error = null;
    } else {
      cert.emailDelivery.status = 'failed';
      cert.emailDelivery.error = emailRes.error || 'Retry delivery failed';
    }

    await cert.save();

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: 'CERTIFICATE_EMAIL_RETRIED',
        entityType: 'Certificate',
        entityId: cert._id.toString(),
        details: { certificateId: cert.certificateId, deliveryStatus: cert.emailDelivery.status },
      });
    } catch (e) {
      console.warn('[CertificateService] Audit log error:', e.message);
    }

    return {
      success: emailRes.success,
      emailDelivery: cert.emailDelivery,
    };
  }

  /**
   * Retry generating and storing PDF for a certificate marked failed.
   */
  async retryIssuanceAdmin(certificateId, adminUserId) {
    const query = certificateId.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: certificateId }
      : { certificateId: certificateId.toUpperCase().trim() };

    const cert = await Certificate.findOne(query).populate('assessmentId');
    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    const student = await User.findById(cert.studentId);
    const systemSetting = await SystemSetting.findOne();

    try {
      const pdfBuffer = await pdfGenerator.generateCertificatePdf({
        certificate: cert,
        template: cert.templateSnapshot,
        systemSetting,
      });

      const saved = await storageService.saveCertificatePdf({
        certificateId: cert.certificateId,
        buffer: pdfBuffer,
      });

      cert.pdf = {
        fileKey: saved.fileKey,
        filePath: saved.filePath,
        fileSize: saved.fileSize,
        generatedAt: saved.generatedAt,
      };
      cert.issuance = {
        status: 'issued',
        failureReason: null,
        retryCount: (cert.issuance?.retryCount || 0) + 1,
        lastAttemptAt: new Date(),
      };
      await cert.save();

      try {
        await AuditLog.create({
          userId: adminUserId,
          action: 'CERTIFICATE_ISSUANCE_RETRIED',
          entityType: 'Certificate',
          entityId: cert._id.toString(),
          details: { certificateId: cert.certificateId, status: cert.issuance.status },
        });
      } catch (e) {
        console.warn('[CertificateService] Audit log error:', e.message);
      }

      return cert;
    } catch (err) {
      cert.issuance.status = 'failed';
      cert.issuance.failureReason = err.message;
      cert.issuance.retryCount = (cert.issuance?.retryCount || 0) + 1;
      cert.issuance.lastAttemptAt = new Date();
      await cert.save();
      throw err;
    }
  }

  /**
   * Retrieve Institutional Certification Settings from SystemSetting.
   */
  async getCertificationSettingsAdmin() {
    let setting = await SystemSetting.findOne();
    if (!setting) {
      setting = await SystemSetting.create({});
    }
    return setting.certification || {};
  }

  /**
   * Update Institutional Certification Settings in SystemSetting.
   */
  async updateCertificationSettingsAdmin(adminUserId, data) {
    let setting = await SystemSetting.findOne();
    if (!setting) {
      setting = await SystemSetting.create({});
    }

    setting.certification = {
      ...setting.certification,
      ...data,
    };
    setting.updatedBy = adminUserId;
    await setting.save();

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: 'CERTIFICATION_SETTINGS_UPDATED',
        entityType: 'SystemSetting',
        entityId: setting._id.toString(),
        details: data,
      });
    } catch (e) {
      console.warn('[CertificateService] Audit log error:', e.message);
    }

    return setting.certification;
  }
}

module.exports = new CertificateService();
