import { useState } from 'react';
import { RiCheckLine } from 'react-icons/ri';
import { AppLayout, PageHeader } from '../components/layout/AppLayout.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { ErrorState } from '../components/common/ErrorState.jsx';
import { ClassificationBadge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { TableSkeleton } from '../components/common/Skeleton.jsx';
import { useNeedsAttention, useUpdateContact } from '../hooks/useContacts.js';
import { relativeTime, truncate } from '../utils/format.js';

const PAGE_LIMIT = 20;

const AttentionRow = ({ item, onMarkHandled, markingId }) => {
  const { contact, latest_reply: reply } = item;
  const isMarking = markingId === contact._id;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 align-top">
      {/* Contact */}
      <td className="px-4 py-3 w-48">
        <div className="space-y-0.5">
          <span className="text-sm font-medium text-gray-900 block truncate max-w-[11rem]">
            {contact.name}
          </span>
          <span className="text-xs text-gray-400 block truncate max-w-[11rem]">
            {contact.company}
          </span>
          <span className="text-xs text-gray-400 block truncate max-w-[11rem]">
            {contact.email}
          </span>
          {contact.role_title && (
            <span className="text-xs text-gray-300 block truncate max-w-[11rem]">
              {contact.role_title}
            </span>
          )}
        </div>
      </td>

      {/* Latest reply */}
      <td className="px-4 py-3">
        {reply ? (
          <div className="space-y-1 min-w-0">
            <span className="text-xs text-gray-500 font-medium block truncate max-w-sm">
              Re: {reply.subject ?? '(no subject)'}
            </span>
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 max-w-lg">
              {truncate(reply.body ?? reply.raw_reply_text, 200)}
            </p>
            {reply.classification_reason && (
              <p className="text-2xs text-gray-400 italic">
                {reply.classification_reason}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">No reply logged</span>
        )}
      </td>

      {/* Classification */}
      <td className="px-4 py-3 w-36">
        {reply?.classification ? (
          <ClassificationBadge classification={reply.classification} />
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Last activity */}
      <td className="px-4 py-3 w-32">
        <span
          className="text-xs text-gray-400"
          title={reply ? new Date(reply.sent_at || reply.createdAt).toLocaleString() : ''}
        >
          {reply ? relativeTime(reply.sent_at || reply.createdAt) : '—'}
        </span>
      </td>

      {/* Action */}
      <td className="px-4 py-3 w-36">
        <Button
          variant="ghost"
          size="sm"
          loading={isMarking}
          disabled={isMarking}
          onClick={() => onMarkHandled(contact._id)}
          aria-label={`Mark ${contact.name} as handled`}
        >
          <RiCheckLine className="w-3.5 h-3.5" aria-hidden="true" />
          Mark Handled
        </Button>
      </td>
    </tr>
  );
};

const NeedsAttention = () => {
  const [page, setPage] = useState(1);
  const [markingId, setMarkingId] = useState(null);

  const { data, isLoading, isError, refetch } = useNeedsAttention({ page, limit: PAGE_LIMIT });
  const updateContact = useUpdateContact();

  const handleMarkHandled = async (contactId) => {
    setMarkingId(contactId);
    try {
      await updateContact.mutateAsync({ id: contactId, data: { needs_attention: false } });
    } catch (err) {
      window.alert(`Failed to update: ${err.message}`);
    } finally {
      setMarkingId(null);
    }
  };

  const items = data?.contacts ?? [];

  return (
    <AppLayout>
      <PageHeader
        title="Needs Attention"
        description={
          data?.total !== undefined
            ? `${data.total} contact${data.total !== 1 ? 's' : ''} with replies requiring action`
            : 'Contacts that replied with interest and are awaiting your response.'
        }
      />

      <div className="flex flex-col h-[calc(100vh-89px)]">
        <div className="flex-1 overflow-auto">
          {isError ? (
            <ErrorState
              message="Could not load contacts needing attention."
              onRetry={refetch}
            />
          ) : (
            <table className="w-full border-collapse" aria-label="Contacts needing attention">
              <thead className="thead-sticky border-b border-gray-200">
                <tr>
                  {['Contact', 'Latest Reply', 'AI Classification', 'Last Activity', ''].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {isLoading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="No contacts need attention"
                        description="Contacts with interested replies will appear here automatically after the next inbox poll."
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {items.map((item) => (
                    <AttentionRow
                      key={item.contact._id}
                      item={item}
                      onMarkHandled={handleMarkHandled}
                      markingId={markingId}
                    />
                  ))}
                </tbody>
              )}
            </table>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default NeedsAttention;
