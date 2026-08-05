import { useState, useEffect, useRef } from 'react';
import {
  RiCheckLine,
  RiDeleteBin6Line,
  RiMailLine,
  RiSparklingLine,
  RiCloseLine,
  RiUser3Line,
  RiBuildingLine,
  RiMailSendLine,
  RiEditLine,
  RiEyeLine,
  RiSave3Line,
  RiCheckboxMultipleLine
} from 'react-icons/ri';
import { AppLayout, PageHeader } from '../components/layout/AppLayout.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { ErrorState } from '../components/common/ErrorState.jsx';
import { LLMBadge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { TableSkeleton } from '../components/common/Skeleton.jsx';
import { usePendingDrafts, useApproveDraft, useDiscardDraft, useUpdateDraft } from '../hooks/useEmailLogs.js';
import { relativeTime, truncate } from '../utils/format.js';
import { batchGenerateDrafts } from '../api/contacts.js';
import { approveBatchDrafts } from '../api/emailLogs.js';

const PAGE_LIMIT = 20;

/* ─── Draft Preview & Editor Drawer ───────────────────────────────────────── */

const DraftDrawer = ({
  draft,
  onClose,
  onApprove,
  onDiscard,
  onSave,
  approvingId,
  discardingId,
  isSaving,
}) => {
  const drawerRef = useRef(null);
  const contact = draft?.contact;
  const isApproving = approvingId === draft?.draft_id;
  const isDiscarding = discardingId === draft?.draft_id;
  const isBusy = isApproving || isDiscarding || isSaving;

  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [activeTab, setActiveTab] = useState('preview');

  useEffect(() => {
    setSubject(draft?.subject ?? '');
    setBody(draft?.body ?? '');
  }, [draft]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  if (!draft) return null;

  const hasChanges = subject !== (draft.subject ?? '') || body !== (draft.body ?? '');

  const handleSave = () => {
    onSave(draft.draft_id, { subject, body });
  };

  const handleApproveAndSend = () => {
    onApprove(draft.draft_id, hasChanges ? { subject, body } : undefined);
  };

  const autoLinkText = (str) => {
    if (!str) return '';
    let html = str;

    html = html.replace(
      /LinkedIn:\s*(https?:\/\/[^\s<"']+)/gi,
      (match, url) => `<a href="${url.replace(/[.,;)]+$/, '')}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">LinkedIn</a>`
    );
    html = html.replace(
      /GitHub:\s*(https?:\/\/[^\s<"']+)/gi,
      (match, url) => `<a href="${url.replace(/[.,;)]+$/, '')}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">GitHub</a>`
    );
    html = html.replace(
      /Portfolio:\s*(https?:\/\/[^\s<"']+)/gi,
      (match, url) => `<a href="${url.replace(/[.,;)]+$/, '')}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Portfolio</a>`
    );
    html = html.replace(
      /Resume PDF:\s*(https?:\/\/[^\s<"']+)/gi,
      (match, url) => `<a href="${url.replace(/[.,;)]+$/, '')}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Resume PDF</a>`
    );

    const urlRegex = /(https?:\/\/[^\s<"']+)/g;
    html = html.replace(urlRegex, (url) => {
      const clean = url.replace(/[.,;)]+$/, '');
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${clean}</a>`;
    });

    return html;
  };

  // Use actual html_body for preview; fall back to plain text with links auto-linked only if edited
  const previewSrcDoc = hasChanges
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.7; color: #1f2937; padding: 16px;">${autoLinkText(body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'))}</body></html>`
    : (draft.html_body || `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, sans-serif; font-size: 14.5px; line-height: 1.7; color: #1f2937; padding: 16px;">${autoLinkText(body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'))}</body></html>`);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit email draft for ${contact?.name ?? 'contact'}`}
        className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <RiUser3Line className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                {contact?.name ?? 'Recruiter'}
              </h2>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                <RiBuildingLine className="w-3.5 h-3.5" />
                {contact?.company ?? 'Company'} &bull; {contact?.email ?? ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition-colors"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between px-6 py-2.5 bg-gray-100/70 border-b border-gray-200 text-xs">
          <div className="flex items-center gap-1 bg-gray-200/80 p-0.5 rounded-md">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'edit'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <RiEditLine className="w-3.5 h-3.5" />
              Edit Content
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'preview'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <RiEyeLine className="w-3.5 h-3.5" />
              HTML Preview
            </button>
          </div>

          {hasChanges && (
            <Button
              variant="secondary"
              size="sm"
              loading={isSaving}
              disabled={isBusy}
              onClick={handleSave}
            >
              <RiSave3Line className="w-3.5 h-3.5" />
              Save Draft
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label htmlFor="draft-subject" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
              Subject Line
            </label>
            <input
              id="draft-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isBusy}
              placeholder="Email subject..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-900"
            />
          </div>

          <div className="flex flex-col flex-1 h-[calc(100%-4rem)] min-h-[320px]">
            <label htmlFor="draft-body" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
              Email Body {activeTab === 'edit' ? '(Editable Plain Text)' : '(Formatted Preview)'}
            </label>

            {activeTab === 'edit' ? (
              <textarea
                id="draft-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isBusy}
                rows={16}
                placeholder="Write your email body here..."
                className="w-full flex-1 p-3.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed font-sans text-gray-800 resize-none"
              />
            ) : (
              <div className="w-full flex-1 border border-gray-200 rounded-md overflow-hidden bg-white">
                <iframe
                  title="Email HTML preview"
                  srcDoc={previewSrcDoc}
                  sandbox="allow-same-origin"
                  className="w-full border-0"
                  style={{ height: '520px' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            Created {relativeTime(draft.created_at)}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={isDiscarding}
              disabled={isBusy}
              onClick={() => onDiscard(draft.draft_id)}
            >
              <RiDeleteBin6Line className="w-3.5 h-3.5" />
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isApproving}
              disabled={isBusy}
              onClick={handleApproveAndSend}
            >
              <RiMailSendLine className="w-3.5 h-3.5" />
              Approve &amp; Send Now
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

/* ─── Draft Row ─────────────────────────────────────────────────────────── */

const DraftRow = ({ draft, isChecked, onToggleCheck, onSelect, onApprove, onDiscard, approvingId, discardingId }) => {
  const isApproving = approvingId === draft.draft_id;
  const isDiscarding = discardingId === draft.draft_id;
  const isBusy = isApproving || isDiscarding;
  const contact = draft.contact;
  const bodyPreview = truncate(draft.body, 160);

  return (
    <tr
      className={`border-b border-gray-100 align-top cursor-pointer transition-colors ${
        isChecked ? 'bg-indigo-50/70' : 'hover:bg-indigo-50/40'
      }`}
      onClick={() => onSelect(draft)}
      title="Click to edit/preview full email"
    >
      {/* Checkbox */}
      <td className="px-3 py-3.5 w-10 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleCheck(draft.draft_id)}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
        />
      </td>

      {/* Recipient */}
      <td className="px-4 py-3 w-48">
        <div className="space-y-0.5">
          <span className="text-sm font-medium text-gray-900 block truncate max-w-[11rem]">
            {contact?.name ?? '—'}
          </span>
          <span className="text-xs text-gray-400 block truncate max-w-[11rem]">
            {contact?.company ?? '—'}
          </span>
          <span className="text-xs text-gray-400 block truncate max-w-[11rem]">
            {contact?.email ?? '—'}
          </span>
        </div>
      </td>

      {/* Subject + body preview */}
      <td className="px-4 py-3">
        <div className="space-y-1 min-w-0">
          <span className="text-sm font-medium text-gray-800 block truncate max-w-xl">
            {draft.subject ?? '(no subject)'}
          </span>
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 max-w-xl">
            {bodyPreview || '(empty body)'}
          </p>
          <span className="text-xs text-indigo-600 font-medium inline-flex items-center gap-1 hover:underline">
            <RiEditLine className="w-3 h-3" /> Click to edit email draft
          </span>
        </div>
      </td>

      {/* Meta */}
      <td className="px-4 py-3 w-32">
        <div className="space-y-1.5">
          <LLMBadge llmGenerated={draft.llm_generated} />
          <span
            className="text-xs text-gray-400 block"
            title={new Date(draft.created_at).toLocaleString()}
          >
            {relativeTime(draft.created_at)}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-40" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            loading={isApproving}
            disabled={isBusy}
            onClick={() => onApprove(draft.draft_id)}
          >
            <RiCheckLine className="w-3.5 h-3.5" />
            Approve &amp; Send
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={isDiscarding}
            disabled={isBusy}
            onClick={() => onDiscard(draft.draft_id)}
          >
            <RiDeleteBin6Line className="w-3.5 h-3.5" />
            Discard
          </Button>
        </div>
      </td>
    </tr>
  );
};

/* ─── Page ───────────────────────────────────────────────────────────────── */

const PendingDrafts = () => {
  const [page, setPage] = useState(1);
  const [approvingId, setApprovingId] = useState(null);
  const [discardingId, setDiscardingId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk selection states
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBatchSending, setIsBatchSending] = useState(false);

  const { data, isLoading, isError, refetch } = usePendingDrafts({ page, limit: PAGE_LIMIT });
  const approveDraft = useApproveDraft();
  const discardDraft = useDiscardDraft();
  const updateDraftMutation = useUpdateDraft();

  const drafts = data?.drafts ?? [];

  const handleToggleCheck = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === drafts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(drafts.map((d) => d.draft_id));
    }
  };

  const handleApprove = async (draftId, payload) => {
    if (!window.confirm('Approve and send this email?')) return;
    setApprovingId(draftId);
    try {
      await approveDraft.mutateAsync({ draftId, data: payload });
      setSelectedDraft(null);
    } catch (err) {
      window.alert(`Failed to send: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDiscard = async (draftId) => {
    if (!window.confirm('Discard this draft? The contact will return to Queued.')) return;
    setDiscardingId(draftId);
    try {
      await discardDraft.mutateAsync(draftId);
      setSelectedDraft(null);
    } catch (err) {
      window.alert(`Failed to discard: ${err.message}`);
    } finally {
      setDiscardingId(null);
    }
  };

  const handleSave = async (draftId, updatedData) => {
    setIsSaving(true);
    try {
      await updateDraftMutation.mutateAsync({ draftId, data: updatedData });
      setSelectedDraft((prev) => (prev ? { ...prev, ...updatedData } : null));
      window.alert('Draft updated successfully!');
    } catch (err) {
      window.alert(`Failed to update draft: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSend = async (idsToSend) => {
    const count = idsToSend.length;
    if (!window.confirm(`Are you sure you want to approve and send ${count} email draft${count > 1 ? 's' : ''} now?`)) {
      return;
    }

    setIsBatchSending(true);
    try {
      const res = await approveBatchDrafts(idsToSend);
      window.alert(res.message || `Successfully sent ${res.sent_count || count} emails!`);
      setSelectedIds([]);
      refetch();
    } catch (err) {
      window.alert(`Batch send error: ${err.message}`);
    } finally {
      setIsBatchSending(false);
    }
  };

  const [batchCount, setBatchCount] = useState(20);

  const handleGenerateNow = async () => {
    setIsGenerating(true);
    try {
      const result = await batchGenerateDrafts(batchCount);
      const drafted = result?.drafted ?? 0;
      const failed = result?.failed_count ?? 0;
      if (drafted === 0 && failed === 0) {
        window.alert('No contacts with status "new" or "queued" were found to draft.');
      } else {
        window.alert(`Done! ${drafted} draft${drafted !== 1 ? 's' : ''} generated${failed > 0 ? `, ${failed} failed` : ''}.`);
        refetch();
      }
    } catch (err) {
      window.alert(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const isAllSelected = drafts.length > 0 && selectedIds.length === drafts.length;

  return (
    <AppLayout>
      <PageHeader
        title="Pending Drafts"
        description={
          data?.total !== undefined
            ? `${data.total} draft${data.total !== 1 ? 's' : ''} awaiting review`
            : 'Email drafts awaiting your approval before sending.'
        }
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <Button
                variant="primary"
                size="sm"
                loading={isBatchSending}
                disabled={isBatchSending}
                onClick={() => handleBatchSend(selectedIds)}
              >
                <RiMailSendLine className="w-3.5 h-3.5" />
                Send Selected ({selectedIds.length})
              </Button>
            ) : drafts.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                loading={isBatchSending}
                disabled={isBatchSending}
                onClick={() => handleBatchSend(drafts.map((d) => d.draft_id))}
              >
                <RiCheckboxMultipleLine className="w-3.5 h-3.5" />
                Send All Drafts ({drafts.length})
              </Button>
            ) : null}

            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value, 10))}
                disabled={isGenerating}
                className="bg-transparent text-xs font-semibold text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                title="Select number of drafts to generate per click"
              >
                <option value={5}>5 Drafts</option>
                <option value={10}>10 Drafts</option>
                <option value={20}>20 Drafts</option>
                <option value={30}>30 Drafts</option>
                <option value={50}>50 Drafts</option>
                <option value={100}>100 Drafts</option>
              </select>
              <Button
                id="generate-drafts-now-btn"
                variant="primary"
                size="sm"
                loading={isGenerating}
                disabled={isGenerating}
                onClick={handleGenerateNow}
              >
                <RiSparklingLine className="w-3.5 h-3.5" />
                {isGenerating ? 'Generating…' : 'Generate Drafts'}
              </Button>
            </div>
          </div>
        }
      />

      <div className="flex flex-col h-[calc(100vh-89px)]">
        <div className="flex-1 overflow-auto">
          {isError ? (
            <ErrorState
              message="Could not load pending drafts."
              onRetry={refetch}
            />
          ) : (
            <table className="w-full border-collapse" aria-label="Pending email drafts">
              <thead className="thead-sticky border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-3 py-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      disabled={drafts.length === 0}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  {['Recipient', 'Subject & Preview', 'Generated', 'Actions'].map((h) => (
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
                <TableSkeleton rows={6} cols={5} />
              ) : drafts.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="No pending drafts"
                        description="All drafts have been sent or discarded."
                        action={
                          <div className="flex items-center gap-1.5 text-sm text-indigo-600">
                            <RiMailLine className="w-4 h-4" />
                            Run batch generation to create new drafts
                          </div>
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {drafts.map((draft) => (
                    <DraftRow
                      key={draft.draft_id}
                      draft={draft}
                      isChecked={selectedIds.includes(draft.draft_id)}
                      onToggleCheck={handleToggleCheck}
                      onSelect={setSelectedDraft}
                      onApprove={handleApprove}
                      onDiscard={handleDiscard}
                      approvingId={approvingId}
                      discardingId={discardingId}
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

      {selectedDraft && (
        <DraftDrawer
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onApprove={handleApprove}
          onDiscard={handleDiscard}
          onSave={handleSave}
          approvingId={approvingId}
          discardingId={discardingId}
          isSaving={isSaving}
        />
      )}
    </AppLayout>
  );
};

export default PendingDrafts;
