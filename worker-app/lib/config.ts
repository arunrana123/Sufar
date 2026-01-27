import { Platform } from 'react-native';

// Default backend API URL - Use 192.168.1.66:5001 as the primary server address
// FOR ANDROID PHYSICAL DEVICES: This must be your computer's IP address (NOT localhost)
// Update this IP if your backend server is running on a different machine
// You can also override via EXPO_PUBLIC_API_URL environment variable
// To find your IP: Mac/Linux: ifconfig | grep "inet " | Windows: ipconfig
const DEFAULT_API_URL = 'http://192.168.1.66:5001';

// Legacy IP mappings - automatically redirect old IPs to the current server IP
// Only keep mappings for IPs that might still be in use
const LEGACY_IPS: Record<string, string> = {
  '192.168.1.88': '192.168.1.66',   // Redirect old IP to current server
  '192.168.1.92': '192.168.1.66',   // Redirect old IP to current server
  '192.168.1.96': '192.168.1.66',   // Redirect old IP to current server
  '192.168.1.112': '192.168.1.66',  // Redirect old IP to current server
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

  // For Android/iOS physical devices - MUST use network IP (NOT localhost)
  // Check for web first, then handle mobile platforms
  if (__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'windows' || Platform.OS === 'macos')) {
    const envUrl = sanitizeUrl(process.env.EXPO_PUBLIC_API_URL);
    
    // If environment variable is set, use it (it will be sanitized to handle legacy IPs)
    if (envUrl) {
      // CRITICAL: For Android physical devices, reject localhost
      if (Platform.OS === 'android' && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        console.error('❌ ERROR: Android physical device cannot use localhost!');
        console.error('   Environment URL:', envUrl);
        console.error('   Falling back to default IP:', DEFAULT_API_URL);
        return DEFAULT_API_URL;
      }
      console.log('✅ Using API URL from environment variable:', envUrl);
      return envUrl;
    }
    
    // No environment variable - use default
    console.log('📱 Mobile platform detected, using default IP:', DEFAULT_API_URL);
    if (Platform.OS === 'android') {
      console.log('📱 Android physical device - ensure backend is running on:', DEFAULT_API_URL);
    }
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
  
  // CRITICAL: Ensure URL is properly formatted (no trailing slashes, correct protocol)
  url = url.trim();
  url = url.replace(/\/+$/, ''); // Remove trailing slashes
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  
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
  
  // Final safety check - ensure mobile platforms use a valid IP
  // For Android physical devices: MUST use network IP (NOT localhost, NOT 127.0.0.1)
  // Allow 10.0.2.2 only for Android emulator
  const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
  if (__DEV__ && Platform.OS === 'android') {
    // Android physical device - reject localhost
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      console.error('❌ ERROR: Android physical device cannot use localhost!');
      console.error('   Current URL:', url);
      console.error('   Forcing correction to network IP:', DEFAULT_API_URL);
      url = DEFAULT_API_URL.replace(/\/+$/, ''); // Ensure no trailing slash
    } else if (!url.includes(defaultIp) && !url.includes('10.0.2.2')) {
      // Not using default IP and not emulator IP - might be wrong
      console.warn('⚠️ WARNING: Android device using non-standard IP:', url);
      console.warn('   Expected IP:', defaultIp);
      console.warn('   Forcing correction to:', DEFAULT_API_URL);
      url = DEFAULT_API_URL.replace(/\/+$/, ''); // Ensure no trailing slash
    } else {
      // URL is correct, but ensure no trailing slash
      url = url.replace(/\/+$/, '');
    }
  } else if (__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'windows' || Platform.OS === 'macos') && !url.includes(defaultIp) && !url.includes('localhost') && !url.includes('10.0.2.2')) {
    console.error('❌ ERROR: Wrong IP detected in getApiUrl(), forcing correction:', url);
    url = DEFAULT_API_URL.replace(/\/+$/, ''); // Ensure no trailing slash
    console.log('✅ Corrected to:', url);
  }
  
  // Final cleanup: Remove any trailing slashes
  url = url.replace(/\/+$/, '');
  
  if (__DEV__) {
    console.log('🔗 [getApiUrl] Called (Worker App)');
    console.log('   Platform:', Platform.OS);
    console.log('   BASE_URL:', API_CONFIG.BASE_URL);
    console.log('   Returning:', url);
    const defaultIp = DEFAULT_API_URL.replace('http://', '').split(':')[0];
    const isCorrect = url.includes(defaultIp) || url.includes('localhost') || url.includes('10.0.2.2') || Platform.OS === 'web';
    console.log(`   ✅ IP is correct:`, isCorrect);
    console.log(`   ✅ URL format valid:`, /^https?:\/\/[^\/]+:\d+$/.test(url));
  }
  return url;
};

export const getApiUrlCandidates = () => {
  const candidates = new Set<string>([
    BASE_URL,
    DEFAULT_API_URL,
    'http://192.168.1.66:5001', // Primary IP for Android physical devices
  ]);

  return Array.from(candidates);
};

