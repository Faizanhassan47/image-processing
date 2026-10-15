import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

const root = `${API_BASE_URL}/api/platform`;

async function request(path, options = {}) {
  const response = await apiFetch(`${root}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `Request failed (${response.status})`);
  return data;
}

export const platformService = {
  health: (signal) => request('/health', { signal }),
  ingestionJobs: (signal) => request('/ingestion/jobs', { signal }),
  aiModels: (signal) => request('/ai/models', { signal }),
  aiJobs: (signal) => request('/ai/jobs', { signal }),
  hl7Events: (signal) => request('/hl7/events', { signal }),
  compatibility: (signal) => request('/compatibility', { signal }),
  backups: (signal) => request('/backups', { signal }),
  retryIngestion: (id) => request(`/ingestion/jobs/${id}/retry`, { method: 'POST' }),
  processIngestion: (id) => request(`/ingestion/jobs/${id}/process`, { method: 'POST' }),
  replayHl7: (id) => request(`/hl7/events/${id}/replay`, { method: 'POST' }),
  createBackup: (name = 'pathology') => request('/backups', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  }),
};
