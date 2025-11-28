'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../../components/SidebarLayout';

type ConnectionStatus = {
  status: 'healthy' | 'unhealthy' | 'checking';
  timestamp?: string;
  backend?: {
    status: string;
    port: number;
    environment: string;
  };
  database?: {
    connected: boolean;
    readyState: number;
    database: string | null;
    error: string | null;
  };
  counts?: {
    users: number;
    workers: number;
    bookings: number;
  };
  error?: string;
};

export default function ConnectionStatusPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'checking' });
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/auth');
      return;
    }

    try {
      const parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
      checkConnection();
      
      // Auto-refresh every 10 seconds
      const interval = setInterval(() => {
        checkConnection();
      }, 10000);

      return () => clearInterval(interval);
    } catch {
      router.push('/auth');
    }
  }, [router]);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const res = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json();
          setConnectionStatus(data);
          setLastCheck(new Date());
        } else {
          let errorData;
          try {
            errorData = await res.json();
          } catch {
            errorData = { error: `HTTP ${res.status}: ${res.statusText}` };
          }
          
          setConnectionStatus({
            status: 'unhealthy',
            error: errorData.error || 'Backend connection failed',
            backend: {
              status: 'error',
              port: 5001,
              environment: 'unknown',
            },
            database: {
              connected: false,
              readyState: 0,
              database: null,
              error: errorData.error || 'Connection failed',
            },
          });
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout: Backend server did not respond within 5 seconds');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Connection check error:', error);
      
      const errorMessage = error.message || 'Failed to connect to backend';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      
      setConnectionStatus({
        status: 'unhealthy',
        error: errorMessage,
        backend: {
          status: 'error',
          port: 5001,
          environment: 'unknown',
        },
        database: {
          connected: false,
          readyState: 0,
          database: null,
          error: errorMessage.includes('timeout') 
            ? 'Backend server timeout - server may be down or unreachable'
            : errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')
            ? `Cannot reach backend server at ${apiUrl}. Please check if the server is running.`
            : errorMessage,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const getReadyStateText = (state: number) => {
    switch (state) {
      case 0: return 'Disconnected';
      case 1: return 'Connected';
      case 2: return 'Connecting';
      case 3: return 'Disconnecting';
      default: return 'Unknown';
    }
  };

  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarLayout adminName={admin.name}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Connection Status</h1>
          <p className="text-gray-600 mt-2">Monitor backend and database connections</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
            <button
              onClick={checkConnection}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          {connectionStatus.status === 'checking' ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Checking connection...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg ${
                connectionStatus.status === 'healthy' 
                  ? 'bg-green-50 border-2 border-green-200' 
                  : 'bg-red-50 border-2 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${
                      connectionStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-lg font-semibold">
                      Status: {connectionStatus.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                    </span>
                  </div>
                  {connectionStatus.timestamp && (
                    <span className="text-sm text-gray-600">
                      Last checked: {new Date(connectionStatus.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Backend Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Backend Server</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="text-sm text-gray-900 capitalize">{connectionStatus.backend?.status || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Port</label>
                    <p className="text-sm text-gray-900">{connectionStatus.backend?.port || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Environment</label>
                    <p className="text-sm text-gray-900 capitalize">{connectionStatus.backend?.environment || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">API URL</label>
                    <p className="text-sm text-gray-900 break-all">
                      {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Database Status */}
              <div className={`rounded-lg p-4 ${
                connectionStatus.database?.connected 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Database Connection</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Connection Status</label>
                    <p className={`text-sm font-semibold ${
                      connectionStatus.database?.connected ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {connectionStatus.database?.connected ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Ready State</label>
                    <p className="text-sm text-gray-900">
                      {connectionStatus.database?.readyState !== undefined 
                        ? getReadyStateText(connectionStatus.database.readyState)
                        : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Database Name</label>
                    <p className="text-sm text-gray-900">{connectionStatus.database?.database || 'N/A'}</p>
                  </div>
                  {connectionStatus.database?.error && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-red-600">Error</label>
                      <p className="text-sm text-red-600">{connectionStatus.database.error}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Database Counts */}
              {connectionStatus.counts && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Database Records</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Users</label>
                      <p className="text-2xl font-bold text-blue-600">{connectionStatus.counts.users}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Workers</label>
                      <p className="text-2xl font-bold text-green-600">{connectionStatus.counts.workers}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Bookings</label>
                      <p className="text-2xl font-bold text-purple-600">{connectionStatus.counts.bookings}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {connectionStatus.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error</h3>
                  <p className="text-sm text-red-600">{connectionStatus.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connection Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Backend URL:</span>
              <span className="text-gray-900 font-mono">
                {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Health Check Endpoint:</span>
              <span className="text-gray-900 font-mono">/health</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Checked:</span>
              <span className="text-gray-900">{lastCheck.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Auto-refresh:</span>
              <span className="text-gray-900">Every 10 seconds</span>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

