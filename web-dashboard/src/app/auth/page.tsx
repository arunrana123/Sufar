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
        // Store admin session and redirect to dashboard
        localStorage.setItem('adminUser', JSON.stringify(data));
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

  const handleGoogleLogin = async () => {
    // Placeholder: UI button is visible now. To fully enable, wire up Google OAuth per GOOGLE_AUTH_IMPLEMENTATION.md
    alert('Google Sign-In: Please complete Google OAuth setup (client ID) to enable sign-in.');
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
      <div className="bg-gradient-to-br from-blue-100 via-orange-50 to-blue-100 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 border-2 border-orange-200/50">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">Sufar</h1>
          <p className="text-blue-700 font-medium">Admin Dashboard</p>
        </div>

        <div className="flex bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg p-1 mb-6 border border-orange-200/30">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              isLogin
                ? 'bg-gradient-to-r from-blue-500 to-orange-400 text-white shadow-md transform scale-105'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              !isLogin
                ? 'bg-gradient-to-r from-blue-500 to-orange-400 text-white shadow-md transform scale-105'
                : 'text-gray-600 hover:text-orange-600'
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
                className="w-full px-3 py-2 border-2 border-orange-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white/90 transition-all"
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
              className="w-full px-3 py-2 border-2 border-orange-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white/90 transition-all"
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
                className="w-full px-3 py-2 pr-10 border-2 border-orange-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white/90 transition-all"
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
                  className="w-full px-3 py-2 pr-10 border-2 border-orange-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white/90 transition-all"
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
            className="w-full bg-gradient-to-r from-blue-500 to-orange-400 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-orange-500 transition-all duration-200 shadow-md hover:shadow-lg font-medium transform hover:scale-[1.02]"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center py-2 px-4 border-2 border-orange-300/50 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-orange-50 transition-all duration-200 bg-white/80"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-gray-700 font-medium">Continue with Google</span>
          </button>
        </form>

        {isLogin && (
          <div className="text-center mt-4">
            <a href="#" className="text-sm bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent hover:underline font-medium">
              Forgot password?
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
