// WORKER HOME SCREEN - Main dashboard with availability toggle, service management, and location tracking
// Features: Toggle online/offline status, GPS location tracking, add/edit services, incoming booking requests banner, helpful tooltips
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Pressable, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import BottomNav from '@/components/BottomNav';
import IncomingRequestBanner from '@/components/IncomingRequestBanner';
import HelpTooltip from '@/components/HelpTooltip';
import LocationService from '@/lib/LocationService';
import MockLocationService from '@/lib/MockLocationService';
import { SocketService } from '@/lib/SocketService';
import { bookingRequestListener } from '@/lib/BookingRequestListener';
import ServiceCart from '@/components/ServiceCart';
import ServiceRegistrationModal from '@/components/ServiceRegistrationModal';
import ToastNotification from '@/components/ToastNotification';
import { getApiUrl } from '@/lib/config';
import { canGoOnline, getVerificationMessage, checkWorkerPermission } from '@/lib/permissions';
import { detectLocation, AVAILABLE_LOCATIONS } from '@/lib/LocationDetector';

export default function HomeScreen() {
  const { worker, updateWorker } = useAuth();
  const [selectedLocation, setSelectedLocation] = useState('Kathmandu');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [incomingBooking, setIncomingBooking] = useState<any | null>(null);
  const [listenerStatus, setListenerStatus] = useState({ isListening: false, isConnected: false });
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    title?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
  });

  const locations = AVAILABLE_LOCATIONS;
  const locationService = LocationService.getInstance();
  const mockLocationService = MockLocationService.getInstance();
  const socketService = SocketService.getInstance();

  // Auto-detect location on mount
  useEffect(() => {
    const autoDetectLocation = async () => {
      try {
        const detectedLocation = await detectLocation();
        console.log('📍 Auto-detected location:', detectedLocation);
        setSelectedLocation(detectedLocation);
      } catch (error) {
        console.error('Error auto-detecting location:', error);
      }
    };

    autoDetectLocation();
  }, []);

  // Fetches worker's registered services from backend on login
  // Triggered by: Worker logs in, component mounts with worker ID
  const fetchWorkerServices = async () => {
    if (!worker?.id) {
      console.log('⚠️ Worker ID not available, cannot fetch services');
      return;
    }
    
    try {
      const apiUrl = getApiUrl();
      const url = `${apiUrl}/api/workers/${worker.id}`;
      console.log('📡 Fetching worker services from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const workerData = await response.json();
        console.log('📦 Worker data received from backend:', {
          id: workerData._id,
          name: workerData.name,
          serviceCategories: workerData.serviceCategories,
          serviceCategoriesType: typeof workerData.serviceCategories,
          serviceCategoriesLength: workerData.serviceCategories?.length || 0,
          rawServiceCategories: JSON.stringify(workerData.serviceCategories),
        });
        
        // Handle serviceCategories - could be array, string, or undefined
        let serviceCategories: string[] = [];
        if (Array.isArray(workerData.serviceCategories)) {
          serviceCategories = workerData.serviceCategories
            .filter((cat: any) => cat && String(cat).trim().length > 0)
            .map((cat: any) => String(cat).trim());
        } else if (typeof workerData.serviceCategories === 'string' && workerData.serviceCategories.trim().length > 0) {
          serviceCategories = [workerData.serviceCategories.trim()];
        }
        
        console.log('📋 Processed serviceCategories:', serviceCategories, 'Count:', serviceCategories.length);
        
        if (serviceCategories.length > 0) {
          // Convert all service categories to services format
          const allServices = serviceCategories.map((category: string, index: number) => ({
            id: `service-${category}-${index}-${Date.now()}`,
            name: category,
            category: category,
            price: 0,
            priceType: 'hour' as const,
            description: `Professional ${category} services`,
          }));
          
          // FORCE update services - use new array to trigger re-render
          console.log('✅ FORCED: Setting services from backend:', allServices.map((s: { category: string }) => s.category));
          setServices([...allServices]); // Use spread to force new array reference
          
          // Always update worker context with latest serviceCategories from backend
          if (worker) {
            updateWorker({
              ...worker,
              serviceCategories: [...serviceCategories], // Use spread to force new array
            } as any);
            console.log('✅ Updated worker context with serviceCategories:', serviceCategories);
          }
        } else {
          // No services registered yet
          console.log('⚠️ WARNING: No services found in backend response!');
          console.log('   Raw serviceCategories value:', workerData.serviceCategories);
          console.log('   Type:', typeof workerData.serviceCategories);
          console.log('   Full workerData:', JSON.stringify(workerData, null, 2));
          setServices([]);
          
          // Clear serviceCategories from context if backend says there are none
          if (worker && worker.serviceCategories && worker.serviceCategories.length > 0) {
            updateWorker({
              ...worker,
              serviceCategories: [],
            } as any);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch worker services:', response.status, errorText);
        // Don't clear services on error, keep existing ones
        console.log('⚠️ Keeping existing services due to fetch error');
      }
    } catch (error) {
      console.error('❌ Error fetching worker services:', error);
      // Don't clear services on error, keep existing ones
      console.log('⚠️ Keeping existing services due to network error');
    }
  };

  // Syncs service categories to backend after adding/removing services
  // Triggered by: Services are added, removed, or updated
  const syncServiceCategoriesWithBackend = async () => {
    if (!worker?.id) return;
    
    try {
      // Extract unique service categories from services
      const serviceCategories = [...new Set(services.map((service: any) => service.category))];
      
      const apiUrl = getApiUrl();
      
      const response = await fetch(`${apiUrl}/api/workers/update-service-categories`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId: worker.id,
          serviceCategories,
        }),
      });

      if (response.ok) {
        console.log('✅ Service categories synced with backend:', serviceCategories);
      } else {
        console.error('Failed to sync service categories');
      }
    } catch (error) {
      console.error('Error syncing service categories:', error);
    }
  };

  // Checks if new services need document verification
  // Triggered by: After adding new services
  const checkVerificationNeeded = (newCategories: string[]): boolean => {
    if (!worker?.verificationStatus) return true;
    
    // Get current verified categories (if any)
    const verificationStatus = worker.verificationStatus;
    const isVerified = typeof verificationStatus === 'object' 
      ? verificationStatus.overall === 'verified'
      : verificationStatus === 'verified';
    
    // If worker is not verified at all, they need to verify
    if (!isVerified) return true;
    
    // If worker is verified but added new categories, they may need to verify new ones
    // For now, we'll prompt if they added new categories
    return newCategories.length > 0;
  };

  // Update service in services list
  const updateServiceInList = (updatedService: any) => {
    setServices(prev => 
      prev.map((service: any) => 
        service.id === updatedService._id || service._id === updatedService._id
          ? { ...service, ...updatedService, price: updatedService.price }
          : service
      )
    );
    console.log(`✅ Service updated in real-time: ${updatedService.title || updatedService.name} (Price: ${updatedService.price})`);
  };

  // Fetch services when worker logs in or component mounts
  // Triggered by: Worker ID changes or component mounts
  useEffect(() => {
    if (worker?.id) {
      console.log('🔄 Worker ID detected, fetching services...', {
        workerId: worker.id,
        hasServiceCategories: !!worker.serviceCategories,
        serviceCategoriesCount: worker.serviceCategories?.length || 0,
        serviceCategories: worker.serviceCategories,
      });
      
      // FIRST: Use serviceCategories from context immediately for instant display
      if (worker.serviceCategories && Array.isArray(worker.serviceCategories) && worker.serviceCategories.length > 0) {
        console.log('📦 Setting services IMMEDIATELY from worker context:', worker.serviceCategories);
        const immediateServices = worker.serviceCategories
          .filter((cat: any) => cat && String(cat).trim().length > 0)
          .map((category: string, index: number) => ({
            id: `service-${category}-${index}-${Date.now()}`,
            name: category,
            category: category,
            price: 0,
            priceType: 'hour' as const,
            description: `Professional ${category} services`,
          }));
        console.log('✅ IMMEDIATELY setting services from context:', immediateServices.length, 'services:', immediateServices.map((s: any) => s.category));
        // FORCE set services - this will trigger re-render
        setServices([...immediateServices]);
      } else {
        console.log('⚠️ No serviceCategories in worker context, will fetch from backend');
        // Still fetch to ensure we have latest data
      }
      
      // THEN: Fetch from backend to get the latest data and update (always fetch)
      fetchWorkerServices();
    } else {
      console.log('⚠️ No worker ID, clearing services');
      setServices([]);
    }
  }, [worker?.id]);

  // Monitor worker serviceCategories changes and update services immediately
  useEffect(() => {
    console.log('🔍 Monitoring worker serviceCategories:', {
      hasWorker: !!worker,
      hasServiceCategories: !!worker?.serviceCategories,
      serviceCategoriesCount: worker?.serviceCategories?.length || 0,
      serviceCategories: worker?.serviceCategories,
      currentServicesCount: services.length,
      currentServices: services.map((s: any) => s.category),
    });

    if (worker?.serviceCategories && Array.isArray(worker.serviceCategories) && worker.serviceCategories.length > 0) {
      console.log('📦 Worker context has serviceCategories, FORCING update services:', worker.serviceCategories);
      // Convert service categories to services format - filter out empty values
      const allServices = worker.serviceCategories
        .filter((cat: any) => cat && String(cat).trim().length > 0)
        .map((category: string, index: number) => ({
          id: `service-${category}-${index}-${Date.now()}`,
          name: category, // Use category name directly (e.g., "Plumber")
          category: category,
          price: 0,
          priceType: 'hour' as const,
          description: `Professional ${category} services`,
        }));
      
      console.log('✅ FORCED update services from worker context:', allServices.length, 'Services:', allServices.map((s: any) => s.category));
      // Use spread operator to create new array reference and force re-render
      setServices([...allServices]);
    } else if (worker?.id && services.length === 0) {
      // If no serviceCategories in context and no services displayed, fetch from backend
      console.log('📡 No serviceCategories in context and services empty, fetching from backend...');
      fetchWorkerServices();
    }
  }, [worker?.serviceCategories, worker?.id]);

  // Listen for profile updates via socket
  useEffect(() => {
    if (!worker?.id) return;

    const handleProfileUpdate = (data: any) => {
      if (data.workerId === worker.id) {
        console.log('📢 Profile update received:', data);
        // Update worker context with new profile data
        updateWorker({
          ...worker,
          ...(data.name && { name: data.name }),
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
          ...(data.profileImage && { profileImage: data.profileImage }),
        } as any);
      }
    };

    socketService.on('worker:profile_updated', handleProfileUpdate);

    return () => {
      socketService.off('worker:profile_updated', handleProfileUpdate);
    };
  }, [worker?.id]);

  // Refresh profile data when screen comes into focus (e.g., returning from profile screen)
  useFocusEffect(
    useCallback(() => {
      if (worker?.id) {
        console.log('🔄 Home screen focused, refreshing worker data...');
        // Fetch latest worker data from backend
        const refreshWorkerData = async () => {
          try {
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/api/workers/${worker.id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const workerData = await response.json();
              console.log('✅ Worker data refreshed:', {
                name: workerData.name,
                email: workerData.email,
                profileImage: workerData.profileImage ? 'present' : 'missing',
              });
              
              // Update worker context with latest data
              updateWorker({
                ...worker,
                name: workerData.name,
                email: workerData.email,
                phone: workerData.phone,
                profileImage: workerData.profileImage,
                skills: workerData.skills,
              } as any);
            }
          } catch (error) {
            console.error('❌ Error refreshing worker data:', error);
          }
        };

        refreshWorkerData();
      }
    }, [worker?.id])
  );

  // Fetch unread notification count from backend
  const fetchUnreadCount = useCallback(async () => {
    if (!worker?.id) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/notifications/user/${worker.id}/unread-count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.count || 0;
        setUnreadCount(count);
        console.log('📊 Unread notification count:', count);
      } else {
        console.warn('Failed to fetch unread count, using 0');
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, [worker?.id]);

  // Fetch unread count on mount and when worker changes
  useEffect(() => {
    fetchUnreadCount();
    
    // Refresh count every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Check if services need verification after login
  useEffect(() => {
    if (worker?.id && worker?.serviceCategories && worker.serviceCategories.length > 0) {
      // Check if any service categories need verification (no status or rejected)
      const needsVerification = worker.serviceCategories.some((category: string) => {
        const status = worker.categoryVerificationStatus?.[category];
        return !status || status === 'rejected';
      });

      if (needsVerification) {
        // Wait a bit for the home screen to render first
        setTimeout(() => {
          Alert.alert(
            'Document Verification Required',
            `You have ${worker.serviceCategories?.length || 0} service${(worker.serviceCategories?.length || 0) > 1 ? 's' : ''} (${worker.serviceCategories?.join(', ') || 'none'}) that need document verification. Please submit required documents to verify these services before you can start accepting jobs.`,
            [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'Verify Now', 
                onPress: () => {
                  router.push('/document-verification');
                }
              },
            ]
          );
        }, 2000); // Wait 2 seconds after login to show the prompt
      }
    }
  }, [worker?.id, worker?.serviceCategories]);

  // Refresh count and services when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      // Also refresh services when screen comes into focus (especially after returning from document verification)
      if (worker?.id) {
        console.log('🔄 Screen focused, refreshing services...');
        // First check worker context for immediate display
        if (worker.serviceCategories && worker.serviceCategories.length > 0) {
          console.log('📦 Screen focused, using serviceCategories from context:', worker.serviceCategories);
          const immediateServices = worker.serviceCategories.map((category: string, index: number) => ({
            id: `service-${category}-${index}-${Date.now()}`,
            name: category,
            category: category,
            price: 0,
            priceType: 'hour' as const,
            description: `Professional ${category} services`,
          }));
          setServices(immediateServices);
          console.log('✅ Set services from context on focus:', immediateServices.map((s: any) => s.name));
        }
        // Then fetch from backend to ensure we have latest data
        fetchWorkerServices();
      }
    }, [fetchUnreadCount, worker?.id, worker?.serviceCategories])
  );

  // Socket listener for service updates
  useEffect(() => {
    if (!worker?.id) return;

    const handleServiceUpdate = (data: any) => {
      console.log('📢 Socket: Service update received:', data);
      if (data.workerId === worker.id && data.serviceCategories) {
        console.log('✅ Socket: Updating services from socket event:', data.serviceCategories);
        const updatedServices = Array.isArray(data.serviceCategories) 
          ? data.serviceCategories
              .filter((cat: any) => cat && String(cat).trim().length > 0)
              .map((category: string, index: number) => ({
                id: `service-${category}-${index}-${Date.now()}`,
                name: category,
                category: category,
                price: 0,
                priceType: 'hour' as const,
                description: `Professional ${category} services`,
              }))
          : [];
        
        setServices(updatedServices);
        updateWorker({
          ...worker,
          serviceCategories: data.serviceCategories,
        } as any);
        console.log('✅ Socket: Services updated from socket:', updatedServices.map((s: any) => s.category));
      }
    };

    socketService.on('worker:service_updated', handleServiceUpdate);
    socketService.on('worker:stats_updated', handleServiceUpdate);

    return () => {
      socketService.off('worker:service_updated', handleServiceUpdate);
      socketService.off('worker:stats_updated', handleServiceUpdate);
    };
  }, [worker?.id]);

  // Socket listener for service updates - MUST be before other socket listeners
  useEffect(() => {
    if (!worker?.id) return;

    const handleServiceUpdate = (data: any) => {
      console.log('📢 Socket: Service update received:', data);
      if (data.workerId === worker.id && data.serviceCategories) {
        console.log('✅ Socket: Updating services from socket event:', data.serviceCategories);
        const updatedCategories = Array.isArray(data.serviceCategories) 
          ? data.serviceCategories.filter((cat: any) => cat && String(cat).trim().length > 0)
          : [];
        
        const updatedServices = updatedCategories.map((category: string, index: number) => ({
          id: `service-${category}-${index}-${Date.now()}`,
          name: category,
          category: category,
          price: 0,
          priceType: 'hour' as const,
          description: `Professional ${category} services`,
        }));
        
        console.log('✅ Socket: FORCING services update:', updatedServices.map((s: any) => s.category));
        setServices(updatedServices);
        updateWorker({
          ...worker,
          serviceCategories: updatedCategories,
        } as any);
      }
    };

    socketService.on('worker:service_updated', handleServiceUpdate);
    socketService.on('worker:stats_updated', (data: any) => {
      if (data.workerId === worker.id && data.serviceCategories) {
        handleServiceUpdate(data);
      }
    });

    return () => {
      socketService.off('worker:service_updated', handleServiceUpdate);
      socketService.off('worker:stats_updated', handleServiceUpdate);
    };
  }, [worker?.id]);

  // Initialize socket connection and booking request listener
  // Triggered by: Worker logs in, component mounts with worker ID
  useEffect(() => {
    if (worker?.id) {
      console.log('🚀 Initializing BookingRequestListener for worker:', worker.id);
      
      // Start the dedicated booking request listener
      // This ensures the worker is ALWAYS ready to receive requests
      bookingRequestListener.startListening(worker.id, (booking: any) => {
        console.log('📨 INCOMING REQUEST received by listener:', booking);
        setIncomingBooking(booking);
        
        // Show alert if app is active
        Alert.alert(
          '🔔 New Booking Request!',
          `${booking.serviceName || 'Service'} request from ${booking.location?.address || 'nearby'}`,
          [
            { text: 'Dismiss', style: 'cancel' },
            { text: 'View', onPress: () => {} }, // Handled by IncomingRequestBanner
          ]
        );
      });

      // Connect to Socket.IO for real-time service updates
      socketService.connect(worker.id, 'worker');
      
      // Listen for service updates
      socketService.on('service:updated', (updatedService: any) => {
        console.log('📢 Service update received in worker app:', updatedService);
        updateServiceInList(updatedService);
      });

      // Listen for new notifications to update count in real-time
      const handleNewNotification = (notification: any) => {
        console.log('📬 New notification received:', notification);
        if (notification.userId === worker.id || String(notification.userId) === String(worker.id)) {
          // Increment count immediately
          setUnreadCount(prev => prev + 1);
          // Also refresh from backend to ensure accuracy
          setTimeout(() => fetchUnreadCount(), 500);
        }
      };

      // Listen for notification read events to update count
      const handleNotificationRead = (data: any) => {
        console.log('✅ Notification read event received:', data);
        // Only update if it's for this worker
        if (data.userId === worker.id || data.userId === String(worker.id) || !data.userId) {
          // Decrement count immediately
          setUnreadCount(prev => Math.max(0, prev - 1));
          // Refresh from backend to ensure accuracy
          setTimeout(() => fetchUnreadCount(), 500);
        }
      };

      // Listen for notification deleted events
      const handleNotificationDeleted = (data: any) => {
        console.log('🗑️ Notification deleted event received:', data);
        // Refresh count from backend to ensure accuracy
        setTimeout(() => fetchUnreadCount(), 500);
      };

      // Listen for all notifications cleared
      const handleNotificationsCleared = (data: any) => {
        console.log('🗑️ All notifications cleared event received:', data);
        if (data.userId === worker.id || String(data.userId) === String(worker.id)) {
          setUnreadCount(0);
          // Refresh from backend to ensure accuracy
          setTimeout(() => fetchUnreadCount(), 300);
        }
      };

      // Listen for all notifications marked as read
      const handleAllNotificationsRead = (data: any) => {
        console.log('✅ All notifications read event received:', data);
        if (data.userId === worker.id || String(data.userId) === String(worker.id)) {
          setUnreadCount(0);
          // Refresh from backend to ensure accuracy
          setTimeout(() => fetchUnreadCount(), 300);
        }
      };

      // Set up notification socket listeners
      socketService.on('notification:new', handleNewNotification);
      socketService.on('notification:read', handleNotificationRead);
      socketService.on('notification:deleted', handleNotificationDeleted);
      socketService.on('notifications:cleared', handleNotificationsCleared);
      socketService.on('notifications:all-read', handleAllNotificationsRead);

      // Ensure location tracking starts so backend location updates succeed
      startLocationTracking();
    }

    return () => {
      // Cleanup when component unmounts or worker logs out
      console.log('🛑 Cleaning up BookingRequestListener');
      locationService.stopTracking();
      bookingRequestListener.stopListening();
      socketService.off('service:updated');
      socketService.off('notification:new');
      socketService.off('notification:read');
      socketService.off('notification:deleted');
      socketService.off('notifications:cleared');
      socketService.off('notifications:all-read');
    };
  }, [worker?.id]);

  // Update location state and send to listener
  useEffect(() => {
    const interval = setInterval(async () => {
      // Check both real and mock location services
      let location = locationService.getCurrentLocation();
      let isTracking = locationService.isLocationTracking();
      
      if (!location) {
        location = mockLocationService.getCurrentLocation();
        isTracking = mockLocationService.isLocationTracking();
      }
      
      if (location) {
        setCurrentLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setIsLocationTracking(isTracking);
        
        // Auto-update selected location based on current coordinates
        try {
          const detectedLocation = await detectLocation();
          if (detectedLocation && detectedLocation !== selectedLocation) {
            console.log('📍 Location updated automatically:', detectedLocation);
            setSelectedLocation(detectedLocation);
          }
        } catch (error) {
          console.error('Error updating location:', error);
        }
        
        // Update location in booking listener
        if (isTracking && worker?.id) {
          bookingRequestListener.updateLocation({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      }
      
      // Update listener status for UI indicator
      const status = bookingRequestListener.getStatus();
      setListenerStatus({
        isListening: status.isListening,
        isConnected: status.isConnected,
      });
    }, 30000); // Update every 30 seconds (reduced frequency to avoid too many location checks)

    return () => clearInterval(interval);
  }, [worker?.id, selectedLocation]);

  const startLocationTracking = async () => {
    if (!worker?.id) {
      console.log('⚠️ Worker ID not available, cannot start location tracking');
      return;
    }

    console.log('🚀 Starting location tracking for worker:', worker.id);

    // Set worker ID for location services FIRST before starting
    locationService.setWorkerId(worker.id);
    mockLocationService.setWorkerId(worker.id);
    
    console.log('✅ Worker ID set for location services');

    try {
      // Try real location service first
      let success = await locationService.startTracking();

      if (!success) {
        console.log('Real location service failed, trying mock location service');
        // Fallback to mock location service
        success = await mockLocationService.startTracking();
      }

      if (success) {
        setIsLocationTracking(true);
        console.log('✅ Location tracking started successfully');
        
        // Automatically set status to 'available' when location tracking starts
        console.log('📍 Setting status to available...');
        let statusSuccess = await locationService.updateAvailabilityStatus('available', worker.id);
        
        if (!statusSuccess) {
          statusSuccess = await mockLocationService.updateAvailabilityStatus('available', worker.id);
        }
        
        if (statusSuccess) {
          setIsAvailable(true);
          console.log('✅ Worker status set to available');
        } else {
          console.warn('⚠️ Failed to set status to available, but location tracking is active');
        }
      } else {
        console.log('Both location services failed, but app will continue without location tracking');
        // Don't show error, just continue without location tracking
      }
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      // Don't show error alert, just continue without location tracking
    }
  };

  const toggleAvailability = async () => {
    if (!isLocationTracking) {
      Alert.alert(
        'Location Required',
        'Location tracking is required to show as available on the map. You can still register services without location tracking.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Enable Location', onPress: startLocationTracking },
        ]
      );
      return;
    }

    const newStatus = !isAvailable;
    // Try both location services for availability status update
    let success = await locationService.updateAvailabilityStatus(newStatus ? 'available' : 'busy', worker?.id);
    
    if (!success) {
      success = await mockLocationService.updateAvailabilityStatus(newStatus ? 'available' : 'busy', worker?.id);
    }
    
    if (success) {
      setIsAvailable(newStatus);
      
      // Update availability status in booking listener
      bookingRequestListener.updateAvailability(newStatus ? 'available' : 'busy');
      
      Alert.alert(
        'Status Updated',
        newStatus ? 'You are now available for jobs!' : 'You are now busy and won\'t receive new job requests.'
      );
    } else {
      Alert.alert('Error', 'Failed to update availability status. Please try again.');
    }
  };

  // Handles adding or updating services, shows toast notification, requires verification
  // Triggered by: Worker adds or edits a service in ServiceRegistrationModal
  const handleAddService = async (service: any) => {
    const previousCategories = [...new Set(services.map((s: any) => s.category))];
    
    if (editingService) {
      // Update existing service
      setServices(prev => prev.map((s: any) => s.id === editingService.id ? service : s));
      setEditingService(null);
      setToast({
        visible: true,
        message: `Service "${service.name}" updated successfully!`,
        title: 'Service Updated',
        type: 'success',
      });
    } else {
      // Add new service(s) - service can be single or array for multi-add
      const servicesToAdd = Array.isArray(service) ? service : [service];
      
      // Filter out any services that already exist (shouldn't happen, but safety check)
      const newServices = servicesToAdd.filter(
        s => !previousCategories.includes(s.category)
      );
      
      if (newServices.length === 0) {
        setToast({
          visible: true,
          message: 'All selected services are already registered.',
          title: 'No New Services',
          type: 'warning',
        });
        return;
      }
      
      // FIRST: Update local state immediately
      setServices(prev => [...prev, ...newServices]);
      
      // SECOND: Sync service categories with backend IMMEDIATELY to save them
      const newCategories = newServices.map((s: any) => s.category);
      const allCategories = [...new Set([...previousCategories, ...newCategories])];
      
      // Update worker context immediately
      if (worker) {
        updateWorker({
          ...worker,
          serviceCategories: allCategories,
        } as any);
        console.log('✅ Updated worker context with new serviceCategories:', allCategories);
      }
      
      // Sync with backend immediately
      try {
        const apiUrl = getApiUrl();
        console.log('💾 Saving service categories to backend:', allCategories);
        const response = await fetch(`${apiUrl}/api/workers/update-service-categories`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workerId: worker?.id,
            serviceCategories: allCategories,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Service categories synced with backend successfully:', result);
          
          // Emit socket event to notify other screens
          socketService.emit('worker:service_updated', {
            workerId: worker?.id,
            serviceCategories: allCategories,
          });
          
          // Show success notification
          const serviceCount = newServices.length;
          const serviceNames = newServices.map((s: any) => s.category).join(', ');
          setToast({
            visible: true,
            message: serviceCount > 1 
              ? `Successfully added ${serviceCount} services: ${serviceNames}`
              : `Service "${newServices[0].name}" added successfully!`,
            title: serviceCount > 1 ? 'Services Added' : 'Service Added',
            type: 'success',
          });
          
          // Always require document verification for newly added services
          if (newCategories.length > 0) {
            // Show alert to navigate to document verification after a short delay
            setTimeout(() => {
              Alert.alert(
                'Document Verification Required',
                `You've added new service categories (${newCategories.join(', ')}). Please submit required documents to verify these services before you can start accepting jobs.`,
                [
                  { text: 'Later', style: 'cancel' },
                  { 
                    text: 'Verify Now', 
                    onPress: () => {
                      // Ensure services are saved before navigating
                      console.log('🚀 Navigating to document verification with services:', allCategories);
                      router.push('/document-verification');
                    }
                  },
                ]
              );
            }, 1500); // Wait for toast to show first
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to sync service categories with backend:', response.status, errorText);
          setToast({
            visible: true,
            message: 'Services added locally, but failed to save to server. Please try again.',
            title: 'Warning',
            type: 'warning',
          });
        }
      } catch (error) {
        console.error('❌ Error syncing service categories:', error);
        setToast({
          visible: true,
          message: 'Services added locally, but failed to save to server. Please try again.',
          title: 'Warning',
          type: 'warning',
        });
      }
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    setServices(prev => prev.filter(service => service.id !== serviceId));
    // Sync service categories with backend
    await syncServiceCategoriesWithBackend();
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    setShowServiceModal(true);
  };


  // Opens service registration modal in multi-select mode
  // Triggered by: Worker clicks "Add" button or "Add Your First Service"
  const handleAddNewService = () => {
    setEditingService(null);
    setShowServiceModal(true);
    // Modal will default to multi-select mode for new services
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            {worker?.profileImage ? (
              <Image 
                key={`profile-${worker.profileImage}-${worker.name || ''}`} // Force re-render when profile image or name changes
                source={{ uri: worker.profileImage }} 
                style={styles.avatar}
                resizeMode="cover"
                onLoad={() => console.log('✅ Profile image loaded successfully')}
                onError={() => {
                  console.log('⚠️ Error loading profile image');
                }}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#FF7A2C', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={32} color="#fff" />
              </View>
            )}
          </Pressable>
          
          <Pressable 
            style={styles.locationWrap} 
            onPress={() => setShowLocationDropdown(!showLocationDropdown)}
          >
            <Ionicons name="location" size={16} color="#fff" style={styles.locationIcon} />
            <Text style={styles.locationText}>{selectedLocation}</Text>
            <Ionicons 
              name={showLocationDropdown ? "chevron-up" : "chevron-down"} 
              size={14} 
              color="#fff" 
              style={styles.chevronIcon} 
            />
          </Pressable>
          
          {showLocationDropdown && (
            <View style={styles.locationDropdown}>
              {locations.map((location) => (
                <Pressable
                  key={location}
                  style={[
                    styles.locationOption,
                    selectedLocation === location && styles.selectedLocationOption
                  ]}
                  onPress={() => {
                    setSelectedLocation(location);
                    setShowLocationDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.locationOptionText,
                    selectedLocation === location && styles.selectedLocationOptionText
                  ]}>
                    {location}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.searchButton} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={18} color="#000" />
          </Pressable>

          <Pressable style={styles.bellWrap} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={18} color="#FF7A2C" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount.toString()}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.userName}>{worker?.name || 'Worker'}</Text>

            {/* Availability Status Card */}
            <View style={styles.availabilityCard}>
              <View style={styles.availabilityHeader}>
                <View style={styles.availabilityInfo}>
                  <Ionicons 
                    name={isAvailable ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={isAvailable ? "#10B981" : "#6B7280"} 
                  />
                  <Text style={styles.availabilityTitle}>
                    {isAvailable ? 'Available for Jobs' : 'Currently Busy'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.availabilityToggle,
                    isAvailable ? styles.availabilityToggleActive : styles.availabilityToggleInactive
                  ]}
                  onPress={toggleAvailability}
                >
                  <Text style={[
                    styles.availabilityToggleText,
                    isAvailable ? styles.availabilityToggleTextActive : styles.availabilityToggleTextInactive
                  ]}>
                    {isAvailable ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.locationStatus}>
                <Ionicons 
                  name={isLocationTracking ? "location" : "location-outline"} 
                  size={16} 
                  color={isLocationTracking ? "#10B981" : "#6B7280"} 
                />
                <Text style={[
                  styles.locationStatusText,
                  { color: isLocationTracking ? "#10B981" : "#6B7280" }
                ]}>
                  {isLocationTracking ? 'Location tracking active' : 'Location tracking unavailable - check permissions'}
                </Text>
              </View>

              {/* Booking Request Listener Status */}
              <View style={styles.listenerStatus}>
                <View style={[
                  styles.listenerDot,
                  { backgroundColor: listenerStatus.isListening && listenerStatus.isConnected ? "#10B981" : "#EF4444" }
                ]} />
                <Text style={[
                  styles.listenerStatusText,
                  { color: listenerStatus.isListening && listenerStatus.isConnected ? "#10B981" : "#EF4444" }
                ]}>
                  {listenerStatus.isListening && listenerStatus.isConnected 
                    ? '🎧 Ready to receive booking requests' 
                    : '⚠️ Not connected - check internet connection'}
                </Text>
              </View>

              {currentLocation && (
                <Text style={styles.coordinatesText}>
                  📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </Text>
              )}
            </View>

            {/* Service Cart */}
            {(() => {
              console.log('🎯 RENDERING ServiceCart - Current services state:', {
                count: services.length,
                services: services.map((s: any) => ({ id: s.id, name: s.name, category: s.category })),
                workerServiceCategories: worker?.serviceCategories,
              });
              return null;
            })()}
            <ServiceCart
              services={services}
              onRemoveService={handleRemoveService}
              onAddService={handleAddNewService}
            />

            {/* Quick Actions */}
            <View style={styles.quickActionsContainer}>
              <Text style={styles.quickActionsTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/requests')}>
                  <Ionicons name="briefcase-outline" size={24} color="#FF7A2C" />
                  <Text style={styles.quickActionText}>View Jobs</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/tracking')}>
                  <Ionicons name="location-outline" size={24} color="#FF7A2C" />
                  <Text style={styles.quickActionText}>Track Jobs</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/profile')}>
                  <Ionicons name="person-outline" size={24} color="#FF7A2C" />
                  <Text style={styles.quickActionText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/notifications')}>
                  <Ionicons name="notifications-outline" size={24} color="#FF7A2C" />
                  <Text style={styles.quickActionText}>Notifications</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Incoming Request Floating Banner */}
        <IncomingRequestBanner
          visible={!!incomingBooking}
          booking={incomingBooking}
          onReview={() => {
            setIncomingBooking(null);
            router.push('/requests');
          }}
          onAccept={async () => {
            try {
              if (!incomingBooking?._id) {
                Alert.alert('Error', 'Invalid booking request');
                router.push('/requests');
                return;
              }

              if (!worker?.id) {
                Alert.alert('Error', 'Worker ID not found. Please login again.');
                return;
              }

              console.log('✅ Accepting booking:', {
                bookingId: incomingBooking._id,
                workerId: worker.id,
              });

              const apiUrl = getApiUrl();
              const res = await fetch(`${apiUrl}/api/bookings/${incomingBooking._id}/accept`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workerId: worker.id }),
              });

              if (res.ok) {
                const booking = await res.json();
                console.log('✅ Booking accepted successfully:', booking._id);
                
                // Clear incoming booking
                setIncomingBooking(null);
                
                // Navigate to requests page to show accepted request
                router.push('/requests');
              } else {
                const errorText = await res.text();
                console.error('❌ Failed to accept booking:', res.status, errorText);
                Alert.alert('Error', 'Failed to accept booking. Please try again.');
              }
            } catch (e) {
              console.error('❌ Accept from banner failed:', e);
              Alert.alert('Error', 'Network error. Please check your connection and try again.');
            }
          }}
          onDismiss={() => setIncomingBooking(null)}
        />

        {/* Service Registration Modal */}
        <ServiceRegistrationModal
          visible={showServiceModal}
          onClose={() => {
            setShowServiceModal(false);
            setEditingService(null);
          }}
          onAddService={handleAddService}
          existingServices={services}
          editingService={editingService}
        />

        {/* Bottom Navigation */}
        <BottomNav />

        {/* Toast Notification */}
        <ToastNotification
          visible={toast.visible}
          message={toast.message}
          title={toast.title}
          type={toast.type}
          onDismiss={() => setToast({ ...toast, visible: false })}
          duration={3000}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safe: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF7A2C',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#fff',
  },
  locationWrap: {
    flex: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    position: 'relative',
  },
  locationIcon: {
    marginRight: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  locationDropdown: {
    position: 'absolute',
    top: 50,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
    minWidth: 120,
  },
  locationOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedLocationOption: {
    backgroundColor: '#FFE5CC',
  },
  locationOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedLocationOptionText: {
    color: '#FF7A2C',
    fontWeight: '600',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  quickActionsContainer: {
    marginTop: 20,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
  },
  availabilityCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  availabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  availabilityToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  availabilityToggleActive: {
    backgroundColor: '#10B981',
  },
  availabilityToggleInactive: {
    backgroundColor: '#E5E7EB',
  },
  availabilityToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  availabilityToggleTextActive: {
    color: '#FFFFFF',
  },
  availabilityToggleTextInactive: {
    color: '#6B7280',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationStatusText: {
    fontSize: 14,
    marginLeft: 6,
  },
  listenerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  listenerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  listenerStatusText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
});
