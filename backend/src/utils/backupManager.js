/**
 * Centralized MongoDB Backup and Disaster Recovery Manager
 * Provides archive creation, SHA256 integrity verification, retention pruning,
 * dry-run validation, and interrupted submission reconciliation.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Creates a gzipped JSON/BSON backup archive of specified collections or all models.
 * Calculates and writes a SHA-256 integrity hash file alongside the archive.
 *
 * @param {Object} options
 * @param {string} options.backupDir - Destination directory
 * @param {Array<string>} [options.collections] - Specific collections to export (all if empty)
 * @param {boolean} [options.compress=true] - Whether to gzip compress
 * @returns {Promise<{ backupFile: string, checksumFile: string, sha256: string, totalDocuments: number, sizeBytes: number }>}
 */
async function createBackup({ backupDir = path.resolve(__dirname, '../../../backups/mongodb'), collections = [], compress = true } = {}) {
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = `uap_mongodb_${timestamp}.archive${compress ? '.gz' : ''}`;
  const backupFilePath = path.join(backupDir, baseFilename);
  const checksumFilePath = `${backupFilePath}.sha256`;

  const backupData = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    collections: {},
    totalDocuments: 0,
  };

  // Determine collection list
  const modelNames = collections.length > 0
    ? collections
    : Object.keys(mongoose.models);

  for (const modelName of modelNames) {
    const Model = mongoose.models[modelName];
    if (!Model) continue;

    try {
      const docs = await Model.find({}).lean();
      backupData.collections[modelName] = docs;
      backupData.totalDocuments += docs.length;
    } catch (err) {
      logger.warn(`[BackupManager] Failed to export collection ${modelName}: ${err.message}`);
    }
  }

  const rawJson = JSON.stringify(backupData, null, 2);
  let finalBuffer;

  if (compress) {
    finalBuffer = zlib.gzipSync(Buffer.from(rawJson, 'utf8'));
  } else {
    finalBuffer = Buffer.from(rawJson, 'utf8');
  }

  fs.writeFileSync(backupFilePath, finalBuffer, { mode: 0o600 });

  // Calculate SHA256 checksum
  const sha256Hash = crypto.createHash('sha256').update(finalBuffer).digest('hex');
  fs.writeFileSync(checksumFilePath, `${sha256Hash}  ${path.basename(backupFilePath)}\n`, { mode: 0o600 });

  const stats = fs.statSync(backupFilePath);

  return {
    backupFile: backupFilePath,
    checksumFile: checksumFilePath,
    sha256: sha256Hash,
    totalDocuments: backupData.totalDocuments,
    sizeBytes: stats.size,
  };
}

/**
 * Validates a backup archive's SHA256 checksum and compression stream integrity.
 *
 * @param {string} backupFilePath
 * @param {string} [checksumFilePath]
 * @returns {{ valid: boolean, sha256: string, algorithm: string }}
 */
function verifyArchive(backupFilePath, checksumFilePath = null) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup archive file not found: ${backupFilePath}`);
  }

  const resolvedChecksumPath = checksumFilePath || `${backupFilePath}.sha256`;
  if (!fs.existsSync(resolvedChecksumPath)) {
    throw new Error(`Checksum companion file not found: ${resolvedChecksumPath}`);
  }

  const fileBuffer = fs.readFileSync(backupFilePath);
  const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const expectedHash = fs.readFileSync(resolvedChecksumPath, 'utf8').trim().split(/\s+/)[0];

  if (calculatedHash !== expectedHash) {
    throw new Error(`Checksum mismatch! Expected: ${expectedHash}, Actual: ${calculatedHash}`);
  }

  // Verify gzip magic bytes (0x1f, 0x8b) if gzipped
  if (backupFilePath.endsWith('.gz')) {
    if (fileBuffer.length < 2 || fileBuffer[0] !== 0x1f || fileBuffer[1] !== 0x8b) {
      throw new Error('Invalid gzip header magic bytes');
    }
    // Verify gzip decompressibility
    try {
      zlib.gunzipSync(fileBuffer);
    } catch (decompErr) {
      throw new Error(`Gzip decompression failed: ${decompErr.message}`);
    }
  }

  return {
    valid: true,
    sha256: calculatedHash,
    algorithm: 'sha256',
  };
}

/**
 * Prunes backup archives older than the specified retention window in days.
 *
 * @param {string} backupDir
 * @param {number} [retentionDays=30]
 * @returns {{ deletedFiles: string[], retainedFiles: string[] }}
 */
function pruneOldBackups(backupDir, retentionDays = 30) {
  if (!fs.existsSync(backupDir)) {
    return { deletedFiles: [], retainedFiles: [] };
  }

  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupDir);

  const deletedFiles = [];
  const retainedFiles = [];

  for (const file of files) {
    if (!file.startsWith('uap_mongodb_')) continue;

    const fullPath = path.join(backupDir, file);
    try {
      const stats = fs.statSync(fullPath);
      const ageMs = now - stats.mtimeMs;

      if (ageMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        deletedFiles.push(file);
      } else {
        retainedFiles.push(file);
      }
    } catch (err) {
      logger.warn(`[BackupManager] Error evaluating file age for ${file}: ${err.message}`);
    }
  }

  return { deletedFiles, retainedFiles };
}

/**
 * Restores a backup archive into MongoDB. Supports non-destructive dry-run mode.
 *
 * @param {Object} options
 * @param {string} options.backupFilePath
 * @param {string} [options.checksumFilePath]
 * @param {boolean} [options.dryRun=false] - If true, validates payload without writing to DB
 * @param {string} [options.targetModelPrefix=''] - Optional prefix to restore to isolated collections
 * @returns {Promise<{ valid: boolean, dryRun: boolean, totalRestored: number, collections: Object }>}
 */
async function restoreBackup({ backupFilePath, checksumFilePath = null, dryRun = false, targetModelPrefix = '' } = {}) {
  // First verify archive integrity
  verifyArchive(backupFilePath, checksumFilePath);

  const fileBuffer = fs.readFileSync(backupFilePath);
  let rawJson;

  if (backupFilePath.endsWith('.gz')) {
    rawJson = zlib.gunzipSync(fileBuffer).toString('utf8');
  } else {
    rawJson = fileBuffer.toString('utf8');
  }

  const backupData = JSON.parse(rawJson);
  const collectionSummaries = {};
  let totalRestored = 0;

  for (const [collectionName, docs] of Object.entries(backupData.collections || {})) {
    collectionSummaries[collectionName] = Array.isArray(docs) ? docs.length : 0;

    if (!dryRun) {
      const targetModelName = targetModelPrefix ? `${targetModelPrefix}_${collectionName}` : collectionName;
      const TargetModel = mongoose.models[targetModelName] || mongoose.models[collectionName];

      if (TargetModel && Array.isArray(docs) && docs.length > 0) {
        for (const doc of docs) {
          try {
            await TargetModel.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
            totalRestored++;
          } catch (upsertErr) {
            logger.warn(`[BackupManager] Restore failed for doc ${doc._id} in ${collectionName}: ${upsertErr.message}`);
          }
        }
      }
    }
  }

  return {
    valid: true,
    dryRun,
    totalRestored: dryRun ? 0 : totalRestored,
    collections: collectionSummaries,
    totalDocumentsInArchive: backupData.totalDocuments || 0,
  };
}

/**
 * Reconciles and auto-finalizes expired in-progress submissions.
 * Prevents orphaned submissions when workers or server processes restart.
 *
 * @returns {Promise<{ reconciledCount: number, submissionIds: string[] }>}
 */
async function reconcileInterruptedSubmissions() {
  const { Submission } = require('../models');
  if (!Submission) return { reconciledCount: 0, submissionIds: [] };

  const now = new Date();
  const staleCandidates = await Submission.find({
    status: 'in_progress',
    deadlineAt: { $lt: now },
  });

  const reconciledIds = [];

  for (const sub of staleCandidates) {
    sub.status = 'submitted';
    sub.submittedReason = 'TIME_EXPIRED';
    sub.submittedAt = sub.deadlineAt || now;
    if (sub.startedAt) {
      sub.timeSpentSeconds = Math.max(0, Math.round((sub.submittedAt.getTime() - new Date(sub.startedAt).getTime()) / 1000));
    }
    await sub.save();
    reconciledIds.push(sub._id.toString());
  }

  return {
    reconciledCount: reconciledIds.length,
    submissionIds: reconciledIds,
  };
}

module.exports = {
  createBackup,
  verifyArchive,
  pruneOldBackups,
  restoreBackup,
  reconcileInterruptedSubmissions,
};
