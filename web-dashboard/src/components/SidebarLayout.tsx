'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DocumentVerificationNotification from './DocumentVerificationNotification';
import { socketService } from '../lib/socketService';

interface SidebarLayoutProps {
  children: React.ReactNode;
  adminName?: string;
}

const getDisplayAdminName = (name?: string) => {
  if (!name) return 'Admin';
  const uniqueParts: string[] = [];
  for (const part of name.trim().split(/\s+/)) {
    if (!uniqueParts.includes(part)) {
      uniqueParts.push(part);
    }
  }
  return uniqueParts.join(' ') || 'Admin';
};

export default function SidebarLayout({ children, adminName }: SidebarLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminProfileImage, setAdminProfileImage] = useState<string | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationWorker, setNotificationWorker] = useState<any>(null);

  const loadAdminProfileImage = () => {
    const adminData = localStorage.getItem('adminUser');
    if (adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        setAdminProfileImage(parsedAdmin.profileImage || null);
      } catch (error) {
        console.error('Error parsing admin data:', error);
      }
    }
  };

  useEffect(() => {
    // Load profile image on mount
    loadAdminProfileImage();

    // Listen for custom profile update event
    const handleProfileUpdate = (event: CustomEvent) => {
      const updatedAdmin = event.detail;
      if (updatedAdmin?.profileImage) {
        setAdminProfileImage(updatedAdmin.profileImage);
      } else {
        setAdminProfileImage(null);
      }
    };

    // Listen for localStorage changes (for cross-tab synchronization)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'adminUser') {
        loadAdminProfileImage();
      }
    };

    // Add event listeners
    window.addEventListener('adminProfileUpdated', handleProfileUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    // Connect to Socket.IO for document verification notifications
    const adminData = localStorage.getItem('adminUser');
    if (adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        const adminId = parsedAdmin._id || parsedAdmin.id || 'admin-' + Date.now();
        socketService.connect(adminId, 'admin');

        // Listen for document verification submissions
        const handleDocumentSubmitted = (worker: any) => {
          console.log('📢 Document verification submitted notification received:', worker);
          setNotificationWorker(worker);
          setNotificationVisible(true);
        };

        // Wait a bit for connection to establish
        const connectTimeout = setTimeout(() => {
          socketService.on('document:verification:submitted', handleDocumentSubmitted);
          console.log('✅ Socket.IO listener registered for document:verification:submitted');
        }, 1000);

        return () => {
          clearTimeout(connectTimeout);
          socketService.off('document:verification:submitted', handleDocumentSubmitted);
          window.removeEventListener('adminProfileUpdated', handleProfileUpdate as EventListener);
          window.removeEventListener('storage', handleStorageChange);
        };
      } catch (error) {
        console.error('Error parsing admin data:', error);
        return () => {
          window.removeEventListener('adminProfileUpdated', handleProfileUpdate as EventListener);
          window.removeEventListener('storage', handleStorageChange);
        };
      }
    }

    // Cleanup
    return () => {
      window.removeEventListener('adminProfileUpdated', handleProfileUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    router.push('/auth');
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
        </svg>
      ),
    },
    {
      name: 'Users',
      href: '/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      name: 'Workers',
      href: '/workers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Services',
      href: '/services',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      name: 'Requests',
      href: '/requests',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'Connection Status',
      href: '/connection-status',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Document Verification',
      href: '/document-verification',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Fixed height, no scrolling */}
      <div className="w-64 bg-gradient-to-br from-blue-50 via-orange-50 to-blue-100 shadow-lg relative flex flex-col h-screen">
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-100/30 to-blue-100/40 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col h-full">
          {/* Header - Fixed */}
          <div className="p-6 flex-shrink-0">
            <h1 className="text-2xl font-bold text-blue-600">Sufar</h1>
            <div className="mt-1">
              <p className="text-sm font-semibold animate-flame-text">
                Admin Dashboard
              </p>
            </div>
          </div>

          {/* Navigation - Scrollable only if needed */}
          <nav className="px-3 flex-1 overflow-y-auto relative z-10 min-h-0">
            <div className="space-y-2 pb-4">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-orange-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-orange-100 hover:text-gray-900'
                    }`}
                  >
                    <span className={`mr-3 transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-blue-600'}`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </a>
                );
              })}
            </div>
          </nav>

          {/* User info and logout - Fixed at bottom */}
          <div className="flex-shrink-0 p-6 border-t border-blue-200/50 bg-gradient-to-t from-blue-100/40 to-transparent relative z-10">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-orange-400 rounded-full flex items-center justify-center overflow-hidden shadow-md ring-2 ring-white/50">
                  {adminProfileImage ? (
                    <img
                      src={adminProfileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-base font-semibold text-gray-800">{getDisplayAdminName(adminName)}</p>
                <button
                  onClick={handleLogout}
                  className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-md transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - Scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Document Verification Notification */}
      <DocumentVerificationNotification
        visible={notificationVisible}
        worker={notificationWorker}
        onView={() => {
          setNotificationVisible(false);
          setNotificationWorker(null);
        }}
        onDismiss={() => {
          setNotificationVisible(false);
          setNotificationWorker(null);
        }}
      />
    </div>
  );
}
