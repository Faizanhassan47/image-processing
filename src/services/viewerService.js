import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

const apiRoot = `${API_BASE_URL}/api`;
const platformRoot = `${apiRoot}/platform`;

async function request(url, options = {}) {
  const response = await apiFetch(url, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `Viewer request failed (${response.status})`);
  return data;
}

export const viewerService = {
  annotations: (slideId, signal) => request(`${apiRoot}/slides/${slideId}/annotations`, { signal }),
  createAnnotation: (slideId, annotation) => request(`${apiRoot}/slides/${slideId}/annotations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(annotation),
  }),
  updateAnnotation: (slideId, annotationId, annotation) => request(`${apiRoot}/slides/${slideId}/annotations/${annotationId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(annotation),
  }),
  deleteAnnotation: (slideId, annotationId) => request(`${apiRoot}/slides/${slideId}/annotations/${annotationId}`, { method: 'DELETE' }),
  validation: (slideId, signal) => request(`${apiRoot}/slides/${slideId}/validation`, { signal }),
  saveCalibration: (slideId, calibration) => request(`${platformRoot}/slides/${slideId}/calibration`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calibration),
  }),
  aiResults: (slideId, signal) => request(`${platformRoot}/ai/slides/${slideId}/results`, { signal }),
  bookmarks: (slideId, signal) => request(`${platformRoot}/slides/${slideId}/bookmarks`, { signal }),
  preferences: (slideId, signal) => request(`${platformRoot}/slides/${slideId}/viewer-preferences`, { signal }),
  savePreferences: (slideId, settings, signal) => request(`${platformRoot}/slides/${slideId}/viewer-preferences`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings), signal,
  }),
  createBookmark: (slideId, bookmark) => request(`${platformRoot}/slides/${slideId}/bookmarks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookmark),
  }),
  deleteBookmark: (slideId, bookmarkId) => request(`${platformRoot}/slides/${slideId}/bookmarks/${bookmarkId}`, { method: 'DELETE' }),
};
