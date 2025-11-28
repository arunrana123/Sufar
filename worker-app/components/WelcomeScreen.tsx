// WORKER WELCOME SCREEN - First-time worker onboarding explaining how to earn with Sufar
// Shows: How to get verified, accept jobs, track earnings, get paid
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  onComplete: () => void;
}

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: 'briefcase-outline' as const,
      title: 'Welcome to Sufar Worker',
      description: 'Start earning by providing your professional services. Join thousands of verified workers in Nepal.',
      color: '#FF7A2C',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Get Verified First',
      description: 'Upload your documents (Photo, Certificate, Citizenship, License) for verification. Verified workers get more bookings.',
      color: '#4CAF50',
    },
    {
      icon: 'notifications-outline' as const,
      title: 'Receive Job Requests',
      description: 'Toggle "Available" to receive booking requests. Accept jobs in your area with one tap.',
      color: '#2196F3',
    },
    {
      icon: 'navigate-outline' as const,
      title: 'Navigate & Complete',
      description: 'Use built-in GPS navigation to reach customers. Update job status and complete work to earn.',
      color: '#9C27B0',
    },
    {
      icon: 'cash-outline' as const,
      title: 'Track Your Earnings',
      description: 'View your earnings, completed jobs, and ratings. Get paid directly to your account.',
      color: '#F5A623',
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
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
            <Ionicons name={current.icon} size={64} color="#fff" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{current.title}</Text>

        {/* Description */}
        <Text style={styles.description}>{current.description}</Text>

        {/* Step Indicators */}
        <View style={styles.indicators}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentStep && styles.indicatorActive,
                { backgroundColor: index === currentStep ? current.color : '#E0E0E0' },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity onPress={prevStep} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={nextStep}
          style={[styles.nextButton, { backgroundColor: current.color }]}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === steps.length - 1 ? 'Start Earning' : 'Next'}
          </Text>
          {currentStep < steps.length - 1 && (
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
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
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorActive: {
    width: 30,
    height: 10,
    borderRadius: 5,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
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

