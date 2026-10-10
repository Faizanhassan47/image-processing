import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds credentials and the CSRF header to mutations', async () => {
    document.cookie = 'csrf_token=test-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await apiFetch('/api/example', { method: 'POST' });
    const options = fetchMock.mock.calls[0][1];
    expect(options.credentials).toBe('include');
    expect(options.headers.get('X-CSRF-Token')).toBe('test-token');
  });

  it('announces an expired session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener, { once: true });
    await apiFetch('/api/private');
    expect(listener).toHaveBeenCalledOnce();
  });
});
