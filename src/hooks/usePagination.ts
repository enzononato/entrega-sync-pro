import { useState, useMemo } from 'react';

const PAGE_SIZE = 25;

export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0);

  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Reset page when items change drastically
  const safeePage = page >= totalPages ? Math.max(0, totalPages - 1) : page;

  const paginatedItems = useMemo(
    () => items.slice(safeePage * pageSize, (safeePage + 1) * pageSize),
    [items, safeePage, pageSize]
  );

  const resetPage = () => setPage(0);

  return {
    page: safeePage,
    setPage,
    resetPage,
    totalCount,
    totalPages,
    paginatedItems,
    pageSize,
    from: safeePage * pageSize + 1,
    to: Math.min((safeePage + 1) * pageSize, totalCount),
  };
}
