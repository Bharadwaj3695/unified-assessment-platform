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
} = require('../models');

/**
 * Service managing student certificate retrieval, automatic issuance for eligible submissions,
 * and authorized credential verification.
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
   * Ensures a valid CertificateTemplate exists, falling back to a published/default template
   * or creating a default template if none exist in the database.
   */
  async resolveTemplate(templateId, instructorId) {
    if (templateId) {
      const template = await CertificateTemplate.findById(templateId);
      if (template) return template;
    }

    // Try default published template
    let template = await CertificateTemplate.findOne({ isDefault: true, status: 'published' });
    if (template) return template;

    // Try any published template
    template = await CertificateTemplate.findOne({ status: 'published' });
    if (template) return template;

    // If no templates exist, create an accredited system default template
    template = await CertificateTemplate.create({
      title: 'Institutional Certificate of Completion',
      name: 'Institutional Certificate of Completion',
      description: 'Standard institutional credential template for certified assessment completion',
      orientation: 'landscape',
      pageSize: 'A4',
      status: 'published',
      isDefault: true,
      createdBy: instructorId || null,
      elements: [
        { type: 'title', content: 'Certificate of Achievement' },
        { type: 'body', content: 'This certifies satisfactory completion of the curriculum.' },
      ],
    });

    return template;
  }

  /**
   * Automatically issues a Certificate for an eligible evaluated submission if one does not already exist.
   * Guarantees idempotency via compound uniqueness on { studentId, assessmentId }.
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

    // Check if certificate already exists
    const existing = await Certificate.findOne({
      studentId: student._id,
      assessmentId: asmt._id,
    });
    if (existing) return existing;

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

      const certDoc = await Certificate.create({
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
          signatoryName: asmt.certification?.signatoryName || '',
          signatoryTitle: asmt.certification?.signatoryTitle || 'Dean of Academic Affairs',
        },
        status: 'active',
        verificationCode,
        issuedAt: evaluation.gradedAt || new Date(),
      });

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
   * Retrieves all certificates earned by the authenticated student.
   * Derives ownership strictly from the verified authenticated student ID.
   */
  async getStudentCertificates(studentId) {
    if (!studentId) return [];

    const studentUser = await User.findById(studentId);
    if (!studentUser) return [];

    // Check for any unissued eligible evaluations to ensure immediate availability
    try {
      const eligibleEvaluations = await Evaluation.find({
        certificateEligible: true,
        status: 'completed',
      }).populate('submissionId');

      for (const ev of eligibleEvaluations) {
        if (ev.submissionId && ev.submissionId.studentId && ev.submissionId.studentId.toString() === studentId.toString()) {
          const assessment = await Assessment.findById(ev.submissionId.assessmentId);
          if (assessment && assessment.certification && assessment.certification.enabled) {
            await this.issueCertificateForEvaluation(ev, ev.submissionId, assessment, studentUser);
          }
        }
      }
    } catch (evalErr) {
      console.warn('[CertificateService] Non-fatal check for eligible evaluations:', evalErr.message);
    }

    // Query all authoritative certificates owned by this student
    const certificates = await Certificate.find({
      studentId,
    })
      .populate('assessmentId', 'title category totalPoints passingScore status accessType')
      .sort({ issuedAt: -1 });

    // Format clean response representation for frontend consumption
    return certificates.map((cert) => {
      const snap = cert.academicSnapshot || {};
      return {
        id: cert._id.toString(),
        _id: cert._id.toString(),
        certificateId: cert.certificateId,
        verificationCode: cert.verificationCode,
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
        status: cert.status || 'active',
        issuedAt: cert.issuedAt,
        downloadAvailable: false,
        downloadDependencyMessage: 'Certificate PDF rendering and download service is pending backend implementation.',
      };
    });
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
      .populate('templateId', 'title orientation pageSize elements');

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
   * Handles certificate download request.
   * Returns documented 501 Not Implemented response since PDF rendering engine is pending.
   */
  async downloadCertificate(identifier, studentId) {
    // Verify existence and authorization first
    await this.getCertificateById(identifier, studentId);

    const err = new Error(
      'Certificate PDF download functionality is currently pending backend implementation'
    );
    err.statusCode = 501;
    err.code = 'NOT_IMPLEMENTED';
    throw err;
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
  async getAllCertificatesAdmin({ search, status, assessmentId, page = 1, limit = 20 }) {
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (assessmentId) {
      query.assessmentId = assessmentId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = { $regex: q, $options: 'i' };
      query.$or = [
        { certificateId: regex },
        { verificationCode: regex },
        { 'academicSnapshot.studentName': regex },
        { 'academicSnapshot.studentEmail': regex },
        { 'academicSnapshot.assessmentTitle': regex },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const total = await Certificate.countDocuments(query);
    const certificates = await Certificate.find(query)
      .populate('studentId', 'name email studentId avatar')
      .populate('assessmentId', 'title category totalPoints passingScore status')
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    return {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
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
      .populate('assessmentId', 'title category totalPoints passingScore status durationMinutes accessType')
      .populate('submissionId')
      .populate('evaluationId')
      .populate('templateId');

    if (!cert) {
      const err = new Error('Certificate not found');
      err.statusCode = 404;
      throw err;
    }

    return cert;
  }

  /**
   * Administrator certificate revocation with reason and audit trail preservation.
   */
  async revokeCertificate(identifier, adminUserId, reason) {
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
      reason: (reason || 'Administrative revocation').trim(),
    };

    await cert.save();

    try {
      const { AuditLog } = require('../models');
      if (AuditLog) {
        await AuditLog.create({
          userId: adminUserId,
          action: 'CERTIFICATE_REVOKED',
          details: {
            certificateId: cert.certificateId,
            studentId: cert.studentId,
            assessmentId: cert.assessmentId,
            reason: cert.revocation.reason,
          },
        });
      }
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
   * Administrator certificate template creation.
   */
  async createTemplateAdmin(adminUserId, data) {
    return await CertificateTemplate.create({
      ...data,
      createdBy: adminUserId,
      status: data.status || 'draft',
    });
  }

  /**
   * Administrator certificate template modification (increments version).
   */
  async updateTemplateAdmin(id, adminUserId, data) {
    const template = await CertificateTemplate.findById(id);
    if (!template) {
      const err = new Error('Certificate template not found');
      err.statusCode = 404;
      throw err;
    }

    Object.assign(template, data);
    template.version = (template.version || 1) + 1;
    await template.save();
    return template;
  }
}

module.exports = new CertificateService();
