import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.userName}>{user?.firstName || user?.username || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>SUFAR Services</Text>
        <Text style={styles.subtitle}>Your Professional Service Partner</Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureCard}>
            <Ionicons name="home-outline" size={32} color="#1E40AF" />
            <Text style={styles.featureTitle}>Home Services</Text>
            <Text style={styles.featureDescription}>Plumbing, electrical, cleaning and more</Text>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="people-outline" size={32} color="#1E40AF" />
            <Text style={styles.featureTitle}>Professional Workers</Text>
            <Text style={styles.featureDescription}>Verified and skilled professionals</Text>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="time-outline" size={32} color="#1E40AF" />
            <Text style={styles.featureTitle}>24/7 Available</Text>
            <Text style={styles.featureDescription}>Round the clock service support</Text>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="shield-checkmark-outline" size={32} color="#1E40AF" />
            <Text style={styles.featureTitle}>Safe & Secure</Text>
            <Text style={styles.featureDescription}>Your safety is our priority</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#AEDAFF',
  },
  welcomeSection: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  featuresContainer: {
    gap: 20,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 16,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});


