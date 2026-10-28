import { useEffect, useState } from 'react';

/**
 * Client-side paging over an array. Resets to page 1 whenever `resetKey` changes (e.g. filters).
 */
export function usePagination(items, pageSize, resetKey) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // Stay in range when items shrink (e.g. after a delete).
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice(start, start + pageSize),
    start,
    total: items.length,
  };
}

export default function Pagination({ page, pageCount, setPage, start, pageItems, total }) {
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span className="pagination-info">
        {start + 1}–{start + pageItems.length} of {total}
      </span>
      {pageCount > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="pagination-info">Page {page} of {pageCount}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
