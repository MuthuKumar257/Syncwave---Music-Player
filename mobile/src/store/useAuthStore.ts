import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { apiClient, cancelPendingUserRequests } from '../api/client';
import { queryClient } from '../api/queryClient';
import { resetToGuestHome } from '../navigation/navigationService';
import { useLibraryStore } from './useLibraryStore';
import { usePlayerStore } from './usePlayerStore';
import { useRecommendationStore } from './useRecommendationStore';
import { useDownloadStore } from './useDownloadStore';
import { usePlaybackSessionStore } from './usePlaybackSessionStore';
import { useSchedulerStore } from './useSchedulerStore';
import { useSearchStore } from './useSearchStore';

const TOKEN_KEY = 'syncwave_auth_token';
const USER_ID_KEY = 'syncwave_user_id';
const USER_PROFILE_KEY = 'syncwave_auth_user';

export interface MobileUserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'EMAIL' | 'GOOGLE';
  emailVerified?: boolean;
  createdAt?: string;
}

export interface MobileAuthProviders {
  google: {
    idTokenEnabled: boolean;
    redirectFlowEnabled: boolean;
    clientId: string | null;
  };
  otp: {
    enabled: boolean;
    provider: 'UNCONFIGURED' | 'RESEND' | 'SMTP' | 'TEST_TRANSPORT';
  };
}

export interface MobileOtpChallengeResult {
  ok: boolean;
  otpRequired?: boolean;
  challengeId?: string;
  maskedEmail?: string;
  expiresInSec?: number;
  resendAfterSec?: number;
  code?: string;
  error?: string;
}

interface MobileAuthState {
  user: MobileUserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  providers: MobileAuthProviders | null;

  hydrate: () => Promise<void>;
  fetchProviders: () => Promise<MobileAuthProviders | null>;
  initiateOtpLogin: (email: string, password: string) => Promise<MobileOtpChallengeResult>;
  verifyOtp: (
    challengeId: string,
    email: string,
    otp: string
  ) => Promise<{ ok: boolean; error?: string; attemptsRemaining?: number }>;
  resendOtp: (
    challengeId: string,
    email: string
  ) => Promise<{ ok: boolean; error?: string; resendAfterSec?: number; retryAfterSec?: number }>;
  registerAccount: (
    email: string,
    password: string,
    displayName: string,
    verifyWithOtp: boolean
  ) => Promise<MobileOtpChallengeResult>;
  loginWithGoogleIdToken: (idToken: string) => Promise<{ ok: boolean; error?: string }>;
  completeTokenSession: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; challengeId?: string; maskedEmail?: string; error?: string }>;
  confirmPasswordReset: (data: { email: string; challengeId: string; otp: string; newPassword: string }) => Promise<{ ok: boolean; error?: string }>;
}

const persistSession = async (token: string, user: MobileUserProfile) => {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_ID_KEY, user.id],
    [USER_PROFILE_KEY, JSON.stringify(user)],
  ]);
  await useLibraryStore.getState().switchUser(user.id);
  await useSchedulerStore.getState().switchUser(user.id);
  await useRecommendationStore.getState().initialize();
  void usePlaybackSessionStore.getState().startSessionSync(token);

  // Process any pending favorite track preserved from guest action
  try {
    const pendingFavJson = await AsyncStorage.getItem('@syncwave_pending_fav_track');
    if (pendingFavJson) {
      await AsyncStorage.removeItem('@syncwave_pending_fav_track');
      const pendingTrack = JSON.parse(pendingFavJson);
      if (pendingTrack && (pendingTrack.id || pendingTrack._id)) {
        await useLibraryStore.getState().toggleFavorite(pendingTrack);
      }
    }
  } catch (err) {
    console.warn('[useAuthStore] Failed to process pending favorite track:', err);
  }
};

const clearSessionStorage = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY, USER_PROFILE_KEY]);
};

const extractAxiosError = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; code?: string; attemptsRemaining?: number; retryAfterSec?: number }
      | undefined;
    return {
      message: data?.message || data?.error || fallback,
      code: data?.code,
      attemptsRemaining: data?.attemptsRemaining,
      retryAfterSec: data?.retryAfterSec,
    };
  }
  return { message: fallback };
};

export const useAuthStore = create<MobileAuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  providers: null,

  hydrate: async () => {
    try {
      const [token, userJson] = await AsyncStorage.multiGet([TOKEN_KEY, USER_PROFILE_KEY]);
      const storedToken = token[1];
      const storedUser = userJson[1] ? (JSON.parse(userJson[1]) as MobileUserProfile) : null;

      if (storedToken && storedUser) {
        set({
          token: storedToken,
          user: storedUser,
          isAuthenticated: true,
          isHydrated: true,
        });
        void useLibraryStore.getState().switchUser(storedUser.id);
        try {
          const res = await apiClient.get<{ success: boolean; user?: MobileUserProfile }>('/api/auth/me');
          if (res.data.success && res.data.user) {
            await persistSession(storedToken, res.data.user);
            set({ user: res.data.user });
          }
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            await clearSessionStorage();
            set({ token: null, user: null, isAuthenticated: false });
          }
        }
        return;
      }
    } catch {
      // Ignore corrupt storage
    }
    set({ isHydrated: true });
  },

  fetchProviders: async () => {
    try {
      const res = await apiClient.get<{
        success: boolean;
        google?: MobileAuthProviders['google'];
        otp?: MobileAuthProviders['otp'];
      }>('/api/auth/providers');
      if (res.data.success && res.data.google && res.data.otp) {
        const providers: MobileAuthProviders = {
          google: res.data.google,
          otp: res.data.otp,
        };
        set({ providers });
        return providers;
      }
    } catch {
      // Ignore
    }
    return null;
  },

  initiateOtpLogin: async (email, password) => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        otpRequired?: boolean;
        challengeId?: string;
        maskedEmail?: string;
        expiresInSec?: number;
        resendAfterSec?: number;
        token?: string;
        user?: MobileUserProfile;
        code?: string;
        message?: string;
      }>('/api/auth/login/initiate', { email, password });

      const data = res.data;
      if (data.success && data.otpRequired && data.challengeId) {
        return {
          ok: true,
          otpRequired: true,
          challengeId: data.challengeId,
          maskedEmail: data.maskedEmail,
          expiresInSec: data.expiresInSec,
          resendAfterSec: data.resendAfterSec,
        };
      }
      if (data.success && data.token && data.user) {
        await persistSession(data.token, data.user);
        set({ token: data.token, user: data.user, isAuthenticated: true });
        return { ok: true, otpRequired: false };
      }
      return { ok: false, code: data.code, error: data.message || 'Sign in failed.' };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { code?: string } | undefined;
        if (data?.code === 'OTP_SEND_FAILED' || data?.code === 'OTP_DELIVERY_NOT_CONFIGURED') {
          try {
            const directRes = await apiClient.post<{
              success: boolean;
              token?: string;
              user?: MobileUserProfile;
            }>('/api/auth/login', { email, password });
            if (directRes.data.success && directRes.data.token && directRes.data.user) {
              await persistSession(directRes.data.token, directRes.data.user);
              set({ token: directRes.data.token, user: directRes.data.user, isAuthenticated: true });
              return { ok: true, otpRequired: false };
            }
          } catch {}
        }
      }
      const parsed = extractAxiosError(err, 'Unable to reach SyncWave authentication server.');
      return { ok: false, code: parsed.code, error: parsed.message };
    }
  },

  verifyOtp: async (challengeId, email, otp) => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        token?: string;
        user?: MobileUserProfile;
        message?: string;
      }>('/api/auth/otp/verify', { challengeId, email, otp });

      if (res.data.success && res.data.token && res.data.user) {
        await persistSession(res.data.token, res.data.user);
        set({
          token: res.data.token,
          user: res.data.user,
          isAuthenticated: true,
        });
        return { ok: true };
      }
      return { ok: false, error: res.data.message || 'Verification failed.' };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Unable to verify OTP code.');
      return {
        ok: false,
        error: parsed.message,
        attemptsRemaining: parsed.attemptsRemaining,
      };
    }
  },

  resendOtp: async (challengeId, email) => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        resendAfterSec?: number;
        message?: string;
      }>('/api/auth/otp/resend', { challengeId, email });
      return {
        ok: true,
        resendAfterSec: res.data.resendAfterSec,
      };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Could not resend OTP code.');
      return {
        ok: false,
        error: parsed.message,
        retryAfterSec: parsed.retryAfterSec,
      };
    }
  },

  registerAccount: async (email, password, displayName, verifyWithOtp) => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        otpRequired?: boolean;
        challengeId?: string;
        maskedEmail?: string;
        expiresInSec?: number;
        resendAfterSec?: number;
        token?: string;
        user?: MobileUserProfile;
        code?: string;
        message?: string;
      }>('/api/auth/register', {
        email,
        password,
        displayName,
        verifyWithOtp,
      });

      const data = res.data;
      if (data.success && data.otpRequired && data.challengeId) {
        return {
          ok: true,
          otpRequired: true,
          challengeId: data.challengeId,
          maskedEmail: data.maskedEmail,
          expiresInSec: data.expiresInSec,
          resendAfterSec: data.resendAfterSec,
        };
      }
      if (data.success && data.token && data.user) {
        await persistSession(data.token, data.user);
        set({ token: data.token, user: data.user, isAuthenticated: true });
        return { ok: true, otpRequired: false };
      }
      return { ok: false, code: data.code, error: data.message || 'Registration failed.' };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Unable to create SyncWave account.');
      return { ok: false, code: parsed.code, error: parsed.message };
    }
  },

  loginWithGoogleIdToken: async (idToken) => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        token?: string;
        user?: MobileUserProfile;
        message?: string;
      }>('/api/auth/google', { credential: idToken });

      if (res.data.success && res.data.token && res.data.user) {
        await persistSession(res.data.token, res.data.user);
        set({
          token: res.data.token,
          user: res.data.user,
          isAuthenticated: true,
        });
        return { ok: true };
      }
      return { ok: false, error: res.data.message || 'Google sign-in failed.' };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Google authentication failed.');
      return { ok: false, error: parsed.message };
    }
  },

  completeTokenSession: async (token) => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      const res = await apiClient.get<{ success: boolean; user?: MobileUserProfile }>('/api/auth/me');
      if (res.data.success && res.data.user) {
        await persistSession(token, res.data.user);
        set({ token, user: res.data.user, isAuthenticated: true });
        return true;
      }
      await clearSessionStorage();
      return false;
    } catch {
      await clearSessionStorage();
      return false;
    }
  },

  logout: async () => {
    // 1. Terminate server/cloud session
    try {
      await apiClient.post('/api/auth/logout');
    } catch {}

    // 2. Cancel in-flight user requests
    cancelPendingUserRequests();

    // 3. Clear React Query cache
    try {
      queryClient.clear();
    } catch {}

    // 4. Clear auth tokens & session profile from AsyncStorage
    await clearSessionStorage();

    // 5. Reset player state and queue safely
    await usePlayerStore.getState().resetForGuest();

    // 6. Reset library state (clear in-memory playlists and favorites for guest)
    await useLibraryStore.getState().switchUser(null);

    // 7. Reset recommendation store for clean guest mode (clear user preferences, fetch public songs)
    await useRecommendationStore.getState().resetForGuest();

    // 8. Stop playback session sync
    void usePlaybackSessionStore.getState().stopSessionSync();

    // 9. Reset download store session state (preserving offline files on disk)
    useDownloadStore.getState().resetForGuest();

    // 10. Reset scheduler store for guest
    await useSchedulerStore.getState().switchUser(null);

    // 11. Reset search store for guest
    useSearchStore.getState().resetForGuest();

    // 12. Set auth state to guest
    set({ token: null, user: null, isAuthenticated: false });

    // 13. Reset navigation to Guest Home screen
    try {
      resetToGuestHome();
    } catch {}
  },

  updateProfile: async (data) => {
    try {
      const res = await apiClient.put<{ success: boolean; user?: MobileUserProfile; message?: string }>(
        '/api/auth/profile',
        data
      );
      if (res.data.success && res.data.user) {
        const currentUser = get().user;
        const updated = { ...currentUser, ...res.data.user } as MobileUserProfile;
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updated));
        set({ user: updated });
        return { ok: true };
      }
      return { ok: false, error: res.data.message || 'Profile update failed.' };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Unable to update profile.');
      return { ok: false, error: parsed.message };
    }
  },

  requestPasswordReset: async (email) => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        challengeId?: string;
        maskedEmail?: string;
        message?: string;
      }>('/api/auth/password-reset/request', { email });
      if (res.data.success && res.data.challengeId) {
        return { ok: true, challengeId: res.data.challengeId, maskedEmail: res.data.maskedEmail };
      }
      return { ok: false, error: res.data.message || 'Failed to request reset.' };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Unable to request password reset.');
      return { ok: false, error: parsed.message };
    }
  },

  confirmPasswordReset: async (data) => {
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>(
        '/api/auth/password-reset/confirm',
        data
      );
      if (res.data.success) {
        return { ok: true };
      }
      return { ok: false, error: res.data.message || 'Password reset failed.' };
    } catch (err) {
      const parsed = extractAxiosError(err, 'Unable to confirm password reset.');
      return { ok: false, error: parsed.message };
    }
  },
}));
