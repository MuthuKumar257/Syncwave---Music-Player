import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageBacking = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageBacking.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageBacking.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageBacking.delete(key);
  },
  clear: () => {
    storageBacking.clear();
  }
};

vi.stubGlobal('localStorage', localStorageMock);

describe('Web Auth Session Refresh & Settings Persistence', () => {
  beforeEach(() => {
    storageBacking.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('recovers safely when localStorage contains malformed user JSON', async () => {
    storageBacking.set('syncwave_user', '{corrupted-json');
    storageBacking.set('syncwave_token', 'tok_abc');

    const { useAuthStore } = await import('../store/useAuthStore');
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(localStorageMock.getItem('syncwave_user')).toBeNull();
  });

  it('attempts /api/auth/refresh on 401 in syncWithCloud and updates session when refreshed', async () => {
    storageBacking.set('syncwave_token', 'expired_tok');
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      if (urlStr.includes('/api/auth/refresh')) {
        return new Response(
          JSON.stringify({
            success: true,
            token: 'fresh_tok_123',
            user: {
              id: 'u1',
              email: 'qa@syncwave.app',
              displayName: 'QA User',
              createdAt: new Date().toISOString()
            }
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../store/useAuthStore');
    await useAuthStore.getState().syncWithCloud();

    const state = useAuthStore.getState();
    expect(state.token).toBe('fresh_tok_123');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('qa@syncwave.app');
  });

  it('logs out cleanly when both /api/auth/me and /api/auth/refresh return 401', async () => {
    storageBacking.set('syncwave_token', 'dead_tok');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../store/useAuthStore');
    await useAuthStore.getState().syncWithCloud();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorageMock.getItem('syncwave_token')).toBeNull();
  });

  it('persists updateSettings to localStorage and syncs to /api/settings when authenticated', async () => {
    storageBacking.set('syncwave_token', 'valid_tok');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../store/useAuthStore');
    await useAuthStore.getState().updateSettings({ crossfadeDurationSeconds: 6, themeMode: 'DARK' });

    expect(useAuthStore.getState().settings?.crossfadeDurationSeconds).toBe(6);
    const persisted = JSON.parse(storageBacking.get('syncwave_settings') || '{}');
    expect(persisted.crossfadeDurationSeconds).toBe(6);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/settings',
      expect.objectContaining({ method: 'PUT' })
    );
  });
});
