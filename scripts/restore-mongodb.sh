#!/usr/bin/env bash
# ==============================================================================
# Unified Assessment Platform (UAP) - Production MongoDB Restore Utility
# ==============================================================================
# Restores compressed MongoDB archives with pre-flight SHA256 checksum
# validation and non-destructive dry-run capabilities.
#
# Usage:
#   ./scripts/restore-mongodb.sh <ARCHIVE_PATH> [OPTIONS]
#
# Options:
#   --dry-run          Validate checksum and inspect archive stream without writing to DB
#   --drop             Drop collections in target database prior to restoring
#   --nsInclude <ns>   Filter namespace (e.g., "unified_assessment.*")
#   --target-db <name> Target database name override
#
# Environment Variables:
#   MONGODB_URI        - MongoDB connection string
#   MONGO_CONTAINER    - Docker container name if running via Docker (default: uap-mongodb)
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <ARCHIVE_PATH> [--dry-run] [--drop] [--target-db <name>]" >&2
  exit 1
fi

ARCHIVE_PATH="$1"
shift

DRY_RUN=false
DROP_FLAG=""
TARGET_DB=""
MONGO_CONTAINER="${MONGO_CONTAINER:-uap-mongodb}"
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/unified_assessment}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --drop)
      DROP_FLAG="--drop"
      shift
      ;;
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "[UAP Restore] ERROR: Backup archive file does not exist: ${ARCHIVE_PATH}" >&2
  exit 1
fi

CHECKSUM_PATH="${ARCHIVE_PATH}.sha256"

# Verify SHA256 checksum if .sha256 companion exists
if [ -f "${CHECKSUM_PATH}" ]; then
  echo "[UAP Restore] Verifying SHA-256 checksum against companion file..."
  EXPECTED_HASH="$(awk '{print $1}' "${CHECKSUM_PATH}")"
  ACTUAL_HASH="$(sha256sum "${ARCHIVE_PATH}" | awk '{print $1}')"

  if [ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]; then
    echo "[UAP Restore] FATAL ERROR: SHA256 Checksum mismatch!" >&2
    echo "  Expected: ${EXPECTED_HASH}" >&2
    echo "  Actual:   ${ACTUAL_HASH}" >&2
    echo "Aborting restore to prevent data corruption." >&2
    exit 2
  fi
  echo "[UAP Restore] Checksum verified: PASS (${ACTUAL_HASH})"
else
  echo "[UAP Restore] WARNING: Companion .sha256 file not found. Proceeding with caution."
fi

# Dry Run Verification
if [ "${DRY_RUN}" = true ]; then
  echo "[UAP Restore] DRY-RUN MODE: Verifying gzip stream and archive integrity..."
  if gzip -t "${ARCHIVE_PATH}" 2>/dev/null; then
    echo "[UAP Restore] Gzip stream validation: PASS (archive compression is valid)."
  else
    echo "[UAP Restore] FATAL: Archive failed gzip integrity check!" >&2
    exit 3
  fi

  if command -v mongorestore &>/dev/null; then
    echo "[UAP Restore] Performing mongorestore dry-run inspection..."
    mongorestore --archive="${ARCHIVE_PATH}" --gzip --dryRun
  fi
  echo "[UAP Restore] Dry-run check completed successfully. Database was not modified."
  exit 0
fi

# Execute Restore
echo "[UAP Restore] Proceeding with live restore from: ${ARCHIVE_PATH}"

RESTORE_ARGS=("--archive=${ARCHIVE_PATH}" "--gzip")
if [ -n "${DROP_FLAG}" ]; then
  RESTORE_ARGS+=("${DROP_FLAG}")
fi
if [ -n "${TARGET_DB}" ]; then
  RESTORE_ARGS+=("--nsInclude=${TARGET_DB}.*")
fi

if command -v mongorestore &>/dev/null; then
  echo "[UAP Restore] Executing native mongorestore..."
  mongorestore --uri="${MONGODB_URI}" "${RESTORE_ARGS[@]}"
elif command -v docker &>/dev/null && docker ps -q --filter "name=${MONGO_CONTAINER}" 2>/dev/null | grep -q .; then
  echo "[UAP Restore] Executing mongorestore via Docker container (${MONGO_CONTAINER})..."
  docker exec -i "${MONGO_CONTAINER}" mongorestore --gzip --archive < "${ARCHIVE_PATH}"
else
  echo "[UAP Restore] Executing restore via Node.js backup manager..."
  node -e "
    const { restoreBackup } = require('./backend/src/utils/backupManager');
    restoreBackup({ backupFilePath: '${ARCHIVE_PATH}', dryRun: false })
      .then(res => {
        console.log('[UAP Restore] Node.js restore completed:', res);
        process.exit(0);
      })
      .catch(err => {
        console.error('[UAP Restore] Node.js restore failed:', err.message);
        process.exit(1);
      });
  "
fi

echo "[UAP Restore] Restore routine completed at $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
exit 0
