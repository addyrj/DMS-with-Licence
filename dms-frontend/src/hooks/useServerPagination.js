// src/hooks/useServerPagination.js
// Server-side replacement for the old client-side usePagination — page/search
// are part of the react-query key, so paging/searching triggers a real API
// call instead of slicing an already-fetched array.
// Usage:
//   const { data, page, setPage, search, setSearchInput, total, totalPages, isLoading } =
//     useServerPagination(['users'], getUsers, { limit: 15 });
//   const users = data?.users || [];
//   <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export default function useServerPagination(queryKey, fetchFn, { limit = 15, debounceMs = 400, enabled = true, ...queryOptions } = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounceRef = useRef();

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Debounced so typing in a search box doesn't fire a request per keystroke.
  const setSearchInput = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, debounceMs);
  }, [debounceMs]);

  const query = useQuery({
    queryKey: [...queryKey, page, limit, search],
    queryFn: () => fetchFn({ page, limit, search }),
    placeholderData: keepPreviousData,
    enabled,
    ...queryOptions,
  });

  return {
    ...query,
    page, setPage,
    search, setSearchInput,
    limit,
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 0,
  };
}
