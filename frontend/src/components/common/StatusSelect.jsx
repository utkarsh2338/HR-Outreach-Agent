import { STATUS_OPTIONS } from './Badge.jsx';
import { cn } from '../../utils/cn.js';

const STATUS_CLASSES = {
  new:            'bg-gray-100 text-gray-600',
  queued:         'bg-blue-50 text-blue-700',
  draft_pending:  'bg-amber-50 text-amber-700',
  sent:           'bg-sky-50 text-sky-700',
  opened:         'bg-violet-50 text-violet-700',
  replied:        'bg-indigo-50 text-indigo-700',
  interested:     'bg-emerald-50 text-emerald-700',
  not_interested: 'bg-red-50 text-red-600',
  no_response:    'bg-gray-100 text-gray-500',
  closed:         'bg-gray-100 text-gray-400',
};

/**
 * Inline status selector that looks like a badge.
 * Fires onChange when the user picks a new status.
 */
export const StatusSelect = ({ value, onChange, disabled = false }) => {
  const colorClass = STATUS_CLASSES[value] ?? 'bg-gray-100 text-gray-500';

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Change contact status"
      className={cn(
        'appearance-none rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer',
        'border-0 ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        colorClass
      )}
    >
      {STATUS_OPTIONS.map(({ value: v, label }) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
};
