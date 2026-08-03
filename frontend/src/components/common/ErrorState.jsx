import { RiAlertLine, RiRefreshLine } from 'react-icons/ri';

/**
 * Error state component for failed API requests.
 * Shows the error message and a retry callback if provided.
 */
export const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mb-4">
      <RiAlertLine className="w-5 h-5 text-red-400" aria-hidden="true" />
    </div>
    <p className="text-sm font-medium text-gray-900 mb-1">Something went wrong</p>
    <p className="text-sm text-gray-500 max-w-xs">
      {message || 'Failed to load data. Check that the API server is running.'}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        <RiRefreshLine className="w-4 h-4" aria-hidden="true" />
        Try again
      </button>
    )}
  </div>
);

/**
 * Compact inline error for form fields or small contexts.
 */
export const InlineError = ({ message }) => {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-600" role="alert">
      {message}
    </p>
  );
};
