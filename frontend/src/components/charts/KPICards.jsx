import {
  RiMailSendLine,
  RiReplyLine,
  RiEyeLine,
  RiFileList3Line,
  RiUserHeartLine,
} from 'react-icons/ri';
import { KPISkeleton } from '../common/Skeleton.jsx';

const KPI_DEFINITIONS = [
  {
    key: 'totalSent',
    label: 'Total Sent',
    icon: RiMailSendLine,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'replyRate',
    label: 'Reply Rate',
    icon: RiReplyLine,
    format: (v) => `${v}%`,
  },
  {
    key: 'openRate',
    label: 'Open Rate',
    icon: RiEyeLine,
    format: (v) => `${v}%`,
  },
  {
    key: 'interested',
    label: 'Interested',
    icon: RiUserHeartLine,
    format: (v) => v.toLocaleString(),
    highlight: true,
  },
  {
    key: 'pendingDrafts',
    label: 'Pending Drafts',
    icon: RiFileList3Line,
    format: (v) => v.toLocaleString(),
  },
];

const KPICard = ({ label, value, icon: Icon, highlight, isLoading }) => (
  <div className="border border-gray-200 rounded p-4">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <Icon
        className="w-3.5 h-3.5 text-gray-300"
        aria-hidden="true"
      />
    </div>
    {isLoading ? (
      <div className="h-7 w-16 animate-pulse rounded bg-gray-100" />
    ) : (
      <span
        className={`text-2xl font-semibold tabular-nums tracking-tight ${
          highlight ? 'text-emerald-700' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    )}
  </div>
);

/**
 * Row of KPI metric cards below the funnel chart.
 */
export const KPICards = ({ kpis, isLoading }) => (
  <div className="grid grid-cols-5 gap-4">
    {KPI_DEFINITIONS.map(({ key, label, icon, format, highlight }) => (
      <KPICard
        key={key}
        label={label}
        icon={icon}
        value={kpis?.[key] !== undefined ? format(kpis[key]) : '—'}
        highlight={highlight}
        isLoading={isLoading}
      />
    ))}
  </div>
);
