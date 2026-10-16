import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

export async function getAuditEvents({ signal } = {}) {
  const response = await apiFetch(`${API_BASE_URL}/api/platform/audit`, { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `Could not load activity logs (${response.status})`);
  return Array.isArray(data) ? data : [];
}
