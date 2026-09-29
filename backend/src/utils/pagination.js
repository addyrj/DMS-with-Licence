// src/utils/pagination.js
// Parse pagination query params and build paginated response

export const parsePage = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 10);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

export const buildPaginatedResponse = (data, total, { page, limit }) => ({
  data,
  pagination: {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

// Validate ?sortBy=/?sortDir= against a per-endpoint column whitelist
// (whitelisting is required since column names can't be parameterized in ORDER BY)
export const parseSort = (query, allowedColumns, defaultColumn, defaultDir = 'DESC') => {
  const sortBy  = allowedColumns.includes(query.sortBy) ? query.sortBy : defaultColumn;
  const sortDir = String(query.sortDir).toUpperCase() === 'ASC' ? 'ASC' : defaultDir;
  return { sortBy, sortDir };
};

// Wraps the app's standard success() envelope with pagination metadata,
// keeping the existing resource key name (e.g. "users", "clients") so
// frontend call sites don't need to change how they read the response.
export const paginatedSuccess = (res, success, key, rows, total, { page, limit }) =>
  success(res, { [key]: rows, page, limit, total, totalPages: Math.ceil(total / limit) || 0 });
