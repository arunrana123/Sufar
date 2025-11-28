'use client';

export default function AnimatedWorkers() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Plumber fixing pipe - Top Left Corner (Corner 1) */}
      <div className="absolute top-5 left-5" style={{ transform: 'scale(1.2)' }}>
        <svg width="180" height="200" viewBox="0 0 180 200" className="opacity-70">
          {/* Worker Body */}
          <circle cx="90" cy="50" r="20" fill="#4A90E2" />
          {/* Hard Hat */}
          <ellipse cx="90" cy="45" rx="22" ry="8" fill="#F5A623" />
          <rect x="75" y="40" width="30" height="8" rx="2" fill="#D97706" />
          {/* Body */}
          <rect x="75" y="60" width="30" height="50" rx="5" fill="#2563EB" />
          {/* Arms - Working Position */}
          <ellipse cx="105" cy="75" rx="15" ry="8" fill="#1E40AF" transform="rotate(45 105 75)" />
          <ellipse cx="75" cy="80" rx="12" ry="6" fill="#1E40AF" transform="rotate(-30 75 80)" />
          {/* Legs */}
          <rect x="78" y="105" width="8" height="35" rx="4" fill="#1E3A8A" />
          <rect x="94" y="105" width="8" height="35" rx="4" fill="#1E3A8A" />
          {/* Boots */}
          <ellipse cx="82" cy="140" rx="10" ry="6" fill="#1F2937" />
          <ellipse cx="98" cy="140" rx="10" ry="6" fill="#1F2937" />
          
          {/* Pipe System */}
          <rect x="120" y="70" width="50" height="8" fill="#94A3B8" />
          <rect x="165" y="60" width="8" height="20" fill="#64748B" />
          <circle cx="125" cy="74" r="6" fill="#475569" />
          
          {/* Wrench Tool - Animated */}
          <rect x="115" y="68" width="25" height="4" rx="2" fill="#6B7280" className="animate-tool-twist" transform="rotate(45 127 70)" />
          <rect x="135" y="65" width="8" height="10" rx="2" fill="#374151" />
          
          {/* Water Drops */}
          <circle cx="170" cy="80" r="3" fill="#60A5FA" className="animate-water-drop" />
          <circle cx="172" cy="85" r="2" fill="#60A5FA" className="animate-water-drop" style={{ animationDelay: '0.3s' }} />
        </svg>
      </div>

      {/* Mechanic working on car - Top Right Corner (Corner 2) */}
      <div className="absolute top-10 right-10" style={{ transform: 'scale(1.1)' }}>
        <svg width="250" height="180" viewBox="0 0 250 180" className="opacity-70">
          {/* Car Body */}
          <rect x="30" y="80" width="100" height="50" rx="8" fill="#EF4444" />
          <rect x="40" y="60" width="80" height="30" rx="8" fill="#DC2626" />
          <rect x="50" y="70" width="60" height="15" rx="3" fill="#1F2937" opacity="0.7" />
          {/* Car Wheels */}
          <circle cx="50" cy="130" r="12" fill="#111827" />
          <circle cx="50" cy="130" r="8" fill="#374151" />
          <circle cx="110" cy="130" r="12" fill="#111827" />
          <circle cx="110" cy="130" r="8" fill="#374151" />
          {/* Car Details */}
          <rect x="45" y="85" width="5" height="8" fill="#FBBF24" />
          <rect x="85" y="85" width="5" height="8" fill="#FBBF24" />
          
          {/* Mechanic Worker */}
          <circle cx="160" cy="50" r="18" fill="#F59E0B" />
          {/* Cap */}
          <ellipse cx="160" cy="45" rx="20" ry="6" fill="#92400E" />
          {/* Body */}
          <rect x="145" y="65" width="30" height="45" rx="5" fill="#D97706" />
          {/* Arms - Working Position */}
          <ellipse cx="175" cy="75" rx="18" ry="10" fill="#B45309" transform="rotate(60 175 75)" />
          <ellipse cx="145" cy="80" rx="15" ry="8" fill="#B45309" transform="rotate(-45 145 80)" />
          {/* Legs - Kneeling Position */}
          <ellipse cx="150" cy="110" rx="12" ry="8" fill="#78350F" transform="rotate(45 150 110)" />
          <ellipse cx="170" cy="115" rx="12" ry="8" fill="#78350F" transform="rotate(-30 170 115)" />
          {/* Boots */}
          <ellipse cx="148" cy="120" rx="8" ry="5" fill="#1F2937" />
          <ellipse cx="172" cy="125" rx="8" ry="5" fill="#1F2937" />
          
          {/* Tool Box */}
          <rect x="185" y="95" width="40" height="30" rx="3" fill="#374151" />
          <rect x="188" y="98" width="34" height="24" fill="#1F2937" />
          <circle cx="195" cy="108" r="2" fill="#6B7280" />
          <circle cx="210" cy="108" r="2" fill="#6B7280" />
          
          {/* Wrench Tool - Animated */}
          <line x1="175" y1="75" x2="195" y2="90" stroke="#4B5563" strokeWidth="5" className="animate-tool-swing" />
          <rect x="190" y="85" width="10" height="15" rx="2" fill="#374151" />
          
          {/* Sparks from work */}
          <circle cx="195" cy="90" r="4" fill="#FBBF24" className="animate-spark" />
          <circle cx="198" cy="88" r="3" fill="#F59E0B" className="animate-spark" style={{ animationDelay: '0.2s' }} />
        </svg>
      </div>

      {/* Carpenter with hammer - Bottom Right Corner (Corner 3) */}
      <div className="absolute bottom-10 right-10" style={{ transform: 'scale(1.3)' }}>
        <svg width="160" height="200" viewBox="0 0 160 200" className="opacity-70">
          {/* Worker Body */}
          <circle cx="80" cy="45" r="22" fill="#10B981" />
          {/* Safety Helmet */}
          <ellipse cx="80" cy="40" rx="25" ry="10" fill="#FFA500" />
          <rect x="60" y="35" width="40" height="10" rx="3" fill="#FF8C00" />
          {/* Body */}
          <rect x="65" y="65" width="30" height="55" rx="6" fill="#059669" />
          {/* Arms - Hammering Position */}
          <ellipse cx="95" cy="75" rx="20" ry="10" fill="#047857" transform="rotate(45 95 75)" />
          <ellipse cx="65" cy="85" rx="18" ry="8" fill="#047857" transform="rotate(-60 65 85)" />
          {/* Legs - Standing Position */}
          <rect x="68" y="115" width="10" height="40" rx="5" fill="#065F46" />
          <rect x="82" y="115" width="10" height="40" rx="5" fill="#065F46" />
          {/* Boots */}
          <ellipse cx="73" cy="155" rx="12" ry="7" fill="#1F2937" />
          <ellipse cx="87" cy="155" rx="12" ry="7" fill="#1F2937" />
          
          {/* Wood Board */}
          <rect x="105" y="70" width="50" height="15" rx="2" fill="#92400E" />
          <rect x="107" y="72" width="46" height="11" fill="#78350F" />
          
          {/* Hammer - Animated Striking */}
          <line x1="95" y1="75" x2="120" y2="75" stroke="#4B5563" strokeWidth="6" className="animate-hammer-strike" />
          <rect x="118" y="70" width="15" height="12" rx="2" fill="#374151" />
          <rect x="122" y="65" width="8" height="8" rx="1" fill="#1F2937" />
          
          {/* Wood Chips */}
          <path d="M 125 70 L 128 65 L 130 70 Z" fill="#A16207" className="animate-chip-fly" />
          <path d="M 130 72 L 133 67 L 135 72 Z" fill="#A16207" className="animate-chip-fly" style={{ animationDelay: '0.3s' }} />
        </svg>
      </div>

      {/* Electrician with wire - Bottom Left Corner (Corner 4) */}
      <div className="absolute bottom-10 left-10" style={{ transform: 'scale(1.2)' }}>
        <svg width="200" height="180" viewBox="0 0 200 180" className="opacity-70">
          {/* Worker Body */}
          <circle cx="100" cy="40" r="20" fill="#F59E0B" />
          {/* Hard Hat */}
          <ellipse cx="100" cy="35" rx="22" ry="8" fill="#FCD34D" />
          <rect x="85" y="30" width="30" height="10" rx="2" fill="#FBBF24" />
          {/* Body */}
          <rect x="85" y="55" width="30" height="50" rx="5" fill="#D97706" />
          {/* Arms - Working with Wires */}
          <ellipse cx="115" cy="70" rx="18" ry="10" fill="#B45309" transform="rotate(60 115 70)" />
          <ellipse cx="85" cy="75" rx="15" ry="8" fill="#B45309" transform="rotate(-45 85 75)" />
          {/* Legs */}
          <rect x="88" y="100" width="10" height="35" rx="5" fill="#78350F" />
          <rect x="102" y="100" width="10" height="35" rx="5" fill="#78350F" />
          {/* Boots */}
          <ellipse cx="93" cy="135" rx="10" ry="6" fill="#1F2937" />
          <ellipse cx="107" cy="135" rx="10" ry="6" fill="#1F2937" />
          
          {/* Electrical Panel */}
          <rect x="125" y="50" width="60" height="80" rx="5" fill="#1F2937" />
          <rect x="130" y="55" width="50" height="70" fill="#111827" />
          
          {/* Wires - Multiple Colors */}
          <path d="M 140 65 Q 155 60, 170 65 Q 185 70, 180 75" 
                stroke="#FCD34D" 
                strokeWidth="4" 
                fill="none"
                className="animate-wire-flicker" />
          <path d="M 145 80 Q 160 75, 175 80 Q 190 85, 185 90" 
                stroke="#60A5FA" 
                strokeWidth="4" 
                fill="none"
                className="animate-wire-flicker" 
                style={{ animationDelay: '0.2s' }} />
          <path d="M 140 95 Q 155 90, 170 95 Q 185 100, 180 105" 
                stroke="#34D399" 
                strokeWidth="4" 
                fill="none"
                className="animate-wire-flicker" 
                style={{ animationDelay: '0.4s' }} />
          
          {/* Sparks */}
          <circle cx="180" cy="105" r="5" fill="#FBBF24" className="animate-spark" />
          <circle cx="177" cy="108" r="4" fill="#FCD34D" className="animate-spark" style={{ animationDelay: '0.1s' }} />
          <circle cx="183" cy="102" r="3" fill="#F59E0B" className="animate-spark" style={{ animationDelay: '0.2s' }} />
          
          {/* Tool in hand */}
          <rect x="110" y="68" width="20" height="4" rx="2" fill="#6B7280" transform="rotate(45 120 70)" />
        </svg>
      </div>
    </div>
  );
}
