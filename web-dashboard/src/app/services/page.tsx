'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../../components/SidebarLayout';
import FloatingActionButton from '../../components/FloatingActionButton';
import ServiceFormModal from '../../components/ServiceFormModal';
import EditServiceModal from '../../components/EditServiceModal';
import ServiceCard from '../../components/ServiceCard';
import CategoryCard from '../../components/CategoryCard';
import CategoryServiceCard from '../../components/CategoryServiceCard';
import { socketService } from '../../lib/socketService';

type Service = {
  _id: string;
  title: string;
  description: string;
  price: number;
  priceType: string;
  category: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
  imageUrl?: string;
  subCategory?: string;
  isMainCategory?: boolean;
  parentCategory?: string;
};

type HierarchicalService = {
  category: string;
  mainService: Service | null;
  subServices: Service[];
};

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [hierarchicalServices, setHierarchicalServices] = useState<HierarchicalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'grid' | 'table'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/auth');
      return;
    }

    try {
      const parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
    } catch {
      router.push('/auth');
      return;
    }

    fetchServices();
  }, [router]);

  // Separate useEffect for Socket.IO connection (after admin is set)
  useEffect(() => {
    if (!admin) return;

    // Connect to Socket.IO for real-time updates
    const adminId = admin._id || admin.id || 'admin-' + Date.now();
    console.log('🔌 Connecting Socket.IO for admin:', adminId);
    socketService.connect(adminId, 'admin');
    
    // Wait a bit for connection to establish before registering listeners
    const connectTimeout = setTimeout(() => {
      // Listen for service updates
      const handleServiceUpdated = (updatedService: any) => {
        console.log('📢 Service update received in web dashboard:', updatedService);
        updateServiceInHierarchy(updatedService);
      };

      const handleServiceCreated = (newService: any) => {
        console.log('📢 New service created:', newService);
        // Refresh to get updated hierarchy
        fetchServices();
      };

      const handleServiceDeleted = (serviceId: string) => {
        console.log('📢 Service deleted:', serviceId);
        // Remove from hierarchy
        setHierarchicalServices(prev => 
          prev.map(hierarchy => {
            // Remove from main service if it matches
            if (hierarchy.mainService?._id === serviceId) {
              return {
                ...hierarchy,
                mainService: null
              };
            }
            // Remove from sub-services
            return {
              ...hierarchy,
              subServices: hierarchy.subServices.filter(s => s._id !== serviceId)
            };
          })
        );
        // Remove from flat list
        setServices(prev => prev.filter(service => service._id !== serviceId));
      };

      socketService.on('service:updated', handleServiceUpdated);
      socketService.on('service:created', handleServiceCreated);
      socketService.on('service:deleted', handleServiceDeleted);
      
      console.log('✅ Socket.IO listeners registered for service events');
      
      // Store handlers for cleanup
      (socketService as any)._handlers = {
        updated: handleServiceUpdated,
        created: handleServiceCreated,
        deleted: handleServiceDeleted,
      };
    }, 1000);

    return () => {
      clearTimeout(connectTimeout);
      const handlers = (socketService as any)?._handlers;
      if (handlers) {
        socketService.off('service:updated', handlers.updated);
        socketService.off('service:created', handlers.created);
        socketService.off('service:deleted', handlers.deleted);
      }
    };
  }, [admin]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Fetch hierarchical services to match frontend
      const res = await fetch('/api/services/hierarchy/all');
      
      if (res.ok) {
        const hierarchicalData = await res.json();
        setHierarchicalServices(hierarchicalData);
        
        // Also flatten services for compatibility
        const flatServices: Service[] = [];
        hierarchicalData.forEach((hierarchy: HierarchicalService) => {
          if (hierarchy.mainService) {
            flatServices.push(hierarchy.mainService);
          }
          flatServices.push(...hierarchy.subServices);
        });
        setServices(flatServices);
        console.log('✅ Hierarchical services fetched from backend:', hierarchicalData.length, 'categories');
        console.log('✅ Total services:', flatServices.length);
      } else {
        console.warn('⚠️ Backend sync failed, using fallback');
        setHierarchicalServices([]);
        setServices([]);
      }
    } catch (error) {
      console.error('❌ Error fetching services:', error);
      setHierarchicalServices([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // Update service in hierarchical structure
  const updateServiceInHierarchy = (updatedService: Service) => {
    setHierarchicalServices(prev => {
      return prev.map(hierarchy => {
        // Update main service if it matches
        if (hierarchy.mainService?._id === updatedService._id) {
          return {
            ...hierarchy,
            mainService: { ...hierarchy.mainService, ...updatedService }
          };
        }
        
        // Update sub-services
        const updatedSubServices = hierarchy.subServices.map(subService =>
          subService._id === updatedService._id
            ? { ...subService, ...updatedService }
            : subService
        );
        
        return {
          ...hierarchy,
          subServices: updatedSubServices
        };
      });
    });
    
    // Also update flat services list
    setServices(prev => 
      prev.map(service => 
        service._id === updatedService._id 
          ? { ...service, ...updatedService }
          : service
      )
    );
    
    console.log(`✅ Service updated in real-time: ${updatedService.title} (Price: ${updatedService.price})`);
  };

  // Fallback mock data (kept for reference but not used)
  const getMockServices = (): Service[] => {
    return [
        // Plumber Services (6 services)
        {
          _id: '1',
          title: 'Waste pipe leakage repair',
          description: 'Professional repair of waste pipe leaks with quality materials',
          price: 450,
          priceType: 'hour',
          category: 'Plumber',
          rating: 5,
          reviewCount: 4,
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          _id: '2',
          title: 'Drinking water pipe installation',
          description: 'Complete drinking water pipe installation and maintenance',
          price: 600,
          priceType: 'hour',
          category: 'Plumber',
          rating: 5,
          reviewCount: 8,
          isActive: true,
          createdAt: '2024-01-16T10:00:00Z',
        },
        {
          _id: '3',
          title: 'Bathroom plumbing repair',
          description: 'Expert bathroom plumbing repair and maintenance services',
          price: 350,
          priceType: 'hour',
          category: 'Plumber',
          rating: 5,
          reviewCount: 12,
          isActive: true,
          createdAt: '2024-01-17T10:00:00Z',
        },
        {
          _id: '4',
          title: 'Kitchen sink installation',
          description: 'Professional kitchen sink installation and setup',
          price: 500,
          priceType: 'fixed',
          category: 'Plumber',
          rating: 5,
          reviewCount: 6,
          isActive: true,
          createdAt: '2024-01-18T10:00:00Z',
        },
        {
          _id: '5',
          title: 'Water heater repair',
          description: 'Complete water heater repair and maintenance services',
          price: 800,
          priceType: 'hour',
          category: 'Plumber',
          rating: 5,
          reviewCount: 10,
          isActive: true,
          createdAt: '2024-01-19T10:00:00Z',
        },
        {
          _id: '6',
          title: 'Drain cleaning service',
          description: 'Professional drain cleaning and unclogging services',
          price: 200,
          priceType: 'fixed',
          category: 'Plumber',
          rating: 5,
          reviewCount: 15,
          isActive: true,
          createdAt: '2024-01-20T10:00:00Z',
        },
        
        // Electrician Services (5 services)
        {
          _id: '7',
          title: 'House electrical wiring',
          description: 'Complete electrical wiring installation for residential properties',
          price: 800,
          priceType: 'hour',
          category: 'Electrician',
          rating: 5,
          reviewCount: 12,
          isActive: true,
          createdAt: '2024-01-10T10:00:00Z',
        },
        {
          _id: '8',
          title: 'Circuit breaker installation',
          description: 'Professional circuit breaker installation and maintenance',
          price: 400,
          priceType: 'fixed',
          category: 'Electrician',
          rating: 5,
          reviewCount: 8,
          isActive: true,
          createdAt: '2024-01-11T10:00:00Z',
        },
        {
          _id: '9',
          title: 'Light fixture installation',
          description: 'Expert light fixture installation and repair services',
          price: 300,
          priceType: 'hour',
          category: 'Electrician',
          rating: 5,
          reviewCount: 20,
          isActive: true,
          createdAt: '2024-01-12T10:00:00Z',
        },
        {
          _id: '10',
          title: 'Electrical outlet repair',
          description: 'Professional electrical outlet repair and replacement',
          price: 150,
          priceType: 'fixed',
          category: 'Electrician',
          rating: 5,
          reviewCount: 25,
          isActive: true,
          createdAt: '2024-01-13T10:00:00Z',
        },
        {
          _id: '11',
          title: 'Generator installation',
          description: 'Complete generator installation and setup services',
          price: 1200,
          priceType: 'fixed',
          category: 'Electrician',
          rating: 5,
          reviewCount: 5,
          isActive: true,
          createdAt: '2024-01-14T10:00:00Z',
        },
        
        // Cleaner Services (4 services)
        {
          _id: '12',
          title: 'Complete house cleaning',
          description: 'Thorough house cleaning service for all rooms',
          price: 800,
          priceType: 'hour',
          category: 'Cleaner',
          rating: 5,
          reviewCount: 30,
          isActive: true,
          createdAt: '2024-01-25T10:00:00Z',
        },
        {
          _id: '13',
          title: 'Office cleaning service',
          description: 'Professional office cleaning and maintenance',
          price: 600,
          priceType: 'hour',
          category: 'Cleaner',
          rating: 5,
          reviewCount: 18,
          isActive: true,
          createdAt: '2024-01-26T10:00:00Z',
        },
        {
          _id: '14',
          title: 'Carpet cleaning',
          description: 'Deep carpet cleaning and stain removal services',
          price: 400,
          priceType: 'hour',
          category: 'Cleaner',
          rating: 5,
          reviewCount: 22,
          isActive: true,
          createdAt: '2024-01-27T10:00:00Z',
        },
        {
          _id: '15',
          title: 'Window cleaning',
          description: 'Professional window cleaning for residential and commercial',
          price: 250,
          priceType: 'hour',
          category: 'Cleaner',
          rating: 5,
          reviewCount: 14,
          isActive: true,
          createdAt: '2024-01-28T10:00:00Z',
        },
        
        // Mechanic Services (4 services)
        {
          _id: '16',
          title: 'Engine repair and maintenance',
          description: 'Professional engine repair and maintenance services',
          price: 1000,
          priceType: 'hour',
          category: 'Mechanic',
          rating: 5,
          reviewCount: 20,
          isActive: true,
          createdAt: '2024-01-05T10:00:00Z',
        },
        {
          _id: '17',
          title: 'Brake service and repair',
          description: 'Complete brake system service and repair',
          price: 500,
          priceType: 'fixed',
          category: 'Mechanic',
          rating: 5,
          reviewCount: 16,
          isActive: true,
          createdAt: '2024-01-06T10:00:00Z',
        },
        {
          _id: '18',
          title: 'Oil change service',
          description: 'Professional oil change and filter replacement',
          price: 150,
          priceType: 'fixed',
          category: 'Mechanic',
          rating: 5,
          reviewCount: 35,
          isActive: true,
          createdAt: '2024-01-07T10:00:00Z',
        },
        {
          _id: '19',
          title: 'Tire replacement',
          description: 'Complete tire replacement and balancing service',
          price: 300,
          priceType: 'fixed',
          category: 'Mechanic',
          rating: 5,
          reviewCount: 12,
          isActive: true,
          createdAt: '2024-01-08T10:00:00Z',
        },
        
        // AC Repair Services (3 services)
        {
          _id: '20',
          title: 'AC installation and setup',
          description: 'Professional AC installation with proper setup and testing',
          price: 2500,
          priceType: 'fixed',
          category: 'AC Repair',
          rating: 5,
          reviewCount: 12,
          isActive: true,
          createdAt: '2024-01-12T10:00:00Z',
        },
        {
          _id: '21',
          title: 'AC repair and maintenance',
          description: 'Complete AC repair and regular maintenance services',
          price: 400,
          priceType: 'hour',
          category: 'AC Repair',
          rating: 5,
          reviewCount: 18,
          isActive: true,
          createdAt: '2024-01-13T10:00:00Z',
        },
        {
          _id: '22',
          title: 'AC gas refilling',
          description: 'Professional AC gas refilling and leak detection',
          price: 300,
          priceType: 'fixed',
          category: 'AC Repair',
          rating: 5,
          reviewCount: 8,
          isActive: true,
          createdAt: '2024-01-14T10:00:00Z',
        },
        
        // Carpenter Services (3 services)
        {
          _id: '23',
          title: 'Furniture repair and restoration',
          description: 'Expert furniture repair and restoration services',
          price: 600,
          priceType: 'hour',
          category: 'Carpenter',
          rating: 5,
          reviewCount: 15,
          isActive: true,
          createdAt: '2024-01-20T10:00:00Z',
        },
        {
          _id: '24',
          title: 'Custom furniture making',
          description: 'Professional custom furniture design and manufacturing',
          price: 1200,
          priceType: 'fixed',
          category: 'Carpenter',
          rating: 5,
          reviewCount: 6,
          isActive: true,
          createdAt: '2024-01-21T10:00:00Z',
        },
        {
          _id: '25',
          title: 'Door and window repair',
          description: 'Complete door and window repair and installation',
          price: 400,
          priceType: 'hour',
          category: 'Carpenter',
          rating: 5,
          reviewCount: 10,
          isActive: true,
          createdAt: '2024-01-22T10:00:00Z',
        },
    ];
  };

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

  const handleAddService = () => {
    setIsModalOpen(true);
  };

  const handleAddSubService = (category: string) => {
    // Open modal with pre-filled category
    setEditingService({ category, isMainCategory: false, parentCategory: category });
    setIsEditModalOpen(true);
  };

  const handleServiceCreated = () => {
    // Refresh the services list
    fetchServices();
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    setIsEditModalOpen(true);
  };

  const handleServiceUpdated = () => {
    // Refresh the services list
    fetchServices();
  };

  const getServicesByCategory = () => {
    const categories: { [key: string]: Service[] } = {};
    services.forEach(service => {
      if (!categories[service.category]) {
        categories[service.category] = [];
      }
      categories[service.category].push(service);
    });
    return categories;
  };

  const getCategoryStats = () => {
    // Use hierarchical services for accurate counts matching frontend
    return hierarchicalServices.map(hierarchy => {
      const categoryServices: Service[] = [];
      if (hierarchy.mainService) {
        categoryServices.push(hierarchy.mainService);
      }
      categoryServices.push(...hierarchy.subServices);
      const activeServices = categoryServices.filter(s => s.isActive !== false).length;
      
      return {
        name: hierarchy.category,
        icon: hierarchy.category,
        color: hierarchy.category,
        serviceCount: categoryServices.length,
        activeServices: activeServices,
        totalRevenue: categoryServices.reduce((sum, s) => sum + s.price, 0)
      };
    });
  };

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setViewMode('grid');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setViewMode('categories');
  };

  const getFilteredServices = () => {
    if (selectedCategory) {
      // Get services from hierarchical structure for selected category
      const categoryHierarchy = hierarchicalServices.find(h => h.category === selectedCategory);
      if (categoryHierarchy) {
        const categoryServices: Service[] = [];
        if (categoryHierarchy.mainService) {
          categoryServices.push(categoryHierarchy.mainService);
        }
        categoryServices.push(...categoryHierarchy.subServices);
        return categoryServices;
      }
      // Fallback to flat list
      return services.filter(service => service.category === selectedCategory);
    }
    return services;
  };

  const handleToggleStatus = async (serviceId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';
      const response = await fetch(`/api/services/${serviceId}/toggle`, {
        method: 'PATCH',
      });

      if (response.ok) {
        // Refresh the services list
        fetchServices();
      } else {
        alert('Failed to toggle service status');
      }
    } catch (error) {
      console.error('Error toggling service status:', error);
      alert('Failed to toggle service status');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';
      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the services list
        fetchServices();
      } else {
        alert('Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service');
    }
  };

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarLayout adminName={admin.name}>
      <div className="p-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {selectedCategory && (
                <button
                  onClick={handleBackToCategories}
                  className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Categories
                </button>
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedCategory ? `${selectedCategory} Services (${getFilteredServices().length})` : `All Services (${services.length})`}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('categories')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'categories' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Card View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <rect x="7" y="8" width="10" height="3" rx="1" />
                  <rect x="7" y="13" width="10" height="3" rx="1" />
                  <rect x="7" y="18" width="6" height="2" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Grid View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="6" cy="6" r="2" />
                  <circle cx="18" cy="6" r="2" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="1" />
                  <line x1="8" y1="8" x2="16" y2="8" strokeWidth={1.5} />
                  <line x1="8" y1="12" x2="16" y2="12" strokeWidth={1.5} />
                  <line x1="8" y1="16" x2="14" y2="16" strokeWidth={1.5} />
                  <line x1="10" y1="12" x2="10" y2="16" strokeWidth={1.5} />
                </svg>
              </button>
            </div>
          </div>
          
          {viewMode === 'categories' ? (
            <div className="p-6">
              {services.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl text-gray-300 mb-4">🔧</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
                  <p className="text-gray-500 mb-4">Get started by adding your first service</p>
                  <button
                    onClick={handleAddService}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Service
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {getCategoryStats().map((category) => (
                    <CategoryCard
                      key={category.name}
                      category={category}
                      onClick={() => handleCategoryClick(category.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-6">
              {getFilteredServices().length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl text-gray-300 mb-4">🔧</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedCategory ? `No ${selectedCategory} services found` : 'No services found'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {selectedCategory ? `No services available in ${selectedCategory} category` : 'Get started by adding your first service'}
                  </p>
                  <button
                    onClick={handleAddService}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Service
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {getFilteredServices().map((service) => (
                    selectedCategory ? (
                      <CategoryServiceCard
                        key={service._id}
                        service={service}
                        onEdit={handleEditService}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDeleteService}
                      />
                    ) : (
                      <ServiceCard
                        key={service._id}
                        service={service}
                        onEdit={handleEditService}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDeleteService}
                      />
                    )
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reviews
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredServices().map((service) => (
                    <tr key={service._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {service.title}
                        </div>
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {service.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {service.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(service.price, service.priceType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-yellow-400">★</span>
                          <span className="ml-1 text-sm text-gray-900">{service.rating}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {service.reviewCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          service.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(service.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditService(service)}
                            className="text-blue-600 hover:bg-blue-50 text-xs px-2 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(service._id)}
                            className={`text-xs px-2 py-1 rounded ${
                              service.isActive
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {service.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteService(service._id)}
                            className="text-red-600 hover:bg-red-50 text-xs px-2 py-1 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onAddService={handleAddService} />

      {/* Service Form Modal */}
      <ServiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleServiceCreated}
      />

      {/* Edit Service Modal */}
      <EditServiceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingService(null);
        }}
        onSuccess={handleServiceUpdated}
        service={editingService}
      />
    </SidebarLayout>
  );
}
