'use client';

import { useState } from 'react';

interface Service {
  _id: string;
  title: string;
  description: string;
  price: number;
  priceType: 'hour' | 'per_foot' | 'fixed' | 'customize';
  category: string;
  subCategory?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  imageUrl?: string;
  isMainCategory?: boolean;
  parentCategory?: string;
  createdAt: string;
  updatedAt: string;
}

interface HierarchicalServiceCardProps {
  category: string;
  mainService: Service | null;
  subServices: Service[];
  onEditService: (service: Service) => void;
  onToggleStatus: (serviceId: string) => void;
  onDeleteService: (serviceId: string) => void;
  onAddSubService: (category: string) => void;
}

export default function HierarchicalServiceCard({ 
  category, 
  mainService, 
  subServices, 
  onEditService, 
  onToggleStatus, 
  onDeleteService,
  onAddSubService 
}: HierarchicalServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const formatPrice = (price: number, priceType: string) => {
    switch (priceType) {
      case 'hour':
        return `$${price}/hour`;
      case 'per_foot':
        return `$${price}/ft`;
      case 'fixed':
        return `$${price}`;
      case 'customize':
        return 'Custom Quote';
      default:
        return `$${price}`;
    }
  };

  return (
    <div className="bg-orange-50 rounded-xl border border-orange-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
      {/* Category Header */}
      <div 
        className={`h-24 bg-gradient-to-r ${getCategoryColor(category)} relative overflow-hidden cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="absolute inset-0 bg-blue-200 bg-opacity-20"></div>
        <div className="relative p-6 h-full flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl">
              {getCategoryIcon(category)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-black">{category}</h3>
              <p className="text-black text-opacity-90 text-sm">
                {subServices.length} service{subServices.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-black">
              {subServices.filter(s => s.isActive).length}
            </div>
            <div className="text-black text-opacity-90 text-xs">
              Active Services
            </div>
            <div className="mt-2">
              <svg
                className={`w-5 h-5 text-black transform transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Service (if exists) */}
      {mainService && (
        <div className="p-4 bg-white border-b border-orange-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{mainService.title}</h4>
              <p className="text-sm text-gray-600">{mainService.description}</p>
              <p className="text-lg font-bold text-blue-600 mt-1">
                {formatPrice(mainService.price, mainService.priceType)}
              </p>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <span className={`px-2 py-1 text-xs rounded-full ${
                mainService.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {mainService.isActive ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => onEditService(mainService)}
                className="p-1 text-blue-600 hover:text-blue-800"
              >
                ✏️
              </button>
              <button
                onClick={() => onToggleStatus(mainService._id)}
                className="p-1 text-yellow-600 hover:text-yellow-800"
              >
                {mainService.isActive ? '⏸️' : '▶️'}
              </button>
              <button
                onClick={() => onDeleteService(mainService._id)}
                className="p-1 text-red-600 hover:text-red-800"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub Services */}
      {isExpanded && (
        <div className="bg-white">
          <div className="p-4 border-b border-orange-200 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Sub Services</h4>
            <button
              onClick={() => onAddSubService(category)}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              + Add Sub Service
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {subServices.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No sub-services available. Click "Add Sub Service" to create one.
              </div>
            ) : (
              subServices.map((service) => (
                <div key={service._id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{service.title}</h5>
                      <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <p className="text-sm font-semibold text-blue-600">
                          {formatPrice(service.price, service.priceType)}
                        </p>
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-sm text-gray-600">{service.rating}</span>
                          <span className="text-sm text-gray-500">({service.reviewCount})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => onEditService(service)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onToggleStatus(service._id)}
                        className="p-1 text-yellow-600 hover:text-yellow-800"
                      >
                        {service.isActive ? '⏸️' : '▶️'}
                      </button>
                      <button
                        onClick={() => onDeleteService(service._id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
