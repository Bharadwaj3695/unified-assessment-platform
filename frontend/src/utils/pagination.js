export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];

/**
 * Normalize pagination metadata from differing backend response shapes
 * ({ currentPage, perPage, totalPages, totalCount } or { page, limit, totalPages, total/pages }).
 */
export function normalizePagination(rawPagination, fallback = {}) {
  const fallbackLimit = Number(fallback.limit) || DEFAULT_PAGE_SIZE;
  const fallbackPage = Math.max(1, Number(fallback.page) || 1);
  const fallbackTotal = Math.max(0, Number(fallback.total) || 0);

  if (!rawPagination || typeof rawPagination !== 'object') {
    const totalPages = Math.max(1, Math.ceil(fallbackTotal / fallbackLimit) || 1);
    return {
      page: Math.min(fallbackPage, totalPages),
      limit: fallbackLimit,
      total: fallbackTotal,
      totalPages,
    };
  }

  const limit = Math.max(
    1,
    Number(rawPagination.perPage ?? rawPagination.limit ?? fallbackLimit) || fallbackLimit
  );
  const total = Math.max(
    0,
    Number(rawPagination.totalCount ?? rawPagination.total ?? fallbackTotal) || 0
  );
  const totalPages = Math.max(
    1,
    Number(rawPagination.totalPages ?? rawPagination.pages ?? Math.ceil(total / limit)) || 1
  );
  const rawPage = Number(rawPagination.currentPage ?? rawPagination.page ?? fallbackPage) || 1;
  const page = Math.min(Math.max(1, rawPage), totalPages);

  return { page, limit, total, totalPages };
}

/**
 * Slice an array deterministically for client-side pagination with clamped page bounds.
 */
export function paginateArray(items = [], requestedPage = 1, requestedLimit = DEFAULT_PAGE_SIZE) {
  const safeList = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(requestedLimit) || DEFAULT_PAGE_SIZE);
  const total = safeList.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
  const startIndex = (page - 1) * limit;

  return {
    items: safeList.slice(startIndex, startIndex + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
