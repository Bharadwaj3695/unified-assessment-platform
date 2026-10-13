const fs = require('fs');
const path = require('path');
const { User, Submission, AuditLog } = require('../models');
const userService = require('../services/user.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Safely unlink an old avatar file from the uploads directory if it is local
 * and not referenced by any other User record.
 */
async function cleanupAvatarFile(avatarPath, currentUserId) {
  if (!avatarPath || typeof avatarPath !== 'string') return;
  // Only clean up local /uploads/ files, not external SSO URLs
  if (!avatarPath.startsWith('/uploads/')) return;

  try {
    const filename = path.basename(avatarPath);
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const resolvedPath = path.resolve(uploadsDir, filename);

    // Prevent directory traversal attacks
    if (!resolvedPath.startsWith(uploadsDir)) return;

    // Check if another user references this same avatar file
    const sharedCount = await User.countDocuments({
      avatar: avatarPath,
      _id: { $ne: currentUserId },
    });
    if (sharedCount > 0) return;

    if (fs.existsSync(resolvedPath)) {
      await fs.promises.unlink(resolvedPath);
    }
  } catch (err) {
    console.warn('[UserController] Non-fatal error cleaning up old avatar:', err.message);
  }
}

class UserController {
  async getProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.user.id);
      return successResponse(res, 'Profile retrieved successfully', profile);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const profile = await userService.updateProfile(req.user.id, req.body);
      return successResponse(res, 'Profile updated successfully', profile);
    } catch (err) {
      next(err);
    }
  }

  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return errorResponse(res, 'No image file uploaded', 400);
      }

      // Strictly resolve target user from authenticated JWT context
      const user = await User.findById(req.user.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const previousAvatar = user.avatar;
      const isNew = !previousAvatar;
      const avatarPath = `/uploads/${req.file.filename}`;

      // Clean up previous local avatar file to prevent orphaned files
      if (previousAvatar && previousAvatar !== avatarPath) {
        await cleanupAvatarFile(previousAvatar, user._id);
      }

      user.avatar = avatarPath;
      await user.save();

      // Record audit log event for security audit trail
      try {
        await AuditLog.create({
          userId: user._id,
          action: isNew ? 'PROFILE_PHOTO_ADDED' : 'PROFILE_PHOTO_CHANGED',
          entityType: 'User',
          entityId: user._id.toString(),
          details: {
            avatar: avatarPath,
            previousAvatar: previousAvatar || null,
            role: user.role,
          },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn('[UserController] Failed to create audit log for avatar upload:', auditErr.message);
      }

      return successResponse(res, isNew ? 'Profile photo added successfully' : 'Profile photo updated successfully', {
        avatar: avatarPath,
        user: {
          id: user._id.toString(),
          avatar: avatarPath,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteAvatar(req, res, next) {
    try {
      // Strictly resolve target user from authenticated JWT context (ignore any client-provided userId)
      const user = await User.findById(req.user.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const previousAvatar = user.avatar;
      if (!previousAvatar) {
        return successResponse(res, 'Profile photo already empty', {
          avatar: null,
          user: {
            id: user._id.toString(),
            avatar: null,
          },
        });
      }

      // Safely unlink stored avatar file if local and not shared
      await cleanupAvatarFile(previousAvatar, user._id);

      user.avatar = null;
      await user.save();

      // Record audit log event for security audit trail
      try {
        await AuditLog.create({
          userId: user._id,
          action: 'PROFILE_PHOTO_REMOVED',
          entityType: 'User',
          entityId: user._id.toString(),
          details: {
            previousAvatar,
            role: user.role,
          },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn('[UserController] Failed to create audit log for avatar removal:', auditErr.message);
      }

      return successResponse(res, 'Profile photo removed successfully', {
        avatar: null,
        user: {
          id: user._id.toString(),
          avatar: null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getStudents(req, res, next) {
    try {
      const { search } = req.query;
      const query = {
        role: 'student',
        $or: [{ status: 'active' }, { status: { $exists: false } }],
      };

      if (search) {
        query.$and = [
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { studentId: { $regex: search, $options: 'i' } },
            ],
          },
        ];
      }

      const students = await User.find(query)
        .select('name email avatar studentId department isActive status createdAt')
        .sort({ name: 1 });

      const studentIds = students.map((s) => s._id);
      const submissions = await Submission.find({ studentId: { $in: studentIds } }).select(
        'studentId score totalPoints percentage passed status createdAt'
      );

      const studentData = students.map((s) => {
        const studentSubmissions = submissions.filter(
          (sub) => sub.studentId.toString() === s._id.toString()
        );
        return {
          id: s._id.toString(),
          _id: s._id.toString(),
          name: s.name,
          email: s.email,
          avatar: s.avatar,
          studentId: s.studentId,
          department: s.department,
          isActive: s.isActive,
          status: s.status,
          createdAt: s.createdAt,
          submissions: studentSubmissions,
        };
      });

      return successResponse(res, 'Students retrieved successfully', studentData);
    } catch (err) {
      next(err);
    }
  }

  async getStudentProfile(req, res, next) {
    try {
      const studentProfile = await userService.getStudentProfileForFaculty(req.user.id, req.params.id);
      return successResponse(res, 'Student profile retrieved successfully', studentProfile);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
