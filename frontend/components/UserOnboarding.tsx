// USER ONBOARDING - Comprehensive guide for new users on how to use the app
// Features: Step-by-step tutorial, service booking guide, market shopping guide, payment guide
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

interface OnboardingStep {
  icon: string;
  title: string;
  description: string;
  details: string[];
  color: string;
  image?: string;
}

interface UserOnboardingProps {
  onComplete: () => void;
}

export default function UserOnboarding({ onComplete }: UserOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      icon: 'home-outline',
      title: 'Welcome to Sufar! 🎉',
      description: 'Your one-stop solution for all local services and shopping in Nepal',
      details: [
        'Browse 15+ service categories',
        'Shop from local market',
        'Track orders in real-time',
        'Secure payment options',
      ],
      color: '#FF7A2C',
    },
    {
      icon: 'search-outline',
      title: '1. Browse Services',
      description: 'Find the service you need',
      details: [
        'Go to Home screen',
        'Search or browse service categories',
        'View available workers near you',
        'Check ratings and reviews',
        'Select a service provider',
      ],
      color: '#4A90E2',
    },
    {
      icon: 'calendar-outline',
      title: '2. Book a Service',
      description: 'Schedule your service appointment',
      details: [
        'Tap on a service category',
        'Choose a worker from available list',
        'Select "Book Now" or "Schedule Later"',
        'Add service location and photos',
        'Confirm booking details',
      ],
      color: '#7ED321',
    },
    {
      icon: 'navigate-outline',
      title: '3. Track in Real-Time',
      description: 'Watch your worker arrive',
      details: [
        'View live location on map',
        'See estimated arrival time',
        'Track route with Mapbox directions',
        'Get notified when worker arrives',
        'Monitor work progress',
      ],
      color: '#9C27B0',
    },
    {
      icon: 'storefront-outline',
      title: '4. Shop from Market',
      description: 'Buy products from local vendors',
      details: [
        'Go to Market tab',
        'Browse products by category',
        'Add items to cart',
        'Select delivery address',
        'Choose payment method',
      ],
      color: '#F5A623',
    },
    {
      icon: 'cube-outline',
      title: '5. Track Your Orders',
      description: 'Monitor your market orders',
      details: [
        'View order status timeline',
        'See delivery boy location on map',
        'Track route with live updates',
        'Confirm COD payment when delivered',
        'Rate and review products',
      ],
      color: '#50E3C2',
    },
    {
      icon: 'card-outline',
      title: '6. Make Payments',
      description: 'Secure payment options',
      details: [
        'Pay online: eSewa, Khalti, PhonePay',
        'Cash on Delivery (COD)',
        'Use reward points for discounts',
        'Confirm payment after service',
        'Earn points on every purchase',
      ],
      color: '#E91E63',
    },
    {
      icon: 'star-outline',
      title: '7. Rate & Review',
      description: 'Share your experience',
      details: [
        'Rate services after completion',
        'Write detailed reviews',
        'Rate products after delivery',
        'Earn reward points for reviews',
        'Help others make better choices',
      ],
      color: '#FF9800',
    },
    {
      icon: 'gift-outline',
      title: '8. Earn Rewards',
      description: 'Get points for every action',
      details: [
        'Earn points on orders (1 point per Rs. 10)',
        'Get 100 points per review',
        'Use points for discounts',
        'Track points in Profile',
        'Redeem points anytime',
      ],
      color: '#4CAF50',
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skip = () => {
    onComplete();
  };

  const current = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${((currentStep + 1) / steps.length) * 100}%`,
                backgroundColor: current.color 
              }
            ]} 
          />
        </View>
        <TouchableOpacity onPress={skip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon Circle */}
        <View style={[styles.iconContainer, { backgroundColor: `${current.color}15` }]}>
          <View style={[styles.iconCircle, { backgroundColor: current.color }]}>
            <Ionicons name={current.icon as any} size={64} color="#fff" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{current.title}</Text>

        {/* Description */}
        <Text style={styles.description}>{current.description}</Text>

        {/* Details List */}
        <View style={styles.detailsContainer}>
          {current.details.map((detail, index) => (
            <View key={index} style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: `${current.color}20` }]}>
                <Ionicons name="checkmark-circle" size={20} color={current.color} />
              </View>
              <Text style={styles.detailText}>{detail}</Text>
            </View>
          ))}
        </View>

        {/* Step Counter */}
        <View style={styles.stepCounter}>
          <Text style={styles.stepCounterText}>
            {currentStep + 1} of {steps.length}
          </Text>
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity onPress={prevStep} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#666" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={nextStep}
          style={[styles.nextButton, { backgroundColor: current.color }]}
        >
          <Text style={styles.nextButtonText}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
          {!isLastStep && (
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
          )}
          {isLastStep && (
            <Ionicons name="checkmark" size={20} color="#fff" style={styles.arrowIcon} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  detailsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  detailText: {
    flex: 1,
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  stepCounter: {
    marginTop: 20,
  },
  stepCounterText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  arrowIcon: {
    marginLeft: 8,
  },
});
