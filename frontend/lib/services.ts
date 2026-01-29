import { getApiUrl } from '@/lib/config';

// Slug (user app route) to backend category name for API
export const slugToBackendCategory: Record<string, string> = {
  plumber: 'Plumber', electrician: 'Electrician', carpenter: 'Carpenter', cleaner: 'Cleaner',
  mechanic: 'Mechanic', 'ac-repair': 'AC Repair', painter: 'Painter', mason: 'Mason', cook: 'Cook',
  driver: 'Driver', security: 'Security', beautician: 'Beautician', technician: 'Technician',
  delivery: 'Delivery', gardener: 'Gardener', workers: 'Workers',
};

// Service data structure for all categories
export interface Service {
  id: string;
  title: string;
  description?: string;
  price: string;
  priceType: 'hour' | 'fixed' | 'per_foot' | 'customize';
  rating: number;
  reviewCount: number;
  image: string;
  verified: boolean;
  category: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  services: Service[];
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: 'plumber',
    name: 'Plumber',
    icon: 'build-outline',
    color: '#4A90E2',
    services: [
      {
        id: 'waste-pipe-leakage',
        title: 'Waste pipe leakage repair',
        price: '450',
        priceType: 'hour',
        rating: 5,
        reviewCount: 4,
        image: 'waste-pipe-leakage.jpg',
        verified: true,
        category: 'plumber'
      },
      {
        id: 'drinking-water-pipe',
        title: 'Drinking Water pipe installation',
        price: '2000',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 4,
        image: 'drinking-water-pipe.jpg',
        verified: true,
        category: 'plumber'
      },
      {
        id: 'geyser-installation',
        title: 'Geyser installation for bathroom',
        price: '4000',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 4,
        image: 'geyser-installation.jpg',
        verified: true,
        category: 'plumber'
      },
      {
        id: 'toilet-installation',
        title: 'New Toilet installation',
        price: '7000',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 4,
        image: 'toilet-installation.jpg',
        verified: true,
        category: 'plumber'
      },
      {
        id: 'drainage-pipe',
        title: 'Back yard drainage pipe installation',
        price: '100',
        priceType: 'per_foot',
        rating: 5,
        reviewCount: 4,
        image: 'drainage-pipe.jpg',
        verified: true,
        category: 'plumber'
      },
      {
        id: 'bathroom-pipe-setup',
        title: 'New bathroom pipe setup',
        price: '14000',
        priceType: 'customize',
        rating: 5,
        reviewCount: 4,
        image: 'bathroom-pipe-setup.jpg',
        verified: true,
        category: 'plumber'
      }
    ]
  },
  {
    id: 'electrician',
    name: 'Electrician',
    icon: 'flash-outline',
    color: '#F5A623',
    services: [
      {
        id: 'electrical-wiring',
        title: 'House electrical wiring',
        price: '800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 12,
        image: 'electrical-wiring.jpg',
        verified: true,
        category: 'electrician'
      },
      {
        id: 'switch-installation',
        title: 'Switch and socket installation',
        price: '300',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 8,
        image: 'switch-installation.jpg',
        verified: true,
        category: 'electrician'
      },
      {
        id: 'fan-installation',
        title: 'Ceiling fan installation',
        price: '500',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 6,
        image: 'fan-installation.jpg',
        verified: true,
        category: 'electrician'
      },
      {
        id: 'light-fixture',
        title: 'Light fixture installation',
        price: '400',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 10,
        image: 'light-fixture.jpg',
        verified: true,
        category: 'electrician'
      }
    ]
  },
  {
    id: 'carpenter',
    name: 'Carpenter',
    icon: 'hammer-outline',
    color: '#D0021B',
    services: [
      {
        id: 'furniture-repair',
        title: 'Furniture repair and restoration',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 15,
        image: 'furniture-repair.jpg',
        verified: true,
        category: 'carpenter'
      },
      {
        id: 'custom-furniture',
        title: 'Custom furniture making',
        price: '5001',
        priceType: 'customize',
        rating: 5,
        reviewCount: 8,
        image: 'custom-furniture.jpg',
        verified: true,
        category: 'carpenter'
      },
      {
        id: 'door-installation',
        title: 'Door and window installation',
        price: '1200',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 12,
        image: 'door-installation.jpg',
        verified: true,
        category: 'carpenter'
      }
    ]
  },
  {
    id: 'mechanic',
    name: 'Mechanic',
    icon: 'car-outline',
    color: '#7ED321',
    services: [
      {
        id: 'engine-repair',
        title: 'Engine repair and maintenance',
        price: '1000',
        priceType: 'hour',
        rating: 5,
        reviewCount: 20,
        image: 'engine-repair.jpg',
        verified: true,
        category: 'mechanic'
      },
      {
        id: 'brake-service',
        title: 'Brake system service',
        price: '800',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 18,
        image: 'brake-service.jpg',
        verified: true,
        category: 'mechanic'
      },
      {
        id: 'oil-change',
        title: 'Oil change and filter replacement',
        price: '500',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 25,
        image: 'oil-change.jpg',
        verified: true,
        category: 'mechanic'
      }
    ]
  },
  {
    id: 'cleaner',
    name: 'Cleaner',
    icon: 'sparkles-outline',
    color: '#4ECDC4',
    services: [
      {
        id: 'house-cleaning',
        title: 'Complete house cleaning',
        price: '800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 30,
        image: 'house-cleaning.jpg',
        verified: true,
        category: 'cleaner'
      },
      {
        id: 'office-cleaning',
        title: 'Office cleaning service',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 15,
        image: 'office-cleaning.jpg',
        verified: true,
        category: 'cleaner'
      },
      {
        id: 'deep-cleaning',
        title: 'Deep cleaning service',
        price: '1200',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 22,
        image: 'deep-cleaning.jpg',
        verified: true,
        category: 'cleaner'
      }
    ]
  },
  {
    id: 'mechanic',
    name: 'Mechanic',
    icon: 'car-outline',
    color: '#7ED321',
    services: [
      {
        id: 'engine-repair',
        title: 'Engine repair and maintenance',
        price: '1000',
        priceType: 'hour',
        rating: 5,
        reviewCount: 20,
        image: 'engine-repair.jpg',
        verified: true,
        category: 'mechanic'
      },
      {
        id: 'brake-service',
        title: 'Brake system service',
        price: '800',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 18,
        image: 'brake-service.jpg',
        verified: true,
        category: 'mechanic'
      },
      {
        id: 'oil-change',
        title: 'Oil change and filter replacement',
        price: '500',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 25,
        image: 'oil-change.jpg',
        verified: true,
        category: 'mechanic'
      },
      {
        id: 'tire-repair',
        title: 'Tire repair and replacement',
        price: '300',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 16,
        image: 'tire-repair.jpg',
        verified: true,
        category: 'mechanic'
      }
    ]
  },
  {
    id: 'ac-repair',
    name: 'AC Repair',
    icon: 'snow-outline',
    color: '#50E3C2',
    services: [
      {
        id: 'ac-installation',
        title: 'AC installation and setup',
        price: '2500',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 12,
        image: 'ac-installation.jpg',
        verified: true,
        category: 'ac-repair'
      },
      {
        id: 'ac-maintenance',
        title: 'AC maintenance and cleaning',
        price: '800',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 20,
        image: 'ac-maintenance.jpg',
        verified: true,
        category: 'ac-repair'
      },
      {
        id: 'ac-repair-service',
        title: 'AC repair and troubleshooting',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 15,
        image: 'ac-repair-service.jpg',
        verified: true,
        category: 'ac-repair'
      },
      {
        id: 'refrigerator-repair',
        title: 'Refrigerator repair service',
        price: '700',
        priceType: 'hour',
        rating: 5,
        reviewCount: 10,
        image: 'refrigerator-repair.jpg',
        verified: true,
        category: 'ac-repair'
      }
    ]
  },
  {
    id: 'mason',
    name: 'Mason',
    icon: 'home-outline',
    color: '#9013FE',
    services: [
      {
        id: 'wall-construction',
        title: 'Wall construction and repair',
        price: '1200',
        priceType: 'hour',
        rating: 5,
        reviewCount: 18,
        image: 'wall-construction.jpg',
        verified: true,
        category: 'mason'
      },
      {
        id: 'flooring-work',
        title: 'Flooring and tiling work',
        price: '800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 22,
        image: 'flooring-work.jpg',
        verified: true,
        category: 'mason'
      },
      {
        id: 'concrete-work',
        title: 'Concrete and cement work',
        price: '1000',
        priceType: 'hour',
        rating: 5,
        reviewCount: 16,
        image: 'concrete-work.jpg',
        verified: true,
        category: 'mason'
      },
      {
        id: 'brickwork',
        title: 'Brickwork and masonry',
        price: '900',
        priceType: 'hour',
        rating: 5,
        reviewCount: 14,
        image: 'brickwork.jpg',
        verified: true,
        category: 'mason'
      }
    ]
  },
  {
    id: 'painter',
    name: 'Painter',
    icon: 'brush-outline',
    color: '#FF6B6B',
    services: [
      {
        id: 'house-painting',
        title: 'House interior painting',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 25,
        image: 'house-painting.jpg',
        verified: true,
        category: 'painter'
      },
      {
        id: 'exterior-painting',
        title: 'Exterior wall painting',
        price: '800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 18,
        image: 'exterior-painting.jpg',
        verified: true,
        category: 'painter'
      },
      {
        id: 'furniture-painting',
        title: 'Furniture painting and refinishing',
        price: '500',
        priceType: 'hour',
        rating: 5,
        reviewCount: 12,
        image: 'furniture-painting.jpg',
        verified: true,
        category: 'painter'
      },
      {
        id: 'wallpaper-installation',
        title: 'Wallpaper installation',
        price: '400',
        priceType: 'hour',
        rating: 5,
        reviewCount: 8,
        image: 'wallpaper-installation.jpg',
        verified: true,
        category: 'painter'
      }
    ]
  },
  {
    id: 'gardener',
    name: 'Gardener',
    icon: 'leaf-outline',
    color: '#45B7D1',
    services: [
      {
        id: 'garden-maintenance',
        title: 'Garden maintenance and care',
        price: '500',
        priceType: 'hour',
        rating: 5,
        reviewCount: 20,
        image: 'garden-maintenance.jpg',
        verified: true,
        category: 'gardener'
      },
      {
        id: 'lawn-mowing',
        title: 'Lawn mowing and trimming',
        price: '300',
        priceType: 'hour',
        rating: 5,
        reviewCount: 15,
        image: 'lawn-mowing.jpg',
        verified: true,
        category: 'gardener'
      },
      {
        id: 'plant-installation',
        title: 'Plant installation and landscaping',
        price: '800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 12,
        image: 'plant-installation.jpg',
        verified: true,
        category: 'gardener'
      }
    ]
  },
  {
    id: 'cook',
    name: 'Cook',
    icon: 'restaurant-outline',
    color: '#FFA07A',
    services: [
      {
        id: 'home-cooking',
        title: 'Home cooking service',
        price: '400',
        priceType: 'hour',
        rating: 5,
        reviewCount: 30,
        image: 'home-cooking.jpg',
        verified: true,
        category: 'cook'
      },
      {
        id: 'event-catering',
        title: 'Event catering service',
        price: '2000',
        priceType: 'customize',
        rating: 5,
        reviewCount: 18,
        image: 'event-catering.jpg',
        verified: true,
        category: 'cook'
      },
      {
        id: 'meal-preparation',
        title: 'Meal preparation service',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 22,
        image: 'meal-preparation.jpg',
        verified: true,
        category: 'cook'
      }
    ]
  },
  {
    id: 'driver',
    name: 'Driver',
    icon: 'car-sport-outline',
    color: '#98D8C8',
    services: [
      {
        id: 'personal-driver',
        title: 'Personal driver service',
        price: '800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 25,
        image: 'personal-driver.jpg',
        verified: true,
        category: 'driver'
      },
      {
        id: 'airport-transfer',
        title: 'Airport transfer service',
        price: '1200',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 20,
        image: 'airport-transfer.jpg',
        verified: true,
        category: 'driver'
      },
      {
        id: 'city-tour',
        title: 'City tour and sightseeing',
        price: '1000',
        priceType: 'hour',
        rating: 5,
        reviewCount: 15,
        image: 'city-tour.jpg',
        verified: true,
        category: 'driver'
      }
    ]
  },
  {
    id: 'security',
    name: 'Security',
    icon: 'shield-outline',
    color: '#F7DC6F',
    services: [
      {
        id: 'home-security',
        title: 'Home security service',
        price: '1500',
        priceType: 'hour',
        rating: 5,
        reviewCount: 12,
        image: 'home-security.jpg',
        verified: true,
        category: 'security'
      },
      {
        id: 'event-security',
        title: 'Event security service',
        price: '2000',
        priceType: 'hour',
        rating: 5,
        reviewCount: 8,
        image: 'event-security.jpg',
        verified: true,
        category: 'security'
      },
      {
        id: 'office-security',
        title: 'Office security service',
        price: '1800',
        priceType: 'hour',
        rating: 5,
        reviewCount: 10,
        image: 'office-security.jpg',
        verified: true,
        category: 'security'
      }
    ]
  },
  {
    id: 'technician',
    name: 'Technician',
    icon: 'settings-outline',
    color: '#BB8FCE',
    services: [
      {
        id: 'computer-repair',
        title: 'Computer repair and maintenance',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 20,
        image: 'computer-repair.jpg',
        verified: true,
        category: 'technician'
      },
      {
        id: 'phone-repair',
        title: 'Mobile phone repair',
        price: '400',
        priceType: 'hour',
        rating: 5,
        reviewCount: 25,
        image: 'phone-repair.jpg',
        verified: true,
        category: 'technician'
      },
      {
        id: 'appliance-repair',
        title: 'Home appliance repair',
        price: '500',
        priceType: 'hour',
        rating: 5,
        reviewCount: 18,
        image: 'appliance-repair.jpg',
        verified: true,
        category: 'technician'
      }
    ]
  },
  {
    id: 'delivery',
    name: 'Delivery',
    icon: 'bicycle-outline',
    color: '#85C1E9',
    services: [
      {
        id: 'food-delivery',
        title: 'Food delivery service',
        price: '100',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 50,
        image: 'food-delivery.jpg',
        verified: true,
        category: 'delivery'
      },
      {
        id: 'package-delivery',
        title: 'Package delivery service',
        price: '150',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 30,
        image: 'package-delivery.jpg',
        verified: true,
        category: 'delivery'
      },
      {
        id: 'document-delivery',
        title: 'Document delivery service',
        price: '120',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 20,
        image: 'document-delivery.jpg',
        verified: true,
        category: 'delivery'
      }
    ]
  },
  {
    id: 'workers',
    name: 'Workers',
    icon: 'people-outline',
    color: '#BD10E0',
    services: [
      {
        id: 'general-labor',
        title: 'General labor work',
        price: '400',
        priceType: 'hour',
        rating: 5,
        reviewCount: 35,
        image: 'general-labor.jpg',
        verified: true,
        category: 'workers'
      },
      {
        id: 'construction-helper',
        title: 'Construction helper service',
        price: '500',
        priceType: 'hour',
        rating: 5,
        reviewCount: 25,
        image: 'construction-helper.jpg',
        verified: true,
        category: 'workers'
      },
      {
        id: 'moving-assistance',
        title: 'Moving and shifting assistance',
        price: '600',
        priceType: 'hour',
        rating: 5,
        reviewCount: 20,
        image: 'moving-assistance.jpg',
        verified: true,
        category: 'workers'
      }
    ]
  },
  {
    id: 'beautician',
    name: 'Beautician',
    icon: 'sparkles-outline',
    color: '#E91E63',
    services: [
      {
        id: 'haircut-styling',
        title: 'Haircut and styling',
        price: '500',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 45,
        image: 'haircut-styling.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'facial-treatment',
        title: 'Facial treatment',
        price: '800',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 38,
        image: 'facial-treatment.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'manicure-pedicure',
        title: 'Manicure and pedicure',
        price: '600',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 42,
        image: 'manicure-pedicure.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'hair-coloring',
        title: 'Hair coloring and highlights',
        price: '1500',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 28,
        image: 'hair-coloring.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'bridal-makeup',
        title: 'Bridal makeup package',
        price: '5000',
        priceType: 'customize',
        rating: 5,
        reviewCount: 35,
        image: 'bridal-makeup.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'party-makeup',
        title: 'Party makeup',
        price: '1200',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 40,
        image: 'party-makeup.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'threading-waxing',
        title: 'Threading and waxing',
        price: '300',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 50,
        image: 'threading-waxing.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'hair-spa',
        title: 'Hair spa treatment',
        price: '1000',
        priceType: 'fixed',
        rating: 5,
        reviewCount: 32,
        image: 'hair-spa.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'skin-care',
        title: 'Skin care consultation',
        price: '400',
        priceType: 'hour',
        rating: 5,
        reviewCount: 25,
        image: 'skin-care.jpg',
        verified: true,
        category: 'beautician'
      },
      {
        id: 'mehendi-art',
        title: 'Mehendi (Henna) art',
        price: '800',
        priceType: 'customize',
        rating: 5,
        reviewCount: 30,
        image: 'mehendi-art.jpg',
        verified: true,
        category: 'beautician'
      }
    ]
  }
];

export const getServicesByCategory = (categoryId: string): Service[] => {
  const category = serviceCategories.find(cat => cat.id === categoryId);
  return category ? category.services : [];
};

export const getCategoryInfo = (categoryId: string): ServiceCategory | undefined => {
  return serviceCategories.find(cat => cat.id === categoryId);
};

/** Fetch services for a category from backend (active sub-services only). Falls back to empty on error. */
export async function getServicesByCategoryFromAPI(categorySlug: string): Promise<Service[]> {
  const slug = categorySlug.toLowerCase().replace(/\s+/g, '-');
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) return [];
    const url = `${apiUrl}/api/services/category/${encodeURIComponent(slug)}?includeSubServices=true`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((s: { isMainCategory?: boolean }) => !s.isMainCategory)
      .map((s: { _id: string; title: string; description?: string; price: number; priceType: string; rating?: number; reviewCount?: number; imageUrl?: string; subCategory?: string }) => ({
        id: s._id,
        title: s.title,
        description: s.description ?? '',
        price: String(s.price),
        priceType: (s.priceType || 'fixed') as Service['priceType'],
        rating: s.rating ?? 5,
        reviewCount: s.reviewCount ?? 0,
        image: s.imageUrl || `${(s.subCategory || s.title).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.jpg`,
        verified: true,
        category: slug,
      }));
  } catch {
    return [];
  }
}
