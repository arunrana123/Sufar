'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useMemo, memo } from 'react';
import SidebarLayout from './SidebarLayout';

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/users',
  '/workers',
  '/services',
  '/requests',
  '/connection-status',
  '/document-verification',
  '/profile',
];

// Memoized wrapper to prevent unnecessary re-renders
const DashboardLayoutWrapper = memo(function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [adminName, setAdminName] = useState<string>('Admin');
  
  // Memoize the dashboard route check
  const isDashboardRoute = useMemo(() => {
    return DASHBOARD_ROUTES.includes(pathname);
  }, [pathname]);

  useEffect(() => {
    // Load admin name from localStorage
    const adminData = localStorage.getItem('adminUser');
    if (adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        setAdminName(parsedAdmin.name || 'Admin');
      } catch (error) {
        console.error('Error parsing admin data:', error);
      }
    }
  }, []);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      const updatedAdmin = event.detail;
      if (updatedAdmin?.name) {
        setAdminName(updatedAdmin.name);
      }
    };

    window.addEventListener('adminProfileUpdated', handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener('adminProfileUpdated', handleProfileUpdate as EventListener);
    };
  }, []);

  // Only render SidebarLayout for dashboard routes, keep it persistent
  if (isDashboardRoute) {
    return <SidebarLayout adminName={adminName}>{children}</SidebarLayout>;
  }

  return <>{children}</>;
});

export default DashboardLayoutWrapper;
