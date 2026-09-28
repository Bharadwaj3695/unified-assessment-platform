const { User, AuditLog, Notification, SystemSetting, MfaChallenge } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  generateAccessToken,
  generateRefreshToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const { generateStudentId, generateFacultyId } = require('../utils/idGenerator');
const emailService = require('./email.service');
const googleAuthService = require('./googleAuth.service');
const mfaUtil = require('../utils/mfa');
const crypto = require('crypto');

class AuthService {
  async _createMfaChallenge(userId) {
    const challengeId = crypto.randomUUID();
    const ttlMs = 5 * 60 * 1000; // 5 minutes
    const expiresAt = new Date(Date.now() + ttlMs);

    await MfaChallenge.create({
      challengeId,
      userId,
      consumed: false,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
    });

    const mfaToken = generateMfaChallengeToken({ userId, challengeId });
    return { challengeId, mfaToken, expiresAt };
  }

  _formatUserProfile(user) {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      avatar: user.avatar,
      bio: user.bio,
      department: user.department,
      studentId: user.studentId,
      facultyId: user.facultyId,
      adminId: user.adminId,
      subjectId: user.subjectId,
      subjectName: user.subjectName,
      subjectDescription: user.subjectDescription,
      authProvider: user.authProvider,
      mfaEnabled: Boolean(user.mfaEnabled),
    };
  }
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
    const userData = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: assignedRole,
      status: 'pending',
      isActive: false,
      instituteCode: instituteCode ? instituteCode.trim() : null,
    };

    if (assignedRole === 'student') {
      userData.studentId = await generateStudentId();
      userData.department = 'Computer Science';
    } else if (assignedRole === 'instructor') {
      userData.facultyId = await generateFacultyId();
      userData.department = 'Computer Science & Engineering';
      userData.subjectId = 'CS-101';
      userData.subjectName = 'Algorithmic Foundations & Systems';
      userData.subjectDescription = 'Academic curriculum, system architecture, and assessment oversight.';
    }

    const user = await User.create(userData);

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

    if (!user.password) {
      const error = new Error('This account was created with Google Sign-In. Please sign in with Google.');
      error.statusCode = 400;
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

    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
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

    if (user.mfaEnabled) {
      const challenge = await this._createMfaChallenge(user._id);
      await AuditLog.create({
        userId: user._id,
        action: 'MFA_CHALLENGE_ISSUED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, authMethod: 'password', challengeId: challenge.challengeId },
        ipAddress,
      });

      return {
        mfaRequired: true,
        mfaToken: challenge.mfaToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
      };
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

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: this._formatUserProfile(user),
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
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id.toString(),
    });

    return { message: 'Password updated successfully' };
  }

  async googleLogin({ code, state, idToken, credential, ipAddress = null }) {
    // 1. Verify identity through Google OAuth 2.0 / OpenID Connect service
    const googlePayload = await googleAuthService.verifyGoogleIdentity({ code, state, idToken, credential });

    const googleId = googlePayload.sub;
    const email = googlePayload.email ? googlePayload.email.toLowerCase().trim() : null;
    const name = googlePayload.name || (email ? email.split('@')[0] : 'User');
    const avatar = googlePayload.picture || null;

    if (!googleId) {
      const error = new Error('Invalid Google identity: missing subject identifier (sub)');
      error.statusCode = 400;
      throw error;
    }

    if (!email) {
      const error = new Error('Invalid Google identity: missing email address');
      error.statusCode = 400;
      throw error;
    }

    if (!googlePayload.email_verified) {
      const error = new Error('Unverified Google email. Only verified Google accounts are permitted.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate institutional domain if configured (Part 7)
    googleAuthService.validateDomain(email);

    // 3. Search for existing user: first by googleId, then by email (Part 2 & 3)
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if existing user has the same verified email
      user = await User.findOne({ email });

      if (user) {
        // PART 3: EXISTING USER LINKING
        // Link Google authentication to existing account
        user.googleId = googleId;
        user.authProvider = user.password ? 'both' : 'google';
        if (!user.avatar && avatar) {
          user.avatar = avatar;
        }
        // Preserve: role, status, isActive, studentId, facultyId, instituteCode, department, etc.!
        await user.save();

        await AuditLog.create({
          userId: user._id,
          action: 'GOOGLE_ACCOUNT_LINKED',
          entityType: 'User',
          entityId: user._id.toString(),
          details: { email: user.email, googleId, role: user.role, status: user.status },
          ipAddress,
        });
      }
    }

    if (!user) {
      // PART 4: NEW GOOGLE REGISTRATION
      // Check if registration is open
      const setting = await SystemSetting.findOne();
      if (setting && setting.registrationOpen === false) {
        const error = new Error('User registration is currently closed by the platform administrator.');
        error.statusCode = 403;
        throw error;
      }

      // Safe default role: 'student'. NEVER accept role from Google claims. (Part 6)
      const assignedRole = 'student';
      const studentId = await generateStudentId();

      user = await User.create({
        name,
        email,
        googleId,
        authProvider: 'google',
        role: assignedRole,
        status: 'pending',
        isActive: false,
        studentId,
        department: 'Computer Science',
        avatar,
      });

      await AuditLog.create({
        userId: user._id,
        action: 'USER_REGISTER_GOOGLE',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, googleId, role: user.role, status: 'pending' },
        ipAddress,
      });

      // Notify applicant and administrators
      try {
        await emailService.sendPendingRegistrationEmail(user);
        const admins = await User.find({ role: 'admin', status: 'active' });
        if (admins.length > 0) {
          await emailService.sendAdminNewApplicantAlert(admins, user);
          for (const admin of admins) {
            await Notification.create({
              userId: admin._id,
              title: 'New Google Applicant Pending',
              message: `${user.name} (${user.email}) registered via Google for role "${user.role}".`,
              type: 'system',
              link: '/admin/dashboard',
            });
          }
        }
      } catch (emailErr) {
        console.warn('[AuthService] Non-fatal notification error during Google registration:', emailErr.message);
      }

      // Return pending status without issuing application JWT (Part 4)
      return {
        status: 'pending',
        message: 'Google registration submitted successfully. Your account is pending administrator approval.',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          studentId: user.studentId,
        },
      };
    }

    // PART 5: STATUS / ACCOUNT LIFECYCLE
    if (user.status === 'pending') {
      const error = new Error('Your account is pending administrator approval.');
      error.statusCode = 403;
      error.status = 'pending';
      throw error;
    }

    if (user.status === 'rejected') {
      const error = new Error(
        `Your account registration was rejected${user.rejectionReason ? ': ' + user.rejectionReason : '. Please contact administration.'}`
      );
      error.statusCode = 403;
      throw error;
    }

    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      await AuditLog.create({
        userId: user._id,
        action: 'REVOKED_USER_LOGIN_ATTEMPT',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, reason: 'Revoked account Google login attempt' },
        ipAddress,
      });
      const error = new Error('Your account has been revoked. Please contact administration.');
      error.statusCode = 403;
      throw error;
    }

    // Active user: issue application tokens (Part 9)
    if (user.mfaEnabled) {
      const challenge = await this._createMfaChallenge(user._id);
      await AuditLog.create({
        userId: user._id,
        action: 'MFA_CHALLENGE_ISSUED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, authMethod: 'google', challengeId: challenge.challengeId },
        ipAddress,
      });

      return {
        status: 'active',
        mfaRequired: true,
        mfaToken: challenge.mfaToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
      };
    }

    // Active user: issue application tokens (Part 9)
    user.lastLoginAt = new Date();
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGIN_GOOGLE',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role, googleId: user.googleId },
      ipAddress,
    });

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      status: 'active',
      user: this._formatUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  async initiateMfaSetup(userId) {
    const user = await User.findById(userId);
    if (!user || user.status !== 'active' || !user.isActive) {
      const error = new Error('Active account required for MFA setup');
      error.statusCode = 403;
      throw error;
    }

    const secret = mfaUtil.generateTotpSecret();
    const encryptedSecret = mfaUtil.encryptSecret(secret);
    user.mfaPendingSecret = encryptedSecret;
    await user.save();

    const otpauthUri = mfaUtil.generateTotpUri(user.email, secret);
    const qrCode = await mfaUtil.generateQrCode(otpauthUri);

    await AuditLog.create({
      userId: user._id,
      action: 'MFA_SETUP_INITIATED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email },
    });

    return {
      secret,
      otpauthUri,
      qrCode,
    };
  }

  async confirmMfaSetup(userId, code) {
    const user = await User.findById(userId);
    if (!user || user.status !== 'active' || !user.isActive) {
      const error = new Error('Active account required for MFA setup');
      error.statusCode = 403;
      throw error;
    }

    if (!user.mfaPendingSecret) {
      const error = new Error('No pending MFA setup found. Please initiate setup first.');
      error.statusCode = 400;
      throw error;
    }

    const decryptedSecret = mfaUtil.decryptSecret(user.mfaPendingSecret);
    const isValid = mfaUtil.verifyTotp(code, decryptedSecret);
    if (!isValid) {
      const error = new Error('Invalid TOTP verification code. Please check your authenticator app and try again.');
      error.statusCode = 400;
      throw error;
    }

    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = null;
    user.mfaEnabled = true;
    user.mfaEnrolledAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate previously issued single-factor sessions

    const recoveryCodes = mfaUtil.generateRecoveryCodes(8);
    user.mfaRecoveryCodes = recoveryCodes.map((c) => ({
      codeHash: mfaUtil.hashRecoveryCode(c),
      used: false,
      usedAt: null,
    }));

    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'MFA_ENROLLED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email },
    });

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      studentId: user.studentId,
      facultyId: user.facultyId,
      adminId: user.adminId,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      message: 'MFA enrolled successfully',
      mfaEnabled: true,
      recoveryCodes,
      accessToken,
      refreshToken,
    };
  }

  async verifyMfaChallenge({ mfaToken, code, ipAddress = null }) {
    if (!mfaToken) {
      const error = new Error('MFA challenge token is required');
      error.statusCode = 400;
      throw error;
    }
    if (!code) {
      const error = new Error('TOTP code is required');
      error.statusCode = 400;
      throw error;
    }

    let decoded;
    try {
      decoded = verifyMfaChallengeToken(mfaToken);
    } catch (err) {
      const error = new Error('Invalid or expired MFA challenge token');
      error.statusCode = 401;
      throw error;
    }

    const challenge = await MfaChallenge.findOne({ challengeId: decoded.jti });
    if (!challenge || challenge.userId.toString() !== decoded.sub) {
      const error = new Error('Invalid MFA challenge');
      error.statusCode = 401;
      throw error;
    }

    if (challenge.expiresAt < new Date()) {
      const error = new Error('MFA challenge has expired. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    if (challenge.consumed) {
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      const error = new Error('Maximum MFA verification attempts exceeded. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

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
    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      const error = new Error('Your account has been revoked. Please contact administration.');
      error.statusCode = 403;
      throw error;
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      const error = new Error('MFA is not enabled for this account');
      error.statusCode = 400;
      throw error;
    }

    const secret = mfaUtil.decryptSecret(user.mfaSecret);
    const isValid = mfaUtil.verifyTotp(code, secret);

    if (!isValid) {
      challenge.attempts += 1;
      await challenge.save();

      await AuditLog.create({
        userId: user._id,
        action: 'MFA_VERIFY_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, attempts: challenge.attempts, challengeId: challenge.challengeId },
        ipAddress,
      });

      const remaining = challenge.maxAttempts - challenge.attempts;
      const error = new Error(
        remaining > 0
          ? `Invalid TOTP verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Challenge locked. Please sign in again.'
      );
      error.statusCode = 401;
      throw error;
    }

    // Atomically consume challenge to prevent race conditions & double-use
    const consumedChallenge = await MfaChallenge.findOneAndUpdate(
      { challengeId: decoded.jti, consumed: false, attempts: { $lt: challenge.maxAttempts } },
      { $set: { consumed: true, consumedAt: new Date() } },
      { new: true }
    );
    if (!consumedChallenge) {
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    user.lastLoginAt = new Date();
    user.mfaLastUsedAt = new Date();
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGIN_MFA_SUCCESS',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role, method: 'totp' },
      ipAddress,
    });

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: this._formatUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  async redeemMfaRecoveryCode({ mfaToken, recoveryCode, ipAddress = null }) {
    if (!mfaToken) {
      const error = new Error('MFA challenge token is required');
      error.statusCode = 400;
      throw error;
    }
    if (!recoveryCode) {
      const error = new Error('Recovery code is required');
      error.statusCode = 400;
      throw error;
    }

    let decoded;
    try {
      decoded = verifyMfaChallengeToken(mfaToken);
    } catch (err) {
      const error = new Error('Invalid or expired MFA challenge token');
      error.statusCode = 401;
      throw error;
    }

    const challenge = await MfaChallenge.findOne({ challengeId: decoded.jti });
    if (!challenge || challenge.userId.toString() !== decoded.sub) {
      const error = new Error('Invalid MFA challenge');
      error.statusCode = 401;
      throw error;
    }

    if (challenge.expiresAt < new Date()) {
      const error = new Error('MFA challenge has expired. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    if (challenge.consumed) {
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      const error = new Error('Maximum MFA verification attempts exceeded. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

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
    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      const error = new Error('Your account has been revoked. Please contact administration.');
      error.statusCode = 403;
      throw error;
    }

    if (!user.mfaEnabled) {
      const error = new Error('MFA is not enabled for this account');
      error.statusCode = 400;
      throw error;
    }

    const hashedInput = mfaUtil.hashRecoveryCode(recoveryCode);
    const matchedCode = user.mfaRecoveryCodes.find((c) => c.codeHash === hashedInput);

    if (!matchedCode || matchedCode.used) {
      challenge.attempts += 1;
      await challenge.save();

      await AuditLog.create({
        userId: user._id,
        action: 'MFA_RECOVERY_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, attempts: challenge.attempts, challengeId: challenge.challengeId },
        ipAddress,
      });

      const remaining = challenge.maxAttempts - challenge.attempts;
      const error = new Error(
        remaining > 0
          ? `Invalid or already used recovery code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Challenge locked. Please sign in again.'
      );
      error.statusCode = 401;
      throw error;
    }

    // Atomically consume challenge to prevent race conditions & double-use
    const consumedChallenge = await MfaChallenge.findOneAndUpdate(
      { challengeId: decoded.jti, consumed: false, attempts: { $lt: challenge.maxAttempts } },
      { $set: { consumed: true, consumedAt: new Date() } },
      { new: true }
    );
    if (!consumedChallenge) {
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    matchedCode.used = true;
    matchedCode.usedAt = new Date();

    user.lastLoginAt = new Date();
    user.mfaLastUsedAt = new Date();
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'MFA_RECOVERY_CODE_USED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role },
      ipAddress,
    });

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: this._formatUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  async disableMfa({ userId, password, code, ipAddress = null }) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (!user.mfaEnabled) {
      const error = new Error('MFA is not enabled for this account');
      error.statusCode = 400;
      throw error;
    }

    // Require password check if local/both, or TOTP code if Google-only or provided
    if (user.password) {
      if (!password) {
        const error = new Error('Current password is required to disable MFA');
        error.statusCode = 400;
        throw error;
      }
      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        const error = new Error('Incorrect password');
        error.statusCode = 401;
        throw error;
      }
    } else {
      if (!code) {
        const error = new Error('TOTP code is required to disable MFA for Google accounts');
        error.statusCode = 400;
        throw error;
      }
      const secret = mfaUtil.decryptSecret(user.mfaSecret);
      const isValid = mfaUtil.verifyTotp(code, secret);
      if (!isValid) {
        const error = new Error('Invalid TOTP verification code');
        error.statusCode = 401;
        throw error;
      }
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaPendingSecret = null;
    user.mfaRecoveryCodes = [];
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate previously issued sessions
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'MFA_DISABLED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email },
      ipAddress,
    });

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      studentId: user.studentId,
      facultyId: user.facultyId,
      adminId: user.adminId,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      message: 'Two-factor authentication has been disabled successfully',
      accessToken,
      refreshToken,
    };
  }

  async regenerateRecoveryCodes({ userId, password, code, ipAddress = null }) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      const error = new Error('MFA must be enabled to regenerate recovery codes');
      error.statusCode = 400;
      throw error;
    }

    if (user.password) {
      if (!password) {
        const error = new Error('Current password is required to regenerate recovery codes');
        error.statusCode = 400;
        throw error;
      }
      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        const error = new Error('Incorrect password');
        error.statusCode = 401;
        throw error;
      }
    } else {
      if (!code) {
        const error = new Error('TOTP code is required to regenerate recovery codes');
        error.statusCode = 400;
        throw error;
      }
      const secret = mfaUtil.decryptSecret(user.mfaSecret);
      if (!mfaUtil.verifyTotp(code, secret)) {
        const error = new Error('Invalid TOTP verification code');
        error.statusCode = 401;
        throw error;
      }
    }

    const recoveryCodes = mfaUtil.generateRecoveryCodes(8);
    user.mfaRecoveryCodes = recoveryCodes.map((c) => ({
      codeHash: mfaUtil.hashRecoveryCode(c),
      used: false,
      usedAt: null,
    }));
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'MFA_RECOVERY_CODES_REGENERATED',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email },
      ipAddress,
    });

    return {
      message: 'Recovery codes regenerated successfully',
      recoveryCodes,
    };
  }

  async refreshAccessToken({ refreshToken, ipAddress = null }) {
    if (!refreshToken) {
      const error = new Error('Refresh token is required');
      error.statusCode = 400;
      throw error;
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Refresh token has expired'
        : (err.statusCode === 401 && err.message ? err.message : 'Invalid refresh token');
      const error = new Error(message);
      error.statusCode = 401;
      throw error;
    }

    if (decoded.type && decoded.type !== 'refresh') {
      const error = new Error('Invalid token type for refresh');
      error.statusCode = 401;
      throw error;
    }

    const userId = decoded.id || decoded.sub;
    if (!userId) {
      const error = new Error('Invalid refresh token payload');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    if (user.status !== 'active' || !user.isActive) {
      let message;
      if (user.status === 'revoked') {
        message = 'Account has been revoked. Access denied.';
      } else if (user.status === 'rejected') {
        message = 'Account application was rejected. Access denied.';
      } else if (!user.isActive && user.status === 'active') {
        message = 'Account is deactivated.';
      } else {
        message = `Account status is ${user.status}. Access denied.`;
      }
      const error = new Error(message);
      error.statusCode = 401;
      throw error;
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      const error = new Error('Session has expired or been invalidated. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      studentId: user.studentId,
      facultyId: user.facultyId,
      adminId: user.adminId,
      tokenVersion: user.tokenVersion || 0,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await AuditLog.create({
      userId: user._id,
      action: 'TOKEN_REFRESH_SUCCESS',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role },
      ipAddress,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: this._formatUserProfile(user),
    };
  }
}

module.exports = new AuthService();
