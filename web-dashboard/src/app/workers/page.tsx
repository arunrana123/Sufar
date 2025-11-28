// WORKERS MANAGEMENT PAGE - Admin panel to view, verify, activate/deactivate workers
// Features: Worker list table, search/filter, verification status, approve/reject workers, view documents
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../../components/SidebarLayout';
import { socketService } from '../../lib/socketService';

type ServiceCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  pendingRequests: number;
  verifiedWorkers: number;
  totalWorkers: number;
};

export default function WorkersPage() {
  const router = useRouter();
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setExpandedCard(null);
      }
    };

    if (expandedCard) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedCard]);

  // Fetches live worker statistics by category from backend API
  // Triggered by: Component mount, auto-refresh every 30 seconds, manual refresh button, Socket.IO events
  const fetchServiceCategories = useCallback(async () => {
    try {
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    
      // Try direct connection first, then fallback to proxy
      let res;
      let errorDetails: any = null;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        res = await fetch(`${apiUrl}/api/workers/stats-by-category`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (directError: any) {
        console.warn('Direct connection failed, trying proxy:', directError.message);
        // Fallback to proxy route
        try {
          res = await fetch('/api/proxy/api/workers/stats-by-category', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (proxyError: any) {
          console.error('Proxy connection also failed:', proxyError);
          setError(`Failed to connect to backend server. Please ensure:
1. Backend server is running on port 5001
2. MongoDB database is connected
3. Check backend console for errors`);
          if (serviceCategories.length === 0) {
            setLoading(false);
          }
          return;
        }
      }
      
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          if (data.length > 0) {
            setServiceCategories(data);
            setError(null);
            console.log('✅ Worker stats synced with backend successfully:', data.length, 'categories');
          } else {
            setServiceCategories([]);
            setError('No worker data available. Workers will appear here once they register and select service categories.');
            console.warn('No worker categories found - database is empty or no workers have categories');
          }
        } else {
          // Handle error response from backend
          errorDetails = data;
          setError(data.message || 'Invalid response from backend server');
          console.error('Invalid response format:', data);
          if (serviceCategories.length === 0) {
            setServiceCategories([]);
          }
        }
      } else {
        // Try to parse error response
        let errorMessage = `HTTP ${res?.status || 'Unknown'}`;
        try {
          const errorData = await res?.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData;
        } catch {
          // Response is not JSON
        }
        
        setError(`Failed to fetch worker statistics: ${errorMessage}. ${errorDetails?.error ? `Details: ${errorDetails.error}` : ''}`);
        console.error('Failed to fetch worker stats:', res?.status, errorDetails);
        if (serviceCategories.length === 0) {
          setServiceCategories([]);
        }
      }
    } catch (error: any) {
      console.error('Error fetching service categories:', error);
      setError(error.message || 'An unexpected error occurred while fetching worker data. Check backend server and database connection.');
      if (serviceCategories.length === 0) {
        setServiceCategories([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/auth');
      return;
    }

    let parsedAdmin: any;
    try {
      parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
    } catch {
      router.push('/auth');
      return;
    }

    // Connect to Socket.IO for real-time updates
    const adminId = parsedAdmin._id || parsedAdmin.id || 'admin-' + Date.now();
    socketService.connect(adminId, 'admin');

    // Initial fetch
    fetchServiceCategories();
    
    // Listen for document verification updates (when worker is approved/rejected)
    const handleVerificationUpdated = (data: any) => {
      console.log('📢 Worker verification updated:', data);
      setIsUpdating(true);
      // Refresh stats immediately when verification status changes
      setTimeout(() => {
        fetchServiceCategories().finally(() => {
          setIsUpdating(false);
        });
      }, 500); // Small delay to ensure backend has saved the changes
    };

    // Listen for admin dashboard-specific worker stats updates
    const handleDashboardStatsUpdate = (data: any) => {
      console.log('📊 Admin dashboard worker stats update:', data);
      setIsUpdating(true);
      // Refresh stats immediately
      setTimeout(() => {
        fetchServiceCategories().finally(() => {
          setIsUpdating(false);
        });
      }, 500);
    };

    // Listen for new document submissions
    const handleDocumentSubmitted = (worker: any) => {
      console.log('📢 New document submission received:', worker);
      setIsUpdating(true);
      // Refresh stats to show new pending request
      setTimeout(() => {
        fetchServiceCategories().finally(() => {
          setIsUpdating(false);
        });
      }, 500);
    };

    // Wait a bit for socket connection to establish
    const connectTimeout = setTimeout(() => {
      socketService.on('document:verification:updated', handleVerificationUpdated);
      socketService.on('admin:dashboard:worker-stats-updated', handleDashboardStatsUpdate);
      socketService.on('document:verification:submitted', handleDocumentSubmitted);
      console.log('✅ Socket.IO listeners registered for worker stats updates');
    }, 1000);
    
    // Auto-refresh every 30 seconds as backup
    const interval = setInterval(() => {
      fetchServiceCategories();
    }, 30000);
    
    return () => {
      clearTimeout(connectTimeout);
      clearInterval(interval);
      socketService.off('document:verification:updated', handleVerificationUpdated);
      socketService.off('admin:dashboard:worker-stats-updated', handleDashboardStatsUpdate);
      socketService.off('document:verification:submitted', handleDocumentSubmitted);
    };
  }, [router, fetchServiceCategories]);

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarLayout adminName={admin.name}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Worker Management</h1>
          <p className="text-gray-600 mt-2">Manage worker verification and service categories</p>
        </div>

        {/* Service Categories Grid - Refined Cards with Dropdown */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Worker Categories</h2>
              <p className="text-sm text-gray-500 mt-1">
                Live statistics for each service type
                {isUpdating && (
                  <span className="ml-2 inline-flex items-center gap-1 text-blue-600">
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Updating...
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchServiceCategories();
              }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <button
                  onClick={() => {
                    setLoading(true);
                    fetchServiceCategories();
                  }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && serviceCategories.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Worker Categories Found</h3>
              <p className="text-sm text-gray-600 mb-4">Worker statistics will appear here once workers register and select their service categories.</p>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchServiceCategories();
                }}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Refresh Data
              </button>
            </div>
          )}

          {/* Categories Grid */}
          {serviceCategories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {serviceCategories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border-l-4"
                style={{ borderLeftColor: category.color }}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-4xl mr-3">{category.icon}</span>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                        <p className="text-xs text-gray-500">{category.totalWorkers} total workers</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Pending Requests</span>
                      </div>
                      <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                        category.pendingRequests > 0
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {category.pendingRequests}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Verified Workers</span>
                      </div>
                      <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                        category.verifiedWorkers > 0
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {category.verifiedWorkers}
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCard(expandedCard === category.id ? null : category.id);
                      }}
                      className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 hover:opacity-90"
                      style={{ backgroundColor: category.color }}
                    >
                      <span>Actions</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${expandedCard === category.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu Content */}
                    {expandedCard === category.id && (
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => {
                            router.push(`/document-verification?category=${category.name}`);
                            setExpandedCard(null);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Pending Requests ({category.pendingRequests})
                        </button>
                        <button
                          onClick={() => {
                            router.push(`/document-verification?category=${category.name}&status=verified`);
                            setExpandedCard(null);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          View Verified ({category.verifiedWorkers})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
