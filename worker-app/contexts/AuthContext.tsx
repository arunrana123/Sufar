import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  token: string;
  profileImage?: string;
  serviceCategories?: string[];
  categoryVerificationStatus?: {
    [category: string]: 'pending' | 'verified' | 'rejected';
  };
  documents?: {
    profilePhoto?: string | null;
    certificate?: string | null;
    citizenship?: string | null;
    license?: string | null;
  };
  verificationStatus?: {
    profilePhoto?: string;
    certificate?: string;
    citizenship?: string;
    license?: string;
    overall?: string;
  };
  verificationSubmitted?: boolean;
  submittedAt?: string;
}

interface AuthContextType {
  worker: Worker | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (workerData: Worker) => Promise<void>;
  logout: () => Promise<void>;
  updateWorker: (workerData: Partial<Worker>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Timeout for debouncing updateWorker
let updateWorkerTimeout: ReturnType<typeof setTimeout> | null = null;

export function AuthProvider({ children }: AuthProviderProps) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    // Load stored worker data check (but never auto-authenticate)
    // User must always go through splash -> login -> home
    loadStoredWorker();
  }, []);

  const loadStoredWorker = async () => {
    try {
      // Set a timeout to ensure loading doesn't hang forever (max 3 seconds)
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.log('⚠️ AsyncStorage timeout - proceeding with app load');
          resolve(null);
        }, 3000);
      });

      const storagePromise = AsyncStorage.getItem('workerData');
      
      // Race between storage load and timeout
      const storedWorker = await Promise.race([storagePromise, timeoutPromise]);
      
      if (storedWorker) {
        console.log('Stored worker data exists, but user must login');
      }
    } catch (error) {
      console.error('Error loading stored worker:', error);
    } finally {
      setIsLoading(false);
      setHasCheckedAuth(true);
    }
  };

  const clearStoredWorker = async () => {
    try {
      await AsyncStorage.removeItem('workerData');
      setWorker(null);
    } catch (error) {
      console.error('Error clearing stored worker:', error);
    }
  };

  const login = async (workerData: Worker) => {
    try {
      // Merge with any existing stored data to preserve profileImage and other updates
      let existingData: Partial<Worker> = {};
      try {
        const stored = await AsyncStorage.getItem('workerData');
        if (stored) {
          existingData = JSON.parse(stored);
        }
      } catch (e) {
        // No existing data, continue
      }
      
      // Merge: use stored profileImage if it exists, otherwise use login data
      const mergedData: Worker = {
        ...workerData,
        profileImage: existingData.profileImage || workerData.profileImage || undefined,
        documents: existingData.documents || workerData.documents || undefined,
        verificationStatus: existingData.verificationStatus || workerData.verificationStatus || undefined,
        verificationSubmitted: existingData.verificationSubmitted || workerData.verificationSubmitted || false,
      };
      
      await AsyncStorage.setItem('workerData', JSON.stringify(mergedData));
      setWorker(mergedData);
      console.log('Worker logged in and data stored:', mergedData.name);
    } catch (error) {
      console.error('Error storing worker data:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('workerData');
      setWorker(null);
    } catch (error) {
      console.error('Error removing worker data:', error);
      throw error;
    }
  };

  const updateWorker = (workerData: Partial<Worker>) => {
    if (worker) {
      const updatedWorker = { ...worker, ...workerData };
      
      // CRITICAL FIX for Android: Only update state if not already the same
      // This prevents unnecessary re-renders
      if (JSON.stringify(worker) !== JSON.stringify(updatedWorker)) {
        setWorker(updatedWorker);
        
        // Save to AsyncStorage with debounce to prevent rapid writes (Android-friendly)
        if (updateWorkerTimeout) {
          clearTimeout(updateWorkerTimeout);
        }
        
        updateWorkerTimeout = setTimeout(() => {
          AsyncStorage.setItem('workerData', JSON.stringify(updatedWorker))
            .then(() => console.log('Worker data updated and saved to AsyncStorage'))
            .catch(error => console.error('Error updating worker data:', error));
        }, 300); // Increased to 300ms for Android stability
      }
    }
  };

  const value: AuthContextType = {
    worker,
    isLoading,
    isAuthenticated: !!worker,
    login,
    logout,
    updateWorker,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
