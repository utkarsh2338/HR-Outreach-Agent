import { cn } from '../../utils/cn.js';

const STATUS_CONFIG = {
  new:            { label: 'New',            base: 'bg-gray-100 text-gray-600' },
  queued:         { label: 'Queued',         base: 'bg-blue-50 text-blue-700' },
  draft_pending:  { label: 'Draft Pending',  base: 'bg-amber-50 text-amber-700' },
  sent:           { label: 'Sent',           base: 'bg-sky-50 text-sky-700' },
  opened:         { label: 'Opened',         base: 'bg-violet-50 text-violet-700' },
  replied:        { label: 'Replied',        base: 'bg-indigo-50 text-indigo-700' },
  interested:     { label: 'Interested',     base: 'bg-emerald-50 text-emerald-700' },
  not_interested: { label: 'Not Interested', base: 'bg-red-50 text-red-600' },
  no_response:    { label: 'No Response',    base: 'bg-gray-100 text-gray-500' },
  closed:         { label: 'Closed',         base: 'bg-gray-100 text-gray-400' },
};

const CLASSIFICATION_CONFIG = {
  interested:     { label: 'Interested',     base: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  not_interested: { label: 'Not Interested', base: 'bg-red-50 text-red-600 border border-red-200' },
  auto_reply:     { label: 'Auto Reply',     base: 'bg-gray-100 text-gray-500 border border-gray-200' },
  bounce:         { label: 'Bounce',         base: 'bg-orange-50 text-orange-700 border border-orange-200' },
  out_of_office:  { label: 'Out of Office',  base: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  unclear:        { label: 'Unclear',        base: 'bg-gray-100 text-gray-400 border border-gray-200' },
};

/**
 * Displays a status badge for a contact's status field.
 */
export const StatusBadge = ({ status, className }) => {
  const config = STATUS_CONFIG[status] ?? { label: status, base: 'bg-gray-100 text-gray-500' };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        config.base,
        className
      )}
    >
      {config.label}
    </span>
  );
};

/**
 * Displays a classification badge for a reply classification.
 */
export const ClassificationBadge = ({ classification, className }) => {
  const config = CLASSIFICATION_CONFIG[classification] ?? {
    label: classification,
    base: 'bg-gray-100 text-gray-500 border border-gray-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        config.base,
        className
      )}
    >
      {config.label}
    </span>
  );
};

/**
 * Small pill badge for LLM-generated vs template indicator.
 */
export const LLMBadge = ({ llmGenerated }) => {
  if (llmGenerated) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
        AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      Template
    </span>
  );
};

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}));
