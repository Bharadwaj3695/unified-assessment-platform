#!/usr/bin/env bash
# ==============================================================================
# Unified Assessment Platform (UAP) - Production MongoDB Backup Utility
# ==============================================================================
# Creates compressed MongoDB archives with SHA256 checksums and automated
# 30-day retention pruning. Safe for automated cron execution.
#
# Usage:
#   ./scripts/backup-mongodb.sh [options]
#
# Environment Variables:
#   MONGODB_URI        - MongoDB connection string (or use default container networking)
#   BACKUP_DIR         - Destination folder for backup archives (default: ./backups/mongodb)
#   RETENTION_DAYS     - Days to retain backup archives (default: 30)
#   MONGO_CONTAINER    - Docker container name if running via Docker (default: uap-mongodb)
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/mongodb}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MONGO_CONTAINER="${MONGO_CONTAINER:-uap-mongodb}"
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/unified_assessment}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
ARCHIVE_FILENAME="uap_mongodb_${TIMESTAMP}.archive.gz"
CHECKSUM_FILENAME="${ARCHIVE_FILENAME}.sha256"

# Ensure target directory exists with restricted permissions (0700)
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_FILENAME}"
CHECKSUM_PATH="${BACKUP_DIR}/${CHECKSUM_FILENAME}"

echo "================================================================="
echo "[UAP Backup] Starting MongoDB Backup at $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "[UAP Backup] Destination: ${ARCHIVE_PATH}"
echo "================================================================="

# Check whether we run via Docker container or local mongodump
if command -v mongodump &>/dev/null; then
  echo "[UAP Backup] Executing native mongodump..."
  mongodump --uri="${MONGODB_URI}" --archive="${ARCHIVE_PATH}" --gzip
elif command -v docker &>/dev/null && docker ps -q --filter "name=${MONGO_CONTAINER}" 2>/dev/null | grep -q .; then
  echo "[UAP Backup] Executing mongodump via Docker container (${MONGO_CONTAINER})..."
  docker exec "${MONGO_CONTAINER}" mongodump --archive --gzip > "${ARCHIVE_PATH}"
else
  echo "[UAP Backup] INFO: Neither local mongodump nor running Docker container found."
  echo "[UAP Backup] Delegating to UAP Node.js Backup Manager..."
  node -e "
    const { createBackup } = require('./backend/src/utils/backupManager');
    createBackup({ backupDir: '${BACKUP_DIR}', compress: true })
      .then(res => {
        console.log('[UAP Backup] Backup completed via Node.js manager:', res.backupFile);
        process.exit(0);
      })
      .catch(err => {
        console.error('[UAP Backup] Node.js backup failed:', err.message);
        process.exit(1);
      });
  "
  exit 0
fi

# Verify archive was generated and is non-empty
if [ ! -s "${ARCHIVE_PATH}" ]; then
  echo "[UAP Backup] ERROR: Backup archive is missing or empty: ${ARCHIVE_PATH}" >&2
  exit 1
fi

# Generate SHA256 checksum
echo "[UAP Backup] Computing SHA-256 checksum..."
sha256sum "${ARCHIVE_PATH}" | awk '{print $1}' > "${CHECKSUM_PATH}"
CHECKSUM_VAL="$(cat "${CHECKSUM_PATH}")"
ARCHIVE_SIZE="$(du -h "${ARCHIVE_PATH}" | cut -f1)"

echo "[UAP Backup] SUCCESS: Archive created successfully."
echo "[UAP Backup] Archive Size: ${ARCHIVE_SIZE}"
echo "[UAP Backup] SHA256 Checksum: ${CHECKSUM_VAL}"
echo "[UAP Backup] Checksum File: ${CHECKSUM_PATH}"

# Retention Management: Prune archives older than RETENTION_DAYS
echo "[UAP Backup] Applying retention policy (${RETENTION_DAYS} days)..."
DELETED_COUNT=0
while IFS= read -r old_file; do
  if [ -n "${old_file}" ]; then
    rm -f "${old_file}" "${old_file}.sha256"
    DELETED_COUNT=$((DELETED_COUNT + 1))
    echo "[UAP Backup] Pruned expired backup: ${old_file}"
  fi
done < <(find "${BACKUP_DIR}" -name "uap_mongodb_*.archive.gz" -type f -mtime +"${RETENTION_DAYS}" 2>/dev/null || true)

echo "[UAP Backup] Retention check completed. Expired archives pruned: ${DELETED_COUNT}"
echo "[UAP Backup] Backup routine finished at $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
exit 0
