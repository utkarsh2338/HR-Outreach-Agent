import { api } from './client.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const getProfile = () => api.get('/api/profile');

export const updateProfileUrls = (data) => api.post('/api/profile/urls', data);

export const analyzeProfile = () => api.post('/api/profile/analyze');

export const testGenerateDraft = (data) => api.post('/api/profile/test-generate', data);

export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('resume', file);

  const res = await fetch(`${BASE_URL}/api/profile/upload-resume`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload resume');
  }

  return data;
};
