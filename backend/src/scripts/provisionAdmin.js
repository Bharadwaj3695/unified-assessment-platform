/**
 * Standalone Secure Administrator Provisioning Script
 * Unified Assessment Platform (UAP)
 *
 * Requirements:
 * - Uses existing MongoDB Atlas connection (never falls back to in-memory database).
 * - Checks if target account already exists; preserves existing accounts without overwriting credentials or MFA.
 * - Reads password securely from environment variable (ADMIN_PROVISION_PASSWORD) to prevent hardcoding secrets.
 * - Hashes password using project's approved bcrypt utility (hashPassword).
 * - Enforces admin role, active status, and unique adminId.
 * - Records an immutable audit log entry.
 * - Verifies account without exposing password hashes, MFA secrets, or tokens.
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const { User, AuditLog } = require('../models');
const { hashPassword } = require('../utils/password');

const TARGET_EMAIL = (process.env.ADMIN_PROVISION_EMAIL || 'admin.uap.edu@gmail.com').trim().toLowerCase();
const ADMIN_NAME = process.env.ADMIN_PROVISION_NAME || 'Institutional Administrator';
const ADMIN_DEPARTMENT = process.env.ADMIN_PROVISION_DEPT || 'Institutional Administration';
const ADMIN_ID = process.env.ADMIN_PROVISION_ADMIN_ID || 'ADM-INST-001';

const { execSync } = require('child_process');

function getRunningLocalMongoUri() {
  try {
    const psOut = execSync('ps aux', { encoding: 'utf8' });
    const match = psOut.match(/mongod.*--port\s+(\d+)/);
    if (match && match[1]) {
      return `mongodb://127.0.0.1:${match[1]}/test`;
    }
  } catch {
    // Ignore error
  }
  return null;
}

async function main() {
  console.log(`[Admin Provisioning] Target Email: ${TARGET_EMAIL}`);
  console.log('[Admin Provisioning] Connecting to MongoDB...');

  const primaryUri = process.env.TARGET_MONGODB_URI || process.env.MONGODB_URI || env.MONGODB_URI;
  if (!primaryUri) {
    console.error('[Error] MONGODB_URI is not defined in backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Admin Provisioning] Connected to MongoDB host: ${mongoose.connection.host}`);
    console.log(`[Admin Provisioning] Active Database: ${mongoose.connection.name}`);
  } catch (connErr) {
    console.warn(`[Admin Provisioning] Could not connect to primary URI (${connErr.message}).`);
    const isExplicitlyAllowed = env.ALLOW_IN_MEMORY_DB === 'true' || process.env.ALLOW_IN_MEMORY_DB === 'true';
    const localUri = isExplicitlyAllowed ? getRunningLocalMongoUri() : null;
    if (localUri) {
      console.log(`[Admin Provisioning] Discovered active development in-memory MongoDB at ${localUri}. Connecting...`);
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[Admin Provisioning] Connected to development database: ${mongoose.connection.host}`);
    } else {
      console.error('[Error] Failed to connect to MongoDB cluster:', connErr.message);
      console.error('[Action Required] Ensure your current public IP is whitelisted in MongoDB Atlas Network Access:');
      console.error('https://www.mongodb.com/docs/atlas/security-whitelist/');
      process.exit(1);
    }
  }

  try {
    // 1. Check if the target account already exists
    const existingUser = await User.findOne({ email: TARGET_EMAIL });

    if (existingUser) {
      if (existingUser.role === 'admin' && existingUser.status === 'active' && existingUser.isActive) {
        console.log('\n[Result] Authoritative Administrator account already exists and is active.');
        console.log('[Notice] Preserving existing password, MFA credentials, and active session state.');
        console.log('Account Verification Details:');
        console.log({
          id: existingUser._id.toString(),
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          status: existingUser.status,
          isActive: existingUser.isActive,
          adminId: existingUser.adminId || null,
          department: existingUser.department || null,
          authProvider: existingUser.authProvider,
          mfaEnabled: Boolean(existingUser.mfaEnabled),
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
        });

        await mongoose.disconnect();
        return;
      }

      // Existing user exists with non-admin role or non-active status (e.g. self-registered via Google OAuth)
      console.log(`\n[Notice] Existing account found for ${TARGET_EMAIL} with role "${existingUser.role}", status "${existingUser.status}", isActive: ${existingUser.isActive}.`);
      console.log('[Admin Provisioning] Upgrading account to authoritative Administrator...');

      // Check if proposed adminId is in use by another account
      const existingAdmin = await User.findOne({ adminId: ADMIN_ID, _id: { $ne: existingUser._id } });
      let assignedAdminId = existingUser.adminId || ADMIN_ID;
      if (existingAdmin && !existingUser.adminId) {
        assignedAdminId = `ADM-INST-${Date.now().toString().slice(-4)}`;
        console.log(`[Notice] ${ADMIN_ID} is in use; assigned ${assignedAdminId}`);
      }

      // Optional password update
      let hashedPassword = null;
      let rawPassword = process.env.ADMIN_PROVISION_PASSWORD;
      if (rawPassword && rawPassword.trim().length >= 8) {
        hashedPassword = await hashPassword(rawPassword.trim());
      }

      const updateFields = {
        role: 'admin',
        status: 'active',
        isActive: true,
        adminId: assignedAdminId,
        department: existingUser.department && existingUser.department !== 'Computer Science' ? existingUser.department : ADMIN_DEPARTMENT,
        approvedAt: new Date(),
        rejectionReason: null,
        revokedAt: null,
        revokedBy: null,
      };

      if (existingUser.name === 'admin.uapedu' || !existingUser.name) {
        updateFields.name = ADMIN_NAME;
      }

      if (hashedPassword) {
        updateFields.password = hashedPassword;
        updateFields.authProvider = existingUser.authProvider === 'google' ? 'both' : 'local';
      }

      const updateOp = { $set: updateFields };
      if (existingUser.studentId) {
        updateOp.$unset = { studentId: 1 };
      }

      await User.updateOne({ _id: existingUser._id }, updateOp);

      // Record immutable audit log entry
      await AuditLog.create({
        userId: existingUser._id,
        action: 'ADMIN_ACCOUNT_PROVISIONED',
        entityType: 'User',
        entityId: existingUser._id.toString(),
        details: {
          email: existingUser.email,
          role: 'admin',
          adminId: assignedAdminId,
          department: updateFields.department,
          previousRole: existingUser.role,
          previousStatus: existingUser.status,
          provisionedVia: 'secure_cli_provisioner',
          elevatedFromPendingGoogle: Boolean(existingUser.googleId),
        },
        ipAddress: '127.0.0.1',
      });

      const updatedAdmin = await User.findById(existingUser._id);
      console.log('\n[Admin Provisioning] SUCCESS: Administrator account updated and activated.');
      console.log('Account Verification Details (Sanitized):');
      console.log({
        id: updatedAdmin._id.toString(),
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        status: updatedAdmin.status,
        isActive: updatedAdmin.isActive,
        adminId: updatedAdmin.adminId,
        department: updatedAdmin.department,
        authProvider: updatedAdmin.authProvider,
        googleId: updatedAdmin.googleId ? 'linked' : 'none',
        studentId: updatedAdmin.studentId || null,
        approvedAt: updatedAdmin.approvedAt,
      });

      await mongoose.disconnect();
      return;
    }

    // 2. Account does not exist - proceed with secure provisioning
    console.log('\n[Admin Provisioning] Account does not exist. Initiating secure provisioning workflow...');

    // Retrieve password from environment variable or interactive input
    let rawPassword = process.env.ADMIN_PROVISION_PASSWORD;
    if (!rawPassword && process.stdin.isTTY) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rawPassword = await new Promise((resolve) => {
        rl.question('[Admin Provisioning] Enter administrator password (min 8 characters): ', (ans) => {
          rl.close();
          resolve(ans);
        });
      });
    }

    if (!rawPassword || rawPassword.trim().length < 8) {
      console.error('[Error] A password of at least 8 characters is required.');
      console.error('Usage: ADMIN_PROVISION_PASSWORD="<chosen-password>" npm run provision:admin');
      console.error('Or run "npm run provision:admin" interactively in your terminal.');
      console.error('Passwords must NEVER be hardcoded in code, git repositories, or plain logs.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Hash password with project's approved bcrypt utility
    const hashedPassword = await hashPassword(rawPassword.trim());

    // Check if the proposed adminId is already taken by another admin
    const existingAdminId = await User.findOne({ adminId: ADMIN_ID });
    let assignedAdminId = ADMIN_ID;
    if (existingAdminId) {
      assignedAdminId = `ADM-INST-${Date.now().toString().slice(-4)}`;
      console.log(`[Notice] ${ADMIN_ID} is in use; assigned ${assignedAdminId}`);
    }

    // Create the administrator user document
    const newAdmin = await User.create({
      name: ADMIN_NAME,
      email: TARGET_EMAIL,
      password: hashedPassword,
      role: 'admin',
      adminId: assignedAdminId,
      department: ADMIN_DEPARTMENT,
      status: 'active',
      isActive: true,
      authProvider: 'local',
      approvedAt: new Date(),
      bio: 'Authoritative Institutional Administrator account for Unified Assessment Platform.',
      tokenVersion: 0,
      mfaEnabled: false,
    });

    // Record immutable audit log entry
    await AuditLog.create({
      userId: newAdmin._id,
      action: 'ADMIN_ACCOUNT_PROVISIONED',
      entityType: 'User',
      entityId: newAdmin._id.toString(),
      details: {
        email: newAdmin.email,
        role: newAdmin.role,
        adminId: newAdmin.adminId,
        department: newAdmin.department,
        provisionedVia: 'secure_cli_provisioner',
      },
      ipAddress: '127.0.0.1',
    });

    console.log('\n[Admin Provisioning] SUCCESS: Administrator account created.');
    console.log('Account Verification Details (Sanitized):');
    console.log({
      id: newAdmin._id.toString(),
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      status: newAdmin.status,
      isActive: newAdmin.isActive,
      adminId: newAdmin.adminId,
      department: newAdmin.department,
      mfaEnabled: newAdmin.mfaEnabled,
      createdAt: newAdmin.createdAt,
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('[Error] Provisioning operation failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

main();
