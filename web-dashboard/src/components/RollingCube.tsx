'use client';

import { useState } from 'react';

interface RollingCubeProps {
  onCubeClick?: () => void;
}

// Worker types with realistic big icons and colors
const WORKER_FACES = [
  { 
    type: 'Plumber', 
    icon: '🔧',
    gradient: 'from-blue-500/80 to-cyan-500/80',
    name: 'Plumber'
  },
  { 
    type: 'Carpenter', 
    icon: '🔨',
    gradient: 'from-amber-500/80 to-orange-500/80',
    name: 'Carpenter'
  },
  { 
    type: 'Mechanic', 
    icon: '🔩',
    gradient: 'from-red-500/80 to-pink-500/80',
    name: 'Mechanic'
  },
  { 
    type: 'Electrician', 
    icon: '⚡',
    gradient: 'from-yellow-500/80 to-amber-500/80',
    name: 'Electrician'
  },
  { 
    type: 'Cleaner', 
    icon: '✨',
    gradient: 'from-green-500/80 to-emerald-500/80',
    name: 'Cleaner'
  },
  { 
    type: 'Painter', 
    icon: '🎨',
    gradient: 'from-purple-500/80 to-indigo-500/80',
    name: 'Painter'
  },
];

export default function RollingCube({ onCubeClick }: RollingCubeProps) {
  const [animationState, setAnimationState] = useState<'idle' | 'dropping' | 'bouncing' | 'rising'>('idle');

  // Fixed position in left corner (top left)
  const position = { x: 5, y: 10 };

  const handleClick = () => {
    if (animationState !== 'idle') return; // Prevent multiple clicks during animation
    
    setAnimationState('dropping');
    if (onCubeClick) onCubeClick();
    
    // Drop (0.8s) -> Bounce (0.3s) -> Rise (1.2s) -> Return to idle
    setTimeout(() => {
      setAnimationState('bouncing');
    }, 800);
    
    setTimeout(() => {
      setAnimationState('rising');
    }, 1100);
    
    setTimeout(() => {
      setAnimationState('idle');
    }, 2300);
  };

  const getContainerAnimationClass = () => {
    if (animationState === 'idle') return 'animate-cube-float';
    if (animationState === 'dropping') return 'animate-cube-drop animate-cube-move-horizontal';
    if (animationState === 'bouncing') return 'animate-cube-bounce animate-cube-move-horizontal';
    if (animationState === 'rising') return 'animate-cube-rise animate-cube-move-horizontal';
    return 'animate-cube-float';
  };

  const getRotationAnimationClass = () => {
    if (animationState === 'idle') return 'animate-cube-roll';
    return 'animate-cube-slow-roll';
  };

  return (
    <div
      className={`absolute z-0 cursor-pointer ${getContainerAnimationClass()}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        perspective: '1000px',
      }}
      onClick={handleClick}
    >
      <div
        className={`relative ${getRotationAnimationClass()}`}
        style={{
          transformStyle: 'preserve-3d',
          width: '120px',
          height: '120px',
        }}
      >
        {/* Front Face - Plumber */}
        <div
          className={`absolute w-full h-full rounded-2xl border-3 border-white/90 bg-gradient-to-br ${WORKER_FACES[0].gradient} flex flex-col items-center justify-center shadow-lg`}
          style={{
            transform: 'translateZ(60px)',
          }}
        >
          <span className="text-6xl mb-2 drop-shadow-2xl filter brightness-110">{WORKER_FACES[0].icon}</span>
          <span className="text-white text-xs font-bold drop-shadow-lg">{WORKER_FACES[0].name}</span>
        </div>
        
        {/* Back Face - Carpenter */}
        <div
          className={`absolute w-full h-full rounded-2xl border-3 border-white/90 bg-gradient-to-br ${WORKER_FACES[1].gradient} flex flex-col items-center justify-center shadow-lg`}
          style={{
            transform: 'translateZ(-60px) rotateY(180deg)',
          }}
        >
          <span className="text-6xl mb-2 drop-shadow-2xl filter brightness-110">{WORKER_FACES[1].icon}</span>
          <span className="text-white text-xs font-bold drop-shadow-lg">{WORKER_FACES[1].name}</span>
        </div>
        
        {/* Right Face - Mechanic */}
        <div
          className={`absolute w-full h-full rounded-2xl border-3 border-white/90 bg-gradient-to-br ${WORKER_FACES[2].gradient} flex flex-col items-center justify-center shadow-lg`}
          style={{
            transform: 'rotateY(90deg) translateZ(60px)',
          }}
        >
          <span className="text-6xl mb-2 drop-shadow-2xl filter brightness-110">{WORKER_FACES[2].icon}</span>
          <span className="text-white text-xs font-bold drop-shadow-lg">{WORKER_FACES[2].name}</span>
        </div>
        
        {/* Left Face - Electrician */}
        <div
          className={`absolute w-full h-full rounded-2xl border-3 border-white/90 bg-gradient-to-br ${WORKER_FACES[3].gradient} flex flex-col items-center justify-center shadow-lg`}
          style={{
            transform: 'rotateY(-90deg) translateZ(60px)',
          }}
        >
          <span className="text-6xl mb-2 drop-shadow-2xl filter brightness-110">{WORKER_FACES[3].icon}</span>
          <span className="text-white text-xs font-bold drop-shadow-lg">{WORKER_FACES[3].name}</span>
        </div>
        
        {/* Top Face - Cleaner */}
        <div
          className={`absolute w-full h-full rounded-2xl border-3 border-white/90 bg-gradient-to-br ${WORKER_FACES[4].gradient} flex flex-col items-center justify-center shadow-lg`}
          style={{
            transform: 'rotateX(90deg) translateZ(60px)',
          }}
        >
          <span className="text-6xl mb-2 drop-shadow-2xl filter brightness-110">{WORKER_FACES[4].icon}</span>
          <span className="text-white text-xs font-bold drop-shadow-lg">{WORKER_FACES[4].name}</span>
        </div>
        
        {/* Bottom Face - Painter */}
        <div
          className={`absolute w-full h-full rounded-2xl border-3 border-white/90 bg-gradient-to-br ${WORKER_FACES[5].gradient} flex flex-col items-center justify-center shadow-lg`}
          style={{
            transform: 'rotateX(-90deg) translateZ(60px)',
          }}
        >
          <span className="text-6xl mb-2 drop-shadow-2xl filter brightness-110">{WORKER_FACES[5].icon}</span>
          <span className="text-white text-xs font-bold drop-shadow-lg">{WORKER_FACES[5].name}</span>
        </div>
      </div>
    </div>
  );
}

