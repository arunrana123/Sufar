import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
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
 * Check if device has network connectivity
 */
export const checkNetworkConnectivity = async (): Promise<{ connected: boolean; type: string }> => {
  try {
    const state = await NetInfo.fetch();
    return {
      connected: state.isConnected ?? false,
      type: state.type || 'unknown',
    };
  } catch (error) {
    console.log('⚠️ Network connectivity check failed:', error);
    return { connected: false, type: 'unknown' };
  }
};

/**
 * Check if server is reachable before making requests
 * Made more lenient - shorter timeout and doesn't block if it fails
 */
export const checkServerHealth = async (apiUrl?: string): Promise<boolean> => {
  const url = apiUrl || getApiUrl();
  // Backend health endpoint is at /health (not /api/health)
  const healthEndpoint = `${url}/health`;
  
  try {
    const controller = new AbortController();
    // Reduced timeout to 3 seconds - don't wait too long
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
      // Add timeout headers for Android
      headers: {
        'Connection': 'close',
      },
    });
    
    clearTimeout(timeoutId);
    // Any response (even 404) means server is reachable
    return response.status < 500; // 2xx, 3xx, 4xx all mean server responded
  } catch (error: any) {
    // Don't log as error - health check failure is expected if server is down
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
 * Enhanced for Android network issues
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

      // Enhanced fetch options for Android compatibility
      const existingHeaders = options.headers || {};
      const headersObj = typeof existingHeaders === 'object' && !Array.isArray(existingHeaders) && !(existingHeaders instanceof Headers)
        ? existingHeaders as Record<string, string>
        : {};
      
      const fetchOptions: RequestInit = {
        ...options,
        signal: controller.signal,
        cache: 'no-cache',
        credentials: 'omit',
        // Add headers for better Android compatibility
        headers: {
          ...headersObj,
          'Connection': 'close',
          'Accept': 'application/json',
          'Content-Type': headersObj['Content-Type'] || 'application/json',
          // Android-specific headers
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      };

      // Try fetch with enhanced options
      let response: Response;
      try {
        response = await fetch(url, fetchOptions);
      } catch (fetchError: any) {
        // On Android, sometimes fetch fails with TypeError
        // Try one more time with minimal options
        if (Platform.OS === 'android' && attempt < maxRetries && (
          fetchError.name === 'TypeError' || 
          fetchError.message?.includes('Network request failed')
        )) {
          console.log('⚠️ Android fetch failed, retrying with minimal options...');
          const minimalOptions: RequestInit = {
            method: options.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            body: options.body,
            signal: controller.signal,
          };
          response = await fetch(url, minimalOptions);
        } else {
          throw fetchError;
        }
      }

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
        error.message?.includes('Failed to connect') ||
        error.message?.includes('Unable to resolve host') ||
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
 * Made more robust for connection issues with network connectivity checks
 */
export const loginRequest = async (
  endpoint: string,
  body: any,
  apiUrl?: string
): Promise<Response> => {
  const url = apiUrl || getApiUrl();
  const fullUrl = `${url}${endpoint}`;
  const maxRetries = 4; // Increased retries for login
  const serverIP = url.split('://')[1]?.split(':')[0] || 'unknown';

  // Check network connectivity (non-blocking - don't fail if check is wrong)
  console.log('📶 Checking network connectivity...');
  const networkStatus = await checkNetworkConnectivity();
  
  if (!networkStatus.connected) {
    console.warn('⚠️ Network check reports no connection, but proceeding anyway (check may be incorrect)');
    // Don't throw error - NetInfo can be wrong, let the actual fetch determine if connection exists
  } else {
    console.log(`✅ Network connected (${networkStatus.type})`);
  }

  // Check server health in parallel (non-blocking) - don't wait for it
  console.log('🏥 Checking server health (non-blocking)...');
  checkServerHealth(url).then(isHealthy => {
    if (isHealthy) {
      console.log('✅ Server health check passed');
    } else {
      console.warn('⚠️ Server health check failed - proceeding with login attempt anyway');
    }
  }).catch(() => {
    // Ignore health check errors - proceed with login
    console.warn('⚠️ Server health check error - proceeding with login attempt');
  });

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
        initialDelay: 1500, // Slightly longer initial delay
        maxDelay: 10000,
        backoffMultiplier: 2,
        timeout: 35000, // Increased timeout for login (35 seconds)
      },
    });

    return response;
  } catch (error: any) {
    // Enhanced error handling for login
    const isAndroid = Platform.OS === 'android';
    const appName = 'worker-app';

    // Check if it's a timeout error
    if (error.message?.includes('timeout') || error.name === 'AbortError' || error.message?.includes('timeout after')) {
      throw new Error(
        `⏱️ Connection Timeout\n\nAll ${maxRetries + 1} attempts timed out.\n\n🔍 Quick Fix:\n\n1️⃣ Make sure backend is running:\n   cd backend && bun run dev\n\n2️⃣ Test in phone browser:\n   http://${serverIP}:5001/health\n\n3️⃣ Check network:\n   • Same WiFi network\n   • IP: ${serverIP}\n   • Port 5001 open`
      );
    }

    // Check if it's a network error
    if (
      error.message?.includes('Network request failed') || 
      error.message?.includes('Failed to connect') ||
      error.message?.includes('Unable to resolve host') ||
      error.name === 'TypeError' || 
      error.message?.includes('Cannot connect')
    ) {
      // Try to get more diagnostic info
      const networkInfo = await checkNetworkConnectivity();
      const networkInfoText = networkInfo.connected 
        ? `Network: Connected (${networkInfo.type})` 
        : `Network: Not Connected`;

      const suggestions = isAndroid
        ? `🔴 Cannot Connect to Server\n\n${networkInfoText}\n\n📋 Fix Steps:\n\n1️⃣ Start Backend Server:\n   cd backend\n   bun run dev\n   (Wait for "Server running on port 5001")\n\n2️⃣ Test in Phone Browser:\n   Open: http://${serverIP}:5001/health\n   (Must show JSON response)\n\n3️⃣ If Browser Test Fails:\n   • Check WiFi: Device & PC same network\n   • Verify IP: ${serverIP}\n   • Check firewall: Allow port 5001\n   • Restart backend server\n\n4️⃣ If Browser Test Works:\n   • App may need rebuild\n   • Try: cd ${appName} && bunx expo prebuild --clean`
        : `🔴 Cannot Connect to Server\n\n${networkInfoText}\n\n📋 Fix Steps:\n\n1️⃣ Start Backend Server:\n   cd backend\n   bun run dev\n   (Wait for "Server running on port 5001")\n\n2️⃣ Test in Phone Browser:\n   Open: http://${serverIP}:5001/health\n   (Must show JSON response)\n\n3️⃣ If Browser Test Fails:\n   • Check network: Device & PC same network\n   • Verify IP: ${serverIP}\n   • Check firewall: Allow port 5001\n   • Restart backend server`;

      throw new Error(`Cannot connect to server at ${url}\n\n${suggestions}`);
    }

    // Generic error - preserve original message
    throw error;
  }
};

