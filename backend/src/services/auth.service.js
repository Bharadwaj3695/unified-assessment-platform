// Destructure MongoDB database models for users, logs, notifications, settings, challenges, registries, reset tokens, and sessions
const { User, AuditLog, Notification, SystemSetting, MfaChallenge, StudentRegistry, PasswordResetToken, Session } = require('../models');
// Import password hashing and comparison utility functions based on bcrypt
const { hashPassword, comparePassword } = require('../utils/password');
// Destructure JSON Web Token utility helper functions for access, refresh, and MFA tokens
const {
  // Generates short-lived access JWT token
  generateAccessToken,
  // Generates long-lived refresh JWT token
  generateRefreshToken,
  // Generates signed challenge token for two-factor authentication verification
  generateMfaChallengeToken,
  // Verifies and decodes incoming two-factor challenge token
  verifyMfaChallengeToken,
  // Verifies and decodes incoming refresh JWT token
  verifyRefreshToken,
} = require('../utils/jwt');
// Import unique academic identifier generators for students and faculty
const { generateStudentId, generateFacultyId } = require('../utils/idGenerator');
// Import email service for dispatching transactional, verification, and alert emails
const emailService = require('./email.service');
// Import Google OAuth 2.0 verification and domain validation service
const googleAuthService = require('./googleAuth.service');
// Import two-factor authentication utilities (TOTP secrets, QR codes, recovery codes)
const mfaUtil = require('../utils/mfa');
// Import Winston application logger for system logging
const logger = require('../utils/logger');
// Import built-in Node.js crypto module for cryptographically secure random bytes and UUIDs
const crypto = require('crypto');
// Environment config (email OTP feature flag)
const env = require('../config/env');

// Email OTP policy: resend cooldown, max sends per MFA challenge, and code lifetime
const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_OTP_MAX_SENDS = 5;
const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;

// Masks an email address for display (e.g. jo***@example.edu)
function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
// Import AES-256-GCM recovery encryption and token hashing utilities
const { encryptRecoveryToken, decryptRecoveryToken, hashToken } = require('../utils/sessionCrypto');

// Define AuthService class encapsulating authentication, registration, MFA, and session logic
class AuthService {
  // Private helper method to generate and persist a short-lived MFA challenge for two-step verification
  async _createMfaChallenge(userId) {
    // Generate a unique cryptographically secure UUID string for the challenge
    const challengeId = crypto.randomUUID();
    // Compute SHA-256 cryptographic hash of the challenge identifier
    const challengeHash = mfaUtil.hashMfaChallenge(challengeId);
    // Define challenge time-to-live duration as 5 minutes in milliseconds
    const ttlMs = 5 * 60 * 1000; // 5 minutes
    // Compute expiration Date object by adding TTL to current timestamp
    const expiresAt = new Date(Date.now() + ttlMs);

    // Persist new MfaChallenge document to MongoDB storing ONLY the cryptographic hash
    await MfaChallenge.create({
      // Assign the cryptographic challenge hash
      challengeHash,
      // Associate with target user primary key
      userId,
      // Flag indicating challenge has not been consumed yet
      consumed: false,
      // Initialize failed verification attempt counter to 0
      attempts: 0,
      // Define maximum allowed verification attempts before locking
      maxAttempts: 5,
      // Set expiration timestamp
      expiresAt,
    });

    // Generate signed JWT MFA challenge token encoding the user ID and challenge ID
    const mfaToken = generateMfaChallengeToken({ userId, challengeId });
    // Return challenge ID, challenge hash, signed JWT challenge token, and expiration timestamp
    return { challengeId, challengeHash, mfaToken, expiresAt };
  }

  // Internal helper to create and persist an active session document
  async _createSession(user, refreshToken, ipAddress = null, userAgent = null) {
    if (!refreshToken) return null;
    const familyId = crypto.randomUUID();
    const currentTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return await Session.create({
      familyId,
      userId: user._id,
      currentTokenHash,
      recentRotations: [],
      historicalRevokedHashes: [],
      status: 'active',
      version: 0,
      ipAddress,
      userAgent,
      lastActiveAt: new Date(),
      expiresAt,
    });
  }

  // Private helper method to format and sanitize user document for client responses
  _formatUserProfile(user) {
    // Return sanitized object omitting sensitive authentication secrets
    return {
      // String representation of user MongoDB ObjectId
      id: user._id.toString(),
      // User display name
      name: user.name,
      // User registered email address
      email: user.email,
      // User authorization role (student, instructor, admin)
      role: user.role,
      // User account status (active, pending, rejected, revoked)
      status: user.status,
      // Active status boolean flag
      isActive: user.isActive,
      // Avatar image URL or null
      avatar: user.avatar,
      // User biography text or null
      bio: user.bio,
      // Academic department affiliation
      department: user.department,
      // Student institutional identifier
      studentId: user.studentId,
      // Format date of birth to YYYY-MM-DD ISO string if present
      dateOfBirth: user.dateOfBirth
        ? (user.dateOfBirth instanceof Date ? user.dateOfBirth.toISOString().slice(0, 10) : user.dateOfBirth)
        : null,
      // Faculty institutional identifier
      facultyId: user.facultyId,
      // Administrator identifier
      adminId: user.adminId,
      // Academic subject identifier
      subjectId: user.subjectId,
      // Academic subject title
      subjectName: user.subjectName,
      // Subject syllabus description
      subjectDescription: user.subjectDescription,
      // Authentication provider type (local, google, both)
      authProvider: user.authProvider,
      // Boolean flag indicating if two-factor authentication is active
      mfaEnabled: Boolean(user.mfaEnabled),
    };
  }

  // Method to handle user registration with automatic registry verification or admin approval queue
  async register({
    // User full name
    name,
    // User email address
    email,
    // Plaintext password
    password,
    // Password confirmation string
    confirmPassword = null,
    // Requested role defaulting to student
    role = 'student',
    // Optional student institutional ID
    studentId = null,
    // Optional date of birth
    dateOfBirth = null,
    // Optional institutional code
    instituteCode = null,
    // Optional client IP address for audit tracking
    ipAddress = null,
  }) {
    // Guard against public registration of administrator accounts
    if (role === 'admin') {
      // Create forbidden error instance
      const error = new Error('Public registration cannot create an Administrator account.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify password confirmation matches password
    if (confirmPassword && password !== confirmPassword) {
      // Create bad request error for mismatched passwords
      const error = new Error('Passwords do not match');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Retrieve system settings to verify registration status
    const setting = await SystemSetting.findOne();
    // Check if administrator has disabled public registrations
    if (setting && setting.registrationOpen === false) {
      // Create forbidden error indicating registration is closed
      const error = new Error('User registration is currently closed by the platform administrator.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Restrict assignable role to either instructor or student
    const assignedRole = role === 'instructor' ? 'instructor' : 'student';
    // Normalize email to lowercase trimmed string
    const normalizedEmail = (email || '').trim().toLowerCase();
    // Normalize student ID to uppercase trimmed string or null
    const normalizedStudentId = studentId ? studentId.trim().toUpperCase() : null;

    // Check if User account already exists by email
    // Query database for an existing user account with the normalized email
    const existingUser = await User.findOne({ email: normalizedEmail });
    // If email already exists, throw conflict error
    if (existingUser) {
      // Create conflict error message
      const error = new Error('Email is already registered');
      // Set HTTP status code 409 Conflict
      error.statusCode = 409;
      // Throw the conflict error
      throw error;
    }

    // Check if User account already exists by studentId (prevent duplicate account creation)
    // If student ID was provided, check if it is already claimed by an existing user account
    if (normalizedStudentId) {
      // Query User collection by studentId
      const existingStudent = await User.findOne({ studentId: normalizedStudentId });
      // If studentId already claimed, throw conflict error
      if (existingStudent) {
        // Create duplicate student ID error message
        const error = new Error('An account with this Student ID is already registered');
        // Set HTTP status code 409 Conflict
        error.statusCode = 409;
        // Throw the conflict error
        throw error;
      }
    }

    // Hash the plaintext password securely using bcrypt
    const hashedPassword = await hashPassword(password);

    // =========================================================================
    // STUDENT REGISTRATION: Master Registry Verification Workflow
    // =========================================================================
    // Check if applicant is registering for student role
    if (assignedRole === 'student') {
      // Initialize boolean tracking verification status against master registry
      let isVerified = false;
      // Initialize variable holding matched master registry record
      let registryRecord = null;

      // Check if all four required academic identity fields are present
      if (normalizedStudentId && name && dateOfBirth && normalizedEmail) {
        // Attempt automated verification against StudentRegistry collection
        const verification = await StudentRegistry.verifyStudent({
          // Normalized student identifier
          studentId: normalizedStudentId,
          // Provided s830tudent name
          name,
          // Provided date of birth
          dateOfBirth,
          // Normalized email address
          email: normalizedEmail,
        });

        // If verification succeeded against master registry
        if (verification.verified) {
          // Flag student as verified
          isVerified = true;
          // Store matched registry record
          registryRecord = verification.record;
        }
      }

      // If student is verified against institutional master registry
      if (isVerified && registryRecord) {
        // MATCHED STUDENT FLOW:
        // Automatically create active account without requiring manual admin approval.
        // Construct user document data for verified student
        const userData = {
          // Use official registry name
          name: registryRecord.name,
          // Normalized email address
          email: normalizedEmail,
          // Hashed password
          password: hashedPassword,
          // Student role
          role: 'student',
          // Active status
          status: 'active',
          // Active boolean true
          isActive: true,
          // Timestamp of automated approval
          approvedAt: new Date(),
          // Official student ID from registry
          studentId: registryRecord.studentId,
          // Official date of birth from registry
          dateOfBirth: registryRecord.dateOfBirth,
          // Assigned department
          department: 'Computer Science',
          // Optional trimmed institute code
          instituteCode: instituteCode ? instituteCode.trim() : null,
        };

        // Persist newly created active student user document
        const user = await User.create(userData);

        // Record audit log for verified registration
        await AuditLog.create({
          // Newly created user ID
          userId: user._id,
          // Action type identifier
          action: 'USER_REGISTER_VERIFIED',
          // Target entity model type
          entityType: 'User',
          // Target entity ID
          entityId: user._id.toString(),
          // Verification metadata details
          details: {
            // User registered email
            email: user.email,
            // User student ID
            studentId: user.studentId,
            // Flag indicating verification via registry
            verifiedViaRegistry: true,
            // Account status
            status: 'active',
          },
          // Client IP address
          ipAddress,
        });

        // Send welcome / account approved email & create in-app notification
        try {
          // Send account approved notification email to student
          await emailService.sendAccountApprovedEmail(user);
          // Create in-app system notification for the user
          await Notification.create({
            // Target user ID
            userId: user._id,
            // Notification title
            title: 'Academic Identity Verified',
            // Notification message body
            message: 'Your student identity has been verified via the institution master registry. Your account is active.',
            // System notification category
            type: 'system',
            // Redirection link
            link: '/auth/login',
          });
        } catch (emailErr) {
          // Log non-fatal notification error without breaking registration
          console.warn('[AuthService] Non-fatal notification error during verified student registration:', emailErr.message);
        }

        // Return registration success response for verified student
        return {
          // Success message
          message: 'Registration successful! Your academic identity has been verified and your account is active.',
          // Active status string
          status: 'active',
          // Verification flag true
          verified: true,
          // Sanitized user details object
          user: {
            // Serialized MongoDB ID string
            id: user._id.toString(),
            // Student name
            name: user.name,
            // Student email
            email: user.email,
            // User role
            role: user.role,
            // User status
            status: user.status,
            // Student institutional ID
            studentId: user.studentId,
          },
        };
      }

      // NON-MATCHED STUDENT FLOW:
      // Academic details could not be verified automatically.
      // Account created with 'pending' status for admin approval.
      // Return generic message to prevent account/identity enumeration.
      // Construct user document data for unverified student applicant
      const userData = {
        // Cleaned name with normalized whitespace
        name: (name || '').trim().replace(/\s+/g, ' '),
        // Normalized email address
        email: normalizedEmail,
        // Hashed password
        password: hashedPassword,
        // Student role
        role: 'student',
        // Pending approval status
        status: 'pending',
        // Deactivated until approved
        isActive: false,
        // Use provided student ID or auto-generate fallback ID
        studentId: normalizedStudentId || (await generateStudentId()),
        // Parsed date of birth Date object or null
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        // Assigned department
        department: 'Computer Science',
        // Optional trimmed institute code
        instituteCode: instituteCode ? instituteCode.trim() : null,
      };

      // Persist pending student user document
      const user = await User.create(userData);

      // Record audit log for unverified student registration
      await AuditLog.create({
        // Newly created user ID
        userId: user._id,
        // Action type identifier
        action: 'USER_REGISTER',
        // Target entity model type
        entityType: 'User',
        // Target entity ID
        entityId: user._id.toString(),
        // Registration metadata details
        details: {
          // Applicant email
          email: user.email,
          // Requested role
          requestedRole: 'student',
          // Pending status
          status: 'pending',
          // Flag indicating unverified against registry
          verifiedViaRegistry: false,
        },
        // Client IP address
        ipAddress,
      });

      // Send pending registration notification to applicant & alert admins
      try {
        // Send email informing student applicant that registration is pending review
        await emailService.sendPendingRegistrationEmail(user);
        // Find all active system administrators
        const admins = await User.find({ role: 'admin', status: 'active' });
        // If active admins exist, alert them of the new applicant
        if (admins.length > 0) {
          // Send notification email to administrators
          await emailService.sendAdminNewApplicantAlert(admins, user);
          // Loop through each administrator to create in-app notification
          for (const admin of admins) {
            // Create in-app system notification for administrator
            await Notification.create({
              // Target admin user ID
              userId: admin._id,
              // Notification title
              title: 'New Applicant Pending',
              // Notification message body
              message: `${user.name} (${user.email}) submitted a registration application for role "${user.role}".`,
              // System notification category
              type: 'system',
              // Link to admin pending applicant view with authoritative applicant ID
              link: `/admin/users?applicantId=${user._id}`,
            });
          }
        }
      } catch (emailErr) {
        // Log non-fatal error without breaking registration
        console.warn('[AuthService] Non-fatal notification error during registration:', emailErr.message);
      }

      // Return pending registration response
      return {
        // Message explaining pending review status
        message: 'Your academic details could not be verified. Your registration has been submitted and is pending administrator review.',
        // Pending status string
        status: 'pending',
        // Verification flag false
        verified: false,
        // Sanitized user summary object
        user: {
          // Serialized ID string
          id: user._id.toString(),
          // Student name
          name: user.name,
          // Student email
          email: user.email,
          // User role
          role: user.role,
          // User status
          status: user.status,
          // Student ID
          studentId: user.studentId,
        },
      };
    }

    // =========================================================================
    // INSTRUCTOR REGISTRATION: Existing Administrative Approval Workflow
    // =========================================================================
    // Construct user document data for instructor applicant
    const userData = {
      // Cleaned name with normalized whitespace
      name: (name || '').trim().replace(/\s+/g, ' '),
      // Normalized email address
      email: normalizedEmail,
      // Hashed password
      password: hashedPassword,
      // Instructor role
      role: 'instructor',
      // Pending status awaiting approval
      status: 'pending',
      // Inactive until approved
      isActive: false,
      // Optional trimmed institute code
      instituteCode: instituteCode ? instituteCode.trim() : null,
      // Auto-generate unique faculty ID
      facultyId: await generateFacultyId(),
      // Assigned department
      department: 'Computer Science & Engineering',
      // Default subject ID assignment
      subjectId: 'CS-101',
      // Default subject title
      subjectName: 'Algorithmic Foundations & Systems',
      // Default subject description
      subjectDescription: 'Academic curriculum, system architecture, and assessment oversight.',
    };

    // Persist pending instructor user document
    const user = await User.create(userData);

    // Record audit log for instructor registration
    await AuditLog.create({
      // Newly created user ID
      userId: user._id,
      // Action type identifier
      action: 'USER_REGISTER',
      // Target entity model type
      entityType: 'User',
      // Target entity ID
      entityId: user._id.toString(),
      // Metadata recording registration request details
      details: { email: user.email, requestedRole: 'instructor', status: 'pending' },
      // Client IP address
      ipAddress,
    });

    try {
      // Send pending registration confirmation email to instructor applicant
      await emailService.sendPendingRegistrationEmail(user);
      // Query active administrators to receive review alert
      const admins = await User.find({ role: 'admin', status: 'active' });
      // If active admins exist, alert them
      if (admins.length > 0) {
        // Dispatch alert email to all active admins
        await emailService.sendAdminNewApplicantAlert(admins, user);
        // Loop through each administrator to create an in-app notification
        for (const admin of admins) {
          // Persist in-app notification document
          await Notification.create({
            // Target admin ID
            userId: admin._id,
            // Notification title
            title: 'New Applicant Pending',
            // Notification message body
            message: `${user.name} (${user.email}) submitted a registration application for role "${user.role}".`,
            // System category
            type: 'system',
            // Navigation link to admin pending applicant view with applicant ID
            link: `/admin/users?applicantId=${user._id}`,
          });
        }
      }
    } catch (emailErr) {
      // Log non-fatal notification error without breaking registration
      console.warn('[AuthService] Non-fatal notification error during registration:', emailErr.message);
    }

    // Return pending registration response for instructor applicant
    return {
      // Informational message
      message: 'Registration submitted successfully. Your account is pending administrator approval.',
      // Pending status string
      status: 'pending',
      // Sanitized user details object
      user: {
        // Serialized ID string
        id: user._id.toString(),
        // Instructor name
        name: user.name,
        // Instructor email
        email: user.email,
        // User role
        role: user.role,
        // User status
        status: user.status,
      },
    };
  }

  // Method to authenticate user with email and password credentials
  async login({ email, password, ipAddress = null, userAgent = null }) {
    // Find user by normalized lowercase email
    const user = await User.findOne({ email: email.toLowerCase() });
    // If no user document found with given email
    if (!user) {
      // Record audit log for failed login attempt due to unknown user
      await AuditLog.create({
        // Null user ID
        userId: null,
        // Action type identifier
        action: 'LOGIN_FAILED',
        // Target entity model type
        entityType: 'User',
        // Metadata recording reason
        details: { email: email.toLowerCase(), reason: 'User not found' },
        // Client IP address
        ipAddress,
      });
      // Create unauthorized error instance with generic message to prevent email enumeration
      const error = new Error('Invalid email or password');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the authentication error
      throw error;
    }

    // If account was created through Google OAuth without local password
    if (!user.password) {
      // Create error informing user to authenticate via Google
      const error = new Error('This account was created with Google Sign-In. Please sign in with Google.');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Compare supplied plaintext password against stored bcrypt hash
    const isMatch = await comparePassword(password, user.password);
    // If password does not match
    if (!isMatch) {
      // Record audit log for failed login attempt due to incorrect password
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'LOGIN_FAILED',
        // Target entity model type
        entityType: 'User',
        // Entity primary key string
        entityId: user._id.toString(),
        // Metadata recording failure reason
        details: { email: user.email, reason: 'Incorrect password' },
        // Client IP address
        ipAddress,
      });
      // Create unauthorized error instance with generic message
      const error = new Error('Invalid email or password');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the authentication error
      throw error;
    }

    // Account status verification
    // Verify user account is not pending administrator approval
    if (user.status === 'pending') {
      // Create forbidden error for pending account
      const error = new Error('Your account is pending administrator approval.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify user account application was not rejected
    if (user.status === 'rejected') {
      // Create forbidden error containing optional rejection reason
      const error = new Error(
        `Your account registration was rejected${user.rejectionReason ? ': ' + user.rejectionReason : '. Please contact administration.'}`
      );
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify user account is active and has not been revoked
    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      // Record audit log for unauthorized login attempt on revoked account
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'REVOKED_USER_LOGIN_ATTEMPT',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Metadata recording reason
        details: { email: user.email, reason: 'Revoked account access attempt' },
        // Client IP address
        ipAddress,
      });
      // Create forbidden error for revoked account
      const error = new Error('Your account has been revoked. Please contact administration.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Check if two-factor authentication is enabled for this user
    if (user.mfaEnabled) {
      // Generate and persist short-lived MFA challenge token
      const challenge = await this._createMfaChallenge(user._id);
      // Record audit log for MFA challenge issuance
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'MFA_CHALLENGE_ISSUED',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Metadata detailing MFA challenge
        details: { email: user.email, authMethod: 'password' },
        // Client IP address
        ipAddress,
      });


      // Return challenge response prompting client for second factor code
      return {
        // Flag indicating MFA verification step is required
        mfaRequired: true,
        // Signed JWT challenge token
        mfaToken: challenge.mfaToken,
        // Basic user identification object
        user: {
          // User ID string
          id: user._id.toString(),
          // User email
          email: user.email,
          // User role
          role: user.role,
        },
      };
    }

    // Record last login timestamp on user document
    user.lastLoginAt = new Date();
    // Persist login timestamp to database
    await user.save();

    // Record audit log for successful login
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'USER_LOGIN',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Login details metadata
      details: { email: user.email, role: user.role },
      // Client IP address
      ipAddress,
    });

    // Construct JWT claims payload
    const tokenPayload = {
      // User primary key string
      id: user._id.toString(),
      // User authorization role
      role: user.role,
      // User email address
      email: user.email,
      // Token version number for revocation tracking
      tokenVersion: user.tokenVersion || 0,
    };
    // Generate signed short-lived access JWT token
    const accessToken = generateAccessToken(tokenPayload);
    // Generate signed long-lived refresh JWT token
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create and persist active Session document in MongoDB
    await this._createSession(user, refreshToken, ipAddress, userAgent);

    // Return authenticated user profile and tokens
    return {
      // Sanitized user profile object
      user: this._formatUserProfile(user),
      // Access JWT token
      accessToken,
      // Refresh JWT token
      refreshToken,
    };
  }

  // Method to update user password after verifying current credentials
  async changePassword(userId, currentPassword, newPassword) {
    // Find user document by primary key ID
    const user = await User.findById(userId);
    // If user not found, throw 404 error
    if (!user) {
      // Create not found error instance
      const error = new Error('User not found');
      // Set HTTP status code 404 Not Found
      error.statusCode = 404;
      // Throw the error
      throw error;
    }

    // Verify current password matches stored hash
    const isMatch = await comparePassword(currentPassword, user.password);
    // If current password does not match
    if (!isMatch) {
      // Create bad request error for incorrect current password
      const error = new Error('Incorrect current password');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Hash the new password securely
    user.password = await hashPassword(newPassword);
    // Increment tokenVersion to invalidate any existing sessions/tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    // Save updated password and token version to database
    await user.save();

    // Revoke all active sessions for this user in MongoDB
    await Session.updateMany(
      { userId: user._id, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: 'password_changed',
        },
      }
    );

    // Record audit log for password change event
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'PASSWORD_CHANGED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
    });

    // Return success confirmation message
    return { message: 'Password updated successfully' };
  }

  // Method to initiate password recovery workflow and dispatch reset token email
  async forgotPassword(email) {
    // Normalize email to lowercase trimmed string
    const normalizedEmail = (email || '').trim().toLowerCase();
    // Return early with generic message if email is blank
    if (!normalizedEmail) {
      // Generic response message to avoid revealing account status
      return {
        // Neutral response text
        message: 'If an account exists with that email address, password reset instructions have been sent.',
      };
    }

    // Query user by normalized email
    let user = await User.findOne({ email: normalizedEmail });
    // Support fallback lookup for gmail addresses with dot variations
    if (!user && normalizedEmail.includes('@gmail.com')) {
      const parts = normalizedEmail.split('@');
      const dotPattern = parts[0].replace(/\./g, '').split('').join('\\.?');
      const dotRegex = new RegExp(`^${dotPattern}@gmail\\.com$`, 'i');
      user = await User.findOne({ email: { $regex: dotRegex } });
    }
    // Generic response if user does not exist or is revoked to prevent account enumeration
    // Check if user is missing or account has been revoked
    if (!user || user.status === 'revoked') {
      // Log notice for monitoring without revealing information to client
      logger.info(`[AuthService] Password recovery requested for non-existent or inactive email.`);
      // Return identical generic response to prevent email enumeration
      return {
        // Neutral response text
        message: 'If an account exists with that email address, password reset instructions have been sent.',
      };
    }

    // 1. Generate cryptographically secure random token (32 bytes = 64 hex chars)
    // Generate 32 bytes of secure random data converted to hex string
    const rawToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash token for secure persistence (SHA-256)
    // Hash raw token with SHA-256 for secure database storage
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 3. Set expiry to 1 hour (3600000 ms)
    // Define 1 hour TTL duration in milliseconds
    const ttlMs = 60 * 60 * 1000;
    // Compute expiration Date object
    const expiresAt = new Date(Date.now() + ttlMs);

    // Invalidate any previous unconsumed password reset tokens for this user
    // Mark previous active tokens as consumed to enforce single active recovery link
    await PasswordResetToken.updateMany(
      // Match active unconsumed tokens for this user
      { userId: user._id, consumed: false },
      // Set consumed flag true and record timestamp
      { consumed: true, consumedAt: new Date() }
    );

    // 4. Persist hashed token
    // Save new PasswordResetToken document with hashed token
    await PasswordResetToken.create({
      // Stored SHA-256 hash
      tokenHash,
      // Associated user ID
      userId: user._id,
      // Initial unconsumed state
      consumed: false,
      // Expiration timestamp
      expiresAt,
    });

    // 5. Send recovery email (do NOT log the raw token or secrets!)
    try {
      // Dispatch password reset email containing the raw token link to the user
      const mailResult = await emailService.sendPasswordResetEmail(user, rawToken);
      // Check if email sending failed
      if (!mailResult.success) {
        // Log error with reason
        logger.error(`[AuthService] Failed to deliver password recovery email: ${mailResult.error || 'Unknown error'}`);
      } else {
        // Log success message
        logger.info(`[AuthService] Password recovery email dispatched successfully.`);
      }
    } catch (mailErr) {
      // Log exception during email dispatch
      logger.error(`[AuthService] Exception while sending password reset email: ${mailErr.message || mailErr}`);
    }

    // 6. Audit log
    // Record audit log for password reset request
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'PASSWORD_RESET_REQUESTED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
    });

    // 7. Generic response to avoid account enumeration
    // Return standard generic response message
    return {
      // Neutral response text
      message: 'If an account exists with that email address, password reset instructions have been sent.',
    };
  }

  // Method to complete password reset using valid recovery token
  async resetPassword({ token, password, confirmPassword = null }) {
    // Validate that reset token is a non-empty string
    if (!token || typeof token !== 'string') {
      // Create bad request error for missing token
      const err = new Error('Reset token is required');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the error
      throw err;
    }

    // Validate that password confirmation matches new password
    if (confirmPassword && password !== confirmPassword) {
      // Create bad request error for mismatched passwords
      const err = new Error('Passwords do not match');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the error
      throw err;
    }

    // Hash incoming token to match against stored hash
    // Compute SHA-256 hash of incoming raw token
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Query PasswordResetToken collection by tokenHash
    const resetRecord = await PasswordResetToken.findOne({ tokenHash });
    // If token record does not exist
    if (!resetRecord) {
      // Create error for invalid token
      const err = new Error('Invalid or expired password reset link. Please request a new recovery link.');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the error
      throw err;
    }

    // Verify token has not already been used
    if (resetRecord.consumed) {
      // Create error for consumed token
      const err = new Error('This password reset link has already been used. Please request a new one.');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the error
      throw err;
    }

    // Verify token expiration time has not passed
    if (new Date() > resetRecord.expiresAt) {
      // Create error for expired token
      const err = new Error('Password reset link has expired. Please request a new recovery link.');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the error
      throw err;
    }

    // Retrieve user associated with reset token
    const user = await User.findById(resetRecord.userId);
    // If user record no longer exists
    if (!user) {
      // Create not found error for deleted user account
      const err = new Error('Associated user account no longer exists.');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the error
      throw err;
    }

    // Update password
    // Hash new password using bcrypt and store on user
    user.password = await hashPassword(password);
    // Invalidate existing sessions/JWT tokens
    // Increment tokenVersion to revoke all active JWT sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    // Save updated password and token version to database
    await user.save();

    // Revoke all active sessions for this user in MongoDB
    await Session.updateMany(
      { userId: user._id, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: 'password_reset',
        },
      }
    );

    // Consume the token (single use)
    // Mark the reset token as consumed
    resetRecord.consumed = true;
    // Record consumption timestamp
    resetRecord.consumedAt = new Date();
    // Save token document updates
    await resetRecord.save();

    // Invalidate any other active reset tokens for this user
    // Mark all remaining unconsumed tokens for this user as consumed
    await PasswordResetToken.updateMany(
      // Match active unconsumed tokens for user
      { userId: user._id, consumed: false },
      // Update consumed state and timestamp
      { consumed: true, consumedAt: new Date() }
    );

    // Audit Log
    // Record audit log for completed password reset
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'PASSWORD_RESET_COMPLETED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
    });

    // Log completion notice
    logger.info(`[AuthService] Password reset successfully completed.`);

    // Return success response message
    return {
      // User confirmation text
      message: 'Your password has been reset successfully. You may now sign in with your new credentials.',
    };
  }

  // Method to handle authentication via Google OAuth 2.0 / OpenID Connect
  async googleLogin({ code, state, idToken, credential, ipAddress = null }) {
    // 1. Verify identity through Google OAuth 2.0 / OpenID Connect service
    // Exchange or verify Google credentials and obtain token payload
    const googlePayload = await googleAuthService.verifyGoogleIdentity({ code, state, idToken, credential });

    // Extract unique Google subject identifier
    const googleId = googlePayload.sub;
    // Extract and normalize Google account email
    const email = googlePayload.email ? googlePayload.email.toLowerCase().trim() : null;
    // Extract display name or derive default name from email prefix
    const name = googlePayload.name || (email ? email.split('@')[0] : 'User');
    // Extract avatar picture URL or null
    const avatar = googlePayload.picture || null;

    // Validate presence of Google subject identifier
    if (!googleId) {
      // Create validation error for missing Google ID
      const error = new Error('Invalid Google identity: missing subject identifier (sub)');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Validate presence of email address
    if (!email) {
      // Create validation error for missing email address
      const error = new Error('Invalid Google identity: missing email address');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Verify email address has been verified by Google
    if (!googlePayload.email_verified) {
      // Create error rejecting unverified Google email accounts
      const error = new Error('Unverified Google email. Only verified Google accounts are permitted.');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // 2. Validate institutional domain if configured (Part 7)
    // Enforce institutional domain policy against email domain if configured
    googleAuthService.validateDomain(email);

    // 3. Search for existing user: first by googleId, then by email (Part 2 & 3)
    // Query database for user with matching googleId
    let user = await User.findOne({ googleId });

    // If user not found by googleId, attempt lookup by verified email
    if (!user) {
      // Check if existing user has the same verified email
      // Query User collection by normalized email
      user = await User.findOne({ email });

      // If existing user account exists with this email, link Google ID
      if (user) {
        // PART 3: EXISTING USER LINKING
        // Link Google authentication to existing account
        // Set Google ID on existing user document
        user.googleId = googleId;
        // Update authProvider to 'both' if password exists, otherwise 'google'
        user.authProvider = user.password ? 'both' : 'google';
        // Assign avatar image if user has no avatar set
        if (!user.avatar && avatar) {
          // Set avatar URL
          user.avatar = avatar;
        }
        // Preserve: role, status, isActive, studentId, facultyId, instituteCode, department, etc.!
        // Save linked user account document
        await user.save();

        // Record audit log for account linking event
        await AuditLog.create({
          // Linked user ID
          userId: user._id,
          // Action type identifier
          action: 'GOOGLE_ACCOUNT_LINKED',
          // Target entity model type
          entityType: 'User',
          // Entity ID string
          entityId: user._id.toString(),
          // Metadata recording link details
          details: { email: user.email, googleId, role: user.role, status: user.status },
          // Client IP address
          ipAddress,
        });
      }
    }

    // If no existing account was found by googleId or email, register new Google applicant
    if (!user) {
      // PART 4: NEW GOOGLE REGISTRATION
      // Check if registration is open
      // Query system settings for registration status
      const setting = await SystemSetting.findOne();
      // Verify registration is currently open on the platform
      if (setting && setting.registrationOpen === false) {
        // Create forbidden error indicating registration is closed
        const error = new Error('User registration is currently closed by the platform administrator.');
        // Set HTTP status code 403 Forbidden
        error.statusCode = 403;
        // Throw the error
        throw error;
      }

      // Safe default role: 'student'. NEVER accept role from Google claims. (Part 6)
      // Assign default safe student role
      const assignedRole = 'student';
      // Generate unique student identifier for the new applicant
      const studentId = await generateStudentId();

      // Create new pending user account registered via Google
      user = await User.create({
        // Extracted Google display name
        name,
        // Verified Google email address
        email,
        // Google subject identifier
        googleId,
        // Google auth provider
        authProvider: 'google',
        // Assigned role student
        role: assignedRole,
        // Initial pending approval status
        status: 'pending',
        // Inactive until approved
        isActive: false,
        // Generated student ID
        studentId,
        // Default department
        department: 'Computer Science',
        // Google profile photo
        avatar,
      });

      // Record audit log for Google registration
      await AuditLog.create({
        // Newly created user ID
        userId: user._id,
        // Action type identifier
        action: 'USER_REGISTER_GOOGLE',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Registration metadata
        details: { email: user.email, googleId, role: user.role, status: 'pending' },
        // Client IP address
        ipAddress,
      });

      // Notify applicant and administrators
      try {
        // Send email informing user that registration is pending approval
        await emailService.sendPendingRegistrationEmail(user);
        // Find all active system administrators
        const admins = await User.find({ role: 'admin', status: 'active' });
        // If active admins exist, alert them
        if (admins.length > 0) {
          // Send notification email to all active admins
          await emailService.sendAdminNewApplicantAlert(admins, user);
          // Loop through each administrator to create an in-app notification
          for (const admin of admins) {
            // Persist in-app notification document
            await Notification.create({
              // Target admin ID
              userId: admin._id,
              // Notification title
              title: 'New Google Applicant Pending',
              // Notification message body
              message: `${user.name} (${user.email}) registered via Google for role "${user.role}".`,
              // System category
              type: 'system',
              // Link to admin pending applicant view with applicant ID
              link: `/admin/users?applicantId=${user._id}`,
            });
          }
        }
      } catch (emailErr) {
        // Log non-fatal error during notification delivery
        console.warn('[AuthService] Non-fatal notification error during Google registration:', emailErr.message);
      }

      // Return pending status without issuing application JWT (Part 4)
      // Return pending registration acknowledgment to client
      return {
        // Status pending
        status: 'pending',
        // Message explaining pending administrator review
        message: 'Google registration submitted successfully. Your account is pending administrator approval.',
        // Sanitized user details
        user: {
          // User ID string
          id: user._id.toString(),
          // User name
          name: user.name,
          // User email
          email: user.email,
          // User role
          role: user.role,
          // User status
          status: user.status,
          // Inactive state boolean
          isActive: user.isActive,
          // Student ID
          studentId: user.studentId,
        },
      };
    }

    // PART 5: STATUS / ACCOUNT LIFECYCLE
    // Verify account is not pending administrator approval
    if (user.status === 'pending') {
      // Create forbidden error for pending account
      const error = new Error('Your account is pending administrator approval.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Attach pending status property
      error.status = 'pending';
      // Throw the error
      throw error;
    }

    // Verify account application was not rejected
    if (user.status === 'rejected') {
      // Create forbidden error containing optional rejection reason
      const error = new Error(
        `Your account registration was rejected${user.rejectionReason ? ': ' + user.rejectionReason : '. Please contact administration.'}`
      );
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify account is active and has not been revoked
    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      // Record audit log for login attempt on revoked account
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'REVOKED_USER_LOGIN_ATTEMPT',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Metadata recording reason
        details: { email: user.email, reason: 'Revoked account Google login attempt' },
        // Client IP address
        ipAddress,
      });
      // Create forbidden error for revoked account
      const error = new Error('Your account has been revoked. Please contact administration.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Active user: issue application tokens (Part 9)
    // Check if two-factor authentication is active on this account
    if (user.mfaEnabled) {
      // Issue short-lived MFA challenge token
      const challenge = await this._createMfaChallenge(user._id);
      // Record audit log for MFA challenge issuance
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'MFA_CHALLENGE_ISSUED',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Metadata detailing MFA challenge
        details: { email: user.email, authMethod: 'google' },
        // Client IP address
        ipAddress,
      });


      // Return challenge response prompting client for second factor code
      return {
        // Status active
        status: 'active',
        // MFA flag true
        mfaRequired: true,
        // Signed JWT challenge token
        mfaToken: challenge.mfaToken,
        // Basic user identification object
        user: {
          // User ID string
          id: user._id.toString(),
          // User email
          email: user.email,
          // User role
          role: user.role,
        },
      };
    }

    // Active user: issue application tokens (Part 9)
    // Record login timestamp
    user.lastLoginAt = new Date();
    // Persist login timestamp to database
    await user.save();

    // Record audit log for successful Google login
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'USER_LOGIN_GOOGLE',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Login details metadata
      details: { email: user.email, role: user.role, googleId: user.googleId },
      // Client IP address
      ipAddress,
    });

    // Construct JWT claims payload
    const tokenPayload = {
      // User primary key string
      id: user._id.toString(),
      // User role
      role: user.role,
      // User email
      email: user.email,
      // Token version counter
      tokenVersion: user.tokenVersion || 0,
    };
    // Generate signed short-lived access JWT token
    const accessToken = generateAccessToken(tokenPayload);
    // Generate signed long-lived refresh JWT token
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create and persist active Session document in MongoDB
    await this._createSession(user, refreshToken, ipAddress);

    // Return active status, user profile, and session tokens
    return {
      // Status string active
      status: 'active',
      // Sanitized user profile object
      user: this._formatUserProfile(user),
      // Access JWT token
      accessToken,
      // Refresh JWT token
      refreshToken,
    };
  }

  // Method to initiate two-factor authentication setup and generate QR code
  async initiateMfaSetup(userId) {
    // Query user by primary key ID
    const user = await User.findById(userId);
    // Verify user exists and account is fully active
    if (!user || user.status !== 'active' || !user.isActive) {
      // Create forbidden error if account is not active
      const error = new Error('Active account required for MFA setup');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Generate cryptographically secure base32 TOTP secret key
    const secret = mfaUtil.generateTotpSecret();
    // Encrypt TOTP secret before persisting to database
    const encryptedSecret = mfaUtil.encryptSecret(secret);
    // Store encrypted pending secret on user document
    user.mfaPendingSecret = encryptedSecret;
    // Save pending MFA secret to database
    await user.save();

    // Generate standard otpauth:// URI for authenticator applications
    const otpauthUri = mfaUtil.generateTotpUri(user.email, secret);
    // Generate base64 data URL QR code image from otpauth URI
    const qrCode = await mfaUtil.generateQrCode(otpauthUri);

    // Record audit log for MFA setup initiation
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'MFA_SETUP_INITIATED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Metadata recording user email
      details: { email: user.email },
    });

    // Return secret, otpauth URI, and QR code to client
    return {
      // Plaintext secret string for manual entry
      secret,
      // Standard otpauth URI
      otpauthUri,
      // Base64 QR code image data URL
      qrCode,
    };
  }

  // Method to confirm and activate two-factor authentication using first TOTP code
  async confirmMfaSetup(userId, code) {
    // Find user document by primary key ID
    const user = await User.findById(userId);
    // Verify user exists and account is active
    if (!user || user.status !== 'active' || !user.isActive) {
      // Create forbidden error if account is not active
      const error = new Error('Active account required for MFA setup');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify user has initiated an MFA setup with a pending secret
    if (!user.mfaPendingSecret) {
      // Create bad request error for missing pending setup
      const error = new Error('No pending MFA setup found. Please initiate setup first.');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Decrypt the stored pending TOTP secret
    const decryptedSecret = mfaUtil.decryptSecret(user.mfaPendingSecret);
    // Verify the provided code against the decrypted TOTP secret
    const isValid = mfaUtil.verifyTotp(code, decryptedSecret);
    // If the code is invalid
    if (!isValid) {
      // Create bad request error for invalid TOTP code
      const error = new Error('Invalid TOTP verification code. Please check your authenticator app and try again.');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Promote pending secret to active secret
    user.mfaSecret = user.mfaPendingSecret;
    // Clear pending secret field
    user.mfaPendingSecret = null;
    // Set MFA enabled flag to true
    user.mfaEnabled = true;
    // Record MFA enrollment timestamp
    user.mfaEnrolledAt = new Date();
    // Invalidate previously issued single-factor sessions by bumping token version
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate previously issued single-factor sessions

    // Generate 8 cryptographically secure single-use recovery codes
    const recoveryCodes = mfaUtil.generateRecoveryCodes(8);
    // Hash recovery codes and store on user document
    user.mfaRecoveryCodes = recoveryCodes.map((c) => ({
      // Secure hash of recovery code
      codeHash: mfaUtil.hashRecoveryCode(c),
      // Set initial used state false
      used: false,
      // Null used timestamp
      usedAt: null,
    }));

    // Save updated user document to database
    await user.save();

    // Revoke all prior active sessions for this user in MongoDB
    await Session.updateMany(
      { userId: user._id, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: 'mfa_enabled',
        },
      }
    );

    // Record audit log for successful MFA enrollment
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'MFA_ENROLLED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Metadata recording user email
      details: { email: user.email },
    });

    // Construct JWT claims payload including academic identifiers
    const tokenPayload = {
      // User ID string
      id: user._id.toString(),
      // User role
      role: user.role,
      // User email
      email: user.email,
      // Student ID if applicable
      studentId: user.studentId,
      // Faculty ID if applicable
      facultyId: user.facultyId,
      // Admin ID if applicable
      adminId: user.adminId,
      // Current token version
      tokenVersion: user.tokenVersion,
    };
    // Generate new access token
    const accessToken = generateAccessToken(tokenPayload);
    // Generate new refresh token
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create and persist active Session document in MongoDB
    await this._createSession(user, refreshToken);

    // Return enrollment confirmation and plaintext recovery codes to user
    return {
      // Success confirmation message
      message: 'MFA enrolled successfully',
      // MFA active flag
      mfaEnabled: true,
      // Array of plaintext recovery codes for user backup
      recoveryCodes,
      // Newly issued access token
      accessToken,
      // Newly issued refresh token
      refreshToken,
    };
  }

  // Method to email a one-time sign-in code for an active MFA challenge.
  // The emailed code is the user's current TOTP code (same code the authenticator app shows).
  // It lives on the same challenge (same expiry, single use, 5-attempt lock).
  async sendMfaEmailOtp({ mfaToken, ipAddress = null }) {
    const fail = (message, statusCode) => {
      const error = new Error(message);
      error.statusCode = statusCode;
      return error;
    };

    if (!env.MFA_EMAIL_OTP_ENABLED) {
      throw fail('Email verification codes are not enabled on this platform.', 403);
    }
    if (!mfaToken) throw fail('MFA challenge token is required', 400);

    let decoded;
    try {
      decoded = verifyMfaChallengeToken(mfaToken);
    } catch (err) {
      throw fail('Invalid or expired MFA challenge token', 401);
    }

    const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);
    const challenge = await MfaChallenge.findOne({ challengeHash });
    if (!challenge || challenge.userId.toString() !== decoded.sub) {
      throw fail('Invalid MFA challenge', 401);
    }
    if (challenge.expiresAt < new Date()) {
      throw fail('MFA challenge has expired. Please sign in again.', 401);
    }
    if (challenge.consumed) {
      throw fail('MFA challenge has already been used. Please sign in again.', 401);
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw fail('Maximum MFA verification attempts exceeded. Please sign in again.', 401);
    }

    const user = await User.findById(decoded.sub);
    if (!user || user.status !== 'active' || !user.isActive) {
      throw fail('Your account is not active. Please contact administration.', 403);
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw fail('MFA is not enabled for this account', 400);
    }

    const now = Date.now();
    if ((challenge.emailOtpSendCount || 0) >= EMAIL_OTP_MAX_SENDS) {
      throw fail('Maximum number of email codes sent for this sign-in. Please sign in again.', 429);
    }
    if (challenge.emailOtpLastSentAt && now - challenge.emailOtpLastSentAt.getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - (now - challenge.emailOtpLastSentAt.getTime())) / 1000);
      const error = fail(`Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before requesting another code.`, 429);
      error.retryAfterSeconds = waitSec;
      throw error;
    }

    // The code can never outlive the challenge it belongs to
    const otpExpiresAt = new Date(Math.min(now + EMAIL_OTP_TTL_MS, challenge.expiresAt.getTime()));
    // Email the same 6-digit code the user's authenticator app is showing right now
    const code = mfaUtil.generateTotpCode(mfaUtil.decryptSecret(user.mfaSecret));
    const otpHash = mfaUtil.hashEmailOtp(code, challengeHash);

    // Atomically reserve this send (two concurrent "send" clicks cannot both pass the cooldown)
    const cooldownCutoff = new Date(now - EMAIL_OTP_RESEND_COOLDOWN_MS);
    const reserved = await MfaChallenge.findOneAndUpdate(
      {
        challengeHash,
        consumed: false,
        emailOtpSendCount: { $lt: EMAIL_OTP_MAX_SENDS },
        $or: [{ emailOtpLastSentAt: null }, { emailOtpLastSentAt: { $lte: cooldownCutoff } }],
      },
      {
        $set: { emailOtpHash: otpHash, emailOtpExpiresAt: otpExpiresAt, emailOtpLastSentAt: new Date(now) },
        $inc: { emailOtpSendCount: 1 },
      },
      { new: true }
    );
    if (!reserved) {
      throw fail('Please wait before requesting another code.', 429);
    }

    const ttlMinutes = Math.max(1, Math.round((otpExpiresAt.getTime() - now) / 60000));
    const result = await emailService.sendMfaEmailOtp(user, code, ttlMinutes);
    if (!result || !result.success) {
      // Roll back so the user isn't stuck in a cooldown for a code they never received
      await MfaChallenge.updateOne(
        { challengeHash },
        {
          $set: {
            emailOtpHash: challenge.emailOtpHash || null,
            emailOtpExpiresAt: challenge.emailOtpExpiresAt || null,
            emailOtpLastSentAt: challenge.emailOtpLastSentAt || null,
          },
          $inc: { emailOtpSendCount: -1 },
        }
      );
      logger.error(`[AuthService] MFA email OTP delivery failed for user ${user._id}: ${(result && result.error) || 'Unknown error'}`);
      throw fail('We could not send the verification email right now. Please use your authenticator app or try again shortly.', 503);
    }

    await AuditLog.create({
      userId: user._id,
      action: 'MFA_EMAIL_OTP_SENT',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, sendCount: reserved.emailOtpSendCount },
      ipAddress,
    });

    return {
      sent: true,
      email: maskEmail(user.email),
      expiresAt: otpExpiresAt.toISOString(),
      resendAvailableAt: new Date(now + EMAIL_OTP_RESEND_COOLDOWN_MS).toISOString(),
      sendsRemaining: Math.max(0, EMAIL_OTP_MAX_SENDS - reserved.emailOtpSendCount),
    };
  }

  // Method to verify TOTP code against an active login MFA challenge
  async verifyMfaChallenge({ mfaToken, code, method = 'totp', ipAddress = null }) {
    // Validate presence of MFA challenge token
    if (!mfaToken) {
      // Create bad request error for missing challenge token
      const error = new Error('MFA challenge token is required');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }
    // Validate presence of TOTP verification code
    if (!code) {
      // Create bad request error for missing code
      const error = new Error('TOTP code is required');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Declare decoded token payload variable
    let decoded;
    try {
      // Verify and decode JWT MFA challenge token
      decoded = verifyMfaChallengeToken(mfaToken);
    } catch (err) {
      // Create unauthorized error for invalid or expired challenge token
      const error = new Error('Invalid or expired MFA challenge token');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Compute SHA-256 hash of the incoming challenge identifier from JWT jti
    const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);

    // Query database for challenge document matching the cryptographic challenge hash
    const challenge = await MfaChallenge.findOne({ challengeHash });
    // Verify challenge exists and belongs to the decoded user
    if (!challenge || challenge.userId.toString() !== decoded.sub) {
      // Create unauthorized error for invalid challenge
      const error = new Error('Invalid MFA challenge');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Constant-time verification of challenge hash to prevent timing side channels
    const bufStored = Buffer.from(challenge.challengeHash, 'hex');
    const bufCandidate = Buffer.from(challengeHash, 'hex');
    if (bufStored.length !== bufCandidate.length || !crypto.timingSafeEqual(bufStored, bufCandidate)) {
      // Create unauthorized error for mismatched challenge hash
      const error = new Error('Invalid MFA challenge');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }


    // Check if challenge expiration timestamp has passed
    if (challenge.expiresAt < new Date()) {
      // Create unauthorized error for expired challenge
      const error = new Error('MFA challenge has expired. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Check if challenge has already been consumed
    if (challenge.consumed) {
      // Create unauthorized error for previously used challenge
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Check if challenge attempt count has exceeded maximum allowed
    if (challenge.attempts >= challenge.maxAttempts) {
      // Create unauthorized error for exceeded attempts
      const error = new Error('Maximum MFA verification attempts exceeded. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Retrieve user document by subject ID from decoded token
    const user = await User.findById(decoded.sub);
    // If user does not exist
    if (!user) {
      // Create unauthorized error for missing user
      const error = new Error('User not found');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Verify user account is not pending approval
    if (user.status === 'pending') {
      // Create forbidden error for pending account
      const error = new Error('Your account is pending administrator approval.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }
    // Verify user account registration was not rejected
    if (user.status === 'rejected') {
      // Create forbidden error for rejected account
      const error = new Error(
        `Your account registration was rejected${user.rejectionReason ? ': ' + user.rejectionReason : '. Please contact administration.'}`
      );
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }
    // Verify user account is active and has not been revoked
    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      // Create forbidden error for revoked account
      const error = new Error('Your account has been revoked. Please contact administration.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify two-factor authentication is configured on the user account
    if (!user.mfaEnabled || !user.mfaSecret) {
      // Create bad request error if MFA is not enabled
      const error = new Error('MFA is not enabled for this account');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Second-factor method: 'totp' (authenticator app, default) or 'email' (one-time code sent by email)
    const useEmailOtp = method === 'email';
    let isValid;
    if (useEmailOtp) {
      if (!env.MFA_EMAIL_OTP_ENABLED) {
        const error = new Error('Email verification codes are not enabled on this platform.');
        error.statusCode = 403;
        throw error;
      }
      if (!challenge.emailOtpHash) {
        const error = new Error('No email code has been requested for this sign-in. Please request a code first.');
        error.statusCode = 400;
        throw error;
      }
      if (!challenge.emailOtpExpiresAt || challenge.emailOtpExpiresAt < new Date()) {
        const error = new Error('Your email code has expired. Please request a new one.');
        error.statusCode = 401;
        throw error;
      }
      isValid = mfaUtil.verifyEmailOtp(code, challengeHash, challenge.emailOtpHash);
    } else {
      // Decrypt the user's stored TOTP secret key
      const secret = mfaUtil.decryptSecret(user.mfaSecret);
      // Verify the submitted code against the decrypted TOTP secret
      isValid = mfaUtil.verifyTotp(code, secret);
    }

    // If code verification fails (both methods share the same 5-attempt limit per challenge)
    if (!isValid) {
      // Increment failed attempt counter on the challenge
      challenge.attempts += 1;
      // Save incremented attempts to database
      await challenge.save();

      // Record audit log for failed MFA verification attempt
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'MFA_VERIFY_FAILED',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Metadata recording attempt details
        details: { email: user.email, attempts: challenge.attempts, method: useEmailOtp ? 'email_otp' : 'totp' },
        // Client IP address
        ipAddress,
      });

      // Calculate remaining verification attempts before lockout
      const remaining = challenge.maxAttempts - challenge.attempts;
      // Create error message detailing remaining attempts or lockout message
      const error = new Error(
        remaining > 0
          ? `Invalid ${useEmailOtp ? 'email' : 'TOTP'} verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Challenge locked. Please sign in again.'
      );
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the verification error
      throw error;
    }

    // Atomically consume challenge to prevent race conditions & double-use
    // Atomically update challenge to consumed: true if unconsumed and within attempt limit
    const consumedChallenge = await MfaChallenge.findOneAndUpdate(
      // Query conditions to ensure single atomic consumption
      { challengeHash, consumed: false, attempts: { $lt: challenge.maxAttempts } },
      // Update values to mark consumed and record timestamp
      { $set: { consumed: true, consumedAt: new Date(), emailOtpHash: null } },

      // Return updated document
      { new: true }
    );
    // If update returned null, challenge was already consumed concurrently
    if (!consumedChallenge) {
      // Create unauthorized error for already consumed challenge
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Update last login timestamp on user document
    user.lastLoginAt = new Date();
    // Update last MFA usage timestamp on user document
    user.mfaLastUsedAt = new Date();
    // Save updated timestamps to database
    await user.save();

    // Record audit log for successful MFA authentication
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'USER_LOGIN_MFA_SUCCESS',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Metadata recording login details
      details: { email: user.email, role: user.role, method: useEmailOtp ? 'email_otp' : 'totp' },
      // Client IP address
      ipAddress,
    });

    // Construct JWT claims payload
    const tokenPayload = {
      // User ID string
      id: user._id.toString(),
      // User role
      role: user.role,
      // User email
      email: user.email,
      // Token version counter
      tokenVersion: user.tokenVersion || 0,
    };
    // Generate new access JWT token
    const accessToken = generateAccessToken(tokenPayload);
    // Generate new refresh JWT token
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create and persist active Session document in MongoDB
    await this._createSession(user, refreshToken, ipAddress);

    // Return user profile and tokens to complete login
    return {
      // Sanitized user profile object
      user: this._formatUserProfile(user),
      // Access JWT token
      accessToken,
      // Refresh JWT token
      refreshToken,
    };
  }

  // Method to authenticate user via backup recovery code during MFA challenge
  async redeemMfaRecoveryCode({ mfaToken, recoveryCode, ipAddress = null }) {
    // Validate presence of MFA challenge token
    if (!mfaToken) {
      // Create bad request error for missing challenge token
      const error = new Error('MFA challenge token is required');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }
    // Validate presence of recovery code
    if (!recoveryCode) {
      // Create bad request error for missing recovery code
      const error = new Error('Recovery code is required');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Declare decoded token variable
    let decoded;
    try {
      // Verify and decode JWT challenge token
      decoded = verifyMfaChallengeToken(mfaToken);
    } catch (err) {
      // Create unauthorized error for invalid or expired challenge token
      const error = new Error('Invalid or expired MFA challenge token');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Compute SHA-256 hash of the incoming challenge identifier from JWT jti
    const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);

    // Query database for challenge document matching the cryptographic challenge hash
    const challenge = await MfaChallenge.findOne({ challengeHash });
    // Verify challenge exists and matches decoded user
    if (!challenge || challenge.userId.toString() !== decoded.sub) {
      // Create unauthorized error for invalid challenge
      const error = new Error('Invalid MFA challenge');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Constant-time verification of challenge hash to prevent timing side channels
    const bufStored = Buffer.from(challenge.challengeHash, 'hex');
    const bufCandidate = Buffer.from(challengeHash, 'hex');
    if (bufStored.length !== bufCandidate.length || !crypto.timingSafeEqual(bufStored, bufCandidate)) {
      // Create unauthorized error for mismatched challenge hash
      const error = new Error('Invalid MFA challenge');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }


    // Check if challenge expiration time has passed
    if (challenge.expiresAt < new Date()) {
      // Create unauthorized error for expired challenge
      const error = new Error('MFA challenge has expired. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Check if challenge was already consumed
    if (challenge.consumed) {
      // Create unauthorized error for consumed challenge
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Check if challenge attempts have reached max limit
    if (challenge.attempts >= challenge.maxAttempts) {
      // Create unauthorized error for exceeded attempts
      const error = new Error('Maximum MFA verification attempts exceeded. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Retrieve user document by subject ID from decoded token
    const user = await User.findById(decoded.sub);
    // If user does not exist
    if (!user) {
      // Create unauthorized error for missing user
      const error = new Error('User not found');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Verify account is not pending approval
    if (user.status === 'pending') {
      // Create forbidden error for pending account
      const error = new Error('Your account is pending administrator approval.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }
    // Verify account registration was not rejected
    if (user.status === 'rejected') {
      // Create forbidden error for rejected account
      const error = new Error(
        `Your account registration was rejected${user.rejectionReason ? ': ' + user.rejectionReason : '. Please contact administration.'}`
      );
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }
    // Verify account is active and has not been revoked
    if (user.status === 'revoked' || !user.isActive || user.status !== 'active') {
      // Create forbidden error for revoked account
      const error = new Error('Your account has been revoked. Please contact administration.');
      // Set HTTP status code 403 Forbidden
      error.statusCode = 403;
      // Throw the error
      throw error;
    }

    // Verify two-factor authentication is enabled for this account
    if (!user.mfaEnabled) {
      // Create bad request error if MFA is not enabled
      const error = new Error('MFA is not enabled for this account');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Hash the submitted recovery code to compare against stored recovery code hashes
    const hashedInput = mfaUtil.hashRecoveryCode(recoveryCode);
    // Find matching recovery code in user's recovery code list
    const matchedCode = user.mfaRecoveryCodes.find((c) => c.codeHash === hashedInput);

    // If no match found or recovery code has already been used
    if (!matchedCode || matchedCode.used) {
      // Increment failed attempt counter
      challenge.attempts += 1;
      // Save incremented attempts to database
      await challenge.save();

      // Record audit log for failed recovery code redemption
      await AuditLog.create({
        // Target user ID
        userId: user._id,
        // Action type identifier
        action: 'MFA_RECOVERY_FAILED',
        // Target entity model type
        entityType: 'User',
        // Entity ID string
        entityId: user._id.toString(),
        // Metadata recording failure details
        details: { email: user.email, attempts: challenge.attempts },
        // Client IP address
        ipAddress,
      });

      // Calculate remaining verification attempts before lockout
      const remaining = challenge.maxAttempts - challenge.attempts;
      // Create error message with remaining attempts or lockout notice
      const error = new Error(
        remaining > 0
          ? `Invalid or already used recovery code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Challenge locked. Please sign in again.'
      );
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Atomically consume challenge to prevent race conditions & double-use
    // Atomically update challenge to consumed: true
    const consumedChallenge = await MfaChallenge.findOneAndUpdate(
      // Query criteria to ensure single consumption
      { challengeHash, consumed: false, attempts: { $lt: challenge.maxAttempts } },
      // Update consumed state and timestamp
      { $set: { consumed: true, consumedAt: new Date() } },

      // Return updated document
      { new: true }
    );
    // If update returned null, challenge was consumed by another request
    if (!consumedChallenge) {
      // Create unauthorized error for already used challenge
      const error = new Error('MFA challenge has already been used. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Mark matched recovery code as used to prevent re-use
    matchedCode.used = true;
    // Record timestamp when recovery code was redeemed
    matchedCode.usedAt = new Date();

    // Record last login timestamp
    user.lastLoginAt = new Date();
    // Record last MFA usage timestamp
    user.mfaLastUsedAt = new Date();
    // Save user document updates
    await user.save();

    // Record audit log for successful recovery code redemption
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'MFA_RECOVERY_CODE_USED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Metadata recording login details
      details: { email: user.email, role: user.role },
      // Client IP address
      ipAddress,
    });

    // Construct JWT claims payload
    const tokenPayload = {
      // User ID string
      id: user._id.toString(),
      // User role
      role: user.role,
      // User email
      email: user.email,
      // Token version counter
      tokenVersion: user.tokenVersion || 0,
    };
    // Generate new access JWT token
    const accessToken = generateAccessToken(tokenPayload);
    // Generate new refresh JWT token
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create and persist active Session document in MongoDB
    await this._createSession(user, refreshToken, ipAddress);

    // Return user profile and tokens to complete login
    return {
      // Sanitized user profile object
      user: this._formatUserProfile(user),
      // Access JWT token
      accessToken,
      // Refresh JWT token
      refreshToken,
    };
  }

  // Method to disable two-factor authentication after verifying password or TOTP code
  async disableMfa({ userId, password, code, ipAddress = null }) {
    // Find user document by primary key ID
    const user = await User.findById(userId);
    // If user does not exist
    if (!user) {
      // Create not found error instance
      const error = new Error('User not found');
      // Set HTTP status code 404 Not Found
      error.statusCode = 404;
      // Throw the error
      throw error;
    }

    // Enforce mandatory MFA policy for student accounts at the service level
    if (user.role === 'student') {
      const error = new Error('MFA is mandatory for student accounts and cannot be disabled.');
      error.statusCode = 403;
      throw error;
    }

    // Verify two-factor authentication is currently enabled
    if (!user.mfaEnabled) {
      // Create bad request error if MFA is not enabled
      const error = new Error('MFA is not enabled for this account');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Require password check if local/both, or TOTP code if Google-only or provided
    // If account has a password, verify password
    if (user.password) {
      // Check if password was provided
      if (!password) {
        // Create bad request error for missing password
        const error = new Error('Current password is required to disable MFA');
        // Set HTTP status code 400 Bad Request
        error.statusCode = 400;
        // Throw the error
        throw error;
      }
      // Compare supplied password with stored hash
      const isMatch = await comparePassword(password, user.password);
      // If password does not match
      if (!isMatch) {
        // Create unauthorized error for incorrect password
        const error = new Error('Incorrect password');
        // Set HTTP status code 401 Unauthorized
        error.statusCode = 401;
        // Throw the error
        throw error;
      }
    // If Google-only account without password, verify TOTP code
    } else {
      // Check if TOTP code was provided
      if (!code) {
        // Create bad request error for missing TOTP code
        const error = new Error('TOTP code is required to disable MFA for Google accounts');
        // Set HTTP status code 400 Bad Request
        error.statusCode = 400;
        // Throw the error
        throw error;
      }
      // Decrypt stored TOTP secret
      const secret = mfaUtil.decryptSecret(user.mfaSecret);
      // Verify submitted code against decrypted secret
      const isValid = mfaUtil.verifyTotp(code, secret);
      // If code is invalid
      if (!isValid) {
        // Create unauthorized error for invalid TOTP code
        const error = new Error('Invalid TOTP verification code');
        // Set HTTP status code 401 Unauthorized
        error.statusCode = 401;
        // Throw the error
        throw error;
      }
    }

    // Disable MFA on user document
    user.mfaEnabled = false;
    // Clear stored active MFA secret
    user.mfaSecret = null;
    // Clear stored pending MFA secret
    user.mfaPendingSecret = null;
    // Clear stored recovery codes
    user.mfaRecoveryCodes = [];
    // Increment tokenVersion to invalidate existing authenticated sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate previously issued sessions
    // Save updated user document to database
    await user.save();

    // Revoke all prior active sessions for this user in MongoDB
    await Session.updateMany(
      { userId: user._id, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: 'mfa_disabled',
        },
      }
    );

    // Record audit log for disabling MFA
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'MFA_DISABLED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Metadata recording user email
      details: { email: user.email },
      // Client IP address
      ipAddress,
    });

    // Construct JWT claims payload
    const tokenPayload = {
      // User ID string
      id: user._id.toString(),
      // User role
      role: user.role,
      // User email
      email: user.email,
      // Student ID if present
      studentId: user.studentId,
      // Faculty ID if present
      facultyId: user.facultyId,
      // Admin ID if present
      adminId: user.adminId,
      // Updated token version
      tokenVersion: user.tokenVersion,
    };
    // Generate new access JWT token
    const accessToken = generateAccessToken(tokenPayload);
    // Generate new refresh JWT token
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create and persist active Session document in MongoDB
    await this._createSession(user, refreshToken, ipAddress);

    // Return success message and new session tokens
    return {
      // Confirmation message
      message: 'Two-factor authentication has been disabled successfully',
      // Access token
      accessToken,
      // Refresh token
      refreshToken,
    };
  }

  // Method to regenerate a fresh set of recovery codes after verifying credentials
  async regenerateRecoveryCodes({ userId, password, code, ipAddress = null }) {
    // Find user document by primary key ID
    const user = await User.findById(userId);
    // If user does not exist
    if (!user) {
      // Create not found error instance
      const error = new Error('User not found');
      // Set HTTP status code 404 Not Found
      error.statusCode = 404;
      // Throw the error
      throw error;
    }

    // Verify MFA is currently enabled with an active secret
    if (!user.mfaEnabled || !user.mfaSecret) {
      // Create bad request error if MFA is not enabled
      const error = new Error('MFA must be enabled to regenerate recovery codes');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // If account has password, verify current password
    if (user.password) {
      // Check if password was provided
      if (!password) {
        // Create bad request error for missing password
        const error = new Error('Current password is required to regenerate recovery codes');
        // Set HTTP status code 400 Bad Request
        error.statusCode = 400;
        // Throw the error
        throw error;
      }
      // Compare password against stored hash
      const isMatch = await comparePassword(password, user.password);
      // If password does not match
      if (!isMatch) {
        // Create unauthorized error for incorrect password
        const error = new Error('Incorrect password');
        // Set HTTP status code 401 Unauthorized
        error.statusCode = 401;
        // Throw the error
        throw error;
      }
    // If account does not have password (Google login), verify TOTP code
    } else {
      // Check if TOTP code was provided
      if (!code) {
        // Create bad request error for missing TOTP code
        const error = new Error('TOTP code is required to regenerate recovery codes');
        // Set HTTP status code 400 Bad Request
        error.statusCode = 400;
        // Throw the error
        throw error;
      }
      // Decrypt stored TOTP secret
      const secret = mfaUtil.decryptSecret(user.mfaSecret);
      // Verify code against decrypted secret
      if (!mfaUtil.verifyTotp(code, secret)) {
        // Create unauthorized error for invalid TOTP code
        const error = new Error('Invalid TOTP verification code');
        // Set HTTP status code 401 Unauthorized
        error.statusCode = 401;
        // Throw the error
        throw error;
      }
    }

    // Generate 8 new cryptographically secure single-use recovery codes
    const recoveryCodes = mfaUtil.generateRecoveryCodes(8);
    // Hash new recovery codes and replace existing recovery code array
    user.mfaRecoveryCodes = recoveryCodes.map((c) => ({
      // Secure hash of recovery code
      codeHash: mfaUtil.hashRecoveryCode(c),
      // Initial used state false
      used: false,
      // Null used timestamp
      usedAt: null,
    }));
    // Save updated recovery codes to database
    await user.save();

    // Record audit log for recovery code regeneration
    await AuditLog.create({
      // Target user ID
      userId: user._id,
      // Action type identifier
      action: 'MFA_RECOVERY_CODES_REGENERATED',
      // Target entity model type
      entityType: 'User',
      // Entity ID string
      entityId: user._id.toString(),
      // Metadata recording user email
      details: { email: user.email },
      // Client IP address
      ipAddress,
    });

    // Return success message and new plaintext recovery codes for user backup
    return {
      // Confirmation message
      message: 'Recovery codes regenerated successfully',
      // Array of new plaintext recovery codes
      recoveryCodes,
    };
  }

  // Method to issue new access token using a valid refresh token with atomic CAS rotation and recovery
  async refreshAccessToken({ refreshToken, ipAddress = null, userAgent = null }) {
    // Validate presence of refresh token
    if (!refreshToken) {
      // Create bad request error for missing refresh token
      const error = new Error('Refresh token is required');
      // Set HTTP status code 400 Bad Request
      error.statusCode = 400;
      // Throw the error
      throw error;
    }

    // Declare decoded payload variable
    let decoded;
    try {
      // Verify and decode refresh JWT token signature and expiration
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      // Determine descriptive error message based on error type
      const message = err.name === 'TokenExpiredError'
        ? 'Refresh token has expired'
        : (err.statusCode === 401 && err.message ? err.message : 'Invalid refresh token');
      // Create unauthorized error instance
      const error = new Error(message);
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Verify token type claim is 'refresh' if type claim exists
    if (decoded.type && decoded.type !== 'refresh') {
      // Create unauthorized error for invalid token type
      const error = new Error('Invalid token type for refresh');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Extract user ID from token claims
    const userId = decoded.id || decoded.sub;
    // Verify user ID is present in token payload
    if (!userId) {
      // Create unauthorized error for invalid payload
      const error = new Error('Invalid refresh token payload');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Retrieve user document from database by ID
    const user = await User.findById(userId);
    // If user does not exist
    if (!user) {
      // Create unauthorized error for missing user
      const error = new Error('User not found');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Verify user account is active and has not been revoked or rejected
    if (user.status !== 'active' || !user.isActive) {
      // Declare message variable
      let message;
      // If account status is revoked
      if (user.status === 'revoked') {
        // Set revoked message
        message = 'Account has been revoked. Access denied.';
      // If account status is rejected
      } else if (user.status === 'rejected') {
        // Set rejected message
        message = 'Account application was rejected. Access denied.';
      // If account is deactivated
      } else if (!user.isActive && user.status === 'active') {
        // Set deactivated message
        message = 'Account is deactivated.';
      // For any other non-active status
      } else {
        // Set generic status message
        message = `Account status is ${user.status}. Access denied.`;
      }
      // Create unauthorized error with specific message
      const error = new Error(message);
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Verify tokenVersion claim matches current user tokenVersion (session revocation check)
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      // Create unauthorized error for invalidated session
      const error = new Error('Session has expired or been invalidated. Please sign in again.');
      // Set HTTP status code 401 Unauthorized
      error.statusCode = 401;
      // Throw the error
      throw error;
    }

    // Compute SHA-256 hash of the presented refresh token
    const presentedHash = hashToken(refreshToken);

    // Query session in MongoDB matching currentTokenHash, recentRotations, or historicalRevokedHashes
    let session = await Session.findOne({
      $or: [
        { currentTokenHash: presentedHash },
        { 'recentRotations.tokenHash': presentedHash },
        { historicalRevokedHashes: presentedHash },
      ],
    });

    // If no existing session found, establish a session for migration/compatibility
    if (!session) {
      session = await this._createSession(user, refreshToken, ipAddress, userAgent);
    }

    // If session has been revoked or compromised, reject renewal
    if (session.status !== 'active') {
      const error = new Error('Session has been revoked. Please sign in again.');
      error.statusCode = 401;
      throw error;
    }

    const now = new Date();

    // Construct fresh JWT payload
    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      studentId: user.studentId,
      facultyId: user.facultyId,
      adminId: user.adminId,
      tokenVersion: user.tokenVersion || 0,
    };

    // Case 1: Presented token is the currently active token for this session
    if (session.currentTokenHash === presentedHash) {
      const accessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);
      const newRefreshTokenHash = hashToken(newRefreshToken);
      const graceExpiresAt = new Date(now.getTime() + 30 * 1000); // 30-second recovery grace window

      const encryptedReplacementToken = encryptRecoveryToken(newRefreshToken, {
        familyId: session.familyId,
        userId: user._id.toString(),
        parentTokenHash: presentedHash,
      });

      const rotationEntry = {
        tokenHash: presentedHash,
        replacedByTokenHash: newRefreshTokenHash,
        rotatedAt: now,
        graceExpiresAt,
        encryptedReplacementToken,
      };

      // Identify hashes being evicted from the 5-item ring buffer to archive in tombstones (max 20)
      const currentRotations = session.recentRotations || [];
      const evictedHashes = currentRotations.length >= 4
        ? currentRotations.slice(0, currentRotations.length - 3).map((r) => r.tokenHash)
        : [];

      // Atomic CAS update: only updates if currentTokenHash and status remain unchanged
      const updatedSession = await Session.findOneAndUpdate(
        {
          _id: session._id,
          currentTokenHash: presentedHash,
          status: 'active',
        },
        {
          $set: {
            currentTokenHash: newRefreshTokenHash,
            lastActiveAt: now,
            ipAddress: ipAddress || session.ipAddress,
            userAgent: userAgent || session.userAgent,
          },
          $inc: { version: 1 },
          $push: {
            recentRotations: {
              $each: [rotationEntry],
              $slice: -5,
            },
            ...(evictedHashes.length > 0
              ? { historicalRevokedHashes: { $each: evictedHashes, $slice: -20 } }
              : {}),
          },
        },
        { new: true }
      );

      // Concurrency check: If another request rotated or revoked this session concurrently
      if (!updatedSession) {
        const freshSession = await Session.findById(session._id);
        if (!freshSession || freshSession.status !== 'active') {
          const error = new Error('Session has been revoked. Please sign in again.');
          error.statusCode = 401;
          throw error;
        }

        // Check if presentedHash is in freshSession.recentRotations within grace window
        const concurrentRotation = (freshSession.recentRotations || []).find(
          (r) => r.tokenHash === presentedHash
        );
        if (concurrentRotation && concurrentRotation.graceExpiresAt > now) {
          const recoveredToken = decryptRecoveryToken(
            concurrentRotation.encryptedReplacementToken,
            {
              familyId: freshSession.familyId,
              userId: user._id.toString(),
              parentTokenHash: concurrentRotation.tokenHash,
            }
          );
          return {
            accessToken: generateAccessToken(tokenPayload),
            refreshToken: recoveredToken,
            user: this._formatUserProfile(user),
          };
        }

        // If not in grace window, treat as replay
        await Session.findByIdAndUpdate(freshSession._id, {
          $set: {
            status: 'compromised',
            revokedAt: new Date(),
            revocationReason: 'token_reuse_detected',
          },
        });
        const error = new Error('Token reuse detected. Session has been revoked for security.');
        error.statusCode = 401;
        throw error;
      }

      // Record audit log for successful token refresh
      await AuditLog.create({
        userId: user._id,
        action: 'TOKEN_REFRESH_SUCCESS',
        entityType: 'User',
        entityId: user._id.toString(),
        details: { email: user.email, role: user.role, familyId: session.familyId },
        ipAddress,
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: this._formatUserProfile(user),
      };
    }

    // Case 2: Presented token is not current - check recentRotations for Lost Response Recovery
    const matchingRotation = (session.recentRotations || []).find(
      (r) => r.tokenHash === presentedHash
    );

    if (matchingRotation) {
      if (matchingRotation.graceExpiresAt > now) {
        // Within active grace window -> Recover identical replacement token
        const recoveredToken = decryptRecoveryToken(
          matchingRotation.encryptedReplacementToken,
          {
            familyId: session.familyId,
            userId: user._id.toString(),
            parentTokenHash: matchingRotation.tokenHash,
          }
        );

        const accessToken = generateAccessToken(tokenPayload);

        await AuditLog.create({
          userId: user._id,
          action: 'TOKEN_ROTATION_RECOVERY',
          entityType: 'Session',
          entityId: session._id.toString(),
          details: { familyId: session.familyId, email: user.email },
          ipAddress,
        });

        return {
          accessToken,
          refreshToken: recoveredToken,
          user: this._formatUserProfile(user),
        };
      }
    }

    // Case 3: Replay beyond grace window or in tombstone history -> Token Reuse Attack Detected
    await Session.findByIdAndUpdate(session._id, {
      $set: {
        status: 'compromised',
        revokedAt: new Date(),
        revocationReason: 'token_reuse_detected',
      },
    });

    await AuditLog.create({
      userId: user._id,
      action: 'SESSION_COMPROMISED_TOKEN_REUSE',
      entityType: 'Session',
      entityId: session._id.toString(),
      details: {
        familyId: session.familyId,
        email: user.email,
        tokenHash: presentedHash,
      },
      ipAddress,
    });

    const error = new Error('Token reuse detected. Session has been revoked for security.');
    error.statusCode = 401;
    throw error;
  }

  // Method to log out user and revoke specific session family
  async logout({ refreshToken, userId = null, ipAddress = null }) {
    if (refreshToken) {
      const presentedHash = hashToken(refreshToken);
      const session = await Session.findOne({
        $or: [
          { currentTokenHash: presentedHash },
          { 'recentRotations.tokenHash': presentedHash },
        ],
      });

      if (session) {
        session.status = 'revoked';
        session.revokedAt = new Date();
        session.revocationReason = 'user_logout';
        await session.save();

        await AuditLog.create({
          userId: userId || session.userId,
          action: 'USER_LOGOUT',
          entityType: 'Session',
          entityId: session._id.toString(),
          details: { familyId: session.familyId, reason: 'user_logout' },
          ipAddress,
        });

        return { message: 'Logged out successfully' };
      }
    }

    if (userId) {
      const latestSession = await Session.findOne({ userId, status: 'active' }).sort({ lastActiveAt: -1 });
      if (latestSession) {
        latestSession.status = 'revoked';
        latestSession.revokedAt = new Date();
        latestSession.revocationReason = 'user_logout';
        await latestSession.save();
      }

      await AuditLog.create({
        userId,
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: userId.toString(),
        details: { reason: 'user_logout' },
        ipAddress,
      });
    }

    return { message: 'Logged out successfully' };
  }

  // Method to log out user from all active devices
  async logoutAll(userId, ipAddress = null) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Session.updateMany(
      { userId: user._id, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: 'user_logout_all',
        },
      }
    );

    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGOUT_ALL',
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, tokenVersion: user.tokenVersion },
      ipAddress,
    });

    return { message: 'Logged out from all devices successfully' };
  }
}

// Export singleton instance of AuthService
module.exports = new AuthService();
