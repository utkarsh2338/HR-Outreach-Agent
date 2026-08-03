import { useQueries, useQueryClient } from '@tanstack/react-query';
import { getContacts } from '../api/contacts.js';
import { getPendingDrafts } from '../api/emailLogs.js';

const FUNNEL_STAGES = [
  { status: 'queued',     label: 'Queued',     color: '#94a3b8' },
  { status: 'sent',       label: 'Sent',       color: '#60a5fa' },
  { status: 'opened',     label: 'Opened',     color: '#a78bfa' },
  { status: 'replied',    label: 'Replied',    color: '#818cf8' },
  { status: 'interested', label: 'Interested', color: '#34d399' },
];

const KPI_STATUSES = ['new', 'draft_pending', 'not_interested', 'closed'];

/**
 * Fetches all pipeline counts in parallel using React Query's useQueries.
 * Returns funnel data, KPI metrics, and loading/error state.
 */
export const usePipeline = () => {
  const allStatusQueries = [
    ...FUNNEL_STAGES.map(({ status }) => ({
      queryKey: ['contacts', 'count', status],
      queryFn: () => getContacts({ status, limit: 1, page: 1 }),
      staleTime: 60_000,
    })),
    ...KPI_STATUSES.map((status) => ({
      queryKey: ['contacts', 'count', status],
      queryFn: () => getContacts({ status, limit: 1, page: 1 }),
      staleTime: 60_000,
    })),
    {
      queryKey: ['email-logs', 'pending', 'count'],
      queryFn: () => getPendingDrafts({ limit: 1, page: 1 }),
      staleTime: 30_000,
    },
  ];

  const results = useQueries({ queries: allStatusQueries });

  const isLoading = results.some((r) => r.isPending);
  const isError = results.some((r) => r.isError);

  // Funnel data (first N results correspond to FUNNEL_STAGES)
  const funnelData = FUNNEL_STAGES.map((stage, i) => ({
    name: stage.label,
    value: results[i]?.data?.total ?? 0,
    color: stage.color,
  }));

  // KPI status counts
  const [newCount, draftPendingCount, notInterestedCount, closedCount] = KPI_STATUSES.map(
    (_, i) => results[FUNNEL_STAGES.length + i]?.data?.total ?? 0
  );

  const pendingDraftsCount = results[results.length - 1]?.data?.total ?? 0;

  const sentCount = funnelData.find((d) => d.name === 'Sent')?.value ?? 0;
  const repliedCount = funnelData.find((d) => d.name === 'Replied')?.value ?? 0;
  const interestedCount = funnelData.find((d) => d.name === 'Interested')?.value ?? 0;
  const openedCount = funnelData.find((d) => d.name === 'Opened')?.value ?? 0;

  const replyRate = sentCount > 0
    ? ((repliedCount + interestedCount) / sentCount) * 100
    : 0;

  const openRate = sentCount > 0
    ? (openedCount / sentCount) * 100
    : 0;

  return {
    funnelData,
    kpis: {
      totalSent: sentCount,
      replyRate: replyRate.toFixed(1),
      openRate: openRate.toFixed(1),
      pendingDrafts: pendingDraftsCount,
      interested: interestedCount,
      newContacts: newCount,
    },
    isLoading,
    isError,
  };
};
