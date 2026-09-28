const { User, Assessment, Submission, AuditLog, Notification, SystemSetting } = require('../models');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/response');
const emailService = require('../services/email.service');

class AdminController {
  async getDashboardStats(req, res, next) {
    try {
      const [
        totalUsers,
        totalStudents,
        totalInstructors,
        totalAdmins,
        pendingUsersCount,
        activeUsersCount,
        rejectedUsersCount,
        revokedUsersCount,
        totalAssessments,
        publishedAssessments,
        draftAssessments,
        archivedAssessments,
        totalSubmissions,
        passedSubmissions,
        pendingSubmissions,
        submissionsWithScores,
        suspiciousEventsCount,
        recentLogs,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'instructor' }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ status: 'pending' }),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ status: 'rejected' }),
        User.countDocuments({ status: 'revoked' }),
        Assessment.countDocuments(),
        Assessment.countDocuments({ status: 'published' }),
        Assessment.countDocuments({ status: 'draft' }),
        Assessment.countDocuments({ status: 'archived' }),
        Submission.countDocuments(),
        Submission.countDocuments({ passed: true }),
        Submission.countDocuments({ evaluationStatus: 'pending' }),
        Submission.find({ status: { $in: ['submitted', 'evaluated'] } }).select('finalScore score percentage'),
        AuditLog.countDocuments({
          action: { $in: ['LOGIN_FAILED', 'REVOKED_USER_LOGIN_ATTEMPT', 'UNAUTHORIZED_ACCESS'] },
        }),
        AuditLog.find()
          .populate('userId', 'name email role')
          .sort({ createdAt: -1 })
          .limit(10),
      ]);

      const passRate =
        totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0;

      let averageScore = 0;
      if (submissionsWithScores.length > 0) {
        const sumPercentages = submissionsWithScores.reduce(
          (acc, sub) => acc + (sub.percentage || 0),
          0
        );
        averageScore = Math.round(sumPercentages / submissionsWithScores.length);
      }

      return successResponse(res, 'Admin stats retrieved', {
        totalUsers,
        totalStudents,
        totalInstructors,
        totalAdmins,
        pendingUsersCount,
        activeUsersCount,
        rejectedUsersCount,
        revokedUsersCount,
        totalAssessments,
        publishedAssessments,
        draftAssessments,
        archivedAssessments,
        totalSubmissions,
        passedSubmissions,
        pendingSubmissions,
        passRate,
        averageScore,
        suspiciousEventsCount,
        recentLogs,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const { role, status, search, page = 1, limit = 10 } = req.query;
      const query = {};
      if (role) query.role = role;
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { instituteCode: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const total = await User.countDocuments(query);
      const users = await User.find(query)
        .select('name email role status isActive instituteCode lastLoginAt createdAt approvedAt revokedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10));

      return paginatedResponse(res, 'Users retrieved', users, page, limit, total);
    } catch (err) {
      next(err);
    }
  }

  async getPendingUsers(req, res, next) {
    try {
      const pendingUsers = await User.find({ status: 'pending' })
        .select('name email role status instituteCode createdAt bio')
        .sort({ createdAt: -1 });

      return successResponse(res, 'Pending users retrieved', pendingUsers);
    } catch (err) {
      next(err);
    }
  }

  async getUserDetails(req, res, next) {
    try {
      const user = await User.findById(req.params.id)
        .populate('approvedBy', 'name email')
        .populate('revokedBy', 'name email');

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      return successResponse(res, 'User details retrieved', user);
    } catch (err) {
      next(err);
    }
  }

  async approveUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const { role } = req.body;
      if (role && ['student', 'instructor'].includes(role)) {
        user.role = role;
      }

      user.status = 'active';
      user.isActive = true;
      user.approvedAt = new Date();
      user.approvedBy = req.user._id;
      user.rejectionReason = null;
      user.revokedAt = null;
      user.revokedBy = null;
      await user.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'USER_APPROVED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { targetEmail: user.email, assignedRole: user.role },
        ipAddress: req.ip,
      });

      // Send approval email & in-app notification
      try {
        await emailService.sendAccountApprovedEmail(user);
        await Notification.create({
          userId: user._id,
          title: 'Account Approved',
          message: `Your account application has been approved with role "${user.role}". You may now sign in.`,
          type: 'system',
          link: '/auth/login',
        });
      } catch (err) {
        console.warn('[AdminController] Non-fatal notification error on approve:', err.message);
      }

      return successResponse(res, `Account approved successfully for ${user.name}`, user);
    } catch (err) {
      next(err);
    }
  }

  async rejectUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (user._id.toString() === req.user._id.toString()) {
        return errorResponse(res, 'You cannot reject your own administrator account', 400);
      }

      const reason = req.body.reason || 'Registration rejected by administrator';
      user.status = 'rejected';
      user.isActive = false;
      user.rejectionReason = reason;
      await user.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'USER_REJECTED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { targetEmail: user.email, reason },
        ipAddress: req.ip,
      });

      // Send rejection email & in-app notification
      try {
        await emailService.sendAccountRejectedEmail(user, reason);
        await Notification.create({
          userId: user._id,
          title: 'Account Application Rejected',
          message: `Your account registration was not approved: ${reason}`,
          type: 'system',
        });
      } catch (err) {
        console.warn('[AdminController] Non-fatal notification error on reject:', err.message);
      }

      return successResponse(res, `Account registration rejected for ${user.name}`, user);
    } catch (err) {
      next(err);
    }
  }

  async revokeUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (user._id.toString() === req.user._id.toString()) {
        return errorResponse(res, 'You cannot revoke your own administrator account', 400);
      }

      const reason = req.body.reason || 'Account access revoked by administrator';
      user.status = 'revoked';
      user.isActive = false;
      user.revokedAt = new Date();
      user.revokedBy = req.user._id;
      user.rejectionReason = reason;
      await user.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'USER_REVOKED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { targetEmail: user.email, reason },
        ipAddress: req.ip,
      });

      // Send revocation email & in-app notification
      try {
        await emailService.sendAccountRevokedEmail(user, reason);
        await Notification.create({
          userId: user._id,
          title: 'Account Access Revoked',
          message: `Your account access has been revoked: ${reason}`,
          type: 'system',
        });
      } catch (err) {
        console.warn('[AdminController] Non-fatal notification error on revoke:', err.message);
      }

      return successResponse(res, `Account access revoked for ${user.name}`, user);
    } catch (err) {
      next(err);
    }
  }

  async getAllAssessments(req, res, next) {
    try {
      const { status, category, search, page = 1, limit = 10 } = req.query;
      const query = {};
      if (status) query.status = status;
      if (category) query.category = category;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const total = await Assessment.countDocuments(query);
      const assessments = await Assessment.find(query)
        .populate('instructorId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10));

      return paginatedResponse(res, 'Platform assessments retrieved', assessments, page, limit, total);
    } catch (err) {
      next(err);
    }
  }

  async toggleUserStatus(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (user._id.toString() === req.user._id.toString()) {
        return errorResponse(res, 'You cannot deactivate your own account', 400);
      }

      user.isActive = !user.isActive;
      user.status = user.isActive ? 'active' : 'revoked';
      if (!user.isActive) {
        user.revokedAt = new Date();
        user.revokedBy = req.user._id;
      }
      await user.save();

      await AuditLog.create({
        userId: req.user._id,
        action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { targetEmail: user.email, status: user.status },
        ipAddress: req.ip,
      });

      return successResponse(
        res,
        `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        {
          id: user._id.toString(),
          isActive: user.isActive,
          status: user.status,
        }
      );
    } catch (err) {
      next(err);
    }
  }

  async getLogs(req, res, next) {
    try {
      const { page = 1, limit = 20, action } = req.query;
      const query = {};
      if (action) query.action = action;

      const skip = (page - 1) * limit;
      const total = await AuditLog.countDocuments(query);
      const logs = await AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10));

      return paginatedResponse(res, 'Audit logs retrieved', logs, page, limit, total);
    } catch (err) {
      next(err);
    }
  }

  async getSettings(req, res, next) {
    try {
      let settings = await SystemSetting.findOne();
      if (!settings) {
        settings = await SystemSetting.create({
          platformName: 'Unified Assessment Platform',
          registrationOpen: true,
          maintenanceMode: false,
          announcementBanner: '',
          defaultPassingScore: 60,
          enableEmailNotifications: true,
          maxAttemptDurationHours: 4,
          supportEmail: 'support@uap.edu',
          allowStudentReview: true,
        });
      }
      return successResponse(res, 'System settings retrieved', settings);
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const {
        platformName,
        registrationOpen,
        maintenanceMode,
        announcementBanner,
        defaultPassingScore,
        enableEmailNotifications,
        maxAttemptDurationHours,
        supportEmail,
        allowStudentReview,
      } = req.body;

      let settings = await SystemSetting.findOne();
      if (!settings) {
        settings = new SystemSetting();
      }

      if (platformName !== undefined) settings.platformName = platformName;
      if (registrationOpen !== undefined) settings.registrationOpen = Boolean(registrationOpen);
      if (maintenanceMode !== undefined) settings.maintenanceMode = Boolean(maintenanceMode);
      if (announcementBanner !== undefined) settings.announcementBanner = announcementBanner;
      if (defaultPassingScore !== undefined) settings.defaultPassingScore = Number(defaultPassingScore);
      if (enableEmailNotifications !== undefined) settings.enableEmailNotifications = Boolean(enableEmailNotifications);
      if (maxAttemptDurationHours !== undefined) settings.maxAttemptDurationHours = Number(maxAttemptDurationHours);
      if (supportEmail !== undefined) settings.supportEmail = supportEmail;
      if (allowStudentReview !== undefined) settings.allowStudentReview = Boolean(allowStudentReview);
      settings.updatedBy = req.user._id;

      await settings.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'SETTINGS_UPDATED',
        entityType: 'SystemSetting',
        entityId: settings._id.toString(),
        details: req.body,
        ipAddress: req.ip,
      });

      return successResponse(res, 'System settings updated successfully', settings);
    } catch (err) {
      next(err);
    }
  }

  async getOperationalAlerts(req, res, next) {
    try {
      const suspiciousActions = [
        'LOGIN_FAILED',
        'REVOKED_USER_LOGIN_ATTEMPT',
        'UNAUTHORIZED_ACCESS',
        'USER_REVOKED',
        'USER_REJECTED',
      ];

      const [alerts, failedLoginsCount, revokedAttemptsCount, pendingUsersCount] = await Promise.all([
        AuditLog.find({ action: { $in: suspiciousActions } })
          .populate('userId', 'name email role')
          .sort({ createdAt: -1 })
          .limit(25),
        AuditLog.countDocuments({ action: 'LOGIN_FAILED' }),
        AuditLog.countDocuments({ action: 'REVOKED_USER_LOGIN_ATTEMPT' }),
        User.countDocuments({ status: 'pending' }),
      ]);

      return successResponse(res, 'Operational alerts retrieved', {
        alerts,
        summary: {
          totalAlerts: alerts.length,
          failedLoginsCount,
          revokedAttemptsCount,
          pendingUsersCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateAssessmentStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['draft', 'published', 'archived'].includes(status)) {
        return errorResponse(res, 'Invalid assessment status. Must be draft, published, or archived', 400);
      }

      const assessment = await Assessment.findById(id);
      if (!assessment) {
        return errorResponse(res, 'Assessment not found', 404);
      }

      const oldStatus = assessment.status;
      assessment.status = status;
      await assessment.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'ASSESSMENT_STATUS_UPDATED',
        entityType: 'Assessment',
        entityId: assessment._id.toString(),
        details: { title: assessment.title, oldStatus, newStatus: status },
        ipAddress: req.ip,
      });

      return successResponse(res, `Assessment status updated to "${status}"`, assessment);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
