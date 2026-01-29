import { Router, type Request, type Response } from "express";
import Service from "../models/Service.model";
import WorkerUser from "../models/WorkerUser.model";
import { Server as SocketIOServer } from 'socket.io';

// Helper to get io from request
const getIO = (req: Request): SocketIOServer | null => {
  const app = req.app;
  return app.get('io') || null;
};

const router = Router();

// Create a new service
router.post("/", async (req: Request, res: Response) => {
  try {
    const service = await Service.create(req.body);
    
    // Emit Socket.IO event for real-time updates
    const io = getIO(req);
    if (io) {
      const serviceData = {
        _id: String(service._id),
        title: service.title,
        description: service.description,
        price: service.price,
        priceType: service.priceType,
        category: service.category,
        subCategory: service.subCategory,
        rating: service.rating,
        reviewCount: service.reviewCount,
        isActive: service.isActive,
        imageUrl: service.imageUrl,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      };
      io.emit('service:created', serviceData);
      console.log(`📢 Service created event emitted: ${service.title} to ${io.sockets.sockets.size} clients`);
    } else {
      console.warn('⚠️ Socket.IO not available - cannot emit real-time update');
    }
    
    res.status(201).json(service);
  } catch (err: any) {
    console.error('Error creating service:', err);
    res.status(400).json({ 
      error: err.message || 'Failed to create service',
      details: err.errors 
    });
  }
});

// Get all services
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, isActive, page = 1, limit = 10 } = req.query;
    
    const filter: any = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Service.countDocuments(filter);
    
    res.json({
      services,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });
  } catch (err: any) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch services' });
  }
});

// Get all services (simple version for dashboard)
router.get("/all", async (req: Request, res: Response) => {
  try {
    const { city } = req.query; // Optional city filter
    
    let services = await Service.find({ isActive: true }).sort({ createdAt: -1 });
    
    // If city is provided, filter services that have available workers in that city
    if (city) {
      // Get all unique service categories that have available workers in the specified city
      const workersInCity = await WorkerUser.find({
        'currentLocation.city': { $regex: new RegExp(String(city), 'i') },
        status: 'available',
        isActive: true,
        verificationStatus: { $in: ['verified', 'pending'] },
        'currentLocation.coordinates': { $exists: true },
      }).select('serviceCategories').lean();
      
      // Extract all unique service categories from workers in the city
      const availableCategories = new Set<string>();
      workersInCity.forEach(worker => {
        if (worker.serviceCategories && Array.isArray(worker.serviceCategories)) {
          worker.serviceCategories.forEach(cat => {
            if (cat) {
              // Normalize category names (e.g., "Carpenter" matches "Carpenter" service)
              availableCategories.add(cat.toLowerCase());
              // Also add common variations
              if (cat.toLowerCase().includes('carpenter')) availableCategories.add('carpenter');
              if (cat.toLowerCase().includes('plumber')) availableCategories.add('plumber');
              if (cat.toLowerCase().includes('electrician')) availableCategories.add('electrician');
              if (cat.toLowerCase().includes('mechanic')) availableCategories.add('mechanic');
              if (cat.toLowerCase().includes('cleaner')) availableCategories.add('cleaner');
              if (cat.toLowerCase().includes('driver')) availableCategories.add('driver');
              if (cat.toLowerCase().includes('cook')) availableCategories.add('cook');
              if (cat.toLowerCase().includes('gardener')) availableCategories.add('gardener');
            }
          });
        }
      });
      
      console.log(`📍 Filtering services for city: ${city}`);
      console.log(`✅ Found ${availableCategories.size} available service categories in ${city}:`, Array.from(availableCategories));
      
      // Filter services that match available categories in the city
      services = services.filter(service => {
        const serviceCategory = service.category?.toLowerCase() || '';
        // Check if this service category has workers available in the city
        const hasWorkers = Array.from(availableCategories).some(cat => 
          serviceCategory.includes(cat) || cat.includes(serviceCategory) ||
          serviceCategory === cat
        );
        return hasWorkers;
      });
      
      console.log(`✅ Returning ${services.length} services with available workers in ${city}`);
    }
    
    res.json(services);
  } catch (err: any) {
    console.error('Error fetching all services:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch services' });
  }
});

// Slug to backend category name (for user app routes like /plumber, /ac-repair)
const SLUG_TO_CATEGORY: Record<string, string> = {
  plumber: 'Plumber', electrician: 'Electrician', carpenter: 'Carpenter', cleaner: 'Cleaner',
  mechanic: 'Mechanic', 'ac-repair': 'AC Repair', painter: 'Painter', mason: 'Mason', cook: 'Cook',
  driver: 'Driver', security: 'Security', beautician: 'Beautician', technician: 'Technician',
  delivery: 'Delivery', gardener: 'Gardener', workers: 'Workers',
};

function getCategoryFromSlug(slug: string): string | null {
  if (!slug || typeof slug !== 'string') return null;
  const normalized = slug.trim().toLowerCase().replace(/\s+/g, '-');
  const mapped = SLUG_TO_CATEGORY[normalized];
  if (mapped) return mapped;
  // Allow exact category name (e.g. "Plumber")
  const exact = slug.trim();
  if (Object.values(SLUG_TO_CATEGORY).includes(exact)) return exact;
  return null;
}

// Get services by category with sub-services (category can be slug e.g. plumber, ac-repair)
router.get("/category/:category", async (req: Request, res: Response) => {
  try {
    const rawCategory = req.params.category;
    const category = getCategoryFromSlug(rawCategory) || rawCategory;
    const { includeSubServices = 'true' } = req.query;
    
    const filter: any = { category };
    if (includeSubServices === 'true') {
      // Get both main category and sub-services
      filter.$or = [
        { isMainCategory: true },
        { parentCategory: category }
      ];
    } else {
      // Get only sub-services
      filter.parentCategory = category;
    }
    
    const services = await Service.find(filter)
      .sort({ isMainCategory: -1, createdAt: -1 });
    
    res.json(services);
  } catch (err: any) {
    console.error('Error fetching services by category:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch services by category' });
  }
});

// Get hierarchical services structure (includeInactive=true for admin)
router.get("/hierarchy/all", async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const services = await Service.find(filter).sort({ category: 1, isMainCategory: -1, createdAt: -1 });
    const hierarchy: any = {};
    services.forEach(service => {
      if (!hierarchy[service.category]) {
        hierarchy[service.category] = { category: service.category, mainService: null, subServices: [] };
      }
      if (service.isMainCategory) {
        hierarchy[service.category].mainService = service;
      } else {
        hierarchy[service.category].subServices.push(service);
      }
    });
    res.json(Object.values(hierarchy));
  } catch (err: any) {
    console.error('Error fetching hierarchical services:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch hierarchical services' });
  }
});

// Seed default services (16 categories + sub-services matching user app)
const SEED_CATEGORIES: Array<{ category: string; subServices: Array<{ title: string; description: string; price: number; priceType: 'hour' | 'per_foot' | 'fixed' | 'customize' }> }> = [
  { category: 'Plumber', subServices: [
    { title: 'Waste pipe leakage repair', description: 'Professional repair of waste pipe leaks', price: 450, priceType: 'hour' },
    { title: 'Drinking Water pipe installation', description: 'Complete drinking water pipe installation', price: 2000, priceType: 'fixed' },
    { title: 'Geyser installation for bathroom', description: 'Geyser installation for bathroom', price: 4000, priceType: 'fixed' },
    { title: 'New Toilet installation', description: 'New toilet installation', price: 7000, priceType: 'fixed' },
    { title: 'Back yard drainage pipe installation', description: 'Back yard drainage pipe installation', price: 100, priceType: 'per_foot' },
    { title: 'New bathroom pipe setup', description: 'New bathroom pipe setup', price: 14000, priceType: 'customize' },
  ]},
  { category: 'Electrician', subServices: [
    { title: 'House electrical wiring', description: 'House electrical wiring', price: 800, priceType: 'hour' },
    { title: 'Switch and socket installation', description: 'Switch and socket installation', price: 300, priceType: 'fixed' },
    { title: 'Ceiling fan installation', description: 'Ceiling fan installation', price: 500, priceType: 'fixed' },
    { title: 'Light fixture installation', description: 'Light fixture installation', price: 400, priceType: 'fixed' },
  ]},
  { category: 'Carpenter', subServices: [
    { title: 'Furniture repair and restoration', description: 'Furniture repair and restoration', price: 600, priceType: 'hour' },
    { title: 'Custom furniture making', description: 'Custom furniture making', price: 5001, priceType: 'customize' },
    { title: 'Door and window installation', description: 'Door and window installation', price: 1200, priceType: 'fixed' },
  ]},
  { category: 'Cleaner', subServices: [
    { title: 'Complete house cleaning', description: 'Complete house cleaning', price: 800, priceType: 'hour' },
    { title: 'Office cleaning service', description: 'Office cleaning service', price: 600, priceType: 'hour' },
    { title: 'Deep cleaning service', description: 'Deep cleaning service', price: 1200, priceType: 'fixed' },
  ]},
  { category: 'Mechanic', subServices: [
    { title: 'Engine repair and maintenance', description: 'Engine repair and maintenance', price: 1000, priceType: 'hour' },
    { title: 'Brake system service', description: 'Brake system service', price: 800, priceType: 'fixed' },
    { title: 'Oil change and filter replacement', description: 'Oil change and filter replacement', price: 500, priceType: 'fixed' },
    { title: 'Tire repair and replacement', description: 'Tire repair and replacement', price: 300, priceType: 'fixed' },
  ]},
  { category: 'AC Repair', subServices: [
    { title: 'AC installation and setup', description: 'AC installation and setup', price: 2500, priceType: 'fixed' },
    { title: 'AC maintenance and cleaning', description: 'AC maintenance and cleaning', price: 800, priceType: 'fixed' },
    { title: 'AC repair and troubleshooting', description: 'AC repair and troubleshooting', price: 600, priceType: 'hour' },
    { title: 'Refrigerator repair service', description: 'Refrigerator repair service', price: 700, priceType: 'hour' },
  ]},
  { category: 'Painter', subServices: [
    { title: 'House interior painting', description: 'House interior painting', price: 600, priceType: 'hour' },
    { title: 'Exterior wall painting', description: 'Exterior wall painting', price: 800, priceType: 'hour' },
    { title: 'Furniture painting and refinishing', description: 'Furniture painting and refinishing', price: 500, priceType: 'hour' },
    { title: 'Wallpaper installation', description: 'Wallpaper installation', price: 400, priceType: 'hour' },
  ]},
  { category: 'Mason', subServices: [
    { title: 'Wall construction and repair', description: 'Wall construction and repair', price: 1200, priceType: 'hour' },
    { title: 'Flooring and tiling work', description: 'Flooring and tiling work', price: 800, priceType: 'hour' },
    { title: 'Concrete and cement work', description: 'Concrete and cement work', price: 1000, priceType: 'hour' },
    { title: 'Brickwork and masonry', description: 'Brickwork and masonry', price: 900, priceType: 'hour' },
  ]},
  { category: 'Gardener', subServices: [
    { title: 'Garden maintenance and care', description: 'Garden maintenance and care', price: 500, priceType: 'hour' },
    { title: 'Lawn mowing and trimming', description: 'Lawn mowing and trimming', price: 300, priceType: 'hour' },
    { title: 'Plant installation and landscaping', description: 'Plant installation and landscaping', price: 800, priceType: 'hour' },
  ]},
  { category: 'Cook', subServices: [
    { title: 'Home cooking service', description: 'Home cooking service', price: 400, priceType: 'hour' },
    { title: 'Event catering service', description: 'Event catering service', price: 2000, priceType: 'customize' },
    { title: 'Meal preparation service', description: 'Meal preparation service', price: 600, priceType: 'hour' },
  ]},
  { category: 'Driver', subServices: [
    { title: 'Personal driver service', description: 'Personal driver service', price: 800, priceType: 'hour' },
    { title: 'Airport transfer service', description: 'Airport transfer service', price: 1200, priceType: 'fixed' },
    { title: 'City tour and sightseeing', description: 'City tour and sightseeing', price: 1000, priceType: 'hour' },
  ]},
  { category: 'Security', subServices: [
    { title: 'Home security service', description: 'Home security service', price: 1500, priceType: 'hour' },
    { title: 'Event security service', description: 'Event security service', price: 2000, priceType: 'hour' },
    { title: 'Office security service', description: 'Office security service', price: 1800, priceType: 'hour' },
  ]},
  { category: 'Technician', subServices: [
    { title: 'Computer repair and maintenance', description: 'Computer repair and maintenance', price: 600, priceType: 'hour' },
    { title: 'Mobile phone repair', description: 'Mobile phone repair', price: 400, priceType: 'hour' },
    { title: 'Home appliance repair', description: 'Home appliance repair', price: 500, priceType: 'hour' },
  ]},
  { category: 'Delivery', subServices: [
    { title: 'Food delivery service', description: 'Food delivery service', price: 100, priceType: 'fixed' },
    { title: 'Package delivery service', description: 'Package delivery service', price: 150, priceType: 'fixed' },
    { title: 'Document delivery service', description: 'Document delivery service', price: 120, priceType: 'fixed' },
  ]},
  { category: 'Workers', subServices: [
    { title: 'General labor work', description: 'General labor work', price: 400, priceType: 'hour' },
    { title: 'Construction helper service', description: 'Construction helper service', price: 500, priceType: 'hour' },
    { title: 'Moving and shifting assistance', description: 'Moving and shifting assistance', price: 600, priceType: 'hour' },
  ]},
  { category: 'Beautician', subServices: [
    { title: 'Haircut and styling', description: 'Haircut and styling', price: 500, priceType: 'fixed' },
    { title: 'Facial treatment', description: 'Facial treatment', price: 800, priceType: 'fixed' },
    { title: 'Manicure and pedicure', description: 'Manicure and pedicure', price: 600, priceType: 'fixed' },
    { title: 'Hair coloring and highlights', description: 'Hair coloring and highlights', price: 1500, priceType: 'fixed' },
    { title: 'Bridal makeup package', description: 'Bridal makeup package', price: 5000, priceType: 'customize' },
    { title: 'Party makeup', description: 'Party makeup', price: 1200, priceType: 'fixed' },
    { title: 'Threading and waxing', description: 'Threading and waxing', price: 300, priceType: 'fixed' },
    { title: 'Hair spa treatment', description: 'Hair spa treatment', price: 1000, priceType: 'fixed' },
    { title: 'Skin care consultation', description: 'Skin care consultation', price: 400, priceType: 'hour' },
    { title: 'Mehendi (Henna) art', description: 'Mehendi (Henna) art', price: 800, priceType: 'customize' },
  ]},
];

router.post("/seed", async (req: Request, res: Response) => {
  try {
    const existing = await Service.countDocuments();
    if (existing > 0) {
      return res.status(400).json({
        message: "Services already exist. Delete all services first to re-seed.",
        count: existing,
      });
    }
    let created = 0;
    for (const { category, subServices } of SEED_CATEGORIES) {
      await Service.create({
        title: category,
        description: `${category} services`,
        price: 0,
        priceType: 'fixed',
        category,
        isMainCategory: true,
        isActive: true,
        rating: 5,
        reviewCount: 0,
      });
      created++;
      for (const sub of subServices) {
        await Service.create({
          title: sub.title,
          description: sub.description,
          price: sub.price,
          priceType: sub.priceType,
          category,
          subCategory: sub.title,
          parentCategory: category,
          isMainCategory: false,
          isActive: true,
          rating: 5,
          reviewCount: 0,
        });
        created++;
      }
    }
    console.log(`✅ Seeded ${created} services (${SEED_CATEGORIES.length} categories)`);
    res.status(201).json({ message: "Default services seeded successfully", count: created });
  } catch (err: any) {
    console.error('Error seeding services:', err);
    res.status(500).json({ error: err.message || 'Failed to seed services' });
  }
});

// Get a single service by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json(service);
  } catch (err: any) {
    console.error('Error fetching service:', err);
    res.status(400).json({ error: err.message || 'Failed to fetch service' });
  }
});

// Update a service
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const oldService = await Service.findById(req.params.id);
    if (!oldService) {
      return res.status(404).json({ message: "Service not found" });
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: new Date() }, 
      { new: true, runValidators: true }
    );
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Emit Socket.IO event for real-time updates
    const io = getIO(req);
    if (io) {
      const serviceData = {
        _id: String(service._id),
        title: service.title,
        description: service.description,
        price: service.price,
        priceType: service.priceType,
        category: service.category,
        subCategory: service.subCategory,
        rating: service.rating,
        reviewCount: service.reviewCount,
        isActive: service.isActive,
        imageUrl: service.imageUrl,
        updatedAt: service.updatedAt,
        // Include what changed
        changes: {
          priceChanged: oldService.price !== service.price,
          oldPrice: oldService.price,
          newPrice: service.price,
        }
      };
      
      // Emit to all connected clients (users, workers, and admins)
      io.emit('service:updated', serviceData);
      console.log(`📢 Service updated event emitted to all clients: ${service.title} (Price: ${oldService.price} → ${service.price})`);
      console.log(`📊 Connected clients: ${io.sockets.sockets.size}`);
    } else {
      console.warn('⚠️ Socket.IO not available - cannot emit real-time update');
    }
    
    res.json(service);
  } catch (err: any) {
    console.error('Error updating service:', err);
    res.status(400).json({ 
      error: err.message || 'Failed to update service',
      details: err.errors 
    });
  }
});

// Delete a service
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Emit Socket.IO event for real-time updates
    const io = getIO(req);
    if (io) {
      const serviceId = String(service._id);
      io.emit('service:deleted', serviceId);
      console.log(`📢 Service deleted event emitted: ${serviceId}`);
    }
    
    res.json({ message: "Service deleted successfully" });
  } catch (err: any) {
    console.error('Error deleting service:', err);
    res.status(400).json({ error: err.message || 'Failed to delete service' });
  }
});

// Toggle service active status
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    service.isActive = !service.isActive;
    service.updatedAt = new Date();
    await service.save();
    
    // Emit Socket.IO event for real-time updates
    const io = getIO(req);
    if (io) {
      const serviceData = {
        _id: String(service._id),
        title: service.title,
        description: service.description,
        price: service.price,
        priceType: service.priceType,
        category: service.category,
        subCategory: service.subCategory,
        rating: service.rating,
        reviewCount: service.reviewCount,
        isActive: service.isActive,
        imageUrl: service.imageUrl,
        updatedAt: service.updatedAt,
      };
      io.emit('service:updated', serviceData);
      console.log(`📢 Service status updated event emitted: ${service.title} (Active: ${service.isActive}) to ${io.sockets.sockets.size} clients`);
    } else {
      console.warn('⚠️ Socket.IO not available - cannot emit real-time update');
    }
    
    res.json(service);
  } catch (err: any) {
    console.error('Error toggling service status:', err);
    res.status(400).json({ error: err.message || 'Failed to toggle service status' });
  }
});

export default router;
