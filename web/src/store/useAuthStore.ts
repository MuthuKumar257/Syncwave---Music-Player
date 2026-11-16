import { create } from 'zustand';
import { UserProfile, UserSettings } from '../types';
import { useRecommendationStore } from './useRecommendationStore';
import { useAnalyticsStore } from './useAnalyticsStore';

export interface AuthProvidersStatus {
  google: {
    enabled: boolean;
    redirectFlowEnabled: boolean;
    idTokenEnabled: boolean;
    clientId: string | null;
  };
  otp: {
    enabled: boolean;
    provider: 'RESEND' | 'SMTP' | 'TEST_TRANSPORT' | 'UNCONFIGURED';
  };
}

export interface OtpChallengeResponse {
  ok: boolean;
  otpRequired?: boolean;
  challengeId?: string;
  maskedEmail?: string;
  expiresInSec?: number;
  resendAfterSec?: number;
  code?: string;
  error?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  settings: UserSettings | null;
  isAuthenticated: boolean;
  isSyncing: boolean;
  providers: AuthProvidersStatus | null;

  // Actions
  fetchProviders: () => Promise<AuthProvidersStatus | null>;
  login: (email: string, password: string) => Promise<boolean>;
  initiateOtpLogin: (email: string, password: string) => Promise<OtpChallengeResponse>;
  verifyOtp: (
    challengeId: string,
    email: string,
    otp: string
  ) => Promise<{ ok: boolean; error?: string; attemptsRemaining?: number }>;
  resendOtp: (
    challengeId: string,
    email: string
  ) => Promise<{ ok: boolean; error?: string; resendAfterSec?: number; retryAfterSec?: number }>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  registerAccount: (
    email: string,
    password: string,
    displayName: string,
    verifyWithOtp: boolean
  ) => Promise<OtpChallengeResponse>;
  loginWithGoogleCredential: (credential: string) => Promise<{ ok: boolean; error?: string }>;
  startGoogleRedirectLogin: () => Promise<{ ok: boolean; error?: string }>;
  completeGoogleTokenSession: (token: string) => Promise<boolean>;
  logout: () => void;
  syncWithCloud: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; challengeId?: string; maskedEmail?: string; error?: string }>;
  confirmPasswordReset: (data: { email: string; challengeId: string; otp: string; newPassword: string }) => Promise<{ ok: boolean; error?: string }>;
}

function safeParseStoredUser(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    try {
      localStorage.removeItem('syncwave_user');
    } catch {
      // Ignore storage cleanup error
    }
    return null;
  }
}

function safeParseStoredSettings(): UserSettings {
  const defaults: UserSettings = {
    crossfadeDurationSeconds: 3,
    themeMode: 'DARK',
    streamingQuality: 'HIGH',
    offlineCacheLimitMb: 1024,
    autoScheduleEnabled: true
  };
  try {
    const raw = localStorage.getItem('syncwave_settings');
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return defaults;
  }
}

function saveSession(set: any, data: { token: string; user: UserProfile; settings?: UserSettings }) {
  localStorage.setItem('syncwave_token', data.token);
  localStorage.setItem('syncwave_user', JSON.stringify(data.user));
  if (data.settings) {
    try {
      localStorage.setItem('syncwave_settings', JSON.stringify(data.settings));
    } catch {
      // Ignore storage quota error
    }
  }
  set({
    user: data.user,
    token: data.token,
    settings: data.settings || safeParseStoredSettings(),
    isAuthenticated: true
  });
  // Live synchronization of user-isolated preferences and personalized feed
  useRecommendationStore.getState().fetchPreferences();
  useRecommendationStore.getState().fetchFeed();
  useAnalyticsStore.getState().fetchStats(true).catch(() => {});
}

export const useAuthStore = create<AuthState>((set, get) => {
  const storedToken = localStorage.getItem('syncwave_token');
  const storedUser = localStorage.getItem('syncwave_user');

  return {
    user: safeParseStoredUser(storedUser),
    token: storedToken,
    settings: safeParseStoredSettings(),
    isAuthenticated: !!storedToken,
    isSyncing: false,
    providers: null,

    fetchProviders: async () => {
      try {
        const res = await fetch('/api/auth/providers');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const providers: AuthProvidersStatus = {
              google: data.google,
              otp: data.otp
            };
            set({ providers });
            return providers;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch auth providers:', e);
      }
      return null;
    },

    initiateOtpLogin: async (email, password) => {
      try {
        const res = await fetch('/api/auth/login/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.success && data.otpRequired) {
          return {
            ok: true,
            otpRequired: true,
            challengeId: data.challengeId,
            maskedEmail: data.maskedEmail,
            expiresInSec: data.expiresInSec,
            resendAfterSec: data.resendAfterSec
          };
        }
        return {
          ok: false,
          code: data.code,
          error: data.message || 'Invalid email or password.'
        };
      } catch {
        return { ok: false, error: 'Network error while connecting to SyncWave authentication server.' };
      }
    },

    verifyOtp: async (challengeId, email, otp) => {
      try {
        const res = await fetch('/api/auth/login/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, email, otp })
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          saveSession(set, data);
          return { ok: true };
        }
        return {
          ok: false,
          attemptsRemaining: data.attemptsRemaining,
          error: data.message || 'Verification failed.'
        };
      } catch {
        return { ok: false, error: 'Network error verifying code.' };
      }
    },

    resendOtp: async (challengeId, email) => {
      try {
        const res = await fetch('/api/auth/otp/resend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, email })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          return { ok: true, resendAfterSec: data.resendAfterSec };
        }
        return {
          ok: false,
          retryAfterSec: data.retryAfterSec,
          error: data.message || 'Could not resend verification code.'
        };
      } catch {
        return { ok: false, error: 'Network error resending verification code.' };
      }
    },

    login: async (email, password) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.token) {
          saveSession(set, data);
          return true;
        }
      } catch (e) {
        console.error('Login error:', e);
      }
      return false;
    },

    register: async (email, password, displayName) => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName })
        });
        const data = await res.json();
        if (data.success && data.token) {
          saveSession(set, data);
          return true;
        }
      } catch (e) {
        console.error('Register error:', e);
      }
      return false;
    },

    registerAccount: async (email, password, displayName, verifyWithOtp) => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName, verifyWithOtp })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.otpRequired) {
            return {
              ok: true,
              otpRequired: true,
              challengeId: data.challengeId,
              maskedEmail: data.maskedEmail,
              expiresInSec: data.expiresInSec,
              resendAfterSec: data.resendAfterSec
            };
          }
          if (data.token) {
            saveSession(set, data);
            return { ok: true, otpRequired: false };
          }
        }
        return {
          ok: false,
          code: data.code,
          error: data.message || 'Registration failed. Please check your details.'
        };
      } catch {
        return { ok: false, error: 'Network error during registration.' };
      }
    },

    loginWithGoogleCredential: async (credential) => {
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential })
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          saveSession(set, data);
          return { ok: true };
        }
        return { ok: false, error: data.message || 'Google authentication failed.' };
      } catch {
        return { ok: false, error: 'Network error during Google authentication.' };
      }
    },

    startGoogleRedirectLogin: async () => {
      try {
        const origin = window.location.origin;
        const res = await fetch(`/api/auth/google/start?origin=${encodeURIComponent(origin)}`);
        const data = await res.json();
        if (res.ok && data.success && data.authUrl) {
          window.location.assign(data.authUrl);
          return { ok: true };
        }
        return {
          ok: false,
          error: data.message || 'Google OAuth is not configured on this server.'
        };
      } catch {
        return { ok: false, error: 'Network error starting Google OAuth flow.' };
      }
    },

    completeGoogleTokenSession: async (token) => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          saveSession(set, { token, user: data.user, settings: data.settings });
          return true;
        }
      } catch (e) {
        console.error('Google session completion failed:', e);
      }
      return false;
    },

    logout: () => {
      const currentToken = get().token;
      if (currentToken) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` }
        }).catch(() => {});
      }
      localStorage.removeItem('syncwave_token');
      localStorage.removeItem('syncwave_user');
      set({ user: null, token: null, isAuthenticated: false });
      // Strictly clear client caches to maintain multi-user isolation
      useRecommendationStore.getState().resetForLogout();
      useAnalyticsStore.getState().clearCache();
    },

    syncWithCloud: async () => {
      const { token } = get();
      if (!token) return;

      set({ isSyncing: true });
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
          // Attempt transparent JWT refresh before expiring session cleanly
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ token })
          });
          if (refreshRes.ok) {
            const refreshed = await refreshRes.json();
            if (refreshed.success && refreshed.token && refreshed.user) {
              saveSession(set, {
                token: refreshed.token,
                user: refreshed.user,
                settings: refreshed.settings
              });
              return;
            }
          }
          get().logout();
          return;
        }

        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.user) {
          saveSession(set, { token, user: data.user, settings: data.settings });
        }
      } catch (e) {
        console.error('Cloud sync error:', e);
      } finally {
        set({ isSyncing: false });
      }
    },

    updateSettings: async (newSettings) => {
      const current = get().settings || safeParseStoredSettings();
      const merged: UserSettings = { ...current, ...newSettings };
      try {
        localStorage.setItem('syncwave_settings', JSON.stringify(merged));
      } catch {
        // Ignore storage error
      }
      set({ settings: merged });

      const { token } = get();
      if (token) {
        try {
          await fetch('/api/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              isDarkMode: merged.themeMode ? merged.themeMode === 'DARK' : undefined,
              crossfadeDurationSec: merged.crossfadeDurationSeconds,
              crossfadeEnabled:
                typeof merged.crossfadeDurationSeconds === 'number'
                  ? merged.crossfadeDurationSeconds > 0
                  : undefined
            })
          });
        } catch (e) {
          console.warn('Settings cloud sync deferred:', e);
        }
      }
    },

    updateProfile: async (data) => {
      const { token, user } = get();
      if (!token) return { ok: false, error: 'Sign in to update profile' };

      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success && resData.user) {
          const updatedUser: UserProfile = { ...user, ...resData.user };
          try {
            localStorage.setItem('syncwave_user', JSON.stringify(updatedUser));
          } catch {}
          set({ user: updatedUser });
          return { ok: true };
        }
        return { ok: false, error: resData.message || 'Profile update failed' };
      } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error updating profile' };
      }
    },

    requestPasswordReset: async (email) => {
      try {
        const res = await fetch('/api/auth/password-reset/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          return {
            ok: true,
            challengeId: data.challengeId,
            maskedEmail: data.maskedEmail
          };
        }
        return { ok: false, error: data.message || 'Failed to request password reset' };
      } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
      }
    },

    confirmPasswordReset: async (data) => {
      try {
        const res = await fetch('/api/auth/password-reset/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          return { ok: true };
        }
        return { ok: false, error: resData.message || 'Failed to reset password' };
      } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
      }
    }
  };
});
