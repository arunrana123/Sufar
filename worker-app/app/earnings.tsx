// EARNINGS SCREEN - Wallet-style display of worker earnings
// Features: Total earnings, today's earnings, daily earnings history with live updates
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/config';
import { socketService } from '@/lib/SocketService';

const { width } = Dimensions.get('window');

interface Booking {
  _id: string;
  price: number;
  finalAmount?: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string | Date;
  createdAt: string;
  serviceName: string;
  serviceCategory: string;
}

interface DeliveryOrder {
  _id: string;
  orderId: string;
  total: number;
  deliveryCharge?: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: 'pending' | 'confirmed' | 'preparing' | 'assigned' | 'picked' | 'on_way' | 'delivered' | 'cancelled';
  deliveredAt?: string | Date;
  createdAt: string;
}

interface DailyEarning {
  date: string;
  dateLabel: string;
  amount: number;
  count: number;
  bookings: Booking[];
}

export default function EarningsScreen() {
  const { worker } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [serviceEarnings, setServiceEarnings] = useState(0);
  const [deliveryEarnings, setDeliveryEarnings] = useState(0);

  // Fetch earnings data from backend
  const fetchEarnings = async (isRefresh = false) => {
    if (!worker?.id) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      
      // Declare variables at function scope
      let paidBookings: Booking[] = [];
      let paidOrders: DeliveryOrder[] = [];
      
      // Fetch all completed bookings with paid status
      const bookingsResponse = await fetch(`${apiUrl}/api/bookings/worker/${worker.id}?status=completed`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });

      // Fetch delivery orders
      const ordersResponse = await fetch(`${apiUrl}/api/orders/delivery/${worker.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });

      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        paidBookings = Array.isArray(bookingsData) 
          ? bookingsData.filter((b: Booking) => b.paymentStatus === 'paid' && b.status === 'completed')
          : [];
        
        setBookings(paidBookings);
      }
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        paidOrders = Array.isArray(ordersData) 
          ? ordersData.filter((o: DeliveryOrder) => 
              o.status === 'delivered' && 
              (o.paymentStatus === 'paid' || o.paymentMethod === 'cod')
            )
          : [];
        
        setDeliveryOrders(paidOrders);
      }
      
      // Calculate service earnings (use finalAmount if set, else price - matches backend credit)
      const calculatedServiceEarnings = paidBookings.reduce((sum: number, b: Booking) => sum + (b.finalAmount ?? b.price ?? 0), 0);
      setServiceEarnings(calculatedServiceEarnings);
      
      // Calculate delivery earnings (deliveryCharge or 10% of total)
      const calculatedDeliveryEarnings = paidOrders.reduce((sum: number, o: DeliveryOrder) => {
        const earning = o.deliveryCharge || (o.total * 0.1);
        return sum + earning;
      }, 0);
      setDeliveryEarnings(calculatedDeliveryEarnings);
      
      // Calculate total earnings
      const total = calculatedServiceEarnings + calculatedDeliveryEarnings;
      setTotalEarnings(total);
      
      // Calculate today's earnings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayBookings = paidBookings.filter((b: Booking) => {
        const completedDate = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === today.getTime();
      });
      
      const todayOrders = paidOrders.filter((o: DeliveryOrder) => {
        const deliveredDate = o.deliveredAt ? new Date(o.deliveredAt) : new Date(o.createdAt);
        deliveredDate.setHours(0, 0, 0, 0);
        return deliveredDate.getTime() === today.getTime();
      });
      
      const todayServiceTotal = todayBookings.reduce((sum: number, b: Booking) => sum + (b.finalAmount ?? b.price ?? 0), 0);
      const todayDeliveryTotal = todayOrders.reduce((sum: number, o: DeliveryOrder) => {
        const earning = o.deliveryCharge || (o.total * 0.1);
        return sum + earning;
      }, 0);
      
      const todayTotal = todayServiceTotal + todayDeliveryTotal;
      setTodayEarnings(todayTotal);
      setTodayCount(todayBookings.length + todayOrders.length);
      
      console.log('💰 Earnings fetched:', {
        serviceEarnings: calculatedServiceEarnings,
        deliveryEarnings: calculatedDeliveryEarnings,
        total: total,
        today: todayTotal,
        todayCount: todayBookings.length + todayOrders.length,
        serviceJobs: paidBookings.length,
        deliveryJobs: paidOrders.length,
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Group earnings by date (including both bookings and delivery orders)
  const dailyEarnings = useMemo(() => {
    const grouped: { [key: string]: DailyEarning } = {};
    
    // Add service bookings
    bookings.forEach((booking) => {
      const completedDate = booking.completedAt 
        ? new Date(booking.completedAt) 
        : new Date(booking.createdAt);
      
      const dateKey = completedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped[dateKey]) {
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
        
        grouped[dateKey] = {
          date: dateKey,
          dateLabel,
          amount: 0,
          count: 0,
          bookings: [],
        };
      }
      
      grouped[dateKey].amount += booking.finalAmount ?? booking.price ?? 0;
      grouped[dateKey].count += 1;
      grouped[dateKey].bookings.push(booking);
    });
    
    // Add delivery orders
    deliveryOrders.forEach((order) => {
      const deliveredDate = order.deliveredAt 
        ? new Date(order.deliveredAt) 
        : new Date(order.createdAt);
      
      const dateKey = deliveredDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped[dateKey]) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateLabel = deliveredDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: deliveredDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
        
        if (dateKey === today.toISOString().split('T')[0]) {
          dateLabel = 'Today';
        } else if (dateKey === yesterday.toISOString().split('T')[0]) {
          dateLabel = 'Yesterday';
        }
        
        grouped[dateKey] = {
          date: dateKey,
          dateLabel,
          amount: 0,
          count: 0,
          bookings: [],
        };
      }
      
      const deliveryEarning = order.deliveryCharge || (order.total * 0.1);
      grouped[dateKey].amount += deliveryEarning;
      grouped[dateKey].count += 1;
    });
    
    // Convert to array and sort by date (newest first)
    return Object.values(grouped).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [bookings, deliveryOrders]);

  useEffect(() => {
    if (worker?.id) {
      fetchEarnings();
      
      // Connect to socket for real-time updates
      socketService.connect(worker.id, 'worker');
      
      // Listen for payment status updates
      const handlePaymentStatusUpdated = (data: any) => {
        console.log('💳 Payment status updated in earnings:', data);
        const isForThisWorker = data.workerId === worker.id || data.booking?.workerId === worker.id || data.booking?.workerId?._id === worker.id;
        if (data.paymentStatus === 'paid' && isForThisWorker) {
          // Refresh earnings when payment is confirmed (live update wallet)
          setTimeout(() => {
            fetchEarnings();
          }, 500);
        }
      };
      
      // Listen for work completed
      const handleWorkCompleted = (data: any) => {
        console.log('✅ Work completed in earnings:', data);
        if (data.workerId === worker.id || data.bookingId) {
          // Refresh earnings when work is completed
          setTimeout(() => {
            fetchEarnings();
          }, 1000);
        }
      };
      
      // Listen for booking updates
      const handleBookingUpdated = (data: any) => {
        if (data.workerId === worker.id && data.status === 'completed' && data.paymentStatus === 'paid') {
          setTimeout(() => {
            fetchEarnings();
          }, 1000);
        }
      };

      // Listen for reward points claimed (cash added to earnings) - live update wallet
      const handleRewardPointsClaimed = (data: any) => {
        if (data.workerId === worker.id) {
          setTimeout(() => fetchEarnings(), 500);
        }
      };

      socketService.on('payment:status_updated', handlePaymentStatusUpdated);
      socketService.on('work:completed', handleWorkCompleted);
      socketService.on('booking:updated', handleBookingUpdated);
      socketService.on('worker:reward_points_updated', handleRewardPointsClaimed);

      // Auto-refresh every 30 seconds for live updates
      const intervalId = setInterval(() => {
        fetchEarnings();
      }, 30000);

      return () => {
        clearInterval(intervalId);
        socketService.off('payment:status_updated', handlePaymentStatusUpdated);
        socketService.off('work:completed', handleWorkCompleted);
        socketService.off('booking:updated', handleBookingUpdated);
        socketService.off('worker:reward_points_updated', handleRewardPointsClaimed);
      };
    }
  }, [worker?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7A2C" />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>My Earnings</Text>
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
          {/* Wallet Cards */}
          <View style={styles.walletSection}>
            {/* Total Earnings Card */}
            <View style={[styles.earningsCard, styles.totalEarningsCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="wallet" size={28} color="#FFD700" />
                <Text style={styles.cardTitle}>Total Earnings</Text>
              </View>
              <Text style={styles.earningsAmount}>Rs. {totalEarnings.toLocaleString()}</Text>
              <Text style={styles.cardSubtitle}>
                {bookings.length} service jobs • {deliveryOrders.length} deliveries
              </Text>
              {(serviceEarnings > 0 || deliveryEarnings > 0) && (
                <View style={styles.earningsBreakdown}>
                  {serviceEarnings > 0 && (
                    <Text style={styles.breakdownText}>
                      Service: Rs. {serviceEarnings.toLocaleString()}
                    </Text>
                  )}
                  {deliveryEarnings > 0 && (
                    <Text style={styles.breakdownText}>
                      Delivery: Rs. {deliveryEarnings.toLocaleString()}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Today's Earnings Card */}
            <View style={[styles.earningsCard, styles.todayEarningsCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="today" size={28} color="#FF7A2C" />
                <Text style={styles.cardTitle}>Today's Earnings</Text>
              </View>
              <Text style={styles.earningsAmount}>Rs. {todayEarnings.toLocaleString()}</Text>
              <Text style={styles.cardSubtitle}>{todayCount} job{todayCount !== 1 ? 's' : ''} completed</Text>
            </View>
          </View>

          {/* Earnings History Section */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={24} color="#FF7A2C" />
              <Text style={styles.sectionTitle}>Earnings History</Text>
            </View>

            {dailyEarnings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={64} color="#CCC" />
                <Text style={styles.emptyTitle}>No Earnings Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Complete jobs and receive payments to see your earnings here
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.historyList}>
                  {dailyEarnings.map((day, index) => {
                    // Calculate percentage for visual bar (relative to max earning day)
                    const maxAmount = Math.max(...dailyEarnings.map(d => d.amount));
                    const percentage = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                    
                    return (
                      <View key={day.date} style={styles.historyItem}>
                        <View style={styles.historyItemLeft}>
                          <View style={styles.dateCircle}>
                            <Ionicons name="calendar" size={20} color="#FF7A2C" />
                          </View>
                          <View style={styles.historyItemInfo}>
                            <Text style={styles.historyDate}>{day.dateLabel}</Text>
                            <Text style={styles.historyCount}>
                              {day.count} job{day.count !== 1 ? 's' : ''}
                            </Text>
                            {/* Visual progress bar */}
                            <View style={styles.earningBarContainer}>
                              <View style={[styles.earningBar, { width: `${percentage}%` }]} />
                            </View>
                          </View>
                        </View>
                        <View style={styles.historyItemRight}>
                          <Text style={styles.historyAmount}>Rs. {day.amount.toLocaleString()}</Text>
                          <Ionicons name="chevron-forward" size={20} color="#999" />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Recent Transactions */}
          {bookings.length > 0 && (
            <View style={styles.transactionsSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-outline" size={24} color="#FF7A2C" />
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
              </View>

              <View style={styles.transactionsList}>
                {bookings.slice(0, 10).map((booking) => {
                  const completedDate = booking.completedAt 
                    ? new Date(booking.completedAt) 
                    : new Date(booking.createdAt);
                  
                  return (
                    <View key={booking._id} style={styles.transactionItem}>
                      <View style={styles.transactionIcon}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionService}>{booking.serviceName}</Text>
                        <Text style={styles.transactionDate}>
                          {completedDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.transactionAmount}>+Rs. {(booking.finalAmount ?? booking.price ?? 0).toLocaleString()}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
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
  walletSection: {
    padding: 20,
    gap: 16,
  },
  earningsCard: {
    backgroundColor: '#fff',
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
  totalEarningsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  todayEarningsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF7A2C',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  earningsBreakdown: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 4,
  },
  breakdownText: {
    fontSize: 12,
    color: '#999',
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  dateCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyItemInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  earningBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  earningBar: {
    height: '100%',
    backgroundColor: '#FF7A2C',
    borderRadius: 2,
  },
  historyItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  transactionsSection: {
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
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});
