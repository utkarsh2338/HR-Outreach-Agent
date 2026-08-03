import { useQueryClient } from '@tanstack/react-query';
import { RiRefreshLine } from 'react-icons/ri';
import { AppLayout, PageHeader } from '../components/layout/AppLayout.jsx';
import { PipelineFunnel } from '../components/charts/PipelineFunnel.jsx';
import { KPICards } from '../components/charts/KPICards.jsx';
import { StatusBadge } from '../components/common/Badge.jsx';
import { ErrorState } from '../components/common/ErrorState.jsx';
import { Button } from '../components/common/Button.jsx';
import { usePipeline } from '../hooks/usePipeline.js';
import { useContacts } from '../hooks/useContacts.js';
import { shortDate, relativeTime } from '../utils/format.js';

const RecentActivity = ({ contacts, isLoading }) => {
  if (isLoading) {
    return (
      <ul className="divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="py-3 flex items-center gap-3">
            <div className="w-28 h-3.5 animate-pulse rounded bg-gray-100" />
            <div className="w-20 h-3.5 animate-pulse rounded bg-gray-100" />
            <div className="ml-auto w-12 h-3.5 animate-pulse rounded bg-gray-100" />
          </li>
        ))}
      </ul>
    );
  }

  if (!contacts?.length) {
    return <p className="text-sm text-gray-400 py-4">No recent activity.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {contacts.map((contact) => (
        <li
          key={contact._id}
          className="py-3 flex items-center gap-3 min-w-0"
        >
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-900 truncate block">
              {contact.name}
            </span>
            <span className="text-xs text-gray-400 truncate block">
              {contact.company}
            </span>
          </div>
          <StatusBadge status={contact.status} />
          <span
            className="text-xs text-gray-400 shrink-0 tabular-nums"
            title={relativeTime(contact.updatedAt)}
          >
            {shortDate(contact.updatedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
};

const Pipeline = () => {
  const queryClient = useQueryClient();
  const { funnelData, kpis, isLoading, isError } = usePipeline();

  // Recent contacts sorted by updatedAt (server returns newest first)
  const { data: recentData, isLoading: recentLoading } = useContacts({
    limit: 6,
    page: 1,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['email-logs'] });
  };

  if (isError) {
    return (
      <AppLayout>
        <PageHeader title="Pipeline" />
        <div className="px-8 py-16">
          <ErrorState
            message="Could not load pipeline data. Is the API server running?"
            onRetry={handleRefresh}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Pipeline"
        description="Overview of the outreach funnel and contact progression."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            aria-label="Refresh pipeline data"
          >
            <RiRefreshLine className="w-3.5 h-3.5" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="px-8 py-6 space-y-8">
        {/* Funnel */}
        <section aria-labelledby="funnel-heading">
          <h2 id="funnel-heading" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
            Outreach Funnel
          </h2>
          <PipelineFunnel data={funnelData} isLoading={isLoading} />
        </section>

        {/* KPIs */}
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
            Key Metrics
          </h2>
          <KPICards kpis={kpis} isLoading={isLoading} />
        </section>

        {/* Recent Activity */}
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
            Recent Contacts
          </h2>
          <div className="border border-gray-200 rounded">
            <div className="px-4 py-3">
              <RecentActivity
                contacts={recentData?.contacts}
                isLoading={recentLoading}
              />
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Pipeline;
