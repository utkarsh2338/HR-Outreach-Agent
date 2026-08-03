const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const request = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = { error: res.statusText };
    }
    throw new ApiError(
      errorData.error || `Request failed with status ${res.status}`,
      res.status,
      errorData
    );
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
};

const buildQuery = (params) => {
  if (!params) return '';
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : '';
};

export const api = {
  get: (path, params) => request(`${path}${buildQuery(params)}`),
  post: (path, body) =>
    request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: (path, body) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
