const interviewService = require('../services/interview.service');
const interviewReportService = require('../services/interviewReport.service');
const aiWorkerClient = require('../services/aiWorkerClient.service');
const proctoringService = require('../services/proctoring.service');
const { Interview, InterviewSession, BehavioralReport } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { interviewSignaling } = require('../realtime/interviewSignaling');

class InterviewController {
  async createInterview(req, res, next) {
    try {
      const interview = await interviewService.createInterview(req.user, req.body);
      return successResponse(res, 'Interview created successfully', interview, 201);
    } catch (err) {
      next(err);
    }
  }

  async listInterviews(req, res, next) {
    try {
      const interviews = await interviewService.listInterviews(req.user, req.query);
      return successResponse(res, 'Interviews retrieved successfully', interviews);
    } catch (err) {
      next(err);
    }
  }

  async getInterviewById(req, res, next) {
    try {
      const interview = await interviewService.getInterviewById(req.params.id, req.user);
      return successResponse(res, 'Interview retrieved successfully', interview);
    } catch (err) {
      next(err);
    }
  }

  async updateInterview(req, res, next) {
    try {
      const interview = await interviewService.updateInterview(req.params.id, req.user, req.body);
      return successResponse(res, 'Interview updated successfully', interview);
    } catch (err) {
      next(err);
    }
  }

  async transitionStatus(req, res, next) {
    try {
      const { status, reason, scheduledStartAt, scheduledEndAt } = req.body;
      const interview = await interviewService.transitionStatus(req.params.id, req.user, status, {
        reason,
        scheduledStartAt,
        scheduledEndAt,
      });
      return successResponse(res, `Interview transitioned to ${status}`, interview);
    } catch (err) {
      next(err);
    }
  }

  async rescheduleInterview(req, res, next) {
    try {
      const interview = await interviewService.rescheduleInterview(
        req.params.id,
        req.user,
        req.body
      );
      return successResponse(res, 'Interview rescheduled successfully', interview);
    } catch (err) {
      next(err);
    }
  }

  async startOrJoinSession(req, res, next) {
    try {
      const data = await interviewService.startOrJoinSession(req.params.id, req.user, req.body);
      return successResponse(res, 'Interview session active', data);
    } catch (err) {
      next(err);
    }
  }

  async updateCameraStatus(req, res, next) {
    try {
      const { status, eventType, detail } = req.body;
      if (!status) {
        return errorResponse(res, 'Camera status is required', 400);
      }
      const session = await interviewService.updateSessionCameraStatus(req.params.id, req.user, {
        status,
        eventType,
        detail,
      });
      return successResponse(res, 'Camera session status updated', session);
    } catch (err) {
      next(err);
    }
  }

  async saveStudentResponses(req, res, next) {
    try {
      const session = await interviewService.updateStudentResponses(req.params.id, req.user, req.body);
      return successResponse(res, 'Interview responses saved', session);
    } catch (err) {
      next(err);
    }
  }

  async completeOrLeaveSession(req, res, next) {
    try {
      const { action, reason } = req.body || {};
      const interview = await interviewService.completeOrLeaveSession(req.params.id, req.user, {
        action,
        reason,
      });
      return successResponse(res, 'Interview session updated', interview);
    } catch (err) {
      next(err);
    }
  }

  async controlStudentMedia(req, res, next) {
    try {
      const { command } = req.body;
      const result = await interviewService.controlStudentMedia(req.params.id, req.user, command);
      const deliveredToStudent = interviewSignaling.sendMediaControlToStudent(
        req.params.id,
        command,
        result.studentMediaControl
      );
      return successResponse(res, 'Student media control command applied', {
        ...result,
        deliveredToStudent,
      });
    } catch (err) {
      next(err);
    }
  }

  async evaluateInterview(req, res, next) {
    try {
      const report = await interviewReportService.evaluateInterview(
        req.params.id,
        req.user,
        req.body
      );
      return successResponse(res, 'Interview evaluation saved', report);
    } catch (err) {
      next(err);
    }
  }

  async addTranscriptSegment(req, res, next) {
    try {
      const segment = await interviewReportService.addTranscriptSegment(
        req.params.id,
        req.user,
        req.body
      );
      return successResponse(res, 'Transcript segment recorded', segment, 201);
    } catch (err) {
      next(err);
    }
  }

  async getTranscript(req, res, next) {
    try {
      const transcript = await interviewReportService.getTranscript(req.params.id, req.user);
      return successResponse(res, 'Interview transcript retrieved', transcript);
    } catch (err) {
      next(err);
    }
  }

  async getStudentPerformanceReport(req, res, next) {
    try {
      const report = await interviewReportService.getStudentPerformanceReport(
        req.params.id,
        req.user
      );
      return successResponse(res, 'Student interview performance report retrieved', report);
    } catch (err) {
      next(err);
    }
  }

  async getBehavioralReport(req, res, next) {
    try {
      const report = await interviewReportService.getBehavioralReport(req.params.id, req.user);
      return successResponse(res, 'Behavioral report retrieved', report);
    } catch (err) {
      next(err);
    }
  }

  async getFacultyReport(req, res, next) {
    try {
      const report = await interviewReportService.getFacultyReport(req.params.id, req.user);
      return successResponse(res, 'Faculty interview report retrieved', report);
    } catch (err) {
      next(err);
    }
  }

  async finalizeBehavioralReport(req, res, next) {
    try {
      const report = await interviewReportService.finalizeBehavioralReport(
        req.params.id,
        req.user,
        req.body || {}
      );
      return successResponse(res, 'Behavioral report updated', report);
    } catch (err) {
      next(err);
    }
  }

  async processAiTranscript(req, res, next) {
    try {
      const interview = await Interview.findById(req.params.id);
      if (!interview) {
        return errorResponse(res, 'Interview not found', 404);
      }
      if (
        req.user.role !== 'admin' &&
        interview.facultyId.toString() !== (req.user._id || req.user.id).toString()
      ) {
        return errorResponse(res, 'Access denied. You do not own this interview.', 403);
      }

      const result = await aiWorkerClient.processTranscriptPipeline({
        interview,
        utterances: req.body?.utterances || [],
        generateSummary: req.body?.generateSummary !== false,
      });

      const createdSegments = [];
      for (const seg of result.segments) {
        const saved = await interviewReportService.addTranscriptSegment(interview._id, req.user, {
          speakerRole: seg.speakerRole,
          text: seg.text,
          status: seg.status,
          confidence: seg.confidence,
          source: 'ai_transcription',
        });
        createdSegments.push(saved);
      }

      if (result.summary) {
        const report = await BehavioralReport.findOne({ interviewId: interview._id });
        if (report) {
          report.aiSummaryDraft = {
            summaryText: result.summary,
            provider: result.provider,
            generatedAt: new Date(),
            disclaimer:
              'AI-generated draft summary requires faculty review and does not affect official scores.',
          };
          await report.save();
        }
      }

      return successResponse(res, 'AI transcript pipeline completed', {
        provider: result.provider,
        summary: result.summary,
        segments: createdSegments,
      });
    } catch (err) {
      next(err);
    }
  }

  async processAiProctoring(req, res, next) {
    try {
      const interview = await Interview.findById(req.params.id);
      if (!interview) {
        return errorResponse(res, 'Interview not found', 404);
      }
      if (
        req.user.role !== 'admin' &&
        interview.facultyId.toString() !== (req.user._id || req.user.id).toString()
      ) {
        return errorResponse(res, 'Access denied. You do not own this interview.', 403);
      }

      if (!interview.proctoringConfig?.aiProctoringEnabled) {
        return errorResponse(
          res,
          'AI Proctoring is not enabled on this interview configuration.',
          400
        );
      }

      const session = await InterviewSession.findOne({ interviewId: interview._id }).sort({
        createdAt: -1,
      });
      if (!session || !session.proctoringSessionId) {
        return errorResponse(res, 'No proctoring session exists for this interview yet.', 400);
      }

      const result = await aiWorkerClient.processProctoringEventsPipeline({
        interview,
        telemetrySignals: req.body?.telemetrySignals || [],
      });

      const recordedEvents = [];
      for (const evt of result.events) {
        const created = await proctoringService.recordEvent(
          session.proctoringSessionId,
          req.user._id || req.user.id,
          {
            eventType: evt.eventType,
            severity: evt.severity,
            source: 'ai_proctoring',
            metadata: {
              confidence: evt.confidence,
              durationSeconds: evt.durationSeconds,
              faceCount: evt.faceCount,
              note: evt.note,
              detector: result.provider,
            },
          }
        );
        recordedEvents.push(created);
      }

      const behavioralReport = await interviewReportService.getBehavioralReport(
        interview._id,
        req.user
      );
      const reportDoc = await BehavioralReport.findById(behavioralReport.id);
      if (reportDoc && result.behavioralSummaryDraft) {
        reportDoc.aiSummaryDraft = {
          summaryText: result.behavioralSummaryDraft,
          provider: result.provider,
          generatedAt: new Date(),
          disclaimer:
            'AI-detected behavioral flags are review indicators only and never automatically fail students.',
        };
        reportDoc.auditTrail.push({
          action: 'AI_PROCTORING_PIPELINE_PROCESSED',
          actorId: req.user._id || req.user.id,
          actorRole: req.user.role,
          details: { provider: result.provider, eventCount: recordedEvents.length },
          timestamp: new Date(),
        });
        await reportDoc.save();
      }

      return successResponse(res, 'AI proctoring event pipeline completed', {
        provider: result.provider,
        recordedEvents,
        behavioralSummaryDraft: result.behavioralSummaryDraft,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InterviewController();
