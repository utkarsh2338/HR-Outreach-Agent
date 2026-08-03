import { RiInboxLine } from 'react-icons/ri';

/**
 * Empty state for tables and lists when there's no data to display.
 */
export const EmptyState = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mb-4">
      <RiInboxLine className="w-5 h-5 text-gray-400" aria-hidden="true" />
    </div>
    <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
    {description && (
      <p className="text-sm text-gray-500 max-w-xs">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
