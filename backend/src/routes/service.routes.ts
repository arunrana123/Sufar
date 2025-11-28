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

// Get services by category with sub-services
router.get("/category/:category", async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
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

// Get hierarchical services structure
router.get("/hierarchy/all", async (req: Request, res: Response) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ category: 1, isMainCategory: -1, createdAt: -1 });
    
    // Group services by category
    const hierarchy: any = {};
    
    services.forEach(service => {
      if (!hierarchy[service.category]) {
        hierarchy[service.category] = {
          category: service.category,
          mainService: null,
          subServices: []
        };
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
