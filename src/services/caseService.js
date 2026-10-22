import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `Request failed (${response.status})`);
  return data;
}

export const caseService = {
  list: (signal) => request('/api/cases', { signal }),
  reviewers: (signal) => request('/api/reviewers', { signal }),
};
