import { API_BASE_URL } from '../config';
import { apiFetch } from '../api';

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export const reportService = {
  aiMicroscopicDraft: (caseId, signal) => request(`/api/cases/${caseId}/ai-report-draft`, { signal }),
};
