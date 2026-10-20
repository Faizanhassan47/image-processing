import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

const root = `${API_BASE_URL}/api/patients`;

async function request(path = '', options = {}) {
  const response = await apiFetch(`${root}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : detail?.message || `Request failed (${response.status})`);
  }
  return data;
}

function query(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export const patientService = {
  list: (filters, signal) => request(query(filters), { signal }),
  duplicates: (filters, signal) => request(`/duplicates${query(filters)}`, { signal }),
  create: (patient, signal) => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patient), signal }),
  get: (id, signal) => request(`/${id}`, { signal }),
  update: (id, patient, signal) => request(`/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patient), signal }),
  delete: (id, cascade = true, signal) => request(`/${id}?cascade_cases=${cascade ? 'true' : 'false'}`, { method: 'DELETE', signal }),
  profile: (id, signal) => request(`/${id}/complete-profile`, { signal }),
  history: (id, signal) => request(`/${id}/medical-history`, { signal }),
  saveHistory: (id, history, signal) => request(`/${id}/medical-history`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(history), signal }),
  cases: (id, filters = {}, signal) => request(`/${id}/cases${query(filters)}`, { signal }),
  linkCase: (id, payload, signal) => request(`/${id}/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal }),
  tests: (id, filters = {}, signal) => request(`/${id}/tests${query(filters)}`, { signal }),
  createTest: (id, payload, signal) => request(`/${id}/tests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal }),
  reports: (id, signal) => request(`/${id}/reports`, { signal }),
  slides: (id, signal) => request(`/${id}/slides`, { signal }),
  notes: (id, filters = {}, signal) => request(`/${id}/notes${query(filters)}`, { signal }),
  createNote: (id, payload, signal) => request(`/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal }),
  updateNote: (id, noteId, payload, signal) => request(`/${id}/notes/${noteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal }),
  documents: (id, signal) => request(`/${id}/documents`, { signal }),
  uploadDocument: (id, formData, signal) => request(`/${id}/documents`, { method: 'POST', body: formData, signal }),
  documentUrl: (id, documentId) => `${root}/${id}/documents/${documentId}/download`,
  timeline: (id, filters = {}, signal) => request(`/${id}/timeline${query(filters)}`, { signal }),
  exportUrl: (id) => `${root}/${id}/export`,
  importPreview: (document, confirm = false, signal) => request('/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document, confirm }), signal }),
};
