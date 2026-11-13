// Import Mongoose ODM library for ObjectId validation
const mongoose = require('mongoose');
// Import platform models
const {
  ReassignmentRequest,
  Assessment,
  Submission,
  AuditLog,
  Notification,
  User,
} = require('../models');

/**
 * Service managing student reassignment request lifecycle:
 * submission, eligibility verification, duplicate prevention, and instructor/admin review.
 */
class ReassignmentRequestService {
  /**
   * Submit a new reassignment request for an assessment.
   * Enforces that the assessment is missed or failed, not upcoming/in-progress/passed,
   * and prevents duplicate pending requests.
   */
  async requestReassignment(studentId, assessmentId, reason, ipAddress = null) {
    // 1. Validate assessmentId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const error = new Error('Invalid assessment ID');
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate reason: trimmed length and non-whitespace characters
    const trimmedReason = (reason || '').trim();
    const nonWhitespace = trimmedReason.replace(/\s+/g, '');
    if (nonWhitespace.length < 10) {
      const error = new Error('Reason must contain at least 10 non-whitespace characters');
      error.statusCode = 400;
      throw error;
    }
    if (trimmedReason.length > 500) {
      const error = new Error('Reason cannot exceed 500 characters');
      error.statusCode = 400;
      throw error;
    }

    // 3. Find target assessment
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    // Must be published to be eligible for reassignment
    if (assessment.status !== 'published') {
      const error = new Error('This assessment is not open for reassignment requests');
      error.statusCode = 400;
      throw error;
    }

    // If restricted access, student must be in assignedStudents roster
    if (assessment.accessType === 'restricted') {
      const isAssigned =
        assessment.assignedStudents &&
        assessment.assignedStudents.some(
          (id) => id.toString() === studentId.toString()
        );
      if (!isAssigned) {
        const error = new Error('You are not authorized or assigned to this assessment');
        error.statusCode = 403;
        throw error;
      }
    }

    // Upcoming assessments (scheduled in future) cannot be requested for reassignment
    if (assessment.scheduledAt && new Date(assessment.scheduledAt) > new Date()) {
      const error = new Error('This assessment is scheduled for a future date and has not yet started');
      error.statusCode = 400;
      throw error;
    }

    // 4. Verify student eligibility (missed or failed)
    const existingSubmission = await Submission.findOne({
      studentId,
      assessmentId,
    });

    let isEligible = false;
    let eligibilityReason = '';

    if (!existingSubmission) {
      // No attempt exists: check if deadline has passed (Missed)
      if (assessment.deadlineAt && new Date(assessment.deadlineAt) <= new Date()) {
        isEligible = true;
        eligibilityReason = 'missed';
      } else {
        // Deadline has not passed: assessment is still open for normal attempt
        const error = new Error(
          'This assessment is currently open. You may take it directly without requesting reassignment.'
        );
        error.statusCode = 400;
        throw error;
      }
    } else {
      // Submission exists: inspect attempt status
      if (existingSubmission.status === 'in_progress') {
        const now = Date.now();
        const deadlineTime = existingSubmission.deadlineAt
          ? new Date(existingSubmission.deadlineAt).getTime()
          : null;

        if (deadlineTime && now > deadlineTime) {
          // Auto-close expired attempt
          existingSubmission.status = 'submitted';
          existingSubmission.submittedReason = 'TIME_EXPIRED';
          existingSubmission.submittedAt = new Date(deadlineTime);
          await existingSubmission.save();

          const error = new Error(
            'Your previous attempt expired and is pending evaluation.'
          );
          error.statusCode = 400;
          throw error;
        } else {
          const error = new Error('You have an active attempt currently in progress.');
          error.statusCode = 400;
          throw error;
        }
      } else if (existingSubmission.status === 'submitted') {
        const error = new Error(
          'Your assessment submission is currently pending evaluation.'
        );
        error.statusCode = 400;
        throw error;
      } else if (existingSubmission.status === 'evaluated') {
        if (existingSubmission.passed) {
          const error = new Error(
            'You have already successfully passed this assessment.'
          );
          error.statusCode = 400;
          throw error;
        } else {
          // Student attempted and failed
          isEligible = true;
          eligibilityReason = 'failed';
        }
      }
    }

    if (!isEligible) {
      const error = new Error(
        'You are not eligible to request reassignment for this assessment.'
      );
      error.statusCode = 400;
      throw error;
    }

    // 5. Prevent duplicate pending requests for the same student and assessment
    const existingPending = await ReassignmentRequest.findOne({
      studentId,
      assessmentId,
      status: 'pending',
    });

    if (existingPending) {
      const error = new Error(
        'A reassignment request is already pending for this assessment.'
      );
      error.statusCode = 409;
      throw error;
    }

    // 6. Create and persist reassignment request document
    const newRequest = await ReassignmentRequest.create({
      studentId,
      assessmentId,
      reason: trimmedReason,
      status: 'pending',
    });

    // 7. Write audit log entry
    try {
      await AuditLog.create({
        userId: studentId,
        action: 'REASSIGNMENT_REQUEST_SUBMITTED',
        entityType: 'ReassignmentRequest',
        entityId: newRequest._id.toString(),
        details: {
          assessmentId: assessment._id.toString(),
          assessmentTitle: assessment.title,
          eligibilityReason,
          reasonLength: trimmedReason.length,
        },
        ipAddress,
      });
    } catch (auditErr) {
      console.warn('[ReassignmentRequestService] Non-fatal AuditLog error:', auditErr.message);
    }

    // 8. Send notification to assessment author instructor
    if (assessment.instructorId) {
      try {
        await Notification.create({
          userId: assessment.instructorId,
          title: 'New Reassignment Request',
          message: `A student submitted a reassignment request for "${assessment.title}".`,
          type: 'assessment',
          link: `/instructor/assessments`,
        });
      } catch (notifErr) {
        console.warn('[ReassignmentRequestService] Non-fatal Notification error:', notifErr.message);
      }
    }

    return newRequest;
  }

  /**
   * Retrieve all reassignment requests submitted by the authenticated student.
   */
  async getStudentRequests(studentId) {
    const requests = await ReassignmentRequest.find({ studentId })
      .populate('assessmentId', 'title category deadlineAt scheduledAt durationMinutes totalPoints passingScore accessType')
      .sort({ createdAt: -1 });

    return requests.map((req) => {
      const json = req.toJSON();
      if (json.assessmentId) {
        json.assessment = json.assessmentId;
        delete json.assessmentId;
      }
      return json;
    });
  }

  /**
   * Retrieve the current or latest reassignment request for a specific assessment.
   */
  async getRequestForAssessment(studentId, assessmentId) {
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const error = new Error('Invalid assessment ID');
      error.statusCode = 400;
      throw error;
    }

    const request = await ReassignmentRequest.findOne({
      studentId,
      assessmentId,
    })
      .sort({ createdAt: -1 })
      .populate('assessmentId', 'title category deadlineAt scheduledAt durationMinutes totalPoints passingScore');

    if (!request) return null;

    const json = request.toJSON();
    if (json.assessmentId) {
      json.assessment = json.assessmentId;
      delete json.assessmentId;
    }
    return json;
  }

  /**
   * Retrieve all reassignment requests for a specific assessment (instructor/admin view).
   */
  async getAssessmentRequests(assessmentId, reviewerUser) {
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const error = new Error('Invalid assessment ID');
      error.statusCode = 400;
      throw error;
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    // If not admin, caller must be owner instructor
    if (
      reviewerUser.role !== 'admin' &&
      assessment.instructorId.toString() !== reviewerUser.id.toString()
    ) {
      const error = new Error('Access denied. You do not own this assessment.');
      error.statusCode = 403;
      throw error;
    }

    const requests = await ReassignmentRequest.find({ assessmentId })
      .populate('studentId', 'name email studentId department')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 });

    return requests;
  }

  /**
   * Review (approve or reject) a reassignment request.
   */
  async reviewRequest(requestId, reviewerUser, { status, reviewNotes }, ipAddress = null) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      const error = new Error('Invalid request ID');
      error.statusCode = 400;
      throw error;
    }

    if (!['approved', 'rejected'].includes(status)) {
      const error = new Error('Status must be either approved or rejected');
      error.statusCode = 400;
      throw error;
    }

    const request = await ReassignmentRequest.findById(requestId).populate('assessmentId');
    if (!request) {
      const error = new Error('Reassignment request not found');
      error.statusCode = 404;
      throw error;
    }

    if (request.status !== 'pending') {
      const error = new Error(`Request has already been reviewed (current status: ${request.status})`);
      error.statusCode = 400;
      throw error;
    }

    const assessment = request.assessmentId;
    // Check reviewer authorization: admin or owner instructor
    if (
      reviewerUser.role !== 'admin' &&
      assessment &&
      assessment.instructorId &&
      assessment.instructorId.toString() !== reviewerUser.id.toString()
    ) {
      const error = new Error('Access denied. You are not authorized to review this request.');
      error.statusCode = 403;
      throw error;
    }

    request.status = status;
    request.reviewedBy = reviewerUser.id;
    request.reviewedAt = new Date();
    request.reviewNotes = (reviewNotes || '').trim();
    await request.save();

    // Log decision in AuditLog
    try {
      await AuditLog.create({
        userId: reviewerUser.id,
        action: status === 'approved' ? 'REASSIGNMENT_REQUEST_APPROVED' : 'REASSIGNMENT_REQUEST_REJECTED',
        entityType: 'ReassignmentRequest',
        entityId: request._id.toString(),
        details: {
          studentId: request.studentId.toString(),
          assessmentId: assessment?._id?.toString() || request.assessmentId.toString(),
          assessmentTitle: assessment?.title,
          reviewNotes: request.reviewNotes,
        },
        ipAddress,
      });
    } catch (auditErr) {
      console.warn('[ReassignmentRequestService] Non-fatal AuditLog error:', auditErr.message);
    }

    // Send notification to the student
    try {
      await Notification.create({
        userId: request.studentId,
        title: `Reassignment Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your reassignment request for "${assessment?.title || 'Assessment'}" has been ${status}.${request.reviewNotes ? ` Note: ${request.reviewNotes}` : ''}`,
        type: 'assessment',
        link: '/student/catalog',
      });
    } catch (notifErr) {
      console.warn('[ReassignmentRequestService] Non-fatal Notification error:', notifErr.message);
    }

    return request;
  }
}

// Export singleton instance
module.exports = new ReassignmentRequestService();
