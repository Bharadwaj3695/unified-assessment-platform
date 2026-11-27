const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;

/**
 * Parse and bound pagination parameters safely.
 */
function parsePaginationParams(query = {}, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT) {
  const parsedLimit = parseInt(query.limit, 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, maxLimit)
    : defaultLimit;

  const parsedPage = parseInt(query.page, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE;

  return { page, limit };
}

/**
 * Clamp requested page against total count so out-of-range pages fall back to valid bounds.
 */
function resolvePageBounds(requestedPage, limit, total) {
  const safeLimit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);
  const page = safeTotal > 0 ? Math.min(Math.max(1, Number(requestedPage) || 1), totalPages) : 1;
  const skip = (page - 1) * safeLimit;
  return { page, limit: safeLimit, total: safeTotal, totalPages, skip };
}

/**
 * Build a deterministic MongoDB sort object with `_id` tie-breaker.
 */
function buildSortSpec(sortBy, sortOrder, allowedFields = {}, defaultField = 'createdAt', defaultDir = -1) {
  const field = allowedFields[sortBy] || defaultField;
  const normalizedOrder = String(sortOrder || '').toLowerCase();
  const dir = normalizedOrder === 'asc' ? 1 : normalizedOrder === 'desc' ? -1 : defaultDir;
  if (field === '_id') {
    return { _id: dir };
  }
  return { [field]: dir, _id: dir };
}

/**
 * Slice an in-memory array deterministically with clamped pagination metadata.
 */
function paginateInMemory(items = [], requestedPage = 1, requestedLimit = DEFAULT_LIMIT) {
  const safeList = Array.isArray(items) ? items : [];
  const { page, limit, total, totalPages, skip } = resolvePageBounds(
    requestedPage,
    requestedLimit,
    safeList.length
  );
  return {
    items: safeList.slice(skip, skip + limit),
    pagination: {
      currentPage: page,
      perPage: limit,
      totalPages,
      totalCount: total,
    },
    page,
    limit,
    total,
    totalPages,
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePaginationParams,
  resolvePageBounds,
  buildSortSpec,
  paginateInMemory,
};
