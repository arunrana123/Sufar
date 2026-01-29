'use client';

import { useState, useEffect } from 'react';

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  service: {
    _id?: string;
    title?: string;
    description?: string;
    price?: number;
    priceType?: 'hour' | 'per_foot' | 'fixed' | 'customize';
    category?: string;
    imageUrl?: string;
    parentCategory?: string;
    isMainCategory?: boolean;
  } | null;
}

interface ServiceFormData {
  title: string;
  description: string;
  price: number;
  priceType: 'hour' | 'per_foot' | 'fixed' | 'customize';
  category: string;
  imageUrl: string;
}

const categories = [
  'Plumber', 'Electrician', 'Carpenter', 'Cleaner', 'Mechanic', 
  'AC Repair', 'Painter', 'Mason', 'Cook', 'Driver', 'Security', 
  'Beautician', 'Technician', 'Delivery', 'Gardener', 'Workers'
];

const priceTypes = [
  { value: 'hour', label: 'Per Hour' },
  { value: 'per_foot', label: 'Per Foot' },
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'customize', label: 'Customize' }
];

export default function EditServiceModal({ isOpen, onClose, onSuccess, service }: EditServiceModalProps) {
  const [formData, setFormData] = useState<ServiceFormData>({
    title: '',
    description: '',
    price: 0,
    priceType: 'hour',
    category: '',
    imageUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormData, string>>>({});

  useEffect(() => {
    if (isOpen && service) {
      setFormData({
        title: service.title ?? '',
        description: service.description ?? '',
        price: service.price ?? 0,
        priceType: service.priceType ?? 'fixed',
        category: service.category ?? service.parentCategory ?? '',
        imageUrl: service.imageUrl || ''
      });
      setErrors({});
    }
  }, [isOpen, service]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ServiceFormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !validateForm()) return;

    setIsSubmitting(true);
    const isAddMode = !service._id;

    try {
      const body = {
        title: formData.title,
        description: formData.description,
        price: formData.price,
        priceType: formData.priceType,
        category: formData.category,
        imageUrl: formData.imageUrl || undefined,
        ...(isAddMode && {
          isMainCategory: false,
          parentCategory: formData.category,
          subCategory: formData.title,
          rating: 5,
          reviewCount: 0,
        }),
      };
      const url = isAddMode ? '/api/proxy/api/services' : `/api/proxy/api/services/${service._id}`;
      const response = await fetch(url, {
        method: isAddMode ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || errorData.message || (isAddMode ? 'Failed to add service.' : 'Failed to update service.'));
      }
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Failed to save service. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ServiceFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{service._id ? 'Edit Service' : 'Add Sub-Service'}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-2">
              Service Title *
            </label>
            <input
              type="text"
              id="edit-title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter service title"
              maxLength={100}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe the service in detail"
              maxLength={500}
            />
            <div className="flex justify-between mt-1">
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description}</p>
              )}
              <p className="text-sm text-gray-500 ml-auto">
                {formData.description.length}/500
              </p>
            </div>
          </div>

          {/* Category and Price Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                id="edit-category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.category ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-sm text-red-600">{errors.category}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-priceType" className="block text-sm font-medium text-gray-700 mb-2">
                Price Type *
              </label>
              <select
                id="edit-priceType"
                value={formData.priceType}
                onChange={(e) => handleInputChange('priceType', e.target.value as ServiceFormData['priceType'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {priceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price */}
          <div>
            <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-2">
              Price (Rs.) *
            </label>
            <input
              type="number"
              id="edit-price"
              value={formData.price || ''}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.price ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter price"
              min="0"
              step="0.01"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price}</p>
            )}
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="edit-imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Image URL (Optional)
            </label>
            <input
              type="url"
              id="edit-imageUrl"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange('imageUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{isSubmitting ? 'Updating...' : 'Update Service'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
