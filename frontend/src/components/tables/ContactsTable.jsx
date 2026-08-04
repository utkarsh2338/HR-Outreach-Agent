import { useState } from 'react';
import { RiDeleteBin6Line, RiArrowUpDownLine } from 'react-icons/ri';
import { StatusSelect } from '../common/StatusSelect.jsx';
import { TableSkeleton } from '../common/Skeleton.jsx';
import { EmptyState } from '../common/EmptyState.jsx';
import { useUpdateContact, useDeleteContact } from '../../hooks/useContacts.js';
import { shortDate, relativeTime } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const COLUMNS = [
  { key: 'name', label: 'HR Name & Title', sortable: true, width: 'w-56' },
  { key: 'company', label: 'Company', sortable: true, width: 'w-44' },
  { key: 'email', label: 'Email Address', sortable: false, width: 'w-56' },
  { key: 'status', label: 'Status', sortable: false, width: 'w-36' },
  { key: 'last_contacted_at', label: 'Last Contacted', sortable: true, width: 'w-32' },
  { key: 'actions', label: '', sortable: false, width: 'w-12' },
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

const ContactRow = ({ contact, isChecked, onToggleCheck, onStatusChange, onDelete, mutatingId }) => {
  const isMutating = mutatingId === contact._id;

  return (
    <tr className={`border-b border-gray-100 transition-colors ${isChecked ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}>
      {/* Checkbox */}
      <td className="px-3 py-3 w-10 text-center">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleCheck(contact._id)}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
        />
      </td>

      {/* Name & Title */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 truncate max-w-[13rem]">
            {contact.name || 'Recruiter'}
          </span>
          {contact.role_title && (
            <span className="text-xs text-gray-500 truncate max-w-[13rem]">
              {contact.role_title}
            </span>
          )}
        </div>
      </td>

      {/* Company & Domain */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-800 truncate max-w-[11rem]">
            {contact.company || 'Company'}
          </span>
          {contact.company_domain && (
            <a
              href={contact.company_domain.startsWith('http') ? contact.company_domain : `https://${contact.company_domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-2xs text-indigo-600 hover:underline truncate max-w-[11rem]"
            >
              {contact.company_domain.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600 font-mono truncate block max-w-[14rem]">
          {contact.email || '—'}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusSelect
          value={contact.status}
          onChange={(status) => onStatusChange(contact._id, status)}
          disabled={isMutating}
        />
      </td>

      {/* Last Contacted */}
      <td className="px-4 py-3">
        <span
          className="text-xs text-gray-400 cursor-default"
          title={relativeTime(contact.last_contacted_at)}
        >
          {shortDate(contact.last_contacted_at)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(contact._id)}
            disabled={isMutating}
            aria-label={`Delete ${contact.name}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <RiDeleteBin6Line className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const ContactsTable = ({
  data,
  isLoading,
  isError,
  selectedIds = [],
  onToggleCheck,
  onToggleSelectAll
}) => {
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
    if (!window.confirm('Remove this HR contact?')) return;
    setMutatingId(id);
    try {
      await deleteContact.mutateAsync(id);
    } finally {
      setMutatingId(null);
    }
  };

  const contacts = data?.contacts ?? [];
  const sorted = sortKey
    ? [...contacts].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : contacts;

  const isAllSelected = sorted.length > 0 && selectedIds.length === sorted.length;

  return (
    <div className="table-container">
      <table className="w-full border-collapse" aria-label="Contacts table">
        <thead className="thead-sticky">
          <tr className="border-b border-gray-200">
            <th scope="col" className="px-3 py-2.5 w-10 text-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => onToggleSelectAll(sorted.map((c) => c._id))}
                disabled={sorted.length === 0}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                title="Select all HRs on this page"
              />
            </th>
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
                Failed to load HR contacts.
              </td>
            </tr>
          </tbody>
        ) : sorted.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={7}>
                <EmptyState
                  title="No contacts found"
                  description="No HR contacts matched your search filter."
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
                isChecked={selectedIds.includes(contact._id)}
                onToggleCheck={onToggleCheck}
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
