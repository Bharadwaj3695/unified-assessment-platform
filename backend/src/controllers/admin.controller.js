// Destructure Mongoose models required for admin dashboard statistics, user management, audit logging, and registry operations
const { User, Assessment, Submission, AuditLog, Notification, SystemSetting, StudentRegistry, Session } = require('../models');
// Destructure standardized JSON response formatting utility methods for success, pagination, and error responses
const { successResponse, paginatedResponse, errorResponse } = require('../utils/response');
// Import email service for dispatching administrative notification emails (approval, rejection, revocation)
const emailService = require('../services/email.service');

// Define AdminController class handling system administration, user approval lifecycles, platform settings, and audit logs
class AdminController {
  // Controller action to aggregate system-wide metrics and dashboard statistics
  async getDashboardStats(req, res, next) {
    // Begin try block for computing dashboard statistics
    try {
      // Destructure results from concurrent database aggregation queries
      const [
        // Total registered users across all roles and states
        totalUsers,
        // Total registered student accounts
        totalStudents,
        // Total registered instructor accounts
        totalInstructors,
        // Total registered platform administrator accounts
        totalAdmins,
        // Total accounts currently pending administrative review
        pendingUsersCount,
        // Total active and approved accounts
        activeUsersCount,
        // Total rejected account applications
        rejectedUsersCount,
        // Total revoked user accounts
        revokedUsersCount,
        // Total assessments created across platform
        totalAssessments,
        // Total assessments currently published and accessible
        publishedAssessments,
        // Total draft assessments not yet published
        draftAssessments,
        // Total archived assessments
        archivedAssessments,
        // Total submissions received across all assessments
        totalSubmissions,
        // Total submissions that achieved a passing score
        passedSubmissions,
        // Total submissions awaiting manual or automated evaluation
        pendingSubmissions,
        // Submissions containing score metrics for computing score averages
        submissionsWithScores,
        // Total suspicious security events recorded in audit logs
        suspiciousEventsCount,
        // Ten most recent audit log entries
        recentLogs,
      // Execute all database queries concurrently using Promise.all
      ] = await Promise.all([
        // Count total user documents in the system
        User.countDocuments(),
        // Count users having the role of student
        User.countDocuments({ role: 'student' }),
        // Count users having the role of instructor
        User.countDocuments({ role: 'instructor' }),
        // Count users having the role of admin
        User.countDocuments({ role: 'admin' }),
        // Count users whose account status is pending
        User.countDocuments({ status: 'pending' }),
        // Count users whose account status is active
        User.countDocuments({ status: 'active' }),
        // Count users whose account status is rejected
        User.countDocuments({ status: 'rejected' }),
        // Count users whose account status is revoked
        User.countDocuments({ status: 'revoked' }),
        // Count total assessment documents
        Assessment.countDocuments(),
        // Count assessments with status published
        Assessment.countDocuments({ status: 'published' }),
        // Count assessments with status draft
        Assessment.countDocuments({ status: 'draft' }),
        // Count assessments with status archived
        Assessment.countDocuments({ status: 'archived' }),
        // Count total assessment submissions
        Submission.countDocuments(),
        // Count submissions where passed flag is true
        Submission.countDocuments({ passed: true }),
        // Count submissions where evaluationStatus is pending
        Submission.countDocuments({ evaluationStatus: 'pending' }),
        // Query completed submissions with their final score, raw score, and percentage fields
        Submission.find({ status: { $in: ['submitted', 'evaluated'] } }).select('finalScore score percentage'),
        // Count audit logs indicating suspicious or unauthorized actions
        AuditLog.countDocuments({
          // Filter by suspicious security action identifiers
          action: { $in: ['LOGIN_FAILED', 'REVOKED_USER_LOGIN_ATTEMPT', 'UNAUTHORIZED_ACCESS'] },
        // Terminate suspicious action filter object
        }),
        // Fetch the 10 latest audit log entries populated with user details
        AuditLog.find()
          // Populate the associated user ID with name, email, and role
          .populate('userId', 'name email role')
          // Sort newest logs first
          .sort({ createdAt: -1 })
          // Limit results to 10 entries
          .limit(10),
      // Terminate Promise.all array argument
      ]);

      // Calculate overall pass percentage rounded to nearest integer if total submissions exist
      const passRate =
        // Check if there are any submissions to avoid division by zero
        totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0;

      // Initialize average score accumulator to zero
      let averageScore = 0;
      // Calculate average score if there are evaluated submissions with scores
      if (submissionsWithScores.length > 0) {
        // Sum the percentage values of all evaluated submissions
        const sumPercentages = submissionsWithScores.reduce(
          // Reducer accumulator summing each submission's percentage or 0
          (acc, sub) => acc + (sub.percentage || 0),
          // Initial accumulator value
          0
        // Terminate reduce call
        );
        // Calculate rounded average score percentage
        averageScore = Math.round(sumPercentages / submissionsWithScores.length);
      // Terminate if condition for score computation
      }

      // Return HTTP 200 response with aggregated platform statistics object
      return successResponse(res, 'Admin stats retrieved', {
        // Total user count
        totalUsers,
        // Student count
        totalStudents,
        // Instructor count
        totalInstructors,
        // Administrator count
        totalAdmins,
        // Pending users count
        pendingUsersCount,
        // Active users count
        activeUsersCount,
        // Rejected users count
        rejectedUsersCount,
        // Revoked users count
        revokedUsersCount,
        // Total assessments count
        totalAssessments,
        // Published assessments count
        publishedAssessments,
        // Draft assessments count
        draftAssessments,
        // Archived assessments count
        archivedAssessments,
        // Total submissions count
        totalSubmissions,
        // Passed submissions count
        passedSubmissions,
        // Pending submissions count
        pendingSubmissions,
        // Computed pass rate percentage
        passRate,
        // Computed average score percentage
        averageScore,
        // Suspicious security events count
        suspiciousEventsCount,
        // Array of recent audit logs
        recentLogs,
      // Terminate stats payload object
      });
    // Catch block for statistics query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getDashboardStats method definition
  }

  // Controller action to retrieve paginated list of all users with role, status, and search filters
  async getAllUsers(req, res, next) {
    // Begin try block for fetching users
    try {
      // Destructure query parameters for filtering, search, and pagination with defaults
      const { role, status, search, page = 1, limit = 10 } = req.query;
      // Initialize empty MongoDB query filter object
      const query = {};
      // Filter by role if specified in query
      if (role) query.role = role;
      // Filter by status if specified in query
      if (status) query.status = status;
      // Build case-insensitive regex search across name, email, and instituteCode if search query exists
      if (search) {
        // Assign $or array to match search pattern against user fields
        query.$or = [
          // Case-insensitive regex match on user name
          { name: { $regex: search, $options: 'i' } },
          // Case-insensitive regex match on user email
          { email: { $regex: search, $options: 'i' } },
          // Case-insensitive regex match on institute code
          { instituteCode: { $regex: search, $options: 'i' } },
        // Terminate $or array
        ];
      // Terminate search condition check
      }

      // Compute number of documents to skip for pagination
      const skip = (page - 1) * limit;
      // Count total matching user documents
      const total = await User.countDocuments(query);
      // Query paginated users matching criteria
      const users = await User.find(query)
        // Select specific user fields for administration list
        .select('name email role status isActive instituteCode lastLoginAt createdAt approvedAt revokedAt')
        // Sort newest users first
        .sort({ createdAt: -1 })
        // Skip documents for current page
        .skip(skip)
        // Limit query to page size
        .limit(parseInt(limit, 10));

      // Return HTTP 200 paginated response with user list and pagination metadata
      return paginatedResponse(res, 'Users retrieved', users, page, limit, total);
    // Catch block for user query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getAllUsers method definition
  }

  // Controller action to retrieve all users awaiting account approval with optional search and role filtering
  async getPendingUsers(req, res, next) {
    // Begin try block for fetching pending users
    try {
      const { role, search } = req.query;
      const query = { status: 'pending' };

      // Optional role filtering (student or instructor)
      if (role && role !== 'all') {
        query.role = role;
      }

      // Optional search across name, email, student ID, faculty ID, and institute code
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        query.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { studentId: searchRegex },
          { facultyId: searchRegex },
          { instituteCode: searchRegex },
        ];
      }

      // Find all users with pending status sorted newest first
      const pendingUsers = await User.find(query)
        // Select profile fields relevant for review including academic identity fields
        .select('name email role status instituteCode createdAt bio studentId dateOfBirth facultyId department')
        // Sort newest applications first
        .sort({ createdAt: -1 });

      // Return HTTP 200 response with pending users array
      return successResponse(res, 'Pending users retrieved', pendingUsers);
    // Catch block for pending users query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getPendingUsers method definition
  }

  // Controller action to bulk approve multiple pending user registrations
  async bulkApproveUsers(req, res, next) {
    // Begin try block for bulk approving users
    try {
      // Enforce administrator role authorization
      if (!req.user || req.user.role !== 'admin') {
        return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
      }

      const { userIds } = req.body;

      // Validate presence of userIds array
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return errorResponse(res, 'Please provide an array of user IDs to approve', 400);
      }

      // Track approved and skipped user records
      const approved = [];
      const skipped = [];

      for (const id of userIds) {
        // Validate user ID format
        if (!id || (typeof id !== 'string' && typeof id !== 'object')) {
          skipped.push({ id: String(id), reason: 'Invalid user ID format' });
          continue;
        }

        let user;
        try {
          user = await User.findById(id);
        } catch (idErr) {
          skipped.push({ id: String(id), reason: 'Invalid user identifier' });
          continue;
        }

        if (!user) {
          skipped.push({ id: String(id), reason: 'User not found' });
          continue;
        }

        const userIdStr = user._id.toString();

        // Disallow bulk approval of admin accounts or self-approval
        if (userIdStr === req.user._id.toString() || user.role === 'admin') {
          skipped.push({
            id: userIdStr,
            email: user.email,
            reason: 'Cannot approve administrator accounts via queue',
          });
          continue;
        }

        // Verify user is in pending status
        if (user.status !== 'pending') {
          skipped.push({
            id: userIdStr,
            email: user.email,
            status: user.status,
            reason: `User is not in pending status (currently "${user.status}")`,
          });
          continue;
        }

        // Enforce valid student or instructor role
        if (!['student', 'instructor'].includes(user.role)) {
          skipped.push({
            id: userIdStr,
            email: user.email,
            role: user.role,
            reason: `Invalid role for pending registration: "${user.role}"`,
          });
          continue;
        }

        // Transition account status from pending to active
        user.status = 'active';
        user.isActive = true;
        user.approvedAt = new Date();
        user.approvedBy = req.user._id;
        user.rejectionReason = null;
        user.revokedAt = null;
        user.revokedBy = null;
        await user.save();

        // 1. Create audit log entry conforming to existing audit schema
        try {
          await AuditLog.create({
            userId: req.user._id,
            action: 'USER_APPROVED',
            entityType: 'User',
            entityId: userIdStr,
            details: {
              targetName: user.name,
              targetEmail: user.email,
              assignedRole: user.role,
              bulk: true,
            },
            ipAddress: req.ip,
          });
        } catch (auditErr) {
          console.warn('[AdminController] Audit log creation failed for bulk approve:', auditErr.message);
        }

        // 2. Create in-app notification
        try {
          await Notification.create({
            userId: user._id,
            title: 'Account Approved',
            message: `Your account application has been approved with role "${user.role}". You may now sign in.`,
            type: 'system',
            link: '/auth/login',
          });
        } catch (notifErr) {
          console.warn('[AdminController] In-app notification creation error on bulk approve:', notifErr.message);
        }

        // 3. Dispatch transactional approval email (failure must not roll back approval)
        try {
          const emailResult = await emailService.sendAccountApprovedEmail(user);
          if (!emailResult || !emailResult.success) {
            console.warn(`[AdminController] Bulk approval email delivery unconfirmed for ${user.email}:`, emailResult?.error || 'Unknown error');
          }
        } catch (emailErr) {
          console.warn(`[AdminController] Bulk approval email dispatch failed for ${user.email}:`, emailErr.message);
        }

        approved.push({
          id: userIdStr,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }

      const approvedCount = approved.length;
      const skippedCount = skipped.length;
      const approvedUserIds = approved.map((u) => u.id);

      const summaryMessage =
        skippedCount > 0
          ? `Bulk approval completed: ${approvedCount} approved, ${skippedCount} skipped.`
          : `Successfully approved ${approvedCount} registration${approvedCount !== 1 ? 's' : ''}.`;

      return successResponse(res, summaryMessage, {
        approvedCount,
        skippedCount,
        approvedUserIds,
        approved,
        skipped,
      });
    } catch (err) {
      next(err);
    }
  }

  // Controller action to bulk reject multiple pending user registrations
  async bulkRejectUsers(req, res, next) {
    try {
      // Enforce administrator role authorization
      if (!req.user || req.user.role !== 'admin') {
        return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
      }

      const { userIds, reason: providedReason } = req.body;

      // Validate presence of userIds array
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return errorResponse(res, 'Please provide an array of user IDs to reject', 400);
      }

      const defaultReason = 'Registration rejected by administrator';
      const rejectionReason = (providedReason && typeof providedReason === 'string' && providedReason.trim())
        ? providedReason.trim()
        : defaultReason;

      const rejected = [];
      const skipped = [];

      for (const id of userIds) {
        if (!id || (typeof id !== 'string' && typeof id !== 'object')) {
          skipped.push({ id: String(id), reason: 'Invalid user ID format' });
          continue;
        }

        let user;
        try {
          user = await User.findById(id);
        } catch (idErr) {
          skipped.push({ id: String(id), reason: 'Invalid user identifier' });
          continue;
        }

        if (!user) {
          skipped.push({ id: String(id), reason: 'User not found' });
          continue;
        }

        const userIdStr = user._id.toString();

        // Disallow bulk rejection of admin accounts or self-rejection
        if (userIdStr === req.user._id.toString() || user.role === 'admin') {
          skipped.push({
            id: userIdStr,
            email: user.email,
            reason: 'Cannot reject administrator accounts via queue',
          });
          continue;
        }

        // Verify user is in pending status
        if (user.status !== 'pending') {
          skipped.push({
            id: userIdStr,
            email: user.email,
            status: user.status,
            reason: `User is not in pending status (currently "${user.status}")`,
          });
          continue;
        }

        // Enforce valid student or instructor role
        if (!['student', 'instructor'].includes(user.role)) {
          skipped.push({
            id: userIdStr,
            email: user.email,
            role: user.role,
            reason: `Invalid role for pending registration: "${user.role}"`,
          });
          continue;
        }

        // Transition account status from pending to rejected
        user.status = 'rejected';
        user.isActive = false;
        user.rejectionReason = rejectionReason;
        await user.save();

        // 1. Create audit log entry
        try {
          await AuditLog.create({
            userId: req.user._id,
            action: 'USER_REJECTED',
            entityType: 'User',
            entityId: userIdStr,
            details: {
              targetName: user.name,
              targetEmail: user.email,
              assignedRole: user.role,
              reason: rejectionReason,
              bulk: true,
            },
            ipAddress: req.ip,
          });
        } catch (auditErr) {
          console.warn('[AdminController] Audit log creation failed for bulk reject:', auditErr.message);
        }

        // 2. Create in-app notification
        try {
          await Notification.create({
            userId: user._id,
            title: 'Account Application Rejected',
            message: `Your account registration was not approved: ${rejectionReason}`,
            type: 'system',
          });
        } catch (notifErr) {
          console.warn('[AdminController] In-app notification creation error on bulk reject:', notifErr.message);
        }

        // 3. Dispatch rejection email
        try {
          const emailResult = await emailService.sendAccountRejectedEmail(user, rejectionReason);
          if (!emailResult || !emailResult.success) {
            console.warn(`[AdminController] Bulk rejection email delivery unconfirmed for ${user.email}:`, emailResult?.error || 'Unknown error');
          }
        } catch (emailErr) {
          console.warn(`[AdminController] Bulk rejection email dispatch failed for ${user.email}:`, emailErr.message);
        }

        rejected.push({
          id: userIdStr,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }

      const rejectedCount = rejected.length;
      const skippedCount = skipped.length;
      const rejectedUserIds = rejected.map((u) => u.id);

      const summaryMessage =
        skippedCount > 0
          ? `Bulk rejection completed: ${rejectedCount} rejected, ${skippedCount} skipped.`
          : `Successfully rejected ${rejectedCount} registration${rejectedCount !== 1 ? 's' : ''}.`;

      return successResponse(res, summaryMessage, {
        rejectedCount,
        skippedCount,
        rejectedUserIds,
        rejected,
        skipped,
      });
    } catch (err) {
      next(err);
    }
  }

  // Controller action to bulk revoke multiple active user accounts
  async bulkRevokeUsers(req, res, next) {
    try {
      // Enforce administrator role authorization
      if (!req.user || req.user.role !== 'admin') {
        return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
      }

      const { userIds, reason: providedReason } = req.body;

      // Validate presence of userIds array
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return errorResponse(res, 'Please provide an array of user IDs to revoke', 400);
      }

      const defaultReason = 'Account access revoked by administrator';
      const revocationReason = (providedReason && typeof providedReason === 'string' && providedReason.trim())
        ? providedReason.trim()
        : defaultReason;

      const revoked = [];
      const skipped = [];

      for (const id of userIds) {
        if (!id || (typeof id !== 'string' && typeof id !== 'object')) {
          skipped.push({ id: String(id), reason: 'Invalid user ID format' });
          continue;
        }

        let user;
        try {
          user = await User.findById(id);
        } catch (idErr) {
          skipped.push({ id: String(id), reason: 'Invalid user identifier' });
          continue;
        }

        if (!user) {
          skipped.push({ id: String(id), reason: 'User not found' });
          continue;
        }

        const userIdStr = user._id.toString();

        // Disallow bulk revocation of self
        if (userIdStr === req.user._id.toString()) {
          skipped.push({
            id: userIdStr,
            email: user.email,
            reason: 'You cannot revoke your own administrator account',
          });
          continue;
        }

        // Disallow bulk revocation of admin accounts
        if (user.role === 'admin') {
          skipped.push({
            id: userIdStr,
            email: user.email,
            reason: 'Cannot revoke administrator accounts via bulk operation',
          });
          continue;
        }

        // Verify user is in active status (do not treat rejection and revocation as the same transition)
        if (user.status !== 'active') {
          skipped.push({
            id: userIdStr,
            email: user.email,
            status: user.status,
            reason: `User is not in active status (currently "${user.status}"). Only active users can be revoked.`,
          });
          continue;
        }

        // Transition account status from active to revoked
        user.status = 'revoked';
        user.isActive = false;
        user.revokedAt = new Date();
        user.revokedBy = req.user._id;
        user.rejectionReason = revocationReason;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate active user sessions
        await user.save();

        // 1. Create audit log entry
        try {
          await AuditLog.create({
            userId: req.user._id,
            action: 'USER_REVOKED',
            entityType: 'User',
            entityId: userIdStr,
            details: {
              targetName: user.name,
              targetEmail: user.email,
              assignedRole: user.role,
              reason: revocationReason,
              bulk: true,
            },
            ipAddress: req.ip,
          });
        } catch (auditErr) {
          console.warn('[AdminController] Audit log creation failed for bulk revoke:', auditErr.message);
        }

        // 2. Create in-app notification
        try {
          await Notification.create({
            userId: user._id,
            title: 'Account Access Revoked',
            message: `Your account access has been revoked: ${revocationReason}`,
            type: 'system',
          });
        } catch (notifErr) {
          console.warn('[AdminController] In-app notification creation error on bulk revoke:', notifErr.message);
        }

        // 3. Dispatch revocation email
        try {
          const emailResult = await emailService.sendAccountRevokedEmail(user, revocationReason);
          if (!emailResult || !emailResult.success) {
            console.warn(`[AdminController] Bulk revocation email delivery unconfirmed for ${user.email}`);
          }
        } catch (emailErr) {
          console.warn(`[AdminController] Bulk revocation email dispatch failed for ${user.email}:`, emailErr.message);
        }

        revoked.push({
          id: userIdStr,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        });
      }

      const revokedCount = revoked.length;
      const skippedCount = skipped.length;
      const message = `${revokedCount} account${revokedCount === 1 ? '' : 's'} revoked, ${skippedCount} skipped.`;

      return successResponse(res, message, {
        revokedCount,
        skippedCount,
        revokedUserIds: revoked.map((u) => u.id),
        revokedUsers: revoked,
        skipped,
      });
    } catch (err) {
      next(err);
    }
  }

  // Controller action to retrieve comprehensive details for a specific user
  async getUserDetails(req, res, next) {
    // Begin try block for retrieving user details
    try {
      // Query user by route ID and populate approver and revoker user details
      const user = await User.findById(req.params.id)
        // Populate the admin who approved the user
        .populate('approvedBy', 'name email')
        // Populate the admin who revoked the user
        .populate('revokedBy', 'name email');

      // Verify that the requested user exists
      if (!user) {
        // Return HTTP 404 Not Found response if user does not exist
        return errorResponse(res, 'User not found', 404);
      // Terminate user existence check
      }

      // Return HTTP 200 response with user details
      return successResponse(res, 'User details retrieved', user);
    // Catch block for user details retrieval errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getUserDetails method definition
  }

  // Controller action to approve a pending user account registration
  async approveUser(req, res, next) {
    // Begin try block for approving user account
    try {
      // Find target user by ID from route parameter
      const user = await User.findById(req.params.id);
      // Check if user exists in the database
      if (!user) {
        // Return HTTP 404 Not Found if user is missing
        return errorResponse(res, 'User not found', 404);
      // Terminate user existence check
      }

      // Extract optional override role from request body
      const { role } = req.body;
      // If a valid role was provided, assign it to the user
      if (role && ['student', 'instructor'].includes(role)) {
        // Update user's system role
        user.role = role;
      // Terminate role override conditional
      }

      // Set user status to active
      user.status = 'active';
      // Set active boolean flag to true
      user.isActive = true;
      // Record current timestamp as approval date
      user.approvedAt = new Date();
      // Record approving admin's ID
      user.approvedBy = req.user._id;
      // Clear any prior rejection reason
      user.rejectionReason = null;
      // Clear any prior revocation timestamp
      user.revokedAt = null;
      // Clear any prior revoking admin ID
      user.revokedBy = null;
      // Persist user updates to database
      await user.save();

      // Create an audit log entry documenting user approval
      await AuditLog.create({
        // Admin user performing the approval
        userId: req.user._id,
        // Audit action name
        action: 'USER_APPROVED',
        // Type of entity modified
        entityType: 'User',
        // String ID of approved user
        entityId: user._id.toString(),
        // Audit metadata details
        details: { targetEmail: user.email, assignedRole: user.role },
        // IP address of administrator
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // 1. In-app notification created first (must not be blocked by email transport)
      try {
        // Create an in-app notification notifying user of account approval
        await Notification.create({
          // Recipient user ID
          userId: user._id,
          // Notification title
          title: 'Account Approved',
          // Notification message body
          message: `Your account application has been approved with role "${user.role}". You may now sign in.`,
          // Notification category
          type: 'system',
          // Redirection link for user to sign in
          link: '/auth/login',
        // Terminate Notification creation
        });
      // Catch block to ensure notification creation failure does not halt approval
      } catch (notifErr) {
        // Log warning with notification error message
        console.warn('[AdminController] In-app notification creation error on approve:', notifErr.message);
      // Terminate notification try-catch
      }

      // 2. Email attempted (delivery success or failure must NOT roll back user approval)
      try {
        // Dispatch account approval confirmation email via email service
        const emailResult = await emailService.sendAccountApprovedEmail(user);
        // Check if email sending returned failure or empty response
        if (!emailResult || !emailResult.success) {
          // Log warning for unconfirmed email delivery
          console.warn(`[AdminController] Approval email delivery unconfirmed for ${user.email}:`, emailResult?.error || 'Unknown error');
        // Terminate email success check
        }
      // Catch block to ensure email failure does not roll back approval
      } catch (emailErr) {
        // Log warning for failed email dispatch
        console.warn(`[AdminController] Approval email dispatch failed for ${user.email}:`, emailErr.message);
      // Terminate email try-catch
      }

      // Return HTTP 200 response confirming user approval
      return successResponse(res, `Account approved successfully for ${user.name}`, user);
    // Catch block for approval operation errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate approveUser method definition
  }

  // Controller action to reject a pending user registration application
  async rejectUser(req, res, next) {
    // Begin try block for rejecting user registration
    try {
      // Find target user by ID from route parameter
      const user = await User.findById(req.params.id);
      // Verify user exists
      if (!user) {
        // Return HTTP 404 Not Found if user is missing
        return errorResponse(res, 'User not found', 404);
      // Terminate user existence check
      }

      // Prevent administrator from rejecting their own account
      if (user._id.toString() === req.user._id.toString()) {
        // Return HTTP 400 Bad Request if self-rejection is attempted
        return errorResponse(res, 'You cannot reject your own administrator account', 400);
      // Terminate self-rejection check
      }

      // Extract rejection reason from body or use default explanation
      const reason = req.body.reason || 'Registration rejected by administrator';
      // Set user status to rejected
      user.status = 'rejected';
      // Set active flag to false
      user.isActive = false;
      // Save rejection reason to user document
      user.rejectionReason = reason;
      // Persist user document updates
      await user.save();

      // Create audit log entry for user rejection
      await AuditLog.create({
        // Administrator performing rejection
        userId: req.user._id,
        // Audit action name
        action: 'USER_REJECTED',
        // Target entity type
        entityType: 'User',
        // Target user string ID
        entityId: user._id.toString(),
        // Details containing rejected email and reason
        details: { targetEmail: user.email, reason },
        // IP address of administrator
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // 1. In-app notification created first
      try {
        // Create in-app notification informing user of registration rejection
        await Notification.create({
          // Recipient user ID
          userId: user._id,
          // Notification title
          title: 'Account Application Rejected',
          // Notification message with specified reason
          message: `Your account registration was not approved: ${reason}`,
          // Category of notification
          type: 'system',
        // Terminate Notification creation
        });
      // Catch block to prevent notification error from disrupting response
      } catch (notifErr) {
        // Log warning for notification error
        console.warn('[AdminController] In-app notification error on reject:', notifErr.message);
      // Terminate notification try-catch
      }

      // 2. Rejection email attempted
      try {
        // Dispatch account rejection email to the user
        const emailResult = await emailService.sendAccountRejectedEmail(user, reason);
        // Check if email dispatch succeeded
        if (!emailResult || !emailResult.success) {
          // Log warning for unconfirmed email delivery
          console.warn(`[AdminController] Rejection email delivery unconfirmed for ${user.email}:`, emailResult?.error || 'Unknown error');
        // Terminate email success check
        }
      // Catch block for email dispatch errors
      } catch (emailErr) {
        // Log warning for failed email dispatch
        console.warn(`[AdminController] Rejection email dispatch failed for ${user.email}:`, emailErr.message);
      // Terminate email try-catch
      }

      // Return HTTP 200 response confirming rejection
      return successResponse(res, `Account registration rejected for ${user.name}`, user);
    // Catch block for rejection processing errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate rejectUser method definition
  }

  // Controller action to revoke an active user's account access
  async revokeUser(req, res, next) {
    // Begin try block for revoking user access
    try {
      // Find target user by ID from route parameter
      const user = await User.findById(req.params.id);
      // Verify user exists
      if (!user) {
        // Return HTTP 404 Not Found if user is missing
        return errorResponse(res, 'User not found', 404);
      // Terminate user existence check
      }

      // Prevent administrator from revoking their own account access
      if (user._id.toString() === req.user._id.toString()) {
        // Return HTTP 400 Bad Request if self-revocation is attempted
        return errorResponse(res, 'You cannot revoke your own administrator account', 400);
      // Terminate self-revocation check
      }

      // Extract revocation reason from body or use default explanation
      const reason = req.body.reason || 'Account access revoked by administrator';
      // Set user status to revoked
      user.status = 'revoked';
      // Deactivate user account
      user.isActive = false;
      // Record revocation timestamp
      user.revokedAt = new Date();
      // Record revoking administrator ID
      user.revokedBy = req.user._id;
      // Store revocation reason in user document
      user.rejectionReason = reason;
      // Invalidate all active user sessions and access tokens
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      // Persist changes to database
      await user.save();

      // Revoke all active sessions in MongoDB
      await Session.updateMany(
        { userId: user._id, status: 'active' },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: `admin_revocation: ${reason}`,
          },
        }
      ).catch((err) => {
        console.warn('[AdminController] Error revoking sessions for user:', err.message);
      });

      // Create audit log entry recording account revocation
      await AuditLog.create({
        // Administrator performing revocation
        userId: req.user._id,
        // Audit action identifier
        action: 'USER_REVOKED',
        // Target entity type
        entityType: 'User',
        // Target user string ID
        entityId: user._id.toString(),
        // Details containing user email and reason
        details: { targetEmail: user.email, reason },
        // IP address of administrator
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // 1. In-app notification created first
      try {
        // Create in-app notification notifying user of account revocation
        await Notification.create({
          // Recipient user ID
          userId: user._id,
          // Notification title
          title: 'Account Access Revoked',
          // Notification message detailing reason
          message: `Your account access has been revoked: ${reason}`,
          // Category of notification
          type: 'system',
        // Terminate Notification creation
        });
      // Catch block to capture notification errors
      } catch (notifErr) {
        // Log warning for notification error
        console.warn('[AdminController] In-app notification error on revoke:', notifErr.message);
      // Terminate notification try-catch
      }

      // 2. Revocation email attempted
      try {
        // Dispatch account revocation notification email
        const emailResult = await emailService.sendAccountRevokedEmail(user, reason);
        // Verify email delivery confirmation
        if (!emailResult || !emailResult.success) {
          // Log warning for unconfirmed email delivery
          console.warn(`[AdminController] Revocation email delivery unconfirmed for ${user.email}:`, emailResult?.error || 'Unknown error');
        // Terminate email success check
        }
      // Catch block for email dispatch errors
      } catch (emailErr) {
        // Log warning for failed email dispatch
        console.warn(`[AdminController] Revocation email dispatch failed for ${user.email}:`, emailErr.message);
      // Terminate email try-catch
      }

      // Return HTTP 200 response confirming account revocation
      return successResponse(res, `Account access revoked for ${user.name}`, user);
    // Catch block for revocation processing errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate revokeUser method definition
  }

  // Controller action to restore a revoked or deactivated user account
  async restoreUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (user.status === 'active' && user.isActive) {
        return errorResponse(res, 'User account is already active', 400);
      }

      user.status = 'active';
      user.isActive = true;
      user.revokedAt = null;
      user.revokedBy = null;
      user.rejectionReason = null;
      // Increment tokenVersion so pre-revocation tokens cannot be reused
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      try {
        await AuditLog.create({
          userId: req.user._id,
          action: 'USER_RESTORED',
          entityType: 'User',
          entityId: user._id.toString(),
          details: { targetEmail: user.email },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn('[AdminController] Audit log creation failed for restore:', auditErr.message);
      }

      try {
        await Notification.create({
          userId: user._id,
          title: 'Account Access Restored',
          message: 'Your account access has been restored by an administrator.',
          type: 'system',
        });
      } catch (notifErr) {
        console.warn('[AdminController] In-app notification error on restore:', notifErr.message);
      }

      return successResponse(res, `Account access restored for ${user.name}`, user);
    } catch (err) {
      next(err);
    }
  }

  // Controller action to list all platform assessments with status, category, and search filters
  async getAllAssessments(req, res, next) {
    // Begin try block for querying assessments
    try {
      // Destructure query parameters for status, category, search, and pagination
      const { status, category, search, page = 1, limit = 10 } = req.query;
      // Initialize query filter object
      const query = {};
      // Filter by assessment status if provided
      if (status) query.status = status;
      // Filter by category if provided
      if (category) query.category = category;
      // Apply search filter across assessment title and description if provided
      if (search) {
        // Search condition matching title or description
        query.$or = [
          // Case-insensitive regex match on assessment title
          { title: { $regex: search, $options: 'i' } },
          // Case-insensitive regex match on assessment description
          { description: { $regex: search, $options: 'i' } },
        // Terminate $or array
        ];
      // Terminate search condition check
      }

      // Calculate pagination offset
      const skip = (page - 1) * limit;
      // Count total matching assessments
      const total = await Assessment.countDocuments(query);
      // Query paginated assessments matching criteria
      const assessments = await Assessment.find(query)
        // Populate creator instructor's name, email, and avatar
        .populate('instructorId', 'name email avatar')
        // Sort newest assessments first
        .sort({ createdAt: -1 })
        // Skip offset documents
        .skip(skip)
        // Limit results to page size
        .limit(parseInt(limit, 10));

      // Return HTTP 200 paginated response with assessments
      return paginatedResponse(res, 'Platform assessments retrieved', assessments, page, limit, total);
    // Catch block for assessment query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getAllAssessments method definition
  }

  // Controller action to toggle a user's active/revoked status
  async toggleUserStatus(req, res, next) {
    // Begin try block for toggling user active status
    try {
      // Find target user by ID from route parameter
      const user = await User.findById(req.params.id);
      // Check if user exists
      if (!user) {
        // Return HTTP 404 Not Found if user is missing
        return errorResponse(res, 'User not found', 404);
      // Terminate user existence check
      }

      // Prevent administrator from deactivating their own account
      if (user._id.toString() === req.user._id.toString()) {
        // Return HTTP 400 Bad Request if self-deactivation is attempted
        return errorResponse(res, 'You cannot deactivate your own account', 400);
      // Terminate self-deactivation check
      }

      // Invert user's active state boolean
      user.isActive = !user.isActive;
      // Update status to active or revoked depending on new boolean value
      user.status = user.isActive ? 'active' : 'revoked';
      // If account was deactivated, record revocation timestamp and admin ID
      if (!user.isActive) {
        // Record current timestamp as revokedAt
        user.revokedAt = new Date();
        // Record administrator ID as revokedBy
        user.revokedBy = req.user._id;
        // Invalidate active sessions upon deactivation
        user.tokenVersion = (user.tokenVersion || 0) + 1;
      // Terminate deactivation timestamp conditional
      } else {
        // Increment tokenVersion upon reactivation so old tokens cannot be reused
        user.tokenVersion = (user.tokenVersion || 0) + 1;
      }
      // Persist changes to database
      await user.save();

      // Create audit log documenting status toggle
      await AuditLog.create({
        // Administrator performing toggle
        userId: req.user._id,
        // Audit action name based on active status
        action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        // Entity type
        entityType: 'User',
        // Target user string ID
        entityId: user._id.toString(),
        // Details containing user email and new status
        details: { targetEmail: user.email, status: user.status },
        // Administrator IP address
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // Return HTTP 200 response with toggle confirmation and updated state
      return successResponse(
        // Express response object
        res,
        // Dynamic status message
        `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        // Payload object with updated state
        {
          // User string ID
          id: user._id.toString(),
          // Updated active boolean flag
          isActive: user.isActive,
          // Updated status string
          status: user.status,
        // Terminate payload object
        }
      // Terminate successResponse invocation
      );
    // Catch block for toggle status errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate toggleUserStatus method definition
  }

  // Controller action to retrieve paginated audit logs with optional action filtering
  async getLogs(req, res, next) {
    // Begin try block for fetching audit logs
    try {
      // Destructure pagination parameters and optional action filter from query
      const { page = 1, limit = 20, action } = req.query;
      // Initialize query filter object
      const query = {};
      // Filter by audit action identifier if specified
      if (action) query.action = action;

      // Calculate pagination skip offset
      const skip = (page - 1) * limit;
      // Count total matching audit log records
      const total = await AuditLog.countDocuments(query);
      // Query paginated audit logs matching criteria
      const logs = await AuditLog.find(query)
        // Populate actor user's name, email, and role
        .populate('userId', 'name email role')
        // Sort newest logs first
        .sort({ createdAt: -1 })
        // Skip offset records
        .skip(skip)
        // Limit query to page size
        .limit(parseInt(limit, 10));

      // Return HTTP 200 paginated response with audit log entries
      return paginatedResponse(res, 'Audit logs retrieved', logs, page, limit, total);
    // Catch block for audit log query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getLogs method definition
  }

  // Controller action to retrieve global system settings or create defaults if none exist
  async getSettings(req, res, next) {
    // Begin try block for fetching system settings
    try {
      // Query existing system settings document
      let settings = await SystemSetting.findOne();
      // Initialize default settings document if none currently exists in database
      if (!settings) {
        // Create default platform settings document
        settings = await SystemSetting.create({
          // Platform title
          platformName: 'Unified Assessment Platform',
          // Allow open self-registration by default
          registrationOpen: true,
          // Disable maintenance mode by default
          maintenanceMode: false,
          // Empty initial announcement banner message
          announcementBanner: '',
          // Default required passing score percentage
          defaultPassingScore: 60,
          // Enable email notifications by default
          enableEmailNotifications: true,
          // Default maximum assessment attempt duration in hours
          maxAttemptDurationHours: 4,
          // Support email contact address
          supportEmail: 'support@uap.edu',
          // Allow student review of completed assessments by default
          allowStudentReview: true,
        // Terminate default settings creation object
        });
      // Terminate check for existing settings
      }
      // Return HTTP 200 response with current system settings
      return successResponse(res, 'System settings retrieved', settings);
    // Catch block for system settings retrieval errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getSettings method definition
  }

  // Controller action to update global system configuration settings
  async updateSettings(req, res, next) {
    // Begin try block for updating system settings
    try {
      // Destructure configurable settings properties from request body
      const {
        // Name of the platform displayed across applications
        platformName,
        // Boolean flag indicating if public user registration is enabled
        registrationOpen,
        // Boolean flag putting system into maintenance mode
        maintenanceMode,
        // Global announcement banner message text
        announcementBanner,
        // Default passing score percentage for assessments
        defaultPassingScore,
        // Boolean flag enabling or disabling system email dispatches
        enableEmailNotifications,
        // Maximum duration permitted for an assessment attempt
        maxAttemptDurationHours,
        // System support contact email address
        supportEmail,
        // Boolean flag enabling students to review their graded submissions
        allowStudentReview,
      // Target payload from request body
      } = req.body;

      // Query existing system settings record
      let settings = await SystemSetting.findOne();
      // Create new SystemSetting model instance if none exists in database
      if (!settings) {
        // Instantiate fresh SystemSetting instance
        settings = new SystemSetting();
      // Terminate settings existence check
      }

      // Update platform name if specified in request
      if (platformName !== undefined) settings.platformName = platformName;
      // Update registrationOpen flag as boolean if specified
      if (registrationOpen !== undefined) settings.registrationOpen = Boolean(registrationOpen);
      // Update maintenanceMode flag as boolean if specified
      if (maintenanceMode !== undefined) settings.maintenanceMode = Boolean(maintenanceMode);
      // Update announcementBanner text if specified
      if (announcementBanner !== undefined) settings.announcementBanner = announcementBanner;
      // Update defaultPassingScore as number if specified
      if (defaultPassingScore !== undefined) settings.defaultPassingScore = Number(defaultPassingScore);
      // Update enableEmailNotifications flag as boolean if specified
      if (enableEmailNotifications !== undefined) settings.enableEmailNotifications = Boolean(enableEmailNotifications);
      // Update maxAttemptDurationHours as number if specified
      if (maxAttemptDurationHours !== undefined) settings.maxAttemptDurationHours = Number(maxAttemptDurationHours);
      // Update supportEmail if specified
      if (supportEmail !== undefined) settings.supportEmail = supportEmail;
      // Update allowStudentReview flag as boolean if specified
      if (allowStudentReview !== undefined) settings.allowStudentReview = Boolean(allowStudentReview);
      // Record ID of administrator performing configuration update
      settings.updatedBy = req.user._id;

      // Save updated settings to database
      await settings.save();

      // Create audit log documenting settings configuration change
      await AuditLog.create({
        // Administrator performing configuration update
        userId: req.user._id,
        // Audit action identifier
        action: 'SETTINGS_UPDATED',
        // Target entity type
        entityType: 'SystemSetting',
        // Target entity string ID
        entityId: settings._id.toString(),
        // Details containing updated settings payload
        details: req.body,
        // Administrator IP address
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // Return HTTP 200 response with updated system settings
      return successResponse(res, 'System settings updated successfully', settings);
    // Catch block for settings update errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate updateSettings method definition
  }

  // Controller action to retrieve active operational and security alerts
  async getOperationalAlerts(req, res, next) {
    // Begin try block for fetching operational alerts
    try {
      // Define list of audit action types considered suspicious or security-critical
      const suspiciousActions = [
        // Failed login attempt
        'LOGIN_FAILED',
        // Login attempt by user whose account is revoked
        'REVOKED_USER_LOGIN_ATTEMPT',
        // Attempted access without required authorization
        'UNAUTHORIZED_ACCESS',
        // Administrative account revocation
        'USER_REVOKED',
        // Administrative application rejection
        'USER_REJECTED',
      // Terminate suspicious action array
      ];

      // Concurrently query suspicious logs, login failures, revoked attempts, and pending accounts
      const [alerts, failedLoginsCount, revokedAttemptsCount, pendingUsersCount] = await Promise.all([
        // Query recent audit logs matching suspicious actions
        AuditLog.find({ action: { $in: suspiciousActions } })
          // Populate the associated user's name, email, and role
          .populate('userId', 'name email role')
          // Sort newest alerts first
          .sort({ createdAt: -1 })
          // Limit results to 25 latest alerts
          .limit(25),
        // Count total failed login attempts recorded in audit logs
        AuditLog.countDocuments({ action: 'LOGIN_FAILED' }),
        // Count total login attempts by revoked users
        AuditLog.countDocuments({ action: 'REVOKED_USER_LOGIN_ATTEMPT' }),
        // Count total accounts pending administrative approval
        User.countDocuments({ status: 'pending' }),
      // Terminate Promise.all array argument
      ]);

      // Return HTTP 200 response with alerts list and operational summary counters
      return successResponse(res, 'Operational alerts retrieved', {
        // Array of recent alert log documents
        alerts,
        // Operational summary counters object
        summary: {
          // Total number of alerts in current batch
          totalAlerts: alerts.length,
          // Count of recorded failed login attempts
          failedLoginsCount,
          // Count of recorded revoked account login attempts
          revokedAttemptsCount,
          // Count of pending user account applications
          pendingUsersCount,
        // Terminate summary object
        },
      // Terminate alerts payload object
      });
    // Catch block for alerts query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getOperationalAlerts method definition
  }

  // Controller action to update the publication status of an assessment
  async updateAssessmentStatus(req, res, next) {
    // Begin try block for updating assessment publication status
    try {
      // Extract target assessment ID from route parameter
      const { id } = req.params;
      // Extract new status from request body
      const { status } = req.body;

      // Validate that status is one of the permitted assessment lifecycle states
      if (!['draft', 'published', 'archived'].includes(status)) {
        // Return HTTP 400 Bad Request if status is invalid
        return errorResponse(res, 'Invalid assessment status. Must be draft, published, or archived', 400);
      // Terminate status validation check
      }

      // Query assessment by ID from database
      const assessment = await Assessment.findById(id);
      // Check if assessment exists
      if (!assessment) {
        // Return HTTP 404 Not Found if assessment does not exist
        return errorResponse(res, 'Assessment not found', 404);
      // Terminate assessment existence check
      }

      // Record old status for audit logging
      const oldStatus = assessment.status;
      // Assign new status to assessment document
      assessment.status = status;
      // Save changes to database
      await assessment.save();

      // Create audit log entry documenting status modification
      await AuditLog.create({
        // Administrator performing modification
        userId: req.user._id,
        // Audit action identifier
        action: 'ASSESSMENT_STATUS_UPDATED',
        // Target entity type
        entityType: 'Assessment',
        // Target assessment string ID
        entityId: assessment._id.toString(),
        // Details recording assessment title, previous status, and new status
        details: { title: assessment.title, oldStatus, newStatus: status },
        // Administrator IP address
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // Return HTTP 200 response confirming status update
      return successResponse(res, `Assessment status updated to "${status}"`, assessment);
    // Catch block for assessment status update errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate updateAssessmentStatus method definition
  }

  // =========================================================================
  // Section Header: Master Student Registry Management Endpoints
  // =========================================================================

  // Controller action to retrieve paginated student registry records with search and status filtering
  async getStudentRegistry(req, res, next) {
    // Begin try block for querying student registry records
    try {
      // Destructure query parameters for search, status, and pagination with defaults
      const { search, status, page = 1, limit = 10 } = req.query;
      // Initialize query filter object
      const query = {};
      // Filter by status if specified in query
      if (status) query.status = status;
      // Build case-insensitive regex search on studentId, name, or email if search string provided
      if (search) {
        // Match search pattern across student registry attributes
        query.$or = [
          // Case-insensitive match on studentId
          { studentId: { $regex: search, $options: 'i' } },
          // Case-insensitive match on student name
          { name: { $regex: search, $options: 'i' } },
          // Case-insensitive match on student email
          { email: { $regex: search, $options: 'i' } },
        // Terminate $or array
        ];
      // Terminate search condition check
      }

      // Compute pagination skip offset
      const skip = (page - 1) * limit;
      // Count total matching student registry records
      const total = await StudentRegistry.countDocuments(query);
      // Query paginated student registry records matching criteria
      const records = await StudentRegistry.find(query)
        // Sort alphabetically by student ID ascending
        .sort({ studentId: 1 })
        // Skip offset records
        .skip(skip)
        // Limit query to page size
        .limit(parseInt(limit, 10));

      // Return HTTP 200 paginated response with student registry records
      return paginatedResponse(res, 'Student registry records retrieved', records, page, limit, total);
    // Catch block for student registry query errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getStudentRegistry method definition
  }

  // Controller action to create a new master entry in the student registry
  async createStudentRegistryRecord(req, res, next) {
    // Begin try block for creating student registry record
    try {
      // Destructure required registry attributes with default active status from request body
      const { studentId, name, dateOfBirth, email, status = 'active' } = req.body;

      // Verify that all mandatory fields are present
      if (!studentId || !name || !dateOfBirth || !email) {
        // Return HTTP 400 Bad Request if any required field is missing
        return errorResponse(res, 'studentId, name, dateOfBirth, and email are required', 400);
      // Terminate mandatory fields check
      }

      // Normalize student ID by trimming whitespace and converting to uppercase
      const normalizedStudentId = studentId.trim().toUpperCase();
      // Normalize email address by trimming whitespace and converting to lowercase
      const normalizedEmail = email.trim().toLowerCase();

      // Check if student ID already exists in the registry to prevent duplicates
      const existingId = await StudentRegistry.findOne({ studentId: normalizedStudentId });
      // If matching student ID found, return conflict error
      if (existingId) {
        // Return HTTP 409 Conflict if student ID is already registered
        return errorResponse(res, 'Student ID already exists in registry', 409);
      // Terminate duplicate student ID check
      }

      // Check if email address already exists in the registry to prevent duplicates
      const existingEmail = await StudentRegistry.findOne({ email: normalizedEmail });
      // If matching email found, return conflict error
      if (existingEmail) {
        // Return HTTP 409 Conflict if email is already registered
        return errorResponse(res, 'Email already exists in registry', 409);
      // Terminate duplicate email check
      }

      // Create new student registry record in database
      const record = await StudentRegistry.create({
        // Normalized uppercase student ID
        studentId: normalizedStudentId,
        // Normalized student name with collapsed consecutive whitespace
        name: name.trim().replace(/\s+/g, ' '),
        // Parsed Date object for date of birth
        dateOfBirth: new Date(dateOfBirth),
        // Normalized lowercase email address
        email: normalizedEmail,
        // Account status string
        status,
      // Terminate record creation object
      });

      // Create audit log entry documenting registry record creation
      await AuditLog.create({
        // Administrator performing creation
        userId: req.user._id,
        // Audit action identifier
        action: 'STUDENT_REGISTRY_CREATE',
        // Target entity type
        entityType: 'StudentRegistry',
        // Target record string ID
        entityId: record._id.toString(),
        // Details recording student ID, email, and status
        details: { studentId: record.studentId, email: record.email, status: record.status },
        // Administrator IP address
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // Return HTTP 201 Created response with created student registry record
      return successResponse(res, 'Student registry record created successfully', record, 201);
    // Catch block for registry creation errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate createStudentRegistryRecord method definition
  }

  // Controller action to retrieve an individual student registry record by ID
  async getStudentRegistryRecordById(req, res, next) {
    // Begin try block for retrieving single student registry record
    try {
      // Query student registry record by route parameter ID
      const record = await StudentRegistry.findById(req.params.id);
      // Verify record exists
      if (!record) {
        // Return HTTP 404 Not Found if record is missing
        return errorResponse(res, 'Student registry record not found', 404);
      // Terminate record existence check
      }
      // Return HTTP 200 response with student registry record
      return successResponse(res, 'Student registry record retrieved', record);
    // Catch block for lookup errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getStudentRegistryRecordById method definition
  }

  // Controller action to update an existing student registry record
  async updateStudentRegistryRecord(req, res, next) {
    // Begin try block for updating student registry record
    try {
      // Extract target record ID from route parameters
      const { id } = req.params;
      // Query student registry record by ID
      const record = await StudentRegistry.findById(id);
      // Verify that record exists
      if (!record) {
        // Return HTTP 404 Not Found if record does not exist
        return errorResponse(res, 'Student registry record not found', 404);
      // Terminate record existence check
      }

      // Destructure mutable fields from request body
      const { studentId, name, dateOfBirth, email, status } = req.body;

      // Handle student ID modification and uniqueness validation
      if (studentId) {
        // Normalize new student ID to uppercase
        const normId = studentId.trim().toUpperCase();
        // Check if student ID has changed from current value
        if (normId !== record.studentId) {
          // Query database for conflicting record with same ID but different MongoDB _id
          const duplicate = await StudentRegistry.findOne({ studentId: normId, _id: { $ne: id } });
          // If collision found, reject update with conflict error
          if (duplicate) {
            // Return HTTP 409 Conflict if new student ID is already taken
            return errorResponse(res, 'Student ID already exists in registry', 409);
          // Terminate duplicate check
          }
          // Assign validated unique student ID
          record.studentId = normId;
        // Terminate student ID change check
        }
      // Terminate student ID presence check
      }

      // Handle email address modification and uniqueness validation
      if (email) {
        // Normalize new email address to lowercase
        const normEmail = email.trim().toLowerCase();
        // Check if email has changed from current value
        if (normEmail !== record.email) {
          // Query database for conflicting record with same email but different MongoDB _id
          const duplicate = await StudentRegistry.findOne({ email: normEmail, _id: { $ne: id } });
          // If collision found, reject update with conflict error
          if (duplicate) {
            // Return HTTP 409 Conflict if new email is already taken
            return errorResponse(res, 'Email already exists in registry', 409);
          // Terminate duplicate check
          }
          // Assign validated unique email address
          record.email = normEmail;
        // Terminate email change check
        }
      // Terminate email presence check
      }

      // Update name with trimmed and collapsed whitespace if provided
      if (name) record.name = name.trim().replace(/\s+/g, ' ');
      // Update date of birth parsed as Date if provided
      if (dateOfBirth) record.dateOfBirth = new Date(dateOfBirth);
      // Update status string if provided
      if (status) record.status = status;

      // Persist modifications to student registry document
      await record.save();

      // Create audit log documenting registry record update
      await AuditLog.create({
        // Administrator performing modification
        userId: req.user._id,
        // Audit action identifier
        action: 'STUDENT_REGISTRY_UPDATE',
        // Target entity type
        entityType: 'StudentRegistry',
        // Target record string ID
        entityId: record._id.toString(),
        // Details recording updated student ID, email, and status
        details: { studentId: record.studentId, email: record.email, status: record.status },
        // Administrator IP address
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // Return HTTP 200 response with updated student registry record
      return successResponse(res, 'Student registry record updated successfully', record);
    // Catch block for registry update errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate updateStudentRegistryRecord method definition
  }

  // Controller action to delete a record from the student registry
  async deleteStudentRegistryRecord(req, res, next) {
    // Begin try block for deleting student registry record
    try {
      // Extract target record ID from route parameters
      const { id } = req.params;
      // Query student registry record by ID to verify existence and capture details
      const record = await StudentRegistry.findById(id);
      // Verify record exists
      if (!record) {
        // Return HTTP 404 Not Found if record is missing
        return errorResponse(res, 'Student registry record not found', 404);
      // Terminate record existence check
      }

      // Delete the student registry record by ID
      await StudentRegistry.findByIdAndDelete(id);

      // Create audit log entry recording deletion
      await AuditLog.create({
        // Administrator performing deletion
        userId: req.user._id,
        // Audit action identifier
        action: 'STUDENT_REGISTRY_DELETE',
        // Target entity type
        entityType: 'StudentRegistry',
        // Target record string ID
        entityId: id,
        // Details recording student ID and email of deleted record
        details: { studentId: record.studentId, email: record.email },
        // Administrator IP address
        ipAddress: req.ip,
      // Terminate AuditLog creation
      });

      // Return HTTP 200 response confirming deletion with deleted ID
      return successResponse(res, 'Student registry record deleted successfully', { id });
    // Catch block for deletion errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate deleteStudentRegistryRecord method definition
  }
// Terminate AdminController class definition
}

// Export a singleton instance of AdminController for use in administrative routing
module.exports = new AdminController();
