// TRACKING SCREEN - Worker's job tracking page showing active and completed jobs
// Features: View job progress, navigate to job details, job completion status, earnings summary
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { router } from 'expo-router';

interface Job {
  id: string;
  clientName: string;
  service: string;
  location: string;
  startTime: string;
  status: 'in_progress' | 'completed';
  progress: number;
}

export default function TrackingScreen() {
  const [activeJobs, setActiveJobs] = useState<Job[]>([
    {
      id: '1',
      clientName: 'Mike Johnson',
      service: 'Electrical Work',
      location: 'Kailali',
      startTime: '2 hours ago',
      status: 'in_progress',
      progress: 60,
    },
  ]);

  const [completedJobs, setCompletedJobs] = useState<Job[]>([
    {
      id: '2',
      clientName: 'John Doe',
      service: 'Plumbing Work',
      location: 'Kathmandu',
      startTime: 'Yesterday',
      status: 'completed',
      progress: 100,
    },
    {
      id: '3',
      clientName: 'Sarah Smith',
      service: 'Carpentry',
      location: 'Kanchanpur',
      startTime: '2 days ago',
      status: 'completed',
      progress: 100,
    },
  ]);

  const handleMarkComplete = (id: string) => {
    const job = activeJobs.find(j => j.id === id);
    if (job) {
      setActiveJobs(activeJobs.filter(j => j.id !== id));
      setCompletedJobs([{ ...job, status: 'completed', progress: 100 }, ...completedJobs]);
    }
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Jobs</Text>
              {activeJobs.map((job) => (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobHeader}>
                    <View style={styles.clientInfo}>
                      <View style={styles.clientAvatar}>
                        <Ionicons name="person" size={24} color="#FF7A2C" />
                      </View>
                      <View>
                        <Text style={styles.clientName}>{job.clientName}</Text>
                        <Text style={styles.jobTime}>{job.startTime}</Text>
                      </View>
                    </View>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>In Progress</Text>
                    </View>
                  </View>

                  <View style={styles.jobDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{job.service}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{job.location}</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Progress</Text>
                      <Text style={styles.progressPercent}>{job.progress}%</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${job.progress}%` }]} />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleMarkComplete(job.id)}
                  >
                    <Text style={styles.completeButtonText}>Mark as Complete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Completed Jobs</Text>
              {completedJobs.map((job) => (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobHeader}>
                    <View style={styles.clientInfo}>
                      <View style={styles.clientAvatar}>
                        <Ionicons name="person" size={24} color="#4CAF50" />
                      </View>
                      <View>
                        <Text style={styles.clientName}>{job.clientName}</Text>
                        <Text style={styles.jobTime}>{job.startTime}</Text>
                      </View>
                    </View>
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                  </View>

                  <View style={styles.jobDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{job.service}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>{job.location}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {activeJobs.length === 0 && completedJobs.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No jobs to track</Text>
              <Text style={styles.emptySubtitle}>Your active and completed jobs will appear here</Text>
            </View>
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
  completeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
});

