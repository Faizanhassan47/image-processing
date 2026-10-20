import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthProvider';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function Consumer() {
  const { user, sessionExpired, loading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'done'}</div>
      <div data-testid="user">{user ? user.username : 'no-user'}</div>
      <div data-testid="session-expired">{sessionExpired ? 'expired' : 'active'}</div>
    </div>
  );
}

describe('AuthProvider session handling', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sets user on initial auth check if valid session exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ username: 'dr_jane', role: 'Pathologist' }),
    });

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId('loading').textContent).toBe('done');
    expect(screen.getByTestId('user').textContent).toBe('dr_jane');
    expect(screen.getByTestId('session-expired').textContent).toBe('active');
  });

  it('triggers session expired toast and flags sessionExpired when unauthorized event fires on active user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ username: 'dr_jane', role: 'Pathologist' }),
    });

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId('user').textContent).toBe('dr_jane');

    // Simulate 401 dispatched event
    act(() => {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { status: 401 } }));
    });

    expect(screen.getByTestId('user').textContent).toBe('no-user');
    expect(screen.getByTestId('session-expired').textContent).toBe('expired');
    expect(toast.error).toHaveBeenCalledWith('Session expired — please sign in again', { id: 'session-expired' });
  });
});
