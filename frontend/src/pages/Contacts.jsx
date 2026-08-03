import { useState } from 'react';
import { RiSearchLine, RiFilterLine } from 'react-icons/ri';
import { AppLayout, PageHeader } from '../components/layout/AppLayout.jsx';
import { ContactsTable } from '../components/tables/ContactsTable.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { useContacts } from '../hooks/useContacts.js';
import { useDebounce } from '../hooks/useDebounce.js';

const STATUS_FILTER_OPTIONS = [
  { value: '',               label: 'All Statuses' },
  { value: 'new',            label: 'New' },
  { value: 'queued',         label: 'Queued' },
  { value: 'draft_pending',  label: 'Draft Pending' },
  { value: 'sent',           label: 'Sent' },
  { value: 'opened',         label: 'Opened' },
  { value: 'replied',        label: 'Replied' },
  { value: 'interested',     label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'no_response',    label: 'No Response' },
  { value: 'closed',         label: 'Closed' },
];

const PAGE_LIMIT = 25;

const FilterBar = ({ search, onSearch, status, onStatus }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
    {/* Search */}
    <div className="relative flex-1 max-w-xs">
      <RiSearchLine
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search contacts"
        className="w-full pl-8 pr-3 h-8 text-sm border border-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 focus:border-indigo-500"
      />
    </div>

    {/* Status filter */}
    <div className="flex items-center gap-1.5">
      <RiFilterLine className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value)}
        aria-label="Filter by status"
        className="h-8 px-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500"
      >
        {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  </div>
);

const Contacts = () => {
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const search = useDebounce(searchInput, 350);

  // Reset to page 1 when filters change
  const handleSearch = (val) => { setSearchInput(val); setPage(1); };
  const handleStatus = (val) => { setStatus(val); setPage(1); };

  const filters = {
    ...(search && { search }),
    ...(status && { status }),
    page,
    limit: PAGE_LIMIT,
  };

  const { data, isLoading, isError, refetch } = useContacts(filters);

  return (
    <AppLayout>
      <PageHeader
        title="Contacts"
        description={
          data?.total !== undefined
            ? `${data.total.toLocaleString()} contact${data.total !== 1 ? 's' : ''}`
            : 'Your outreach contact list.'
        }
      />

      <div className="flex flex-col h-[calc(100vh-89px)]">
        <FilterBar
          search={searchInput}
          onSearch={handleSearch}
          status={status}
          onStatus={handleStatus}
        />

        <div className="flex-1 overflow-hidden">
          <ContactsTable
            data={data}
            isLoading={isLoading}
            isError={isError}
          />
        </div>

        {data && (
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

export default Contacts;
