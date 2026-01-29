// REWARDS SCREEN - Reward points and bonus claim system
// Features: Reward points calculator, bonus claims, reward history with live updates
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

interface Booking {
  _id: string;
  price: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string | Date;
  createdAt: string;
  serviceName: string;
  serviceCategory: string;
}

interface Bonus {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
  bonusAmount: number;
  icon: string;
}

interface RewardHistory {
  date: string;
  dateLabel: string;
  points: number;
  source: string;
  bookingId?: string;
}

// Reward points calculation: 10 points per completed job + bonus based on price
const calculateRewardPoints = (bookings: Booking[]): number => {
  return bookings.reduce((total, booking) => {
    // Base points: 10 per completed paid job
    let points = 10;
    
    // Bonus points based on job price (1 point per Rs. 100)
    if (booking.price) {
      points += Math.floor(booking.price / 100);
    }
    
    return total + points;
  }, 0);
};

// Available bonuses (100 points = Rs. 1 when claimed to cash)
const availableBonuses: Bonus[] = [
  { id: 'bonus-1', name: 'Small', description: 'Claim Rs. 1 cash', pointsRequired: 100, bonusAmount: 1, icon: 'gift' },
  { id: 'bonus-2', name: 'Medium', description: 'Claim Rs. 5 cash', pointsRequired: 500, bonusAmount: 5, icon: 'gift' },
  { id: 'bonus-3', name: 'Large', description: 'Claim Rs. 10 cash', pointsRequired: 1000, bonusAmount: 10, icon: 'trophy' },
  { id: 'bonus-4', name: 'Mega', description: 'Claim Rs. 20 cash', pointsRequired: 2000, bonusAmount: 20, icon: 'star' },
];

export default function RewardsScreen() {
  const { worker } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [claimedBonuses, setClaimedBonuses] = useState<string[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedBonus, setSelectedBonus] = useState<Bonus | null>(null);

  // Fetch reward points from worker profile (backend calculates it)
  const fetchRewardsData = async (isRefresh = false) => {
    if (!worker?.id) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      
      // Fetch worker profile to get reward points
      const workerResponse = await fetch(`${apiUrl}/api/workers/${worker.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });

      if (workerResponse.ok) {
        const workerData = await workerResponse.json();
        const workerRewardPoints = workerData.rewardPoints || 0;
        setTotalPoints(workerRewardPoints);
        
        // Also fetch bookings for history display
        const bookingsResponse = await fetch(`${apiUrl}/api/bookings/worker/${worker.id}?status=completed`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-cache',
        });
        
        if (bookingsResponse.ok) {
          const bookingsData = await bookingsResponse.json();
          const paidBookings = Array.isArray(bookingsData) 
            ? bookingsData.filter((b: Booking) => b.paymentStatus === 'paid' && b.status === 'completed')
            : [];
          setBookings(paidBookings);
        }
        
        console.log('🎁 Rewards data fetched:', {
          totalPoints: workerRewardPoints,
          fromBackend: true,
        });
      } else {
        console.error('Failed to fetch worker rewards:', workerResponse.status);
        // Fallback to calculating from bookings
        const bookingsResponse = await fetch(`${apiUrl}/api/bookings/worker/${worker.id}?status=completed`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-cache',
        });
        
        if (bookingsResponse.ok) {
          const data = await bookingsResponse.json();
          const paidBookings = Array.isArray(data) 
            ? data.filter((b: Booking) => b.paymentStatus === 'paid' && b.status === 'completed')
            : [];
          setBookings(paidBookings);
          const points = calculateRewardPoints(paidBookings);
          setTotalPoints(points);
        }
      }
    } catch (error) {
      console.error('Error fetching rewards data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Generate reward history from bookings
  const rewardHistory = useMemo(() => {
    const history: RewardHistory[] = [];
    
    bookings.forEach((booking) => {
      const completedDate = booking.completedAt 
        ? new Date(booking.completedAt) 
        : new Date(booking.createdAt);
      
      const dateKey = completedDate.toISOString().split('T')[0];
      
      // Calculate points for this job
      let points = 10;
      if (booking.price) {
        points += Math.floor(booking.price / 100);
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateLabel = completedDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: completedDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
      
      if (dateKey === today.toISOString().split('T')[0]) {
        dateLabel = 'Today';
      } else if (dateKey === yesterday.toISOString().split('T')[0]) {
        dateLabel = 'Yesterday';
      }
      
      history.push({
        date: dateKey,
        dateLabel,
        points,
        source: booking.serviceName,
        bookingId: booking._id,
      });
    });
    
    // Sort by date (newest first)
    return history.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [bookings]);

  useEffect(() => {
    if (worker?.id) {
      fetchRewardsData();
      
      // Connect to socket for real-time updates
      socketService.connect(worker.id, 'worker');
      
      // Listen for work completed
      const handleWorkCompleted = (data: any) => {
        console.log('✅ Work completed in rewards:', data);
        if (data.workerId === worker.id || data.bookingId) {
          setTimeout(() => {
            fetchRewardsData();
          }, 1000);
        }
      };
      
      // Listen for payment status updates
      const handlePaymentStatusUpdated = (data: any) => {
        console.log('💳 Payment status updated in rewards:', data);
        if (data.paymentStatus === 'paid' && data.workerId === worker.id) {
          setTimeout(() => {
            fetchRewardsData();
          }, 1000);
        }
      };
      
      // Listen for booking updates
      const handleBookingUpdated = (data: any) => {
        if (data.workerId === worker.id && data.status === 'completed' && data.paymentStatus === 'paid') {
          setTimeout(() => {
            fetchRewardsData();
          }, 1000);
        }
      };
      
      // Listen for worker reward points updates (new paid job or claim to cash) - live update
      const handleWorkerRewardPointsUpdated = (data: any) => {
        if (data.workerId === worker.id) {
          if (data.totalPoints !== undefined) setTotalPoints(data.totalPoints);
          setTimeout(() => fetchRewardsData(), 500);
        }
      };
      
      socketService.on('work:completed', handleWorkCompleted);
      socketService.on('payment:status_updated', handlePaymentStatusUpdated);
      socketService.on('booking:updated', handleBookingUpdated);
      
      // Listen for worker-specific reward updates (using any to bypass type checking)
      const socketAny = socketService as any;
      socketAny.on('worker:reward_points_updated', handleWorkerRewardPointsUpdated);
      
      // Auto-refresh every 30 seconds
      const intervalId = setInterval(() => {
        fetchRewardsData();
      }, 30000);
      
      return () => {
        clearInterval(intervalId);
        socketService.off('work:completed', handleWorkCompleted);
        socketService.off('payment:status_updated', handlePaymentStatusUpdated);
        socketService.off('booking:updated', handleBookingUpdated);
        const socketAny = socketService as any;
        socketAny.off('worker:reward_points_updated', handleWorkerRewardPointsUpdated);
      };
    }
  }, [worker?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRewardsData(true);
  };

  const handleClaimBonus = (bonus: Bonus) => {
    if (totalPoints < bonus.pointsRequired) {
      Alert.alert(
        'Insufficient Points',
        `You need ${bonus.pointsRequired} points to claim this bonus. You currently have ${totalPoints} points.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedBonus(bonus);
    setShowClaimModal(true);
  };

  const confirmClaimBonus = async () => {
    if (!selectedBonus || !worker?.id) return;

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/workers/${worker.id}/claim-rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointsToClaim: selectedBonus.pointsRequired }),
      });
      const data = await response.json();

      if (response.ok) {
        setTotalPoints(data.rewardPoints ?? totalPoints - selectedBonus.pointsRequired);
        setClaimedBonuses([...claimedBonuses, selectedBonus.id]);
        Alert.alert(
          '🎉 Bonus Claimed!',
          `You have successfully claimed ${selectedBonus.name}!\n\nCash Added: Rs. ${data.cashAdded ?? selectedBonus.bonusAmount}\nPoints Deducted: ${selectedBonus.pointsRequired}\nRemaining Points: ${data.rewardPoints ?? totalPoints - selectedBonus.pointsRequired}\n\nAmount added to your earnings.`,
          [{ text: 'OK', onPress: () => { setShowClaimModal(false); fetchRewardsData(true); } }]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to claim bonus. Please try again.');
      }
    } catch (error) {
      console.error('Error claiming bonus:', error);
      Alert.alert('Error', 'Failed to claim bonus. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7A2C" />
        <Text style={styles.loadingText}>Loading rewards...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['top', 'left', 'right'] : ['left', 'right']}>
        {/* Header - full-bleed on Android */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Rewards</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Reward Points Card */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsCardHeader}>
              <Ionicons name="star" size={32} color="#FFD700" />
              <Text style={styles.pointsCardTitle}>Total Reward Points</Text>
            </View>
            <Text style={styles.pointsAmount}>{totalPoints.toLocaleString()}</Text>
            <Text style={styles.pointsSubtitle}>
              Earned from {bookings.length} completed job{bookings.length !== 1 ? 's' : ''}
            </Text>
            
            {/* Points Calculation Info */}
            <View style={styles.pointsInfo}>
              <View style={styles.pointsInfoItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.pointsInfoText}>10 points per completed job</Text>
              </View>
              <View style={styles.pointsInfoItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.pointsInfoText}>+1 point per Rs. 100 earned</Text>
              </View>
              <View style={styles.pointsInfoItem}>
                <Ionicons name="cash-outline" size={16} color="#4CAF50" />
                <Text style={styles.pointsInfoText}>Claim to cash: 100 points = Rs. 1</Text>
              </View>
            </View>
          </View>

          {/* Available Bonuses */}
          <View style={styles.bonusesSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="gift-outline" size={24} color="#FF7A2C" />
              <Text style={styles.sectionTitle}>Available Bonuses</Text>
            </View>

            <View style={styles.bonusesList}>
              {availableBonuses.map((bonus) => {
                const canClaim = totalPoints >= bonus.pointsRequired && !claimedBonuses.includes(bonus.id);
                const isClaimed = claimedBonuses.includes(bonus.id);
                
                return (
                  <TouchableOpacity
                    key={bonus.id}
                    style={[
                      styles.bonusCard,
                      canClaim && styles.bonusCardAvailable,
                      isClaimed && styles.bonusCardClaimed,
                    ]}
                    onPress={() => !isClaimed && handleClaimBonus(bonus)}
                    disabled={isClaimed}
                  >
                    <View style={styles.bonusCardLeft}>
                      <View style={[
                        styles.bonusIcon,
                        canClaim && styles.bonusIconAvailable,
                        isClaimed && styles.bonusIconClaimed,
                      ]}>
                        <Ionicons 
                          name={bonus.icon as any} 
                          size={24} 
                          color={isClaimed ? '#999' : canClaim ? '#FFD700' : '#CCC'} 
                        />
                      </View>
                      <View style={styles.bonusInfo}>
                        <Text style={[
                          styles.bonusName,
                          isClaimed && styles.bonusNameClaimed,
                        ]}>
                          {bonus.name}
                        </Text>
                        <Text style={styles.bonusDescription}>{bonus.description}</Text>
                        <Text style={styles.bonusPoints}>
                          {bonus.pointsRequired} points required
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bonusCardRight}>
                      <Text style={[
                        styles.bonusAmount,
                        isClaimed && styles.bonusAmountClaimed,
                      ]}>
                        Rs. {bonus.bonusAmount}
                      </Text>
                      {isClaimed ? (
                        <View style={styles.claimedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={styles.claimedText}>Claimed</Text>
                        </View>
                      ) : canClaim ? (
                        <TouchableOpacity style={styles.claimButton}>
                          <Text style={styles.claimButtonText}>Claim</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.lockedBadge}>
                          <Ionicons name="lock-closed" size={16} color="#999" />
                          <Text style={styles.lockedText}>Locked</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Reward History */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={24} color="#FF7A2C" />
              <Text style={styles.sectionTitle}>Reward History</Text>
            </View>

            {rewardHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="star-outline" size={64} color="#CCC" />
                <Text style={styles.emptyTitle}>No Rewards Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Complete jobs and receive payments to earn reward points
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {rewardHistory.map((item, index) => (
                  <View key={`${item.date}-${item.bookingId}-${index}`} style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <View style={styles.pointsCircle}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                      </View>
                      <View style={styles.historyItemInfo}>
                        <Text style={styles.historySource}>{item.source}</Text>
                        <Text style={styles.historyDate}>{item.dateLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.historyItemRight}>
                      <Text style={styles.historyPoints}>+{item.points} pts</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Claim Bonus Modal */}
      <Modal
        visible={showClaimModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowClaimModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="gift" size={32} color="#FFD700" />
              <Text style={styles.modalTitle}>Claim Bonus</Text>
            </View>
            
            {selectedBonus && (
              <>
                <Text style={styles.modalBonusName}>{selectedBonus.name}</Text>
                <Text style={styles.modalBonusDescription}>{selectedBonus.description}</Text>
                
                <View style={styles.modalPointsInfo}>
                  <View style={styles.modalPointsRow}>
                    <Text style={styles.modalPointsLabel}>Your Points:</Text>
                    <Text style={styles.modalPointsValue}>{totalPoints}</Text>
                  </View>
                  <View style={styles.modalPointsRow}>
                    <Text style={styles.modalPointsLabel}>Required Points:</Text>
                    <Text style={styles.modalPointsValue}>{selectedBonus.pointsRequired}</Text>
                  </View>
                  <View style={[styles.modalPointsRow, styles.modalPointsRowTotal]}>
                    <Text style={styles.modalPointsLabel}>Remaining Points:</Text>
                    <Text style={styles.modalPointsValue}>
                      {totalPoints - selectedBonus.pointsRequired}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowClaimModal(false)}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={confirmClaimBonus}
                  >
                    <Text style={styles.modalButtonTextConfirm}>Claim Bonus</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
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
  pointsCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  pointsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pointsCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  pointsAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  pointsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  pointsInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  pointsInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsInfoText: {
    fontSize: 13,
    color: '#666',
  },
  bonusesSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  bonusesList: {
    gap: 12,
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  bonusCardAvailable: {
    backgroundColor: '#FFF9E6',
    borderColor: '#FFD700',
  },
  bonusCardClaimed: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    opacity: 0.7,
  },
  bonusCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  bonusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bonusIconAvailable: {
    backgroundColor: '#FFF9E6',
  },
  bonusIconClaimed: {
    backgroundColor: '#E0E0E0',
  },
  bonusInfo: {
    flex: 1,
  },
  bonusName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bonusNameClaimed: {
    color: '#999',
  },
  bonusDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  bonusPoints: {
    fontSize: 12,
    color: '#999',
  },
  bonusCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  bonusAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  bonusAmountClaimed: {
    color: '#999',
  },
  claimButton: {
    backgroundColor: '#FF7A2C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  claimedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  lockedText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  historySection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  pointsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyItemInfo: {
    flex: 1,
  },
  historySource: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  modalBonusName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF7A2C',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBonusDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalPointsInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  modalPointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalPointsRowTotal: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 4,
  },
  modalPointsLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalPointsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF7A2C',
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
