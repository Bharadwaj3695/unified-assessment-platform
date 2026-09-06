const { User, AuditLog, Notification, SystemSetting } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const emailService = require('./email.service');

class AuthService {
  async register({ name, email, password, role = 'student', instituteCode = null, ipAddress = null }) {
    if (role === 'admin') {
      const error = new Error('Public registration cannot create an Administrator account.');
      error.statusCode = 403;
      throw error;
    }

    const setting = await SystemSetting.findOne();
    if (setting && setting.registrationOpen === false) {
      const error = new Error('User registration is currently closed by the platform administrator.');
      error.statusCode = 403;
      throw error;
    }

    const assignedRole = role === 'instructor' ? 'instructor' : 'student';

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const error = new Error('Email is already registered');
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: assignedRole,
      status: 'pending',
      isActive: false,
      instituteCode: instituteCode ? instituteCode.trim() : null,
    });

    await AuditLog.create({
      userId: user._id,
      action: 'USER_REGISTER',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, requestedRole: assignedRole, status: 'pending' },
      ipAddress,
    });

    // Send pending registration notification to applicant & alert admins
    try {
      await emailService.sendPendingRegistrationEmail(user);
      const admins = await User.find({ role: 'admin', status: 'active' });
      if (admins.length > 0) {
        await emailService.sendAdminNewApplicantAlert(admins, user);
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            title: 'New Applicant Pending',
            message: `${user.name} (${user.email}) submitted a registration application for role "${user.role}".`,
            type: 'system',
            link: '/admin/dashboard',
          });
        }
      }
    } catch (emailErr) {
      console.warn('[AuthService] Non-fatal notification error during registration:', emailErr.message);
    }

    return {
      message: 'Registration submitted successfully. Your account is pending administrator approval.',
      status: 'pending',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  async login({ email, password, ipAddress = null }) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await AuditLog.create({
        userId: null,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        details: { email: email.toLowerCase(), reason: 'User not found' },
        ipAddress,
      });
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      await AuditLog.create({
        userId: user._id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, reason: 'Incorrect password' },
        ipAddress,
      });
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Account status verification
    if (user.status === 'pending') {
      const error = new Error('Your account is pending administrator approval.');
      error.statusCode = 403;
      throw error;
    }

    if (user.status === 'rejected') {
      const error = new Error(
        `Your account registration was rejected${user.rejectionReason ? ': ' + user.rejectionReason : '. Please contact administration.'}`
      );
      error.statusCode = 403;
      throw error;
    }

    if (user.status === 'revoked' || !user.isActive) {
      await AuditLog.create({
        userId: user._id,
        action: 'REVOKED_USER_LOGIN_ATTEMPT',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, reason: 'Revoked account access attempt' },
        ipAddress,
      });
      const error = new Error('Your account has been revoked. Please contact administration.');
      error.statusCode = 403;
      throw error;
    }

    user.lastLoginAt = new Date();
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role },
      ipAddress,
    });

    const tokenPayload = { id: user._id.toString(), role: user.role, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        bio: user.bio,
      },
      accessToken,
      refreshToken,
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      const error = new Error('Incorrect current password');
      error.statusCode = 400;
      throw error;
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id.toString(),
    });

    return { message: 'Password updated successfully' };
  }
}

module.exports = new AuthService();
