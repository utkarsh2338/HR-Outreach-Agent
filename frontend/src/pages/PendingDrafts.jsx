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
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'preview'

  useEffect(() => {
    setSubject(draft?.subject ?? '');
    setBody(draft?.body ?? '');
  }, [draft]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap focus inside drawer
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

  // Convert plain text body to simple formatted HTML for preview tab if edited
  const previewHtml = hasChanges
    ? body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    : (draft.html_body || body.replace(/\n/g, '<br>'));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit email draft for ${contact?.name ?? 'contact'}`}
        className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col bg-white shadow-2xl outline-none"
        style={{ animation: 'slideInRight 0.22s cubic-bezier(.4,0,.2,1)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-gray-200 shrink-0 bg-gray-50/50">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 truncate">
                Edit & Review Draft
              </h2>
              <LLMBadge llmGenerated={draft.llm_generated} />
              {hasChanges && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Unsaved Edits
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <RiUser3Line className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                <strong>To:</strong> {contact?.name ?? '—'}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <RiBuildingLine className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                {contact?.company ?? '—'}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <RiMailSendLine className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                {contact?.email ?? '—'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
            aria-label="Close editor"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
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

        {/* Editor / Preview Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Subject Field */}
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

          {/* Body Field (Edit vs Preview) */}
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
              <div className="w-full flex-1 p-4 border border-gray-200 rounded-md bg-gray-50/50 overflow-y-auto">
                <iframe
                  title="Email preview"
                  srcDoc={`<!DOCTYPE html><html><body style="font-family: Georgia, serif; font-size: 15px; line-height: 1.7; color: #2c2c2c; padding: 12px;">${previewHtml}</body></html>`}
                  sandbox="allow-same-origin"
                  className="w-full h-full min-h-[300px] border-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <span className="text-xs text-gray-400">
            Created {relativeTime(draft.created_at)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="md"
              loading={isDiscarding}
              disabled={isBusy}
              onClick={() => onDiscard(draft.draft_id)}
              aria-label={`Discard draft for ${contact?.name}`}
            >
              <RiDeleteBin6Line className="w-4 h-4" />
              Discard
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isApproving}
              disabled={isBusy}
              onClick={handleApproveAndSend}
              aria-label={`Approve and send to ${contact?.name}`}
            >
              <RiCheckLine className="w-4 h-4" />
              {hasChanges ? 'Save & Send' : 'Approve & Send'}
            </Button>
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
};

/* ─── Draft Row ─────────────────────────────────────────────────────────── */

const DraftRow = ({ draft, onSelect, onApprove, onDiscard, approvingId, discardingId }) => {
  const isApproving = approvingId === draft.draft_id;
  const isDiscarding = discardingId === draft.draft_id;
  const isBusy = isApproving || isDiscarding;
  const contact = draft.contact;
  const bodyPreview = truncate(draft.body, 160);

  return (
    <tr
      className="border-b border-gray-100 hover:bg-indigo-50/40 align-top cursor-pointer transition-colors"
      onClick={() => onSelect(draft)}
      title="Click to edit/preview full email"
    >
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

      {/* Actions — stop propagation so row click doesn't fire */}
      <td className="px-4 py-3 w-40" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            loading={isApproving}
            disabled={isBusy}
            onClick={() => onApprove(draft.draft_id)}
            aria-label={`Approve and send to ${contact?.name}`}
          >
            <RiCheckLine className="w-3.5 h-3.5" aria-hidden="true" />
            Approve &amp; Send
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={isDiscarding}
            disabled={isBusy}
            onClick={() => onDiscard(draft.draft_id)}
            aria-label={`Discard draft for ${contact?.name}`}
          >
            <RiDeleteBin6Line className="w-3.5 h-3.5" aria-hidden="true" />
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

  const { data, isLoading, isError, refetch } = usePendingDrafts({ page, limit: PAGE_LIMIT });
  const approveDraft = useApproveDraft();
  const discardDraft = useDiscardDraft();
  const updateDraftMutation = useUpdateDraft();

  const handleApprove = async (draftId, payload) => {
    if (!window.confirm('Approve and send this email?')) return;
    setApprovingId(draftId);
    try {
      await approveDraft.mutateAsync({ draftId, data: payload });
      setSelectedDraft(null); // close drawer after send
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
      setSelectedDraft(null); // close drawer after discard
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

  const drafts = data?.drafts ?? [];

  const handleGenerateNow = async () => {
    setIsGenerating(true);
    try {
      const result = await batchGenerateDrafts(20);
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
          <Button
            id="generate-drafts-now-btn"
            variant="primary"
            size="sm"
            loading={isGenerating}
            disabled={isGenerating}
            onClick={handleGenerateNow}
            aria-label="Generate email drafts now"
          >
            <RiSparklingLine className="w-3.5 h-3.5" aria-hidden="true" />
            {isGenerating ? 'Generating…' : 'Generate Drafts Now'}
          </Button>
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
                <TableSkeleton rows={6} cols={4} />
              ) : drafts.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        title="No pending drafts"
                        description="All drafts have been sent or discarded."
                        action={
                          <div className="flex items-center gap-1.5 text-sm text-indigo-600">
                            <RiMailLine className="w-4 h-4" aria-hidden="true" />
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

      {/* Draft preview & editor drawer */}
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
