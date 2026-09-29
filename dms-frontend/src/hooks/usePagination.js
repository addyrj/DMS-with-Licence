// src/hooks/usePagination.js
// Universal frontend pagination hook
// Usage: const { paged, page, setPage, totalPages, total, Pager } = usePagination(items, 15)
import { useState, useMemo } from 'react';
import Pagination from '../components/ui/Pagination';

export default function usePagination(items = [], pageSize = 15) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  
  // Reset to page 1 if items change and current page is out of bounds
  const safePage = page > totalPages ? 1 : page;
  
  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  const Pager = () => (
    <Pagination 
      page={safePage} 
      totalPages={totalPages} 
      total={total} 
      pageSize={pageSize} 
      onPage={setPage}
    />
  );

  return { paged, page: safePage, setPage, totalPages, total, pageSize, Pager };
}
