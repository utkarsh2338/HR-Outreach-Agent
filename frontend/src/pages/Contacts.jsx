import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiSearchLine, RiFilterLine, RiSparklingLine, RiMailSendLine } from 'react-icons/ri';
import { AppLayout, PageHeader } from '../components/layout/AppLayout.jsx';
import { ContactsTable } from '../components/tables/ContactsTable.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { Button } from '../components/common/Button.jsx';
import { useContacts } from '../hooks/useContacts.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { generateSelectedDrafts } from '../api/contacts.js';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'queued', label: 'Queued' },
  { value: 'draft_pending', label: 'Draft Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'opened', label: 'Opened' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'no_response', label: 'No Response' },
  { value: 'closed', label: 'Closed' },
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
        placeholder="Search HRs by name, company, email..."
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
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const search = useDebounce(searchInput, 350);

  const handleSearch = (val) => { setSearchInput(val); setPage(1); setSelectedIds([]); };
  const handleStatus = (val) => { setStatus(val); setPage(1); setSelectedIds([]); };

  const filters = {
    ...(search && { search }),
    ...(status && { status }),
    page,
    limit: PAGE_LIMIT,
  };

  const { data, isLoading, isError, refetch } = useContacts(filters);

  const contacts = data?.contacts ?? [];

  const handleToggleCheck = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (currentPageIds) => {
    if (selectedIds.length === currentPageIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentPageIds);
    }
  };

  const handleGenerateDrafts = async () => {
    const idsToProcess = selectedIds.length > 0 ? selectedIds : contacts.map((c) => c._id);
    const count = idsToProcess.length;

    if (count === 0) {
      window.alert('No HR contacts available on this page.');
      return;
    }

    if (!window.confirm(`Generate cold email drafts for ${count} HR contact${count !== 1 ? 's' : ''} now?`)) {
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateSelectedDrafts(idsToProcess);
      window.alert(res.message || `Successfully generated ${res.drafted} draft(s)! Redirecting to Pending Drafts...`);
      setSelectedIds([]);
      navigate('/pending');
    } catch (err) {
      window.alert(`Failed to generate drafts: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="HR Contacts List"
        description={
          data?.total !== undefined
            ? `${data.total.toLocaleString()} HR contact${data.total !== 1 ? 's' : ''} loaded from local storage`
            : 'Review HR names, company details, and job titles.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={isGenerating}
              disabled={isGenerating || contacts.length === 0}
              onClick={handleGenerateDrafts}
            >
              <RiSparklingLine className="w-4 h-4" />
              {selectedIds.length > 0
                ? `Generate Draft for Selected HRs (${selectedIds.length})`
                : `Generate Draft for All HRs (${contacts.length})`}
            </Button>
          </div>
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
            selectedIds={selectedIds}
            onToggleCheck={handleToggleCheck}
            onToggleSelectAll={handleToggleSelectAll}
          />
        </div>

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={(p) => { setPage(p); setSelectedIds([]); }}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Contacts;
