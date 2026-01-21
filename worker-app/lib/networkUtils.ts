import { Platform, Alert } from 'react-native';
import { getApiUrl } from './config';

/**
 * Network request utility with retry logic and exponential backoff
 * Handles transient network failures gracefully
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  timeout?: number;
}

interface RequestOptions extends RequestInit {
  retry?: RetryOptions;
}

/**
 * Check if server is reachable before making requests
 */
export const checkServerHealth = async (apiUrl?: string): Promise<boolean> => {
  const url = apiUrl || getApiUrl();
  // Backend health endpoint is at /health (not /api/health)
  const healthEndpoint = `${url}/health`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
    
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
    });
    
    clearTimeout(timeoutId);
    // Any response (even 404) means server is reachable
    return response.status < 500; // 2xx, 3xx, 4xx all mean server responded
  } catch (error: any) {
    console.log('⚠️ Server health check failed:', error.message || error);
    return false;
  }
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Robust fetch with automatic retry and exponential backoff
 */
export const robustFetch = async (
  url: string,
  options: RequestOptions = {}
): Promise<Response> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    timeout = 30000,
  } = options.retry || {};

  let lastError: Error | null = null;
  let delay = initialDelay;

  console.log(`🔄 Starting request with ${maxRetries + 1} max attempts: ${url}`);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 Attempt ${attempt + 1}/${maxRetries + 1}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-cache',
        credentials: 'omit',
      });

      clearTimeout(timeoutId);

      // If response is OK, return immediately
      if (response.ok) {
        console.log(`✅ Request succeeded on attempt ${attempt + 1}`);
        return response;
      }

      // For non-OK responses, only retry on 5xx errors (server errors)
      if (response.status >= 500 && attempt < maxRetries) {
        console.log(`⚠️ Server error ${response.status}, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
        continue;
      }

      // For 4xx errors (client errors), don't retry
      console.log(`ℹ️ Client error ${response.status}, not retrying`);
      return response;
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort (timeout) if it's the last attempt
      if (error.name === 'AbortError' && attempt === maxRetries) {
        console.error(`❌ Request timeout after ${maxRetries + 1} attempts`);
        throw new Error(`Request timeout after ${maxRetries + 1} attempts`);
      }

      // Don't retry on network errors if it's the last attempt
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries + 1} attempts failed. Last error:`, error.message || error.name);
        break;
      }

      // Retry on network errors with exponential backoff
      if (
        error.message?.includes('Network request failed') ||
        error.name === 'TypeError' ||
        error.name === 'AbortError'
      ) {
        console.log(`⚠️ Network error (${error.name || error.message}), retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
        continue;
      }

      // For other errors, don't retry
      console.error(`❌ Non-retryable error:`, error.message || error.name);
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after all retries');
};

/**
 * Login-specific fetch with enhanced error handling
 */
export const loginRequest = async (
  endpoint: string,
  body: any,
  apiUrl?: string
): Promise<Response> => {
  const url = apiUrl || getApiUrl();
  const fullUrl = `${url}${endpoint}`;
  const maxRetries = 3;

  // First, check server health (quick check, don't block if it fails)
  console.log('🏥 Checking server health...');
  const isHealthy = await checkServerHealth(url);
  if (!isHealthy) {
    console.warn('⚠️ Server health check failed - server may not be running or reachable');
    console.warn('   Proceeding with login attempt anyway (will retry automatically)...');
  } else {
    console.log('✅ Server health check passed');
  }

  try {
    const response = await robustFetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      retry: {
        maxRetries: maxRetries,
        initialDelay: 1000,
        maxDelay: 8000,
        backoffMultiplier: 2,
        timeout: 30000,
      },
    });

    return response;
  } catch (error: any) {
    // Enhanced error handling for login
    const serverIP = url.split('://')[1]?.split(':')[0] || 'unknown';
    const isAndroid = Platform.OS === 'android';
    const appName = 'worker-app';

    // Check if it's a timeout error
    if (error.message?.includes('timeout') || error.name === 'AbortError' || error.message?.includes('timeout after')) {
      throw new Error(
        `⏱️ Connection Timeout\n\nAll ${maxRetries + 1} attempts timed out.\n\n🔍 Troubleshooting:\n\n1️⃣ Check if backend is running:\n   cd backend\n   bun run dev\n   (Should show: "Server running on port 5001")\n\n2️⃣ Test in phone browser:\n   Open: http://${serverIP}:5001/health\n   (Should show JSON response)\n\n3️⃣ Network checks:\n   • Device and computer on same WiFi\n   • Computer IP is ${serverIP}\n   • Firewall allows port 5001\n   • Try restarting backend server`
      );
    }

    // Check if it's a network error
    if (error.message?.includes('Network request failed') || error.name === 'TypeError' || error.message?.includes('Cannot connect')) {
      const suggestions = isAndroid
        ? `🔴 Connection Failed After ${maxRetries + 1} Retries\n\n📋 Step-by-Step Fix:\n\n1️⃣ Start Backend Server:\n   cd backend\n   bun run dev\n   (Wait for: "Server running on port 5001")\n\n2️⃣ Test Server in Phone Browser:\n   Open: http://${serverIP}:5001/health\n   (If this fails, server is not reachable)\n\n3️⃣ Rebuild App (if needed):\n   cd ${appName}\n   bunx expo prebuild --clean\n   bunx expo run:android\n\n4️⃣ Verify Network:\n   • Device and computer on same WiFi\n   • Computer IP is ${serverIP}\n   • Firewall allows port 5001\n   • Backend terminal shows no errors`
        : `🔴 Connection Failed After ${maxRetries + 1} Retries\n\n📋 Step-by-Step Fix:\n\n1️⃣ Start Backend Server:\n   cd backend\n   bun run dev\n   (Wait for: "Server running on port 5001")\n\n2️⃣ Test Server in Phone Browser:\n   Open: http://${serverIP}:5001/health\n   (If this fails, server is not reachable)\n\n3️⃣ Verify Network:\n   • Device and computer on same network\n   • Computer IP is ${serverIP}\n   • Firewall allows port 5001\n   • Backend terminal shows no errors`;

      throw new Error(`Cannot connect to server at ${url}\n\n${suggestions}`);
    }

    // Generic error
    throw error;
  }
};

