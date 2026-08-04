import { api } from './client.js';

/** @returns {Promise<{ drafts: object[], total: number, page: number, totalPages: number }>} */
export const getPendingDrafts = (params) => api.get('/api/email-logs/pending', params);

/** @returns {Promise<object>} Update draft subject/body */
export const updateDraft = (draftId, data) =>
  api.patch(`/api/email-logs/${draftId}`, data);

/** @returns {Promise<object>} Approve and send a draft */
export const approveDraft = (draftId, data) =>
  api.post(`/api/email-logs/${draftId}/approve-and-send`, data);

/** @returns {Promise<object>} Approve and send multiple drafts in batch */
export const approveBatchDrafts = (draftIds) =>
  api.post('/api/email-logs/approve-batch', { draft_ids: draftIds });

/** @returns {Promise<object>} Discard a pending draft */
export const discardDraft = (draftId) =>
  api.patch(`/api/email-logs/${draftId}/discard`);
