// ADMIN DASHBOARD PAGE - Main dashboard with statistics, recent activities, and overview
// Features: User/worker/service/booking counts, revenue stats, recent admin activities, real-time data
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Fetches live dashboard data from backend API with fallback to proxy
  // Triggered by: Component mount, auto-refresh every 30 seconds
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      
      // Try direct connection first, then fallback to proxy
      let statsRes, activitiesRes;
      
      try {
        // Try direct connection with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        statsRes = await fetch(`${apiUrl}/api/dashboard/stats`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        activitiesRes = await fetch(`${apiUrl}/api/dashboard/activities`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
      } catch (directError) {
        // Fallback to proxy route
        console.log('Direct connection failed, trying proxy route...');
        try {
          statsRes = await fetch('/api/proxy/api/dashboard/stats', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          activitiesRes = await fetch('/api/proxy/api/dashboard/activities', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (proxyError) {
          throw new Error('Failed to connect to backend. Please ensure the backend server is running.');
        }
      }
      
      // Process stats response
      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setError(null); // Clear error on successful fetch
      } else if (statsRes) {
        console.error('Failed to fetch stats:', statsRes.status, statsRes.statusText);
        // Set default values on error
        if (!stats) {
          setStats({
            users: { total: 0, regularUsers: 0, workers: 0, recent: 0 },
            bookings: { total: 0, recent: 0 },
            services: { active: 0, total: 0 },
          });
        }
      }

      // Process activities response
      if (activitiesRes && activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to connect to backend server. Please ensure the backend is running on port 5001.');
      // Set default values on error to prevent UI breaking
      if (!stats) {
        setStats({
          users: { total: 0, regularUsers: 0, workers: 0, recent: 0 },
          bookings: { total: 0, recent: 0 },
          services: { active: 0, total: 0 },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [stats]);

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/auth');
      return;
    }
    
    try {
      const parsedAdmin = JSON.parse(adminData) as AdminUser;
      setAdmin(parsedAdmin);
      fetchDashboardData();
      
      // Auto-refresh every 30 seconds for live data
      const interval = setInterval(() => {
        fetchDashboardData();
      }, 30000);
      
      return () => clearInterval(interval);
    } catch {
      router.push('/auth');
    }
  }, [router, fetchDashboardData]);

  const handleClearActivities = async () => {
    if (!confirm('Are you sure you want to clear all recent activities? This action cannot be undone.')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const res = await fetch(`${apiUrl}/api/dashboard/activities`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setActivities([]);
        alert('All activities cleared successfully!');
      } else {
        alert('Failed to clear activities. Please try again.');
      }
    } catch (error) {
      console.error('Error clearing activities:', error);
      alert('Failed to clear activities. Please try again.');
    }
  };

  if (!admin) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Live statistics from user and worker apps</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-yellow-700 font-medium">Connection Warning</p>
                <p className="text-xs text-yellow-600 mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  fetchDashboardData();
                }}
                className="ml-auto text-sm text-yellow-700 hover:text-yellow-900 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading statistics...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Total Users Card - Combined from both apps */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Total Users</h3>
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats?.users?.total || 0}</p>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <span>{stats?.users?.regularUsers || 0} regular users</span>
                <span className="mx-2">•</span>
                <span>{stats?.users?.workers || 0} workers</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{stats?.users?.recent || 0} new this week</p>
          </div>

            {/* Active Services Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Active Services</h3>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats?.services?.active || 0}</p>
              <p className="text-sm text-gray-500 mt-2">Available services</p>
              <p className="text-xs text-gray-400 mt-1">{stats?.services?.total || 0} total services</p>
            </div>

            {/* Total Bookings Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Total Bookings</h3>
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            <p className="text-3xl font-bold text-purple-600">{stats?.bookings?.total || 0}</p>
              <p className="text-sm text-gray-500 mt-2">{stats?.bookings?.recent || 0} bookings this week</p>
              <p className="text-xs text-gray-400 mt-1">From both user and worker apps</p>
            </div>
          </div>
        )}

        {/* Recent Activity Section - Collapsible; expands fully with content so page grows downward */}
        <div className={`mt-8 bg-white rounded-lg shadow transition-all duration-300 ${
          isActivityOpen ? 'max-h-none opacity-100 mb-20 overflow-visible' : 'max-h-0 opacity-0 mb-0 overflow-hidden'
        }`}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            {activities.length > 0 && (
              <button
                onClick={handleClearActivities}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
          </div>
          <div className="p-6">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity._id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {activity.adminId?.firstName} {activity.adminId?.lastName} • {' '}
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Show/Hide Activity button - in flow so it moves to bottom as content grows */}
        <div className="mt-6 flex justify-end pb-8">
          <button
            onClick={() => setIsActivityOpen(!isActivityOpen)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 group relative"
            aria-label="Toggle Recent Activity"
          >
            <svg 
              className={`w-6 h-6 transition-transform duration-300 ${isActivityOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="hidden md:inline-block font-medium">
              {isActivityOpen ? 'Hide' : 'Show'} Activity
            </span>
            {activities.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {activities.length}
              </span>
            )}
          </button>
        </div>
    </div>
  );
}
