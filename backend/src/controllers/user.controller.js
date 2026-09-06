const { User, Submission } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');

class UserController {
  async updateProfile(req, res, next) {
    try {
      const { name, bio } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (name) user.name = name;
      if (bio !== undefined) user.bio = bio;
      await user.save();

      return successResponse(res, 'Profile updated successfully', {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
      });
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
            ],
          },
        ];
      }

      const students = await User.find(query)
        .select('name email avatar isActive status createdAt')
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
}

module.exports = new UserController();
