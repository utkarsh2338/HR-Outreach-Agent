import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

/**
 * Pagination control bar.
 * Displays current range, total, and previous/next buttons.
 */
export const Pagination = ({ page, limit, total, totalPages, onPageChange }) => {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-xs text-gray-500">
        {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RiArrowLeftSLine className="w-4 h-4" aria-hidden="true" />
        </button>

        <span className="px-2 text-xs text-gray-700 font-medium tabular-nums">
          {page} / {totalPages || 1}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RiArrowRightSLine className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
