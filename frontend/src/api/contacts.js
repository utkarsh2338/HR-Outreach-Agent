import { api } from './client.js';

/** @returns {Promise<{ contacts: object[], total: number, page: number, limit: number, totalPages: number }>} */
export const getContacts = (params) => api.get('/api/contacts', params);

/** @returns {Promise<object>} */
export const getContact = (id) => api.get(`/api/contacts/${id}`);

/** @returns {Promise<{ contacts: Array<{ contact: object, latest_reply: object|null }>, total: number }>} */
export const getNeedsAttention = (params) => api.get('/api/contacts/needs-attention', params);

/** @returns {Promise<object>} */
export const updateContact = (id, data) => api.patch(`/api/contacts/${id}`, data);

/** @returns {Promise<void>} */
export const deleteContact = (id) => api.delete(`/api/contacts/${id}`);

/** @returns {Promise<object>} */
export const generateDraft = (id) => api.post(`/api/contacts/${id}/generate-draft`);

/** @returns {Promise<object>} */
export const batchGenerateDrafts = (limit = 10) =>
  api.post('/api/contacts/batch-generate-drafts', { limit });
