'use client';

interface CategoryCardProps {
  category: {
    name: string;
    icon: string;
    color: string;
    serviceCount: number;
    activeServices: number;
    totalRevenue?: number;
  };
  onClick: () => void;
}

export default function CategoryCard({ category, onClick }: CategoryCardProps) {
  const getCategoryIcon = (categoryName: string) => {
    const icons: { [key: string]: string } = {
      'Plumber': '🔧',
      'Electrician': '⚡',
      'Carpenter': '🔨',
      'Cleaner': '✨',
      'Mechanic': '🔧',
      'AC Repair': '❄️',
      'Painter': '🎨',
      'Mason': '🧱',
      'Cook': '👨‍🍳',
      'Driver': '🚗',
      'Security': '🛡️',
      'Beautician': '💄',
      'Technician': '⚙️',
      'Delivery': '🚚',
      'Gardener': '🌱',
      'Workers': '👷',
    };
    return icons[categoryName] || '🔧';
  };

  const getCategoryColor = (categoryName: string) => {
    const colors: { [key: string]: string } = {
      'Plumber': 'from-blue-500 to-blue-600',
      'Electrician': 'from-yellow-500 to-orange-500',
      'Carpenter': 'from-amber-600 to-amber-700',
      'Cleaner': 'from-green-500 to-green-600',
      'Mechanic': 'from-gray-600 to-gray-700',
      'AC Repair': 'from-cyan-500 to-cyan-600',
      'Painter': 'from-pink-500 to-pink-600',
      'Mason': 'from-purple-500 to-purple-600',
      'Cook': 'from-orange-500 to-red-500',
      'Driver': 'from-indigo-500 to-indigo-600',
      'Security': 'from-red-500 to-red-600',
      'Beautician': 'from-rose-500 to-rose-600',
      'Technician': 'from-violet-500 to-violet-600',
      'Delivery': 'from-emerald-500 to-emerald-600',
      'Gardener': 'from-lime-500 to-lime-600',
      'Workers': 'from-slate-500 to-slate-600',
    };
    return colors[categoryName] || 'from-gray-500 to-gray-600';
  };

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-blue-50 rounded-xl transition-all duration-300 transform hover:shadow-lg border border-blue-100 overflow-hidden"
    >
      <div className="p-6 flex items-center justify-between">
        {/* Left: Icon */}
        <div className="flex-shrink-0 mr-4">
          <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center text-3xl">
            {getCategoryIcon(category.name)}
          </div>
        </div>

        {/* Center: Service Name and Availability */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{category.name}</h3>
          <p className="text-sm text-gray-600">
            {category.activeServices} service{category.activeServices !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Right: Active Services Count and Expand Indicator */}
        <div className="flex-shrink-0 ml-4 flex flex-col items-end">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {category.activeServices}
          </div>
          <div className="text-xs text-gray-500 mb-2">
            Active Services
          </div>
          <svg
            className="w-5 h-5 text-gray-400 transform group-hover:translate-y-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
