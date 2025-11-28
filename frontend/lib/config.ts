import { Platform } from 'react-native';

const DEFAULT_API_URL = 'http://192.168.1.96:5001';
const LEGACY_IPS: Record<string, string> = {
  '192.168.1.88': '192.168.1.96',
  '192.168.1.92': '192.168.1.96',
};

const ensureHttpScheme = (url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    return `http://${url}`;
  }
  return url;
};

const ensurePort = (url: string) => {
  if (!/:\d+$/.test(url)) {
    return `${url}:5001`;
  }
  return url;
};

const sanitizeUrl = (value?: string | null) => {
  if (!value) return undefined;

  let sanitized = value.trim();
  if (!sanitized) return undefined;

  sanitized = ensureHttpScheme(sanitized);
  sanitized = sanitized.replace(/\/+$/, '');
  sanitized = ensurePort(sanitized);

  Object.entries(LEGACY_IPS).forEach(([legacy, replacement]) => {
    sanitized = sanitized.replace(legacy, replacement);
  });

  return sanitized;
};

const resolveBaseUrl = () => {
  const envUrl = sanitizeUrl(process.env.EXPO_PUBLIC_API_URL);
  if (envUrl) {
    return envUrl;
  }

  if (__DEV__) {
    if (Platform.OS === 'web') {
      return 'http://localhost:5001';
    }

    return DEFAULT_API_URL;
  }

  return DEFAULT_API_URL;
};

const BASE_URL = resolveBaseUrl();

// Note: process.env is read-only in React Native/Expo, so we just use the resolved URL
export const API_CONFIG = {
  BASE_URL,
};

export const getApiUrl = () => API_CONFIG.BASE_URL;

export const getApiUrlCandidates = () => {
  const candidates = new Set<string>([
    BASE_URL,
    DEFAULT_API_URL,
    'http://10.0.2.2:5001',
    'http://localhost:5001',
  ]);

  return Array.from(candidates);
};
