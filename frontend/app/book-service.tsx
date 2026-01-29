// BOOK SERVICE SCREEN - Service booking form with image upload, location, scheduling, and worker selection
// Features: Photo upload (expo-image-picker), GPS location, date/time picker, worker search, payment integration, helpful tooltips
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  SafeAreaView,
  Dimensions,
  Platform,
  Modal,
  ActivityIndicator,
  Linking,
  Pressable,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { getCurrentUser } from '@/lib/session';
import { socketService } from '@/lib/SocketService';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getApiUrl } from '@/lib/config';
import DateTimePicker from '@react-native-community/datetimepicker';
import WorkerSearchModal from '../components/WorkerSearchModal';
import HelpTooltip from '../components/HelpTooltip';
import ToastNotification from '../components/ToastNotification';
import { canBookService, checkPermissionWithAlert } from '@/lib/permissions';
import { ThemedText } from '@/components/ThemedText';

const { width } = Dimensions.get('window');

// Service data structure passed from service detail pages
interface Service {
  id: string;
  serviceId?: string;
  name: string;
  serviceName?: string;
  category: string;
  serviceCategory?: string;
  price: number;
  description: string;
  image: string;
}

export default function BookServiceScreen() {
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  // Construct service object from params (params are all strings)
  const service: Service = {
    id: (params.serviceId as string) || (params.id as string) || '',
    serviceId: params.serviceId as string,
    name: (params.serviceName as string) || (params.title as string) || (params.name as string) || '',
    serviceName: params.serviceName as string,
    category: (params.serviceCategory as string) || (params.category as string) || '',
    serviceCategory: params.serviceCategory as string,
    price: params.price ? parseFloat(params.price as string) : 0,
    description: (params.description as string) || '',
    image: (params.image as string) || '',
  };
  const { user, isLoading } = useAuth();
  
  // Debug user data changes
  useEffect(() => {
    console.log('Book service - User data changed:', user);
    console.log('Book service - User ID:', user?.id);
    console.log('Book service - Is loading:', isLoading);
  }, [user, isLoading]);
  
  // Show loading if auth is still loading
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [address, setAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [isNow, setIsNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showWorkerSearch, setShowWorkerSearch] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    title?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
  });

  // Shows toast notification for 3 seconds
  // Triggered by: Booking creation, acceptance, errors
  const showToast = (message: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, title, type });
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Listen for booking acceptance events
  useEffect(() => {
    if (!user?.id) return;

    // Connect to socket if not already connected
    socketService.connect(user.id, 'user');

    // Listen for booking acceptance
    const handleBookingAccepted = (data: any) => {
      console.log('✅ Booking accepted event received:', data);
      const bookingId = data.bookingId || data.booking?._id;
      
      if (bookingId) {
        const workerName = data.booking?.workerId?.firstName 
          ? `${data.booking.workerId.firstName} ${data.booking.workerId.lastName || ''}`.trim()
          : data.booking?.worker?.name || 'Worker';
        
        // Show toast notification
        showToast(
          `${workerName} has accepted your request! Opening live tracking...`,
          'Worker Assigned!',
          'success'
        );
        
        // Auto-navigate to live tracking after a short delay
        setTimeout(() => {
          router.push({
            pathname: '/live-tracking',
            params: { bookingId: String(bookingId) },
          });
        }, 1000);
      }
    };

    socketService.on('booking:accepted', handleBookingAccepted);

    return () => {
      socketService.off('booking:accepted', handleBookingAccepted);
    };
  }, [user?.id]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Needed',
          'Enable location for better worker matching. You can also continue with a default location.',
          [
            { text: 'Use Default (Kathmandu)', onPress: () => {
              const fallback = { latitude: 27.7172, longitude: 85.3240 };
              setLocation(fallback as any);
              setAddress('Kathmandu');
            }},
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      let addr = 'Current location';
      try {
        const address = await Location.reverseGeocodeAsync({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        addr = `${address[0]?.street || ''} ${address[0]?.city || ''} ${address[0]?.region || ''}`.trim() || addr;
      } catch {}

      setLocation(current.coords);
      setAddress(addr);
    } catch (error) {
      console.error('Location error:', error);
      // Fallback silently to Kathmandu so the flow can continue
      const fallback = { latitude: 27.7172, longitude: 85.3240 };
      setLocation(fallback as any);
      setAddress('Kathmandu');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-NP', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-NP', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getNext7Days = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setScheduledDate(date);
    setShowDatePicker(false);
  };

  const handleTimeSelect = (time: Date) => {
    setSelectedTime(time);
    // Combine selected date with selected time
    const combinedDateTime = new Date(selectedDate);
    combinedDateTime.setHours(time.getHours());
    combinedDateTime.setMinutes(time.getMinutes());
    setScheduledDate(combinedDateTime);
    setShowTimePicker(false);
  };

  const handleInstantBooking = () => {
    console.log('Instant booking - User data:', user);
    console.log('Instant booking - User ID:', user?.id);
    
    if (!location) {
      // Auto-fill fallback so users can proceed even without permission
      const fallback = { latitude: 27.7172, longitude: 85.3240 } as any;
      setLocation(fallback);
      setAddress('Kathmandu, Nepal'); // Set default address
    }

    if (!user?.id) {
      console.log('Instant booking - No user ID found');
      Alert.alert('Error', 'Please login to continue');
      return;
    }

    // For instant booking, show worker search modal
    setShowWorkerSearch(true);
  };

  const handleWorkerSelect = (worker: any) => {
    console.log('👤 Worker selected:', {
      id: worker._id,
      name: worker.name,
      phone: worker.phone,
      categories: worker.serviceCategories,
    });
    
    setSelectedWorker(worker);
    // After worker selection, proceed with booking
    bookService(worker);
  };

  const bookService = async (worker?: any) => {
    console.log('📦 Book service - User data:', user);
    console.log('📦 Book service - User ID:', user?.id);
    console.log('📦 Book service - Selected worker:', worker ? {
      id: worker._id,
      name: worker.name,
      phone: worker.phone,
      categories: worker.serviceCategories,
    } : 'No worker selected');
    
    if (!location) {
      Alert.alert('Error', 'Location is required');
      return;
    }

    if (!user?.id) {
      console.log('Book service - No user ID found');
      Alert.alert('Error', 'Please login to continue');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      console.log('🔗 Booking service - Using API URL:', apiUrl);
      
      // Ensure address is always provided (required by backend)
      const locationAddress = address && address.trim() !== '' 
        ? address.trim() 
        : `Location at ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      
      const bookingData = {
        userId: user?.id,
        serviceId: service.serviceId || service.id,
        serviceName: service.serviceName || service.name,
        serviceCategory: service.serviceCategory || service.category,
        description: 'Service booking with photos',
        images,
        location: {
          address: locationAddress,
          coordinates: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
        },
        scheduledDate: isNow ? undefined : scheduledDate?.toISOString(),
        price: service.price || 0,
        workerId: worker?._id, // Use the REAL worker ID from the selected worker
        isInstant: isNow,
      };

      console.log('📤 Sending booking data:', {
        ...bookingData,
        workerId: worker?._id,
        workerName: worker?.name,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`${apiUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Booking response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Booking error response:', errorText);
        throw new Error(`Failed to create booking: ${response.status} - ${errorText}`);
      }

      const booking = await response.json();
      console.log('✅ Booking created successfully:', booking._id);
      console.log('📤 Backend will automatically notify workers via socket');

      // Connect to socket for real-time updates (for receiving acceptance notifications)
      if (user?.id) {
        socketService.connect(user.id, 'user');
      }

      // Close worker search modal first
      setShowWorkerSearch(false);

      // Show success toast notification
      if (worker) {
        // User selected a specific worker
        console.log('✅ Booking sent to specific worker:', worker.name);
        showToast(
          `Your request has been sent to ${worker.name}. You will be notified when they accept.`,
          `Request Sent to ${worker.name}!`,
          'success'
        );
      } else {
        // No specific worker selected - booking sent to available workers
        const scheduledDateStr = scheduledDate ? scheduledDate.toLocaleDateString() : 'TBD';
        const scheduledTimeStr = scheduledDate ? scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
        
        if (isNow) {
          showToast(
            `Your ${service.serviceName || service.name} service request has been sent to available workers. You will be notified when a worker accepts it.`,
            'Booking Request Sent!',
            'success'
          );
        } else {
          showToast(
            `Your ${service.serviceName || service.name} service has been scheduled for ${scheduledDateStr} at ${scheduledTimeStr}. You will be notified when a worker accepts it.`,
            'Booking Scheduled!',
            'success'
          );
        }
      }

      // Navigate to tracking page to show worker location on map
      setTimeout(() => {
        router.replace({
          pathname: '/tracking',
          params: { 
            bookingId: booking._id,
          },
        });
      }, 1500);
    } catch (error: any) {
      console.error('Booking error:', error);
      
      // Provide better error messages
      let errorMessage = 'Failed to create booking. Please try again.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout. Please check your network connection and try again.';
      } else if (error.message === 'Network request failed' || error.message?.includes('NetworkError')) {
        errorMessage = `Network error. Please check:\n• Your internet connection\n• Backend server is running at ${getApiUrl()}\n• You are on the same network`;
      } else if (error.message?.includes('Failed to create booking')) {
        errorMessage = error.message;
      }
      
      showToast(
        errorMessage,
        'Booking Error',
        'error'
      );
      
      // Log debug info
      console.log('🔍 Booking error debug info:', {
        errorName: error?.name,
        errorMessage: error?.message,
        apiUrl: getApiUrl(),
        platform: Platform.OS,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.tint }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Book Service</ThemedText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Service Info with Enhanced Price */}
          <View style={styles.serviceCard}>
            <View style={styles.serviceImageContainer}>
              <Image source={{ uri: service.image }} style={styles.serviceImage} />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.serviceName || service.name}</Text>
              <Text style={styles.serviceCategory}>{service.serviceCategory || service.category}</Text>
              <View style={[styles.priceContainer, { backgroundColor: theme.tint + '18' }]}>
                <Text style={[styles.priceLabel, { color: theme.icon }]}>Price</Text>
                <Text style={[styles.servicePrice, { color: theme.tint }]}>Rs. {service.price}</Text>
              </View>
            </View>
          </View>

          {/* Add Photos - Enhanced */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add Photos</Text>
              <Text style={styles.sectionSubtitle}>Upload images of the problem area</Text>
            </View>
            
            <TouchableOpacity style={[styles.addPhotoButton, { backgroundColor: theme.tint + '0C', borderColor: theme.tint + '40' }]} onPress={pickImage}>
              <View style={styles.addPhotoIconContainer}>
                <Ionicons name="camera" size={32} color={theme.tint} />
                <Ionicons name="add" size={16} color={theme.tint} style={styles.addIcon} />
              </View>
              <Text style={[styles.addPhotoText, { color: theme.tint }]}>Tap to add photos</Text>
              <Text style={[styles.addPhotoSubtext, { color: theme.icon }]}>Max 5 photos</Text>
            </TouchableOpacity>
            
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageList}>
                {images.map((uri) => (
                  <View key={uri} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.uploadedImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Location - Enhanced */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Service Location</Text>
              <Text style={styles.sectionSubtitle}>Where should we provide the service?</Text>
            </View>
            <View style={styles.locationCard}>
              <View style={[styles.locationIconContainer, { backgroundColor: theme.tint + '18' }]}>
                <Ionicons name="location" size={24} color={theme.tint} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Current Location</Text>
                <Text style={styles.locationText}>{address || 'Getting location...'}</Text>
              </View>
              <TouchableOpacity style={styles.refreshLocationBtn} onPress={getCurrentLocation}>
                <Ionicons name="refresh" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Schedule */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>When do you need this service?</Text>
              <Text style={styles.sectionSubtitle}>Choose your preferred time</Text>
            </View>
            
            <View style={styles.scheduleOptions}>
              <TouchableOpacity
                style={[styles.scheduleOption, isNow && { backgroundColor: theme.tint, borderColor: theme.tint }]}
                onPress={() => {
                  setIsNow(true);
                  setScheduledDate(null);
                }}
              >
                <Ionicons name="flash" size={20} color={isNow ? '#fff' : theme.tint} />
                <Text style={[styles.optionText, { color: isNow ? '#fff' : theme.tint }]}>Now</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.scheduleOption, !isNow && { backgroundColor: theme.tint, borderColor: theme.tint }]}
                onPress={() => setIsNow(false)}
              >
                <Ionicons name="calendar" size={20} color={!isNow ? '#fff' : theme.tint} />
                <Text style={[styles.optionText, { color: !isNow ? '#fff' : theme.tint }]}>Schedule</Text>
              </TouchableOpacity>
            </View>

            {/* Schedule Details */}
            {!isNow && (
              <View style={styles.scheduleDetails}>
                <Text style={styles.scheduleLabel}>Select Date & Time</Text>
                
                {/* Quick Date Selection - Next 7 Days */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScrollView}>
                  {getNext7Days().map((date) => (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={[
                        styles.dateCard,
                        selectedDate.toDateString() === date.toDateString() && { backgroundColor: theme.tint, borderColor: theme.tint }
                      ]}
                      onPress={() => handleDateSelect(date)}
                    >
                      <Text style={[
                        styles.dateDay,
                        selectedDate.toDateString() === date.toDateString() && styles.selectedDateText
                      ]}>
                        {date.getDate()}
                      </Text>
                      <Text style={[
                        styles.dateWeekday,
                        selectedDate.toDateString() === date.toDateString() && styles.selectedDateText
                      ]}>
                        {date.toLocaleDateString('en-NP', { weekday: 'short' })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Selected Date and Time Display */}
                <View style={styles.selectedDateTimeContainer}>
                  <View style={styles.selectedDateTimeItem}>
                    <Ionicons name="calendar-outline" size={20} color={theme.tint} />
                    <Text style={styles.selectedDateTimeText}>
                      {formatDate(selectedDate)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.selectedDateTimeItem}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color={theme.tint} />
                    <Text style={styles.selectedDateTimeText}>
                      {formatTime(selectedTime)}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Book Button */}
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: theme.tint }, loading && styles.disabledButton]}
            onPress={isNow ? handleInstantBooking : bookService}
            disabled={loading}
          >
            <Text style={styles.bookButtonText}>
              {loading ? 'Creating Booking...' : 
               isNow ? `Find Worker Now - Rs. ${service.price}` : 
               `Book Now - Rs. ${service.price}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      handleDateSelect(selectedDate);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <Modal
            visible={showTimePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Time</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="default"
                  is24Hour={false}
                  onChange={(event, selectedTime) => {
                    if (selectedTime) {
                      handleTimeSelect(selectedTime);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Worker Search Modal */}
        <WorkerSearchModal
          visible={showWorkerSearch}
          onClose={() => setShowWorkerSearch(false)}
          serviceCategory={service.serviceCategory || service.category}
          userLocation={location || { latitude: 27.7172, longitude: 85.3240 }}
          onWorkerSelect={handleWorkerSelect}
        />
      </SafeAreaView>

      {/* Toast Notification - Shows for 3 seconds on booking events */}
      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        title={toast.title}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
        duration={3000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  serviceImageContainer: {
    marginRight: 16,
  },
  serviceImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  serviceCategory: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priceLabel: {
    fontSize: 12,
    marginRight: 6,
    fontWeight: '500',
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  addPhotoButton: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 120,
    justifyContent: 'center',
  },
  addPhotoIconContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  addIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  addPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  addPhotoSubtext: {
    fontSize: 12,
    fontWeight: '400',
  },
  imageList: {
    marginTop: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    lineHeight: 22,
  },
  refreshLocationBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  scheduleOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  scheduleOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedText: {
    color: '#fff',
  },
  // Schedule Details Styles
  scheduleDetails: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scheduleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  dateScrollView: {
    marginBottom: 20,
  },
  dateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  dateWeekday: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  selectedDateText: {
    color: '#fff',
  },
  selectedDateTimeContainer: {
    gap: 12,
  },
  selectedDateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedDateTimeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 12,
    flex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  bookButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});