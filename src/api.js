function cookieValue(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : '';
}

export async function apiFetch(url, options = {}, hasRetriedCsrf = false) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = cookieValue('csrf_token');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(url, { ...options, method, headers, credentials: 'include' });
  if (response.status === 403 && !hasRetriedCsrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const payload = await response.clone().json().catch(() => null);
    if (payload?.detail === 'Invalid CSRF token') {
      const apiPrefix = url.includes('/api/') ? url.slice(0, url.indexOf('/api/')) : '';
      const refreshResponse = await fetch(`${apiPrefix}/api/auth/me`, { credentials: 'include' });
      if (refreshResponse.ok) return apiFetch(url, options, true);
    }
  }
  if (response.status === 401) window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  return response;
}
