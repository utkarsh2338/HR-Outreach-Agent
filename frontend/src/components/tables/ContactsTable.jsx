import { useState } from 'react';
import { RiDeleteBin6Line, RiArrowUpDownLine } from 'react-icons/ri';
import { StatusSelect } from '../common/StatusSelect.jsx';
import { StatusBadge } from '../common/Badge.jsx';
import { TableSkeleton } from '../common/Skeleton.jsx';
import { EmptyState } from '../common/EmptyState.jsx';
import { useUpdateContact, useDeleteContact } from '../../hooks/useContacts.js';
import { shortDate, relativeTime } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const COLUMNS = [
  { key: 'name',             label: 'Name',           sortable: true,  width: 'w-48' },
  { key: 'company',          label: 'Company',         sortable: true,  width: 'w-40' },
  { key: 'email',            label: 'Email',           sortable: false, width: 'w-52' },
  { key: 'status',           label: 'Status',          sortable: false, width: 'w-36' },
  { key: 'tags',             label: 'Tags',            sortable: false, width: 'w-36' },
  { key: 'last_contacted_at',label: 'Last Contacted',  sortable: true,  width: 'w-32' },
  { key: 'actions',          label: '',                sortable: false, width: 'w-16' },
];

const SortIcon = ({ column, sortKey, sortDir }) => {
  const active = sortKey === column;
  return (
    <RiArrowUpDownLine
      className={cn('w-3 h-3 ml-1 shrink-0', active ? 'text-gray-700' : 'text-gray-300')}
      aria-hidden="true"
    />
  );
};

const TagPills = ({ tags }) => {
  if (!tags?.length) return <span className="text-gray-300">—</span>;
  const visible = tags.slice(0, 2);
  const overflow = tags.length - 2;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium bg-gray-100 text-gray-600"
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-2xs text-gray-400">+{overflow}</span>
      )}
    </div>
  );
};

const ContactRow = ({ contact, onStatusChange, onDelete, mutatingId }) => {
  const isMutating = mutatingId === contact._id;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 truncate max-w-[11rem]">
            {contact.name}
          </span>
          {contact.role_title && (
            <span className="text-xs text-gray-400 truncate max-w-[11rem]">
              {contact.role_title}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[10rem]">
        {contact.company}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-500 truncate block max-w-[13rem]">
          {contact.email}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusSelect
          value={contact.status}
          onChange={(status) => onStatusChange(contact._id, status)}
          disabled={isMutating}
        />
      </td>
      <td className="px-4 py-3">
        <TagPills tags={contact.tags} />
      </td>
      <td className="px-4 py-3">
        <span
          className="text-xs text-gray-500 cursor-default"
          title={relativeTime(contact.last_contacted_at)}
        >
          {shortDate(contact.last_contacted_at)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(contact._id)}
            disabled={isMutating}
            aria-label={`Delete ${contact.name}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <RiDeleteBin6Line className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
};

/**
 * Full-featured contacts table with sticky header, inline status editing,
 * sortable columns (client-side on current page), and delete action.
 */
export const ContactsTable = ({ data, isLoading, isError }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [mutatingId, setMutatingId] = useState(null);

  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleStatusChange = async (id, status) => {
    setMutatingId(id);
    try {
      await updateContact.mutateAsync({ id, data: { status } });
    } finally {
      setMutatingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this contact?')) return;
    setMutatingId(id);
    try {
      await deleteContact.mutateAsync(id);
    } finally {
      setMutatingId(null);
    }
  };

  // Client-side sort on current page
  const contacts = data?.contacts ?? [];
  const sorted = sortKey
    ? [...contacts].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : contacts;

  return (
    <div className="table-container">
      <table className="w-full border-collapse" aria-label="Contacts table">
        <thead className="thead-sticky">
          <tr className="border-b border-gray-200">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap',
                  col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                  col.width
                )}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.sortable && (
                    <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {isLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : isError ? (
          <tbody>
            <tr>
              <td colSpan={7} className="text-center py-12 text-sm text-gray-500">
                Failed to load contacts.
              </td>
            </tr>
          </tbody>
        ) : sorted.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={7}>
                <EmptyState
                  title="No contacts found"
                  description="Try adjusting your search or filters."
                />
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {sorted.map((contact) => (
              <ContactRow
                key={contact._id}
                contact={contact}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                mutatingId={mutatingId}
              />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
};
