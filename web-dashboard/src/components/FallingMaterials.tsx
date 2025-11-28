'use client';

import { useState, useEffect } from 'react';

// Materials for each worker type - expanded with many different related materials
const WORKER_MATERIALS = [
  {
    type: 'Plumber',
    materials: [
      '🔧', '🔩', '⚙️', '🪠', '💧', '🔧', '🔩', '⚙️', '🪠', '💧',
      '🔧', '🔩', '⚙️', '🪠', '💧', '🔧', '🔩', '⚙️', '🪠', '💧',
      '🔧', '🔩', '⚙️', '🪠', '💧', '🔧', '🔩', '⚙️', '🪠', '💧',
      
      // Additional different materials
      '🪣', '🧰', '🔌', '📏', '📐', '🪣', '🧰', '🔌', '📏', '📐',
      '🪣', '🧰', '🔌', '📏', '📐', '🪣', '🧰', '🔌', '📏', '📐',
      '🪣', '🧰', '🔌', '📏', '📐', '🪣', '🧰', '🔌', '📏', '📐',
     
    ],
    colors: ['#3B82F6', '#2563EB', '#1D4ED8', '#60A5FA', '#93C5FD']
  },
  {
    type: 'Painter',
    materials: [
      '🎨', '🖌️', '🖼️', '🖊️', '🖍️', '🎨', '🖌️', '🖼️', '🖊️', '🖍️',
      '🎨', '🖌️', '🖼️', '🖊️', '🖍️', '🎨', '🖌️', '🖼️', '🖊️', '🖍️',
      '🎨', '🖌️', '🖼️', '🖊️', '🖍️', '🎨', '🖌️', '🖼️', '🖊️', '🖍️',
    
      // Additional different materials
      '🖨️', '📝', '📄', '📋', '✏️', '🖨️', '📝', '📄', '📋', '✏️',
      '🖨️', '📝', '📄', '📋', '✏️', '🖨️', '📝', '📄', '📋', '✏️',
      '🖨️', '📝', '📄', '📋', '✏️', '🖨️', '📝', '📄', '📋', '✏️',
      
    ],
    colors: ['#A855F7', '#9333EA', '#7C3AED', '#C084FC', '#D8B4FE']
  },
  {
    type: 'Carpenter',
    materials: [
      '🔨', '🪚', '🪓', '🔩', '⚙️', '🔨', '🪚', '🪓', '🔩', '⚙️',
      '🔨', '🪚', '🪓', '🔩', '⚙️', '🔨', '🪚', '🪓', '🔩', '⚙️',
      '🔨', '🪚', '🪓', '🔩', '⚙️', '🔨', '🪚', '🪓', '🔩', '⚙️',
     
      // Additional different materials
      '🧰', '📐', '📏', '🔧', '🛠️', '🧰', '📐', '📏', '🔧', '🛠️',
      '🧰', '📐', '📏', '🔧', '🛠️', '🧰', '📐', '📏', '🔧', '🛠️',
      '🧰', '📐', '📏', '🔧', '🛠️', '🧰', '📐', '📏', '🔧', '🛠️',
     
    ],
    colors: ['#F59E0B', '#D97706', '#B45309', '#FBBF24', '#FCD34D']
  },
  {
    type: 'Electrician',
    materials: [
      '⚡', '💡', '🔌', '🔋', '📡', '⚡', '💡', '🔌', '🔋', '📡',
      '⚡', '💡', '🔌', '🔋', '📡', '⚡', '💡', '🔌', '🔋', '📡',
      '⚡', '💡', '🔌', '🔋', '📡', '⚡', '💡', '🔌', '🔋', '📡',
 
      // Additional different materials
      '📱', '💻', '🖥️', '⌨️', '🖱️', '📱', '💻', '🖥️', '⌨️', '🖱️',
      '📱', '💻', '🖥️', '⌨️', '🖱️', '📱', '💻', '🖥️', '⌨️', '🖱️',
      '📱', '💻', '🖥️', '⌨️', '🖱️', '📱', '💻', '🖥️', '⌨️', '🖱️',
    
    ],
    colors: ['#FCD34D', '#FBBF24', '#F59E0B', '#FDE047', '#FEF3C7']
  },
  {
    type: 'Cleaner',
    materials: [
      '✨', '🧹', '🧽', '🧴', '💧', '✨', '🧹', '🧽', '🧴', '💧',
      '✨', '🧹', '🧽', '🧴', '💧', '✨', '🧹', '🧽', '🧴', '💧',
      '✨', '🧹', '🧽', '🧴', '💧', '✨', '🧹', '🧽', '🧴', '💧',
      
      // Additional different materials
      '🧺', '🧼', '🧻', '🧾', '🪣', '🧺', '🧼', '🧻', '🧾', '🪣',
      '🧺', '🧼', '🧻', '🧾', '🪣', '🧺', '🧼', '🧻', '🧾', '🪣',
      '🧺', '🧼', '🧻', '🧾', '🪣', '🧺', '🧼', '🧻', '🧾', '🪣',
    
    ],
    colors: ['#10B981', '#059669', '#047857', '#34D399', '#6EE7B7']
  },
  {
    type: 'Mechanic',
    materials: [
      '🔩', '🔧', '⚙️', '🛠️', '🔨', '🔩', '🔧', '⚙️', '🛠️', '🔨',
      '🔩', '🔧', '⚙️', '🛠️', '🔨', '🔩', '🔧', '⚙️', '🛠️', '🔨',
      '🔩', '🔧', '⚙️', '🛠️', '🔨', '🔩', '🔧', '⚙️', '🛠️', '🔨',
     
      // Additional different materials
      '🧰', '🔋', '⛽', '🛢️', '📏', '🧰', '🔋', '⛽', '🛢️', '📏',
      '🧰', '🔋', '⛽', '🛢️', '📏', '🧰', '🔋', '⛽', '🛢️', '📏',
      '🧰', '🔋', '⛽', '🛢️', '📏', '🧰', '🔋', '⛽', '🛢️', '📏',
      
    ],
    colors: ['#EF4444', '#DC2626', '#B91C1C', '#F87171', '#FCA5A5']
  },
];

interface Material {
  id: number;
  emoji: string;
  startX: number;
  startDelay: number;
  color: string;
  scatterX: number;
  scatterY: number;
}

export default function FallingMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [workerTypeIndex, setWorkerTypeIndex] = useState<number | null>(null);

  // Cycle through worker types on each page load
  useEffect(() => {
    // Get random worker type or cycle through them
    const storedIndex = sessionStorage.getItem('materialWorkerIndex');
    let index = storedIndex ? (parseInt(storedIndex) + 1) % WORKER_MATERIALS.length : 0;
    sessionStorage.setItem('materialWorkerIndex', index.toString());
    setWorkerTypeIndex(index);
  }, []);

  // Generate materials when worker type is set
  useEffect(() => {
    if (workerTypeIndex === null) return;

    const workerData = WORKER_MATERIALS[workerTypeIndex];
    // Create multiple instances of materials for more density
    const allMaterials: Material[] = [];
    let materialId = 0;

    // Generate 50 materials with random variations
    for (let i = 0; i < 50; i++) {
      const emojiIndex = i % workerData.materials.length;
      const emoji = workerData.materials[emojiIndex];
      
      // Create single copy with variations
      allMaterials.push({
        id: materialId++,
        emoji,
        startX: Math.random() * 100, // Random starting X position (0-100%)
        startDelay: Math.random() * 4, // Random delay (0-4s) for spread
        color: workerData.colors[Math.floor(Math.random() * workerData.colors.length)],
        scatterX: (Math.random() - 0.5) * 300, // Scatter X direction (-150 to 150px)
        scatterY: 100 + Math.random() * 300, // Scatter Y direction (100-400px down)
      });
    }

    setMaterials(allMaterials);
  }, [workerTypeIndex]);

  if (workerTypeIndex === null || materials.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {materials.map((material) => (
        <div
          key={material.id}
          className="absolute text-4xl material-fall"
          style={{
            left: `${material.startX}%`,
            top: '-10%',
            animationDelay: `${material.startDelay}s`,
            '--scatter-x': `${material.scatterX}px`,
            '--scatter-y': `${material.scatterY}px`,
            '--material-color': material.color,
          } as React.CSSProperties & {
            '--scatter-x': string;
            '--scatter-y': string;
            '--material-color': string;
          }}
        >
          {material.emoji}
        </div>
      ))}
    </div>
  );
}

