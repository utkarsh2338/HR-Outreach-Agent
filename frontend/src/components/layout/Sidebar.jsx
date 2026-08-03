import { NavLink } from 'react-router-dom';
import {
  RiBarChartBoxLine,
  RiContactsLine,
  RiFileList3Line,
  RiBellLine,
  RiCircleFill,
  RiUser3Line,
  RiSettings4Line
} from 'react-icons/ri';
import { cn } from '../../utils/cn.js';
import { usePendingDrafts } from '../../hooks/useEmailLogs.js';
import { useNeedsAttention } from '../../hooks/useContacts.js';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Pipeline',
    icon: RiBarChartBoxLine,
    end: true,
  },
  {
    to: '/contacts',
    label: 'Contacts',
    icon: RiContactsLine,
  },
  {
    to: '/drafts',
    label: 'Pending Drafts',
    icon: RiFileList3Line,
    countKey: 'drafts',
  },
  {
    to: '/needs-attention',
    label: 'Needs Attention',
    icon: RiBellLine,
    countKey: 'attention',
  },
  {
    to: '/profile',
    label: 'My Profile & Resume',
    icon: RiUser3Line,
  },
  {
    to: '/settings',
    label: 'Settings & Guardrails',
    icon: RiSettings4Line,
  },
];

const NavItem = ({ to, label, icon: Icon, end, count, urgent }) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 px-3 h-8 rounded text-sm font-medium transition-colors select-none',
          isActive
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('w-4 h-4 shrink-0', isActive ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-600')}
            aria-hidden="true"
          />
          <span className="flex-1 truncate">{label}</span>
          {count > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-2xs font-semibold tabular-nums',
                urgent
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

export const Sidebar = () => {
  const { data: draftsData } = usePendingDrafts({ limit: 1, page: 1 });
  const { data: attentionData } = useNeedsAttention({ limit: 1, page: 1 });

  const counts = {
    drafts: draftsData?.total ?? 0,
    attention: attentionData?.total ?? 0,
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-200 flex flex-col z-20">
      {/* App header */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 shrink-0">
        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center shrink-0">
          <RiCircleFill className="w-2.5 h-2.5 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate">HR Outreach</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            count={item.countKey ? counts[item.countKey] : 0}
            urgent={item.countKey === 'attention'}
          />
        ))}
      </nav>

      {/* Footer: API status */}
      <div className="px-4 py-3 border-t border-gray-200 shrink-0">
        <p className="text-2xs text-gray-400 truncate">
          {import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}
        </p>
      </div>
    </aside>
  );
};
