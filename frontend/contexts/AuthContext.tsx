import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  profilePhoto?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      console.log('Loading stored user...');
      
      // Try to load user data with a reasonable timeout
      const storagePromise = AsyncStorage.getItem('userData');
      const timeoutPromise = new Promise<string | null>((resolve) => {
        setTimeout(() => {
          console.log('⚠️ AsyncStorage taking longer than expected, proceeding...');
          resolve(null);
        }, 5000); // Increased to 5 seconds
      });

      // Race between storage load and timeout
      const storedUser = await Promise.race([storagePromise, timeoutPromise]);
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('✅ Found stored user:', userData.email || userData.id);
          setUser(userData);
        } catch (parseError) {
          console.error('Error parsing stored user data:', parseError);
          // Clear corrupted data
          await AsyncStorage.removeItem('userData');
        }
      } else {
        console.log('ℹ️ No stored user found');
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
      // Don't block app load on storage errors
    } finally {
      console.log('✅ Finished loading user, setting isLoading to false');
      setIsLoading(false);
    }
  };

  const login = async (userData: User) => {
    try {
      console.log('Storing user data:', userData);
      
      // Validate user data before storing
      if (!userData.id) {
        throw new Error('User data is missing required field: id');
      }
      
      // Set timeout for AsyncStorage operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Storage operation timeout')), 5000);
      });
      
      const storagePromise = AsyncStorage.setItem('userData', JSON.stringify(userData));
      await Promise.race([storagePromise, timeoutPromise]);
      
      console.log('User data stored successfully');
      setUser(userData);
      console.log('User state updated');
    } catch (error) {
      console.error('Error storing user data:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out user...');
      await AsyncStorage.removeItem('userData');
      console.log('User data removed from storage');
      setUser(null);
      console.log('User state cleared');
    } catch (error) {
      console.error('Error removing user data:', error);
      throw error;
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
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
