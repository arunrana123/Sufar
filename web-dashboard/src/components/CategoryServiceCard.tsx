'use client';

interface CategoryServiceCardProps {
  service: {
    _id: string;
    title: string;
    description: string;
    price: number;
    priceType: string;
    category: string;
    rating: number;
    reviewCount: number;
    isActive: boolean;
    imageUrl?: string;
    createdAt: string;
  };
  onEdit?: (service: any) => void;
  onDelete?: (serviceId: string) => void;
  onToggleStatus?: (serviceId: string) => void;
}

export default function CategoryServiceCard({ 
  service, 
  onEdit, 
  onDelete, 
  onToggleStatus 
}: CategoryServiceCardProps) {
  const formatPrice = (price: number, priceType: string) => {
    switch (priceType) {
      case 'hour':
        return `Rs. ${price}/Hour`;
      case 'per_foot':
        return `Rs. ${price}/fit`;
      case 'customize':
        return `Rs. ${price}/Customise`;
      default:
        return `Rs. ${price}`;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Plumber': 'bg-blue-100 text-blue-800 border-blue-200',
      'Electrician': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Carpenter': 'bg-amber-100 text-amber-800 border-amber-200',
      'Cleaner': 'bg-green-100 text-green-800 border-green-200',
      'Mechanic': 'bg-gray-100 text-gray-800 border-gray-200',
      'AC Repair': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'Painter': 'bg-pink-100 text-pink-800 border-pink-200',
      'Mason': 'bg-purple-100 text-purple-800 border-purple-200',
      'Cook': 'bg-orange-100 text-orange-800 border-orange-200',
      'Driver': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Security': 'bg-red-100 text-red-800 border-red-200',
      'Beautician': 'bg-rose-100 text-rose-800 border-rose-200',
      'Technician': 'bg-violet-100 text-violet-800 border-violet-200',
      'Delivery': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Gardener': 'bg-lime-100 text-lime-800 border-lime-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div 
      className="bg-orange-50 rounded-lg transition-all duration-200 border border-orange-200 group hover:shadow-lg" 
      style={{
        boxShadow: '0 4px 6px -1px rgba(251, 146, 60, 0.1), 0 2px 4px -1px rgba(251, 146, 60, 0.06)',
        '--tw-shadow-colored': '0 10px 15px -3px rgba(251, 146, 60, 0.2), 0 4px 6px -2px rgba(251, 146, 60, 0.1)'
      } as React.CSSProperties}
    >
      {/* Service Image */}
      <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-t-lg relative overflow-hidden">
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-4xl text-gray-400">
              {service.category === 'Plumber' && '🔧'}
              {service.category === 'Electrician' && '⚡'}
              {service.category === 'Carpenter' && '🔨'}
              {service.category === 'Cleaner' && '✨'}
              {service.category === 'Mechanic' && '🔧'}
              {service.category === 'AC Repair' && '❄️'}
              {service.category === 'Painter' && '🎨'}
              {service.category === 'Mason' && '🧱'}
              {service.category === 'Cook' && '👨‍🍳'}
              {service.category === 'Driver' && '🚗'}
              {service.category === 'Security' && '🛡️'}
              {service.category === 'Beautician' && '💄'}
              {service.category === 'Technician' && '⚙️'}
              {service.category === 'Delivery' && '🚚'}
              {service.category === 'Gardener' && '🌱'}
              {!['Plumber', 'Electrician', 'Carpenter', 'Cleaner', 'Mechanic', 'AC Repair', 'Painter', 'Mason', 'Cook', 'Driver', 'Security', 'Beautician', 'Technician', 'Delivery', 'Gardener'].includes(service.category) && '🔧'}
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            service.isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {service.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Service Content */}
      <div className="p-4 bg-white">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
          {service.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {service.description}
        </p>

        {/* Price */}
        <div className="mb-3">
          <span className="text-xl font-bold text-blue-600">
            {formatPrice(service.price, service.priceType)}
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center mb-4">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`text-sm ${
                  i < Math.floor(service.rating) ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <span className="ml-2 text-sm text-gray-600">
            {service.rating} ({service.reviewCount} reviews)
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(service)}
              className="flex-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
            >
              Edit
            </button>
          )}
          
          {onToggleStatus && (
            <button
              onClick={() => onToggleStatus(service._id)}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                service.isActive
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {service.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={() => onDelete(service._id)}
              className="flex-1 px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
            >
              Delete
            </button>
          )}
        </div>

        {/* Created Date */}
        <div className="mt-3 pt-3 border-t border-orange-200">
          <p className="text-xs text-orange-600">
            Created: {new Date(service.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
