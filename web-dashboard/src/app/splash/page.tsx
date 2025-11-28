'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Curated collection of high-quality images: landscapes, mountains, animals, arts
const WALLPAPER_IMAGES = [
  // Landscapes & Mountains
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop&q=80',
  
  // Animals & Nature
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1920&h=1080&fit=crop&q=80',
  
  // Arts & Abstract
  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1920&h=1080&fit=crop&q=80',
  
  // Professional & Modern
  'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&q=80',
];

// Professional gradient color combinations - Light opacity for clean background visibility
const GRADIENT_SETS = [
  { from: 'from-indigo-900/20', via: 'via-purple-900/20', to: 'to-pink-900/20' },
  { from: 'from-blue-800/20', via: 'via-cyan-800/20', to: 'to-teal-800/20' },
  { from: 'from-violet-900/20', via: 'via-fuchsia-900/20', to: 'to-rose-900/20' },
  { from: 'from-emerald-900/20', via: 'via-teal-800/20', to: 'to-sky-900/20' },
  { from: 'from-amber-900/20', via: 'via-orange-800/20', to: 'to-red-900/20' },
  { from: 'from-slate-900/20', via: 'via-gray-800/20', to: 'to-zinc-900/20' },
];

export default function SplashPage() {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentGradientIndex, setCurrentGradientIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Randomly select image and gradient on mount
  useEffect(() => {
    const randomImageIndex = Math.floor(Math.random() * WALLPAPER_IMAGES.length);
    const randomGradientIndex = Math.floor(Math.random() * GRADIENT_SETS.length);
    setCurrentImageIndex(randomImageIndex);
    setCurrentGradientIndex(randomGradientIndex);
  }, []);

  // Redirect after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/auth');
    }, 3000); // Increased to 3 seconds to enjoy the beautiful splash
    return () => clearTimeout(timer);
  }, [router]);

  const currentImage = WALLPAPER_IMAGES[currentImageIndex];
  const currentGradient = GRADIENT_SETS[currentGradientIndex];

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Dynamic Background Image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{
          backgroundImage: `url(${currentImage})`,
          opacity: imageLoaded ? 1 : 0,
        }}
      >
        {/* Preload image */}
        <img
          src={currentImage}
          alt=""
          className="hidden"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)} // Fallback if image fails
        />
      </div>

      {/* Gradient Overlay - Light blur for clean background visibility */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br ${currentGradient.from} ${currentGradient.via} ${currentGradient.to} transition-all duration-1000`}
        style={{
          backdropFilter: 'blur(1px)',
          WebkitBackdropFilter: 'blur(1px)',
        }}
      />

      {/* Animated Shimmer Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        {/* Logo/Text Animation */}
        <div className="mb-8">
          <div className="flex justify-center space-x-1 mb-6">
            {['S', 'u', 'f', 'a', 'r'].map((letter, index) => (
              <span
                key={index}
                className="text-7xl md:text-8xl font-extrabold text-white drop-shadow-2xl animate-bounce"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  animationDuration: '0.8s',
                  textShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.3)',
                }}
              >
                {letter}
              </span>
            ))}
          </div>
          
          {/* Subtitle */}
          <p className="text-2xl md:text-3xl font-semibold text-white/95 drop-shadow-lg animate-fade-in-up">
            Admin Dashboard
          </p>
          
          {/* Loading Indicator */}
          <div className="mt-8 flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Particles Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

    </div>
  );
}