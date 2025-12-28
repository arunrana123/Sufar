// TRACKING SCREEN - Worker's job tracking page showing active and completed jobs
// Features: View job progress, navigate to job details, job completion status, earnings summary
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

interface Job {
  _id: string;
  userId: {
    firstName: string;
    lastName: string;
    profilePhoto?: string;
  };
  serviceName: string;
  serviceCategory?: string;
  location: {
    address: string;
    city?: string;
  };
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  createdAt: string;
  completedAt?: string;
  workStartTime?: string;
  actualDuration?: number;
}

export default function TrackingScreen() {
  const { worker } = useAuth();
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      if (!worker?.id) {
        console.warn('⚠️ Cannot fetch jobs: No worker ID');
        setLoading(false);
        return;
      }

      const apiUrl = getApiUrl();
      console.log('📥 Fetching jobs for worker:', worker.id);

      // Fetch all bookings for this worker
      const response = await fetch(`${apiUrl}/api/bookings/worker/${worker.id}`);

      if (response.ok) {
        const allBookings: Job[] = await response.json();
        console.log('✅ Jobs fetched successfully:', allBookings.length, 'jobs');

        // Filter only valid bookings (must have userId, serviceName, location)
        // Include ALL statuses: accepted, in_progress, completed
        const validBookings = allBookings.filter((booking) => {
          const isValid = 
            booking._id &&
            booking.userId &&
            booking.userId.firstName &&
            booking.serviceName &&
            booking.location &&
            booking.location.address &&
            (booking.status === 'in_progress' || 
             booking.status === 'completed' || 
             booking.status === 'accepted');
          
          if (!isValid) {
            console.warn('⚠️ Invalid booking filtered out:', {
              id: booking._id,
              status: booking.status,
              hasUserId: !!booking.userId,
              hasServiceName: !!booking.serviceName,
              hasLocation: !!booking.location,
            });
          }
          return isValid;
        });

        console.log('📊 Valid bookings breakdown:', {
          total: validBookings.length,
          accepted: validBookings.filter(b => b.status === 'accepted').length,
          in_progress: validBookings.filter(b => b.status === 'in_progress').length,
          completed: validBookings.filter(b => b.status === 'completed').length,
        });

        // Separate active (in_progress, accepted) and completed jobs
        // IMPORTANT: Include both 'accepted' and 'in_progress' in active jobs
        const active = validBookings.filter(
          (job) => job.status === 'in_progress' || job.status === 'accepted'
        );
        const completed = validBookings.filter((job) => job.status === 'completed');

        // Sort by creation date (newest first)
        active.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        completed.sort((a, b) => {
          const dateA = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.createdAt).getTime();
          const dateB = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.createdAt).getTime();
          return dateA - dateB;
        });

        setActiveJobs(active);
        setCompletedJobs(completed);
        console.log('✅ Active jobs:', active.length, 'Completed jobs:', completed.length);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch jobs:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (worker?.id) {
      fetchJobs();

      // Connect to socket for real-time updates
      socketService.connect(worker.id, 'worker');

      // Listen for booking accepted event - CRITICAL for showing accepted bookings
      const handleBookingAccepted = (data: any) => {
        console.log('✅ Booking accepted event received in tracking:', data);
        
        // Optimistic UI update - immediately add to active jobs if we have the booking data
        if (data.booking && data.booking.workerId === worker.id) {
          const acceptedBooking: Job = {
            _id: data.booking._id || data.bookingId,
            userId: data.booking.userId || { firstName: 'Customer', lastName: '' },
            serviceName: data.booking.serviceName || data.booking.serviceCategory || 'Service',
            serviceCategory: data.booking.serviceCategory,
            location: data.booking.location || { address: 'Location not specified' },
            status: 'accepted',
            price: data.booking.price || 0,
            createdAt: data.booking.createdAt || new Date().toISOString(),
            workStartTime: data.booking.workStartTime,
          };

          // Check if booking already exists
          setActiveJobs(prev => {
            const exists = prev.some(job => job._id === acceptedBooking._id);
            if (exists) {
              // Update existing booking
              return prev.map(job => 
                job._id === acceptedBooking._id 
                  ? { ...job, ...acceptedBooking, status: 'accepted' }
                  : job
              );
            } else {
              // Add new accepted booking to the top of the list
              console.log('✅ Adding accepted booking to tracking list:', acceptedBooking._id);
              return [acceptedBooking, ...prev];
            }
          });
        }
        
        // Also refresh from backend to ensure consistency
        if (data.bookingId || data._id || data.booking?._id) {
          const bookingId = data.bookingId || data._id || data.booking._id;
          console.log('🔄 Refreshing jobs from backend after booking accepted:', bookingId);
          setTimeout(() => {
            fetchJobs();
          }, 1000);
        }
      };

      // Listen for work started event
      const handleWorkStarted = (data: any) => {
        console.log('🔨 Work started event received:', data);
        if (data.bookingId) {
          // Refresh jobs to get updated status
          setTimeout(() => {
            fetchJobs();
          }, 500);
        }
      };

      // Listen for work completed event
      const handleWorkCompleted = (data: any) => {
        console.log('✅ Work completed event received:', data);
        if (data.bookingId) {
          // Refresh jobs to get updated status
          setTimeout(() => {
            fetchJobs();
          }, 500);
        }
      };

      // Listen for booking updates
      const handleBookingUpdated = (booking: any) => {
        console.log('📋 Booking updated event received:', booking);
        if (booking.workerId === worker.id || String(booking.workerId) === String(worker.id)) {
          // Optimistic UI update - immediately update the booking in the list
          const updatedJob: Job = {
            _id: booking._id,
            userId: booking.userId || { firstName: 'Customer', lastName: '' },
            serviceName: booking.serviceName || booking.serviceCategory || 'Service',
            serviceCategory: booking.serviceCategory,
            location: booking.location || { address: 'Location not specified' },
            status: booking.status,
            price: booking.price || 0,
            createdAt: booking.createdAt || new Date().toISOString(),
            completedAt: booking.completedAt,
            workStartTime: booking.workStartTime,
            actualDuration: booking.actualDuration,
          };

          // Update in active jobs if it's accepted or in_progress
          if (booking.status === 'accepted' || booking.status === 'in_progress') {
            setActiveJobs(prev => {
              const exists = prev.some(job => job._id === updatedJob._id);
              if (exists) {
                return prev.map(job => 
                  job._id === updatedJob._id ? updatedJob : job
                );
              } else {
                // Add if it doesn't exist
                return [updatedJob, ...prev];
              }
            });
          }

          // Move to completed if status is completed
          if (booking.status === 'completed') {
            setActiveJobs(prev => prev.filter(job => job._id !== updatedJob._id));
            setCompletedJobs(prev => {
              const exists = prev.some(job => job._id === updatedJob._id);
              if (exists) {
                return prev.map(job => 
                  job._id === updatedJob._id ? updatedJob : job
                );
              } else {
                return [updatedJob, ...prev];
              }
            });
          }

          // Also refresh from backend to ensure consistency
          setTimeout(() => {
            fetchJobs();
          }, 500);
        }
      };

      // Listen for new booking requests (in case they're accepted immediately)
      const handleBookingRequest = (booking: any) => {
        console.log('📨 New booking request received in tracking:', booking);
        // Only refresh if this booking is assigned to this worker
        if (booking.workerId === worker.id || String(booking.workerId) === String(worker.id)) {
          setTimeout(() => {
            fetchJobs();
          }, 500);
        }
      };

      // Set up socket listeners
      socketService.on('booking:accepted', handleBookingAccepted);
      socketService.on('work:started', handleWorkStarted);
      socketService.on('work:completed', handleWorkCompleted);
      socketService.on('booking:updated', handleBookingUpdated);
      socketService.on('booking:request', handleBookingRequest);

      return () => {
        socketService.off('booking:accepted', handleBookingAccepted);
        socketService.off('work:started', handleWorkStarted);
        socketService.off('work:completed', handleWorkCompleted);
        socketService.off('booking:updated', handleBookingUpdated);
        socketService.off('booking:request', handleBookingRequest);
      };
    }
  }, [worker?.id]);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const calculateProgress = (job: Job): number => {
    if (job.status === 'completed') return 100;
    if (job.status === 'in_progress') {
      // If work has started, calculate progress based on duration
      if (job.workStartTime) {
        const startTime = new Date(job.workStartTime).getTime();
        const now = new Date().getTime();
        const elapsed = (now - startTime) / 1000 / 60; // minutes
        const estimated = job.actualDuration || 60; // default 60 minutes
        const progress = Math.min(95, Math.floor((elapsed / estimated) * 100));
        return progress;
      }
      return 50; // Default progress for in_progress without start time
    }
    return 0;
  };

  const handleJobPress = (jobId: string) => {
    router.push({
      pathname: '/job-navigation',
      params: { bookingId: jobId },
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Job Tracking</Text>
          {activeJobs.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeJobs.length}</Text>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchJobs} />
          }
        >
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Loading jobs...</Text>
            </View>
          ) : (
            <>
              {/* Active Jobs - Includes Accepted and In Progress */}
              {activeJobs.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Active Jobs ({activeJobs.filter(j => j.status === 'accepted').length} Accepted, {activeJobs.filter(j => j.status === 'in_progress').length} In Progress)
                  </Text>
                  {activeJobs.map((job) => {
                    const progress = calculateProgress(job);
                    const clientName = `${job.userId.firstName} ${job.userId.lastName || ''}`.trim();
                    return (
                      <TouchableOpacity
                        key={job._id}
                        style={styles.jobCard}
                        onPress={() => handleJobPress(job._id)}
                      >
                        <View style={styles.jobHeader}>
                          <View style={styles.clientInfo}>
                            <View style={styles.clientAvatar}>
                              <Ionicons name="person" size={24} color="#FF7A2C" />
                            </View>
                            <View>
                              <Text style={styles.clientName}>{clientName}</Text>
                              <Text style={styles.jobTime}>{formatTimeAgo(job.createdAt)}</Text>
                            </View>
                          </View>
                          <View style={[
                            styles.statusBadge,
                            job.status === 'accepted' ? styles.acceptedBadge : styles.inProgressBadge
                          ]}>
                            <View style={[
                              styles.statusDot,
                              job.status === 'accepted' ? styles.acceptedDot : styles.inProgressDot
                            ]} />
                            <Text style={[
                              styles.statusText,
                              job.status === 'accepted' ? styles.acceptedText : styles.inProgressText
                            ]}>
                              {job.status === 'in_progress' ? 'In Progress' : 'Accepted'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.jobDetails}>
                          <View style={styles.detailRow}>
                            <Ionicons name="construct-outline" size={16} color="#666" />
                            <Text style={styles.detailText}>{job.serviceName}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={16} color="#666" />
                            <Text style={styles.detailText}>{job.location.address}</Text>
                          </View>
                          {job.location.city && (
                            <View style={styles.detailRow}>
                              <Ionicons name="map-outline" size={16} color="#666" />
                              <Text style={styles.detailText}>{job.location.city}</Text>
                            </View>
                          )}
                          {job.status === 'accepted' && (
                            <View style={styles.detailRow}>
                              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                              <Text style={[styles.detailText, { color: '#4CAF50', fontWeight: '600' }]}>
                                Accepted - Ready to start navigation
                              </Text>
                            </View>
                          )}
                          {job.price > 0 && (
                            <View style={styles.detailRow}>
                              <Ionicons name="cash-outline" size={16} color="#666" />
                              <Text style={styles.detailText}>Rs. {job.price}</Text>
                            </View>
                          )}
                        </View>

                        {/* Progress Bar */}
                        {job.status === 'in_progress' && (
                          <View style={styles.progressSection}>
                            <View style={styles.progressHeader}>
                              <Text style={styles.progressLabel}>Progress</Text>
                              <Text style={styles.progressPercent}>{progress}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                              <View style={[styles.progressFill, { width: `${progress}%` }]} />
                            </View>
                          </View>
                        )}

                        <TouchableOpacity
                          style={styles.viewDetailsButton}
                          onPress={() => handleJobPress(job._id)}
                        >
                          <Text style={styles.viewDetailsText}>View Details</Text>
                          <Ionicons name="chevron-forward" size={16} color="#FF7A2C" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Completed Jobs</Text>
                  {completedJobs.map((job) => {
                    const clientName = `${job.userId.firstName} ${job.userId.lastName || ''}`.trim();
                    return (
                      <TouchableOpacity
                        key={job._id}
                        style={styles.jobCard}
                        onPress={() => handleJobPress(job._id)}
                      >
                        <View style={styles.jobHeader}>
                          <View style={styles.clientInfo}>
                            <View style={styles.clientAvatar}>
                              <Ionicons name="person" size={24} color="#4CAF50" />
                            </View>
                            <View>
                              <Text style={styles.clientName}>{clientName}</Text>
                              <Text style={styles.jobTime}>
                                {job.completedAt ? formatTimeAgo(job.completedAt) : formatTimeAgo(job.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                        </View>

                        <View style={styles.jobDetails}>
                          <View style={styles.detailRow}>
                            <Ionicons name="construct-outline" size={16} color="#666" />
                            <Text style={styles.detailText}>{job.serviceName}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={16} color="#666" />
                            <Text style={styles.detailText}>{job.location.address}</Text>
                          </View>
                          {job.location.city && (
                            <View style={styles.detailRow}>
                              <Ionicons name="map-outline" size={16} color="#666" />
                              <Text style={styles.detailText}>{job.location.city}</Text>
                            </View>
                          )}
                          <View style={styles.detailRow}>
                            <Ionicons name="cash-outline" size={16} color="#666" />
                            <Text style={styles.detailText}>Rs. {job.price}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Empty State */}
              {activeJobs.length === 0 && completedJobs.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <Ionicons name="location-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyTitle}>No jobs to track</Text>
                  <Text style={styles.emptySubtitle}>Your active and completed jobs will appear here</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
        
        {/* Bottom Navigation */}
        <BottomNav />
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  jobTime: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF7A2C',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7A2C',
  },
  jobDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF7A2C',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF7A2C',
    borderRadius: 4,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  viewDetailsText: {
    color: '#FF7A2C',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  acceptedBadge: {
    backgroundColor: '#E8F5E9',
  },
  acceptedDot: {
    backgroundColor: '#4CAF50',
  },
  acceptedText: {
    color: '#4CAF50',
  },
  inProgressBadge: {
    backgroundColor: '#FFF3E0',
  },
  inProgressDot: {
    backgroundColor: '#FF7A2C',
  },
  inProgressText: {
    color: '#FF7A2C',
  },
});
