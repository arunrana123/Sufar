'use client';

import { useState, useEffect } from 'react';

// Beautiful collection of paintings, arts, scenic wallpapers, Himalayas, sports cars, planes, materials, and food
const WALLPAPER_IMAGES = [
  // Paintings & Art
  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1920&h=1080&fit=crop&q=80', // Abstract art
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1920&h=1080&fit=crop&q=80', // Colorful art
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1920&h=1080&fit=crop&q=80', // Art gallery
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1920&h=1080&fit=crop&q=80', // Modern art
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&h=1080&fit=crop&q=80', // Colorful abstract
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1920&h=1080&fit=crop&q=80', // Artistic texture
  
  // Beautiful Scenes & Landscapes
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop&q=80', // Forest scene
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop&q=80', // Waterfall
  'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop&q=80', // Sunset landscape
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop&q=80', // Ocean waves
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&q=80', // Forest path
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&h=1080&fit=crop&q=80', // Nature scene
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1920&h=1080&fit=crop&q=80', // Lake scene
  'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1920&h=1080&fit=crop&q=80', // Beautiful landscape
  'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1920&h=1080&fit=crop&q=80', // Scenic view
  'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1920&h=1080&fit=crop&q=80', // Abstract nature
  
  // Himalayas & Mountains
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&q=80', // Mountain landscape
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop&q=80', // Mountain view
  'https://images.unsplash.com/photo-1464822759844-d150ad2c281e?w=1920&h=1080&fit=crop&q=80', // Snow mountains
  'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1920&h=1080&fit=crop&q=80', // Himalayan peaks
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&q=80', // Mountain range
  'https://images.unsplash.com/photo-1464822759844-d150ad2c281e?w=1920&h=1080&fit=crop&q=80', // Everest view
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop&q=80', // Alpine landscape
  
  // Sports Cars
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&h=1080&fit=crop&q=80', // Sports car
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1920&h=1080&fit=crop&q=80', // Luxury sports car
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1920&h=1080&fit=crop&q=80', // Red sports car
  'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1920&h=1080&fit=crop&q=80', // Fast sports car
  'https://images.unsplash.com/photo-1494976687768-f2e46235a692?w=1920&h=1080&fit=crop&q=80', // Racing car
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1920&h=1080&fit=crop&q=80', // Sports car front
  'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1920&h=1080&fit=crop&q=80', // Classic sports car
  'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=1920&h=1080&fit=crop&q=80', // Modern sports car
  
  // Planes & Aircraft
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&h=1080&fit=crop&q=80', // Airplane in sky
  'https://images.unsplash.com/photo-1529107386315-e3a2d8526729?w=1920&h=1080&fit=crop&q=80', // Plane flying
  'https://images.unsplash.com/photo-1529107386315-e3a2d8526729?w=1920&h=1080&fit=crop&q=80', // Commercial plane
  'https://images.unsplash.com/photo-1530963937876-c8ce3c0bfd02?w=1920&h=1080&fit=crop&q=80', // Aircraft
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&h=1080&fit=crop&q=80', // Plane wing view
  'https://images.unsplash.com/photo-1529107386315-e3a2d8526729?w=1920&h=1080&fit=crop&q=80', // Aviation
  
  // Materials & Textures
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1920&h=1080&fit=crop&q=80', // Artistic texture
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&h=1080&fit=crop&q=80', // Metal texture
  'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=1920&h=1080&fit=crop&q=80', // Wood texture
  'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&h=1080&fit=crop&q=80', // Concrete texture
  'https://images.unsplash.com/photo-1508610048659-a06b669e3321?w=1920&h=1080&fit=crop&q=80', // Fabric texture
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop&q=80', // Geometric patterns
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&h=1080&fit=crop&q=80', // Colorful texture
  'https://images.unsplash.com/photo-1561570544-0a5cb1ec096f?w=1920&h=1080&fit=crop&q=80', // Stone texture
  'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=1920&h=1080&fit=crop&q=80', // Marble texture
  
  // Food Items
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=1080&fit=crop&q=80', // Gourmet food
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=1920&h=1080&fit=crop&q=80', // Delicious meal
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1920&h=1080&fit=crop&q=80', // Food platter
  'https://images.unsplash.com/photo-1506354666786-959d6d497f1a?w=1920&h=1080&fit=crop&q=80', // Fresh food
  'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1920&h=1080&fit=crop&q=80', // Beautiful food
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1920&h=1080&fit=crop&q=80', // Healthy food
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=1080&fit=crop&q=80', // Cuisine
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=1920&h=1080&fit=crop&q=80', // Appetizing food
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1920&h=1080&fit=crop&q=80', // Food arrangement
  'https://images.unsplash.com/photo-1506354666786-959d6d497f1a?w=1920&h=1080&fit=crop&q=80', // Food photography
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'otp' | 'password'>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Randomly select wallpaper on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * WALLPAPER_IMAGES.length);
    setCurrentWallpaper(WALLPAPER_IMAGES[randomIndex]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    // Ensure we're on the client side
    if (typeof window === 'undefined') {
      console.log('Running on server side, skipping fetch');
      return;
    }
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email, password }
        : { name, email, password };
      
      console.log('Making request to:', endpoint);
      console.log('Request body:', body);
      console.log('Running on client side:', typeof window !== 'undefined');
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        mode: 'cors',
        credentials: 'include'
      });
      
      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.message || 'Authentication failed');
        return;
      }
      
      if (isLogin) {
        // Store admin session with all data from backend
        const adminData = {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          address: data.address || '',
          role: data.role,
          profileImage: data.profileImage || null,
          createdAt: data.createdAt,
        };
        localStorage.setItem('adminUser', JSON.stringify(adminData));
        window.location.href = '/dashboard';
      } else {
        // Show success message and switch to login
        alert('Account created successfully! Please login with your credentials.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
        setName('');
      }
      
    } catch (error) {
      console.error('Auth error:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        alert('Network error: Unable to connect to the server. Please check if the backend is running on port 5001.');
      } else {
        alert('Authentication failed. Please try again.');
      }
    }
  };


  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setForgotPasswordMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setForgotPasswordMessage({ type: 'success', text: data.message || 'OTP sent to your email address' });
        setForgotPasswordStep('otp');
        setTimeout(() => setForgotPasswordMessage(null), 5000);
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.message || 'Failed to send OTP. Please try again.' });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setForgotPasswordMessage({ type: 'error', text: 'Network error. Please check your connection and try again.' });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 4) {
      setForgotPasswordMessage({ type: 'error', text: 'Please enter a valid 4-digit OTP' });
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail, otp }),
      });

      const data = await res.json();

      if (res.ok) {
        setResetToken(data.resetToken);
        setForgotPasswordMessage({ type: 'success', text: 'OTP verified successfully!' });
        setForgotPasswordStep('password');
        setTimeout(() => setForgotPasswordMessage(null), 3000);
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.message || 'Invalid or expired OTP. Please try again.' });
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      setForgotPasswordMessage({ type: 'error', text: 'Network error. Please check your connection and try again.' });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setForgotPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (!resetToken) {
      setForgotPasswordMessage({ type: 'error', text: 'Reset token is missing. Please start over.' });
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setForgotPasswordMessage({ type: 'success', text: 'Password reset successfully! You can now login with your new password.' });
        setTimeout(() => {
          setShowForgotPassword(false);
          setForgotPasswordStep('email');
          setForgotPasswordEmail('');
          setOtp('');
          setNewPassword('');
          setConfirmNewPassword('');
          setResetToken('');
          setForgotPasswordMessage(null);
        }, 2000);
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.message || 'Failed to reset password. Please try again.' });
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setForgotPasswordMessage({ type: 'error', text: 'Network error. Please check your connection and try again.' });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setForgotPasswordStep('email');
    setForgotPasswordEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetToken('');
    setForgotPasswordMessage(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Wallpaper */}
      {currentWallpaper && (
        <>
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${currentWallpaper})`,
              opacity: imageLoaded ? 1 : 0,
            }}
          >
            {/* Preload image */}
            <img
              src={currentWallpaper}
              alt=""
              className="hidden"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </div>
          
          {/* Gradient Overlay for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/40 backdrop-blur-[2px]"></div>
        </>
      )}
      
      {/* Login Container */}
      <div className="bg-white backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 border-2 border-gray-200/50">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-600 mb-2">Sufar</h1>
          <p className="text-gray-700 font-medium">Admin Dashboard</p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-6 border border-gray-200/30">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              isLogin
                ? 'bg-purple-600 text-white shadow-md transform scale-105'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              !isLogin
                ? 'bg-purple-600 text-white shadow-md transform scale-105'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
                placeholder="Enter your full name"
                required={!isLogin}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border-2 border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border-2 border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
                  placeholder="Confirm your password"
                  required={!isLogin}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium transform hover:scale-[1.02]"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        {isLogin && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-purple-600 hover:text-purple-700 hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
            <button
              onClick={closeForgotPasswordModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
            <p className="text-sm text-gray-600 mb-6">
              {forgotPasswordStep === 'email' && 'Enter your email address to receive an OTP'}
              {forgotPasswordStep === 'otp' && 'Enter the 4-digit OTP sent to your email'}
              {forgotPasswordStep === 'password' && 'Enter your new password'}
            </p>

            {/* Message Display */}
            {forgotPasswordMessage && (
              <div className={`mb-4 p-3 rounded-md ${
                forgotPasswordMessage.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <p className="text-sm font-medium">{forgotPasswordMessage.text}</p>
              </div>
            )}

            {/* Step 1: Email */}
            {forgotPasswordStep === 'email' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="forgot-email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forgotPasswordLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            )}

            {/* Step 2: OTP Verification */}
            {forgotPasswordStep === 'otp' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all text-center text-2xl font-bold tracking-widest"
                    placeholder="0000"
                    maxLength={4}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Check your email for the 4-digit OTP code
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordStep('email');
                      setOtp('');
                      setForgotPasswordMessage(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={forgotPasswordLoading || otp.length !== 4}
                    className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotPasswordLoading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  className="w-full text-sm text-purple-600 hover:text-purple-700 hover:underline font-medium"
                >
                  Resend OTP
                </button>
              </div>
            )}

            {/* Step 3: New Password */}
            {forgotPasswordStep === 'password' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirm-new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white transition-all"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordStep('otp');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setForgotPasswordMessage(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={forgotPasswordLoading || !newPassword || !confirmNewPassword}
                    className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotPasswordLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
