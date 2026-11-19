import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getBaseUrl = (): string => {
  // Can be overridden via custom endpoint in settings
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
};

let abortController = new AbortController();

export const cancelPendingUserRequests = () => {
  abortController.abort();
  abortController = new AbortController();
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(async (config) => {
  if (!config.signal) {
    config.signal = abortController.signal;
  }
  try {
    const token = await AsyncStorage.getItem('syncwave_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userId = await AsyncStorage.getItem('syncwave_user_id');
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }
    const prefsJson = await AsyncStorage.getItem('@syncwave_user_preferences_v1');
    if (prefsJson) {
      try {
        const prefs = JSON.parse(prefsJson);
        const langs = prefs.preferredLanguages || prefs.selectedLanguages;
        if (Array.isArray(langs) && langs.length > 0) {
          config.headers['X-User-Languages'] = langs.join(',');
        }
      } catch {}
    }
  } catch {}
  return config;
});
