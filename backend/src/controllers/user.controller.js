const { User, Submission } = require('../models');
const userService = require('../services/user.service');
const { successResponse, errorResponse } = require('../utils/response');

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

      const avatarPath = `/uploads/${req.file.filename}`;
      const user = await User.findById(req.user.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }
      user.avatar = avatarPath;
      await user.save();

      return successResponse(res, 'Avatar uploaded successfully', {
        avatar: avatarPath,
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
