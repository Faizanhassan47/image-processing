import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `AI subscription request failed (${response.status})`);
  return data;
}

export const aiSubscriptionService = {
  features: (signal) => request('/api/ai/features', { signal }),
  mySubscription: (signal) => request('/api/ai/my-subscription', { signal }),
  entitlements: (signal) => request('/api/ai/my-entitlements', { signal }),
  adminFeatures: (signal) => request('/api/admin/ai/features', { signal }),
  adminList: (signal) => request('/api/admin/ai/subscriptions', { signal }),
  history: (userId, signal) => request(`/api/admin/ai/subscriptions/${userId}`, { signal }),
  create: (body) => request('/api/admin/ai/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/admin/ai/subscriptions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  setFeatures: (id, featureCodes) => request(`/api/admin/ai/subscriptions/${id}/features`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feature_codes: featureCodes }) }),
  cancel: (id) => request(`/api/admin/ai/subscriptions/${id}/cancel`, { method: 'POST' }),
  setFeatureActive: (id, isActive) => request(`/api/admin/ai/features/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: isActive }) }),
  updateCatalogCard: (id, body) => request(`/api/admin/ai/features/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  setMyFeaturePreference: (id, isEnabled) => request(`/api/ai/features/${id}/preference`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_enabled: isEnabled }) }),
  laboratories: (signal) => request('/api/laboratories', { signal }),
  createLaboratory: (body) => request('/api/laboratories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  plans: (signal) => request('/api/ai/subscription-plans', { signal }),
  createPlan: (body) => request('/api/admin/ai/subscription-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  laboratorySubscriptions: (laboratoryId, signal) => request(`/api/laboratories/${laboratoryId}/ai-subscriptions`, { signal }),
  grantLaboratoryLicense: (laboratoryId, body) => request(`/api/admin/laboratories/${laboratoryId}/ai-grants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  assignSeat: (laboratoryId, body) => request(`/api/laboratories/${laboratoryId}/ai-seats/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  revokeSeat: (laboratoryId, assignmentId) => request(`/api/laboratories/${laboratoryId}/ai-seats/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignment_id: assignmentId }) }),
  checkout: (laboratoryId, body) => request(`/api/laboratories/${laboratoryId}/ai-subscriptions/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
};
