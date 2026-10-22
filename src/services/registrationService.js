import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

const apiRoot = `${API_BASE_URL}/api`;

async function request(url, options = {}) {
  const response = await apiFetch(url, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `Registration request failed (${response.status})`);
  return data;
}

export const registrationService = {
  /** List all registrations for a case or slide */
  list: (params, signal) => {
    const qs = new URLSearchParams(params).toString();
    return request(`${apiRoot}/registrations${qs ? `?${qs}` : ''}`, { signal });
  },

  /** Get a single registration by ID */
  get: (regId, signal) => request(`${apiRoot}/registrations/${regId}`, { signal }),

  /** Create a new registration draft */
  create: (payload) => request(`${apiRoot}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  /** Update registration metadata, transform type, or notes */
  update: (regId, payload) => request(`${apiRoot}/registrations/${regId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  /** Delete a registration record */
  delete: (regId) => request(`${apiRoot}/registrations/${regId}`, { method: 'DELETE' }),

  /** Save / update the landmark points array */
  saveLandmarks: (regId, landmarks) => request(`${apiRoot}/registrations/${regId}/landmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ landmarks }),
  }),

  /** Calculate transformation from landmarks (translation, rigid, similarity, affine) */
  calculate: (regId, payload) => request(`${apiRoot}/registrations/${regId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  /** Trigger automatic feature-based registration via AKAZE/ORB RANSAC */
  autoAlign: (regId, payload = {}) => request(`${apiRoot}/registrations/${regId}/auto-align`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  /** Mark registration status as Reviewed or Rejected with clinical review notes */
  review: (regId, payload) => request(`${apiRoot}/registrations/${regId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),

  /** Retrieve the audit history trail of changes for a registration */
  getHistory: (regId, signal) => request(`${apiRoot}/registrations/${regId}/history`, { signal }),
};
