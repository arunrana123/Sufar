import { Platform } from 'react-native';

// Default backend API URL - Use 192.168.1.66:5001 as the primary server address
// Update this IP if your backend server is running on a different machine
// You can also override via EXPO_PUBLIC_API_URL environment variable
const DEFAULT_API_URL = 'http://192.168.1.66:5001';

// Legacy IP mappings - automatically redirect old IPs to the current server IP
const LEGACY_IPS: Record<string, string> = {
  '192.168.1.88': '192.168.1.66',   // Redirect old IP to current server
  '192.168.1.92': '192.168.1.66',   // Redirect old IP to current server
  '192.168.1.96': '192.168.1.66',   // Redirect old IP to current server
  '192.168.1.112': '192.168.1.66',  // Redirect old IP to current server
  '10.21.12.171': '192.168.1.66'    // Redirect to correct server IP
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

  // Replace legacy IPs with the correct server IP
  Object.entries(LEGACY_IPS).forEach(([legacy, replacement]) => {
    // Replace IP in URL (handles both with and without http://)
    const legacyPattern = new RegExp(legacy.replace(/\./g, '\\.'), 'g');
    sanitized = sanitized.replace(legacyPattern, replacement);
  });

  // Force use of default IP if any legacy IP was detected (but allow localhost and 10.0.2.2 for Android emulator)
  const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
  if (sanitized && !sanitized.includes(defaultIp) && !sanitized.includes('localhost') && !sanitized.includes('10.0.2.2')) {
    console.warn('⚠️ Detected non-standard IP, redirecting to default:', sanitized);
    // Extract port if present
    const portMatch = sanitized.match(/:(\d+)/);
    const port = portMatch ? portMatch[1] : '5001';
    sanitized = `http://${defaultIp}:${port}`;
  }

  return sanitized;
};

const resolveBaseUrl = () => {
  // Web platform - ALWAYS use localhost (browsers can't connect to local network IPs easily)
  // Check this FIRST before any other logic
  if (Platform.OS === 'web') {
    // For web, always use localhost unless explicitly set to something else
    // Browsers have CORS restrictions with local network IPs
    const envUrl = sanitizeUrl(process.env.EXPO_PUBLIC_API_URL);
    if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      if (__DEV__) console.log('🌐 Web platform, using API URL from environment:', envUrl);
      return envUrl;
    }
    // If env URL is a local network IP (192.168.x.x), convert to localhost for web
    if (envUrl && envUrl.match(/192\.168\.\d+\.\d+/)) {
      const portMatch = envUrl.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '5001';
      if (__DEV__) console.log('🌐 Web platform: Converting local network IP to localhost:', envUrl, '→', `http://localhost:${port}`);
      return `http://localhost:${port}`;
    }
    if (__DEV__) console.log('🌐 Web platform detected, using localhost');
    return 'http://localhost:5001';
  }

  // For mobile platforms, prefer environment variable, otherwise use default
  // Check for web first, then handle mobile platforms
  if (__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'windows' || Platform.OS === 'macos')) {
    const envUrl = sanitizeUrl(process.env.EXPO_PUBLIC_API_URL);
    
    // If environment variable is set, use it (it will be sanitized to handle legacy IPs)
    if (envUrl) {
      console.log('✅ Using API URL from environment variable:', envUrl);
      return envUrl;
    }
    
    // No environment variable - use default
    console.log('📱 Mobile platform detected, using default IP:', DEFAULT_API_URL);
    return DEFAULT_API_URL;
  }

  // Production: use default IP
  return DEFAULT_API_URL;
};

let BASE_URL = resolveBaseUrl();

// Final validation - ensure mobile platforms use a valid IP (allow localhost and 10.0.2.2 for emulators)
const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
if (__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'windows' || Platform.OS === 'macos') && !BASE_URL.includes(defaultIp) && !BASE_URL.includes('localhost') && !BASE_URL.includes('10.0.2.2')) {
  console.warn('⚠️ FORCING default IP address - was:', BASE_URL);
  BASE_URL = DEFAULT_API_URL;
  console.log('✅ Corrected to:', BASE_URL);
}

// Log the resolved API URL for debugging
if (__DEV__) {
  console.log('🌐 API Configuration (Worker App):');
  console.log('  Default URL:', DEFAULT_API_URL);
  console.log('  Environment URL:', process.env.EXPO_PUBLIC_API_URL || 'not set');
  console.log('  Resolved URL:', BASE_URL);
  console.log('  Platform:', Platform.OS);
  const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
  console.log(`  ✅ Using correct IP (${defaultIp}):`, BASE_URL.includes(defaultIp));
}

// Note: process.env is read-only in React Native/Expo, so we just use the resolved URL
export const API_CONFIG = {
  BASE_URL,
};

export const getApiUrl = () => {
  let url = API_CONFIG.BASE_URL;
  
  // For web platform, ALWAYS use localhost (browsers can't easily connect to local network IPs)
  // This check happens at runtime, so it will work even if BASE_URL was set incorrectly at module load
  // Remove __DEV__ check - we always want this conversion on web
  if (Platform.OS === 'web') {
    // If URL contains a local network IP (192.168.x.x), convert to localhost
    if (url.match(/192\.168\.\d+\.\d+/)) {
      const portMatch = url.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '5001';
      url = `http://localhost:${port}`;
      console.log('🌐 [getApiUrl] Web platform: Converted local network IP to localhost');
      console.log('   Original:', API_CONFIG.BASE_URL);
      console.log('   Converted:', url);
    }
    // Ensure it's localhost or 127.0.0.1 for web (double-check)
    if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
      const portMatch = url.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '5001';
      url = `http://localhost:${port}`;
      console.log('🌐 [getApiUrl] Web platform: Forced localhost conversion');
      console.log('   Original:', API_CONFIG.BASE_URL);
      console.log('   Converted:', url);
    }
  }
  
  // Final safety check - ensure mobile platforms use a valid IP (allow localhost and 10.0.2.2 for emulators)
  const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
  if (__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'windows' || Platform.OS === 'macos') && !url.includes(defaultIp) && !url.includes('localhost') && !url.includes('10.0.2.2')) {
    console.error('❌ ERROR: Wrong IP detected in getApiUrl(), forcing correction:', url);
    url = DEFAULT_API_URL;
    console.log('✅ Corrected to:', url);
  }
  
  if (__DEV__) {
    console.log('🔗 [getApiUrl] Called (Worker App)');
    console.log('   Platform:', Platform.OS);
    console.log('   BASE_URL:', API_CONFIG.BASE_URL);
    console.log('   Returning:', url);
    const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
    const isCorrect = url.includes(defaultIp) || url.includes('localhost') || url.includes('10.0.2.2') || Platform.OS === 'web';
    console.log(`   ✅ IP is correct:`, isCorrect);
  }
  return url;
};

export const getApiUrlCandidates = () => {
  const candidates = new Set<string>([
    BASE_URL,
    DEFAULT_API_URL,
    'http://10.0.2.2:5001',
    'http://localhost:5001',
  ]);

  return Array.from(candidates);
};

