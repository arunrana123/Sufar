// WORKER ROUTES - Handles worker authentication, profile, verification, and location tracking
// Endpoints: POST /register, POST /login, GET /:id, PUT /:id/location, GET /nearby, PUT /:id/verify
// Features: Worker registration/login, location updates, nearby worker search, document verification status
import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import { OAuth2Client } from 'google-auth-library';
import WorkerUser from "../models/WorkerUser.model";
import Notification from "../models/Notification.model";
import { logAdminActivity } from "./dashboard.routes";

// Calculates distance between two GPS coordinates using Haversine formula
// Returns distance in kilometers
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Worker User Authentication Routes

// Register a new worker user (for mobile app)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, skills, serviceCategories, currentLocation, verificationStatus } = req.body;
    
    if (!name || !email || !phone || !password || !skills) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if worker already exists
    const existingWorker = await WorkerUser.findOne({ email: email.toLowerCase().trim() });
    if (existingWorker) {
      return res.status(409).json({ message: "Worker with this email already exists" });
    }

    // Create new worker user
    const worker = await WorkerUser.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password, // Note: In production, hash this password
      skills: Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim()).filter((s: string) => s),
      serviceCategories: serviceCategories || [],
      currentLocation: currentLocation || {},
      verificationStatus: verificationStatus || 'pending',
    });

    return res.status(201).json({ 
      message: 'Worker registered successfully', 
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        skills: worker.skills,
        isActive: worker.isActive
      }
    });
  } catch (err) {
    console.error('Worker registration error:', err);
    return res.status(500).json({ message: "Worker registration failed", error: String(err) });
  }
});

// Login worker user (for mobile app)
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const worker = await WorkerUser.findOne({ email: email.toLowerCase().trim() });
    if (!worker) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Note: In production, use bcrypt to compare hashed passwords
    if (worker.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!worker.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Generate a simple token (in production, use JWT)
    const token = `worker_${worker._id}_${Date.now()}`;

    return res.json({
      message: 'Login successful',
      token,
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        skills: worker.skills,
        profileImage: worker.profileImage,
        documents: worker.documents,
        verificationStatus: worker.verificationStatus,
        verificationSubmitted: worker.verificationSubmitted,
        submittedAt: worker.submittedAt,
        serviceCategories: worker.serviceCategories || [],
        categoryVerificationStatus: worker.categoryVerificationStatus || {},
        currentLocation: worker.currentLocation,
        isActive: worker.isActive
      }
    });
  } catch (err) {
    console.error('Worker login error:', err);
    return res.status(500).json({ message: "Login failed", error: String(err) });
  }
});

// Google Sign-In for workers
router.post("/google-login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { email, given_name, family_name, picture, sub: googleId } = payload;

    // Check if worker exists
    let worker = await WorkerUser.findOne({ email: email.toLowerCase() });

    if (!worker) {
      // Create new worker with Google data
      worker = await WorkerUser.create({
        email: email.toLowerCase(),
        name: `${given_name || ''} ${family_name || ''}`.trim() || 'Worker',
        phone: '', // Will need to be updated by worker
        password: randomBytes(32).toString('hex'), // Random password for Google users
        skills: [], // Will need to be updated by worker
        profileImage: picture || null,
        googleId,
      });
    } else {
      // Update existing worker's Google info
      if (!worker.googleId) {
        worker.googleId = googleId;
      }
      if (picture && !worker.profileImage) {
        worker.profileImage = picture;
      }
      await worker.save();
    }

    if (!worker.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Generate token
    const token = `worker_${worker._id}_${Date.now()}`;

    return res.json({
      message: 'Login successful',
      token,
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        skills: worker.skills,
        profileImage: worker.profileImage,
        documents: worker.documents,
        verificationStatus: worker.verificationStatus,
        verificationSubmitted: worker.verificationSubmitted,
        submittedAt: worker.submittedAt,
        serviceCategories: worker.serviceCategories || [],
        categoryVerificationStatus: worker.categoryVerificationStatus || {},
        currentLocation: worker.currentLocation,
        isActive: worker.isActive
      }
    });
  } catch (err) {
    console.error('Google worker login error:', err);
    return res.status(500).json({ message: 'Google authentication failed', error: String(err) });
  }
});

// Legacy worker registration routes - DEPRECATED
// These routes used the old Worker model which has been replaced with WorkerUser
// Keeping commented for reference but should be removed in future cleanup

/* Removed legacy routes that used old Worker model:
 * - POST /admin-register - Used old Worker model for registration
 * - GET /pending - Listed pending workers from old model
 * - PATCH /:id/status - Updated worker status in old model
 *
 * All worker functionality now uses WorkerUser model exclusively
 * to prevent data duplication and inconsistencies
 */

// Verify worker using QR code
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { workerId, userId, verificationCode } = req.body;
    
    if (!workerId || !userId || !verificationCode) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the worker
    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    if (!worker.isActive) {
      return res.status(403).json({ message: "Worker account is inactive" });
    }

    // In a real implementation, you would verify the verification code
    // For now, we'll just check if the worker exists and is active
    // You could add additional verification logic here

    // Create a verification record (you might want to create a separate model for this)
    const verificationData = {
      workerId,
      userId,
      verificationCode,
      verifiedAt: new Date(),
      status: 'verified'
    };

    console.log(`Worker verification successful: ${worker.name} (${workerId}) verified by user ${userId}`);

    return res.json({
      success: true,
      message: 'Worker verified successfully',
      workerName: worker.name,
      workerPhone: worker.phone,
      workerEmail: worker.email,
      verificationData
    });
  } catch (err) {
    console.error('Worker verification error:', err);
    return res.status(500).json({ message: "Worker verification failed", error: String(err) });
  }
});

// Search available workers for instant booking
router.post("/search", async (req: Request, res: Response) => {
  try {
    const { serviceCategory, userLocation, radius = 10 } = req.body;
    
    if (!serviceCategory || !userLocation) {
      return res.status(400).json({ message: "Service category and user location are required" });
    }

    console.log(`🔍 Searching for workers with category: "${serviceCategory}"`);

    // First, let's check ALL workers in the database to see what we have
    const allWorkersDb = await WorkerUser.find({}).select('_id name phone email serviceCategories status isActive verificationStatus currentLocation').lean();
    console.log(`📊 Total workers in database: ${allWorkersDb.length}`);
    console.log('📋 All workers in database:', allWorkersDb.map(w => ({
      id: w._id,
      name: w.name,
      phone: w.phone,
      status: w.status,
      isActive: w.isActive,
      verificationStatus: w.verificationStatus,
      categories: w.serviceCategories,
      hasLocation: !!w.currentLocation?.coordinates,
    })));

    // Find available workers in the specified service category
    // Show all workers who are:
    // 1. Status = 'available'
    // 2. isActive = true
    // 3. Match the service category (case-insensitive)
    // Note: We show all matching workers here. Verification filtering happens when sending booking requests.
    // Note: Don't require location or verificationStatus - let workers show up even without these
    const workers = await WorkerUser.find({
      serviceCategories: { $elemMatch: { $regex: new RegExp(String(serviceCategory), 'i') } },
      status: 'available',
      isActive: true,
      // Removed verificationStatus requirement - workers show up even if pending
      // Removed location requirement - workers show up even without location
    }).select('name phone email serviceCategories rating totalJobs completedJobs currentLocation profileImage status _id categoryVerificationStatus').lean();

    console.log(`✅ Found ${workers.length} available workers for "${serviceCategory}"`);
    console.log('🎯 Available workers:', workers.map(w => ({ 
      id: w._id,
      name: w.name, 
      phone: w.phone,
      categories: w.serviceCategories,
      hasLocation: !!w.currentLocation?.coordinates,
      status: w.status,
      isActive: w.isActive,
      categoryVerification: w.categoryVerificationStatus?.[serviceCategory] || 'not set',
    })));

    // If no workers match, show why
    if (workers.length === 0 && allWorkersDb.length > 0) {
      console.warn('⚠️ No available workers found. Checking each worker:');
      allWorkersDb.forEach(worker => {
        const checks = {
          hasCorrectStatus: worker.status === 'available',
          isActive: worker.isActive === true,
          hasLocation: !!worker.currentLocation?.coordinates,
          matchesCategory: worker.serviceCategories?.some(cat => 
            new RegExp(String(serviceCategory), 'i').test(cat)
          ) || false,
          categories: worker.serviceCategories,
        };
        const reasons = [];
        if (!checks.hasCorrectStatus) reasons.push(`status=${worker.status} (needs 'available')`);
        if (!checks.isActive) reasons.push('isActive=false');
        if (!checks.matchesCategory) reasons.push(`no matching category for "${serviceCategory}"`);
        
        console.warn(`  Worker ${worker.name} (${worker._id}):`, {
          ...checks,
          reasons: reasons.length > 0 ? reasons : '✅ Should be included',
        });
      });
    }

    // Calculate distance and filter by radius
    const workersWithDistance = workers
      .map(worker => {
        if (worker.currentLocation?.coordinates?.latitude && worker.currentLocation?.coordinates?.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            worker.currentLocation.coordinates.latitude,
            worker.currentLocation.coordinates.longitude
          );
          
          console.log(`📍 Worker ${worker.name} (${worker._id}): distance = ${distance.toFixed(2)}km, radius = ${radius}km`);
          
          return {
            ...worker,
            distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
            estimatedArrival: Math.round(distance * 2 + Math.random() * 10), // Rough ETA calculation
            isAvailable: true,
          };
        } else {
          // Worker without location - still include them but mark distance as unknown
          console.log(`⚠️ Worker ${worker.name} (${worker._id}): no location data - including with unknown distance`);
          return {
            ...worker,
            distance: Infinity, // Will be filtered by radius if specified
            estimatedArrival: null,
            isAvailable: true,
          };
        }
      })
      .filter((worker) => {
        // If worker has no location (distance = Infinity), include them anyway
        // Otherwise, filter by radius
        if (worker.distance === Infinity) {
          return true; // Include workers without location
        }
        const withinRadius = worker.distance <= radius;
        if (!withinRadius) {
          console.log(`⚠️ Worker ${worker.name}: outside radius (${worker.distance}km > ${radius}km)`);
        }
        return withinRadius;
      })
      .sort((a, b) => {
        // Sort: workers with known distance first, then by distance
        if (a.distance === Infinity && b.distance !== Infinity) return 1;
        if (a.distance !== Infinity && b.distance === Infinity) return -1;
        return a.distance - b.distance;
      });

    console.log(`✅ Returning ${workersWithDistance.length} available workers for "${serviceCategory}" within ${radius}km`);
    
    const firstWorker = workersWithDistance[0];
    if (firstWorker) {
      console.log('🎯 First worker will be:', {
        id: firstWorker._id,
        name: firstWorker.name,
        phone: firstWorker.phone,
      });
    }

    return res.json({
      success: true,
      workers: workersWithDistance,
      count: workersWithDistance.length,
    });
  } catch (err) {
    console.error('❌ Worker search error:', err);
    return res.status(500).json({ message: "Failed to search workers", error: String(err) });
  }
});

// Cache for recent location updates to prevent unnecessary DB writes
const locationUpdateCache = new Map<string, { location: any, timestamp: number }>();
const LOCATION_UPDATE_THROTTLE = 30000; // 30 seconds minimum between DB updates

// Update worker location - Optimized with intelligent throttling
router.patch("/update-location", async (req: Request, res: Response) => {
  try {
    const { workerId, location, timestamp } = req.body;
    
    if (!workerId || !location || !location.latitude || !location.longitude) {
      console.error('❌ Invalid location update request:', {
        workerId: !!workerId,
        location: !!location,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      return res.status(400).json({ 
        message: "Worker ID and location coordinates are required",
        received: { workerId: !!workerId, location: !!location }
      });
    }

    // Check if location update is necessary (throttle frequent updates)
    const cachedData = locationUpdateCache.get(workerId);
    const now = Date.now();
    
    if (cachedData) {
      const timeSinceLastUpdate = now - cachedData.timestamp;
      const distanceMoved = calculateDistance(
        cachedData.location.latitude, cachedData.location.longitude,
        location.latitude, location.longitude
      );
      
      // Skip update if worker hasn't moved significantly and update was recent
      if (distanceMoved < 0.05 && timeSinceLastUpdate < LOCATION_UPDATE_THROTTLE) { // 50m threshold
        // Still emit socket update for real-time tracking without DB write
        const io = req.app.get('io');
        if (io) {
          io.emit('worker:location_update', {
            workerId,
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: timestamp || now,
            }
          });
        }
        
        return res.json({ 
          success: true,
          message: "Location update throttled (minimal movement)",
          cached: true,
          distance: distanceMoved,
          nextDbUpdateIn: Math.max(0, LOCATION_UPDATE_THROTTLE - timeSinceLastUpdate)
        });
      }
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      console.error('❌ Worker not found:', workerId);
      return res.status(404).json({ message: "Worker not found" });
    }

    // Update worker's current location in database
    worker.currentLocation = {
      city: worker.currentLocation?.city || 'Unknown',
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
    };

    await worker.save();
    console.log('✅ Location updated for worker:', worker.name, worker._id);

    // Cache the update
    locationUpdateCache.set(workerId, { location, timestamp: now });

    // Emit location update via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('worker:location_update', {
        workerId: worker._id,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: timestamp || now,
        }
      });
    }

    res.json({ 
      success: true,
      message: "Location updated successfully",
      location: worker.currentLocation 
    });
  } catch (error) {
    console.error('❌ Update location error:', error);
    res.status(500).json({ message: "Failed to update location", error: String(error) });
  }
});

// Update worker availability status
router.patch("/update-status", async (req: Request, res: Response) => {
  try {
    const { workerId, status, availableAfter } = req.body;
    
    if (!workerId || !status) {
      return res.status(400).json({ message: "Worker ID and status are required" });
    }

    if (!['available', 'busy'].includes(status)) {
      return res.status(400).json({ message: "Status must be 'available' or 'busy'" });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Update worker status
    worker.status = status;
    if (availableAfter) {
      worker.availableAfter = new Date(availableAfter);
    } else if (status === 'available') {
      worker.availableAfter = undefined;
    }

    await worker.save();

    // Emit status change via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('worker:status_change', {
        workerId: worker._id,
        status: status,
        availableAfter: worker.availableAfter,
      });
    }

    res.json({ 
      success: true, 
      message: "Status updated successfully",
      status: worker.status,
      availableAfter: worker.availableAfter 
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: "Failed to update status", error: String(error) });
  }
});

// Get available workers with real-time status
router.get("/available", async (req: Request, res: Response) => {
  try {
    const { serviceCategory, latitude, longitude, radius = 10 } = req.query;
    
    const query: any = {
      status: 'available',
      isActive: true,
      // Don't require verificationStatus - let workers show up even if pending
      // Verification filtering happens when sending booking requests
    };

    if (serviceCategory) {
      // Case-insensitive match so 'Carpentry' and 'Carpenter' both match
      query.serviceCategories = { $elemMatch: { $regex: new RegExp(String(serviceCategory), 'i') } };
    }

    console.log(`🔍 Fetching available workers with query:`, JSON.stringify(query, null, 2));
    console.log('ℹ️ Note: Showing all available workers. Verification filtering happens when sending booking requests.');

    // First, let's check ALL workers in the database to see what we have
    const allWorkersDb = await WorkerUser.find({}).select('_id name phone email serviceCategories status isActive verificationStatus currentLocation').lean();
    console.log(`📊 Total workers in database: ${allWorkersDb.length}`);
    console.log('📋 All workers in database:', allWorkersDb.map(w => ({
      id: w._id,
      name: w.name,
      phone: w.phone,
      status: w.status,
      isActive: w.isActive,
      verificationStatus: w.verificationStatus,
      categories: w.serviceCategories,
      hasLocation: !!w.currentLocation?.coordinates,
    })));

    // Test the query step by step
    console.log('🔍 Testing query step by step...');
    
    // Test 1: Just status and isActive
    const test1 = await WorkerUser.find({ status: 'available', isActive: true }).countDocuments();
    console.log(`  Test 1 (status='available', isActive=true): ${test1} workers`);
    
    // Test 2: Add category filter
    if (serviceCategory) {
      const test2Query: any = {
        status: 'available',
        isActive: true,
        serviceCategories: { $elemMatch: { $regex: new RegExp(String(serviceCategory), 'i') } },
      };
      const test2 = await WorkerUser.find(test2Query).countDocuments();
      console.log(`  Test 2 (with category filter for "${serviceCategory}"): ${test2} workers`);
      console.log(`  Test 2 query:`, JSON.stringify(test2Query, null, 2));
    }

    const workers = await WorkerUser.find(query)
      .select('name phone email serviceCategories rating totalJobs completedJobs currentLocation profileImage status availableAfter _id')
      .lean();

    console.log(`✅ Found ${workers.length} workers matching query`);
    console.log(`📋 Query used:`, JSON.stringify(query, null, 2));
    console.log('🎯 Matching workers:', workers.map(w => ({
      id: w._id,
      name: w.name,
      phone: w.phone,
      categories: w.serviceCategories,
      status: w.status,
      hasLocation: !!w.currentLocation?.coordinates,
    })));

    // If no workers match, show why
    if (workers.length === 0 && allWorkersDb.length > 0) {
      console.warn('⚠️ No workers match criteria. Checking each worker:');
      allWorkersDb.forEach(worker => {
        const checks = {
          hasCorrectStatus: worker.status === 'available',
          isActive: worker.isActive === true,
          matchesCategory: serviceCategory ? worker.serviceCategories?.some(cat => 
            new RegExp(String(serviceCategory), 'i').test(cat)
          ) : true,
          hasLocation: !!worker.currentLocation?.coordinates,
          categories: worker.serviceCategories,
        };
        const reasons = [];
        if (!checks.hasCorrectStatus) reasons.push(`status=${worker.status} (needs 'available')`);
        if (!checks.isActive) reasons.push('isActive=false');
        if (serviceCategory && !checks.matchesCategory) reasons.push(`no matching category for "${serviceCategory}"`);
        
        console.warn(`  Worker ${worker.name} (${worker._id}):`, {
          ...checks,
          reasons: reasons.length > 0 ? reasons : '✅ Should be included',
        });
      });
    }

    // Filter by location if coordinates provided
    let availableWorkers = workers;
    if (latitude && longitude) {
      const userLat = parseFloat(latitude as string);
      const userLon = parseFloat(longitude as string);
      const maxRadius = parseFloat(radius as string);

      availableWorkers = workers
        .map(worker => {
          // If worker has location, calculate distance
          if (worker.currentLocation?.coordinates?.latitude && worker.currentLocation?.coordinates?.longitude) {
            const distance = calculateDistance(
              userLat,
              userLon,
              worker.currentLocation.coordinates.latitude,
              worker.currentLocation.coordinates.longitude
            );
            
            return {
              ...worker,
              distance: Math.round(distance * 10) / 10,
              estimatedArrival: Math.round(distance * 2 + Math.random() * 10),
              isAvailable: true,
            };
          } else {
            // Worker without location - still include them but mark distance as unknown
            return {
              ...worker,
              distance: Infinity, // Will be filtered out if radius is specified
              estimatedArrival: null,
              isAvailable: true,
            };
          }
        })
        .filter(worker => {
          // If radius is specified, filter by distance
          // If no location, include them anyway (they'll show as "distance unknown")
          if (maxRadius && maxRadius > 0) {
            return worker.distance <= maxRadius || worker.distance === Infinity;
          }
          return true;
        })
        .sort((a, b) => {
          // Sort: workers with known distance first, then by distance
          if (a.distance === Infinity && b.distance !== Infinity) return 1;
          if (a.distance !== Infinity && b.distance === Infinity) return -1;
          return a.distance - b.distance;
        });
    } else {
      // No location provided - return all workers without distance filtering
      availableWorkers = workers.map(worker => ({
        ...worker,
        distance: undefined,
        estimatedArrival: undefined,
        isAvailable: true,
      }));
    }

    console.log(`✅ Returning ${availableWorkers.length} available workers`);

    res.json({
      success: true,
      workers: availableWorkers,
      count: availableWorkers.length,
    });
  } catch (error) {
    console.error('Get available workers error:', error);
    res.status(500).json({ message: "Failed to get available workers", error: String(error) });
  }
});

// Update worker service categories
router.patch("/update-service-categories", async (req: Request, res: Response) => {
  try {
    const { workerId, serviceCategories } = req.body;
    
    if (!workerId || !Array.isArray(serviceCategories)) {
      return res.status(400).json({ message: "Worker ID and service categories array are required" });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Update worker service categories
    worker.serviceCategories = serviceCategories;
    await worker.save();

    res.json({ 
      success: true, 
      message: "Service categories updated successfully",
      serviceCategories: worker.serviceCategories
    });
  } catch (error) {
    console.error('Update service categories error:', error);
    res.status(500).json({ message: "Failed to update service categories", error: String(error) });
  }
});

// Dev helper: upsert a worker with basic visible fields
router.post("/dev/ensure", async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Forbidden in production' });
    }

    const { workerId, name, phone, skills, serviceCategories, location, status } = req.body;
    if (!workerId) {
      return res.status(400).json({ message: 'workerId is required' });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    if (name) worker.name = String(name);
    if (phone) worker.phone = String(phone);
    if (Array.isArray(skills)) worker.skills = skills.map((s: any) => String(s));
    if (Array.isArray(serviceCategories)) worker.serviceCategories = serviceCategories.map((c: any) => String(c));
    if (status === 'available' || status === 'busy') worker.status = status;

    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      if (!worker.currentLocation) {
        worker.currentLocation = { city: '' };
      }
      worker.currentLocation.coordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
      } as any;
    }

    // Make visible even if pending during dev
    if (!worker.verificationStatus || worker.verificationStatus === 'pending') {
      worker.verificationStatus = 'pending';
    }

    await worker.save();

    return res.json({ success: true, worker: {
      _id: worker._id,
      name: worker.name,
      phone: worker.phone,
      skills: worker.skills,
      serviceCategories: worker.serviceCategories,
      status: worker.status,
      currentLocation: worker.currentLocation,
      verificationStatus: worker.verificationStatus,
    }});
  } catch (error) {
    console.error('Dev ensure worker error:', error);
    res.status(500).json({ message: 'Failed to upsert worker', error: String(error) });
  }
});

// Test endpoint to verify backend and database connection
router.get("/test", async (req: Request, res: Response) => {
  try {
    const dbStatus = WorkerUser.db.readyState;
    const totalWorkers = await WorkerUser.countDocuments({});
    return res.json({ 
      status: 'ok', 
      database: dbStatus === 1 ? 'connected' : 'disconnected',
      readyState: dbStatus,
      totalWorkers 
    });
  } catch (error: any) {
    return res.status(500).json({ 
      status: 'error', 
      error: error?.message || String(error) 
    });
  }
});

// Get worker statistics by category for dashboard
// Returns counts of pending requests and verified workers for each service category
router.get("/stats-by-category", async (req: Request, res: Response) => {
  try {
    console.log('📊 Fetching worker stats by category...');
    
    // Check database connection
    const dbStatus = WorkerUser.db.readyState;
    console.log('🔌 Database readyState:', dbStatus);
    
    if (dbStatus !== 1) {
      console.error('❌ Database not connected. ReadyState:', dbStatus);
      return res.status(500).json({ 
        message: "Database connection error", 
        error: `Database readyState: ${dbStatus} (1 = connected, 0 = disconnected, 2 = connecting, 3 = disconnecting)` 
      });
    }

    const categories = [
      'Plumber', 'Electrician', 'Carpenter', 'Cleaner', 'Mechanic', 
      'AC Repair', 'Painter', 'Mason', 'Cook', 'Driver', 'Security', 
      'Beautician', 'Technician', 'Delivery', 'Gardener'
    ];

    // Get total worker count for debugging
    let totalWorkersInDb = 0;
    let allWorkers: any[] = [];
    
    try {
      totalWorkersInDb = await WorkerUser.countDocuments({});
      console.log(`📈 Total workers in database: ${totalWorkersInDb}`);
      
      // Fetch all workers once for efficient processing
      allWorkers = await WorkerUser.find({}).select('serviceCategories verificationStatus verificationSubmitted').lean();
      console.log(`📋 Fetched ${allWorkers.length} workers from database`);
    } catch (dbError: any) {
      console.error('❌ Database query error:', dbError);
      return res.status(500).json({ 
        message: "Database query failed", 
        error: dbError?.message || String(dbError)
      });
    }

    const stats = categories.map((category) => {
      try {
        // Filter workers that have this category (case-insensitive)
        const categoryRegex = new RegExp(`^${category}$`, 'i');
        const workersInCategory = allWorkers.filter(worker => 
          Array.isArray(worker.serviceCategories) && 
          worker.serviceCategories.some((cat: string) => categoryRegex.test(String(cat)))
        );
        
        const totalWorkers = workersInCategory.length;

        // Count verified workers FIRST (to exclude them from pending)
        const verifiedWorkers = workersInCategory.filter(worker => {
          const status = worker.verificationStatus;
          // A worker is verified if overall status is 'verified'
          if (status && typeof status === 'object' && status.overall === 'verified') {
            return true;
          }
          if (status === 'verified') {
            return true;
          }
          return false;
        }).length;

        // Count pending verification requests (EXCLUDE verified workers)
        // A worker is pending if:
        // 1. They have submitted documents (verificationSubmitted = true)
        // 2. Their overall status is NOT 'verified' (could be 'pending' or 'rejected' or not set)
        const pendingRequests = workersInCategory.filter(worker => {
          const status = worker.verificationStatus;
          
          // CRITICAL: If worker is verified, they are NEVER pending
          if (status && typeof status === 'object' && status.overall === 'verified') {
            return false; // Verified workers are NOT pending
          }
          if (status === 'verified') {
            return false; // Verified workers are NOT pending
          }
          
          // Worker has submitted documents for verification
          if (worker.verificationSubmitted) {
            // Check overall status
            if (status && typeof status === 'object') {
              // If overall is 'pending' or not set, they are pending
              if (!status.overall || status.overall === 'pending') {
                return true;
              }
              // If overall is 'rejected', they are still pending (needs resubmission/review)
              if (status.overall === 'rejected') {
                return true;
              }
              // If overall is 'verified', they are NOT pending (already checked above, but double-check)
              if (status.overall === 'verified') {
                return false;
              }
            } else if (!status || status === 'pending') {
              // No status object or status is string 'pending'
              return true;
            }
          }
          
          return false;
        }).length;

        return {
          id: category.toLowerCase().replace(/\s+/g, '-'),
          name: category,
          icon: getCategoryIcon(category),
          color: getCategoryColor(category),
          pendingRequests,
          verifiedWorkers,
          totalWorkers,
        };
      } catch (categoryError: any) {
        console.error(`❌ Error processing category ${category}:`, categoryError?.message || categoryError);
        // Return default values for this category if there's an error
        return {
          id: category.toLowerCase().replace(/\s+/g, '-'),
          name: category,
          icon: getCategoryIcon(category),
          color: getCategoryColor(category),
          pendingRequests: 0,
          verifiedWorkers: 0,
          totalWorkers: 0,
        };
      }
    });

    console.log(`✅ Worker stats by category fetched: ${stats.length} categories`);
    console.log('📊 Stats summary:', stats.map((s: { name: string; totalWorkers: number; pendingRequests: number; verifiedWorkers: number }) => `${s.name}: ${s.totalWorkers} total, ${s.pendingRequests} pending, ${s.verifiedWorkers} verified`));
    
    res.json(stats);
  } catch (error: any) {
    console.error('❌ Error fetching worker stats by category:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    res.status(500).json({ 
      message: "Failed to fetch worker stats", 
      error: error?.message || String(error),
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// Claim reward points to cash (100 points = Rs. 1) - must be before GET /:id
router.post("/:id/claim-rewards", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pointsToClaim } = req.body as { pointsToClaim?: number };
    const minPoints = 100;
    const pointsPerRupee = 100;
    if (pointsToClaim == null || pointsToClaim < minPoints) {
      return res.status(400).json({ message: `Minimum ${minPoints} points required to claim. Rate: ${pointsPerRupee} points = Rs. 1` });
    }
    const worker = await WorkerUser.findById(id);
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    const current = worker.rewardPoints ?? 0;
    if (current < pointsToClaim) {
      return res.status(400).json({ message: `Insufficient points. You have ${current} points.` });
    }
    const cashAmount = Math.floor(pointsToClaim / pointsPerRupee);
    const newPoints = current - pointsToClaim;
    const newEarnings = (worker.totalEarnings ?? 0) + cashAmount;
    await WorkerUser.findByIdAndUpdate(id, {
      rewardPoints: Math.max(0, newPoints),
      totalEarnings: newEarnings,
    });
    const io = req.app.get('io');
    if (io) {
      io.to(String(id)).emit('worker:reward_points_updated', {
        workerId: id,
        totalPoints: Math.max(0, newPoints),
        pointsUsed: pointsToClaim,
        earningsUpdated: newEarnings,
        cashClaimed: cashAmount,
      });
    }
    return res.json({
      message: 'Points claimed successfully',
      pointsDeducted: pointsToClaim,
      cashAdded: cashAmount,
      totalEarnings: newEarnings,
      rewardPoints: Math.max(0, newPoints),
    });
  } catch (err: any) {
    console.error('Claim rewards error:', err);
    return res.status(500).json({ message: 'Failed to claim rewards' });
  }
});

// Get worker by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const worker = await WorkerUser.findById(id).select('-password');
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    res.status(200).json(worker);
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({ message: "Failed to get worker", error: String(error) });
  }
});

// Update worker profile (name, email, phone, skills)
router.patch("/update-profile", async (req: Request, res: Response) => {
  try {
    const { workerId, name, email, phone, skills } = req.body;

    if (!workerId) {
      return res.status(400).json({ message: "Worker ID is required" });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Update profile fields
    if (name) worker.name = name;
    if (email) worker.email = email.toLowerCase().trim();
    if (phone) worker.phone = phone;
    if (skills) worker.skills = Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim()).filter((s: string) => s);

    await worker.save();

    console.log(`✅ Profile updated for worker: ${worker.name} (${workerId})`);

    res.status(200).json({
      message: "Profile updated successfully",
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        skills: worker.skills,
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: "Failed to update profile", error: String(error) });
  }
});

// Update worker profile image
router.patch("/update-profile-image", async (req: Request, res: Response) => {
  try {
    const { workerId, profileImage } = req.body;

    if (!workerId) {
      return res.status(400).json({ message: "Worker ID is required" });
    }

    if (!profileImage) {
      return res.status(400).json({ message: "Profile image is required" });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Update profile image
    worker.profileImage = profileImage;
    await worker.save();

    console.log(`Profile image updated for worker: ${workerId}`);

    res.status(200).json({
      message: "Profile image updated successfully",
      profileImage: worker.profileImage
    });
  } catch (error) {
    console.error('Update profile image error:', error);
    res.status(500).json({ message: "Failed to update profile image", error: String(error) });
  }
});

// Verify current password
router.post("/verify-password", async (req: Request, res: Response) => {
  try {
    const { workerId, currentPassword } = req.body;

    if (!workerId || !currentPassword) {
      return res.status(400).json({ message: "Worker ID and current password are required" });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Note: In production, use bcrypt to compare hashed passwords
    if (worker.password !== currentPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    return res.json({ message: "Password verified successfully", verified: true });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ message: "Failed to verify password", error: String(error) });
  }
});

// Change password with current password
router.post("/change-password", async (req: Request, res: Response) => {
  try {
    const { workerId, currentPassword, newPassword } = req.body;

    if (!workerId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "Worker ID, current password, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Verify current password
    // Note: In production, use bcrypt to compare hashed passwords
    if (worker.password !== currentPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password
    // Note: In production, hash the password before saving
    worker.password = newPassword;
    await worker.save();

    console.log(`✅ Password changed for worker: ${worker.name} (${workerId})`);

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: "Failed to change password", error: String(error) });
  }
});

// Forgot password - send OTP
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const worker = await WorkerUser.findOne({ email: email.toLowerCase().trim() });
    if (!worker) {
      // Avoid leaking user existence
      return res.json({ message: "If an account exists, an OTP has been sent to your email" });
    }

    // Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    worker.otpCode = otpCode;
    worker.otpExpires = otpExpires;
    await worker.save();

    // Send OTP via email
    try {
      const { sendOTPEmail } = require('../utils/emailService');
      const emailResult = await sendOTPEmail(email, otpCode, worker.name);
      
      if (emailResult.success) {
        console.log(`✅ OTP email sent to ${email}`);
      } else {
        console.error(`❌ Failed to send OTP email: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Continue even if email fails - OTP is still saved
    }

    // For testing - show OTP in console
    console.log(`📧 OTP for ${email}: ${otpCode}`);

    return res.json({ 
      message: "OTP sent to your email", 
      email: email,
      // For testing only - remove in production
      otp: process.env.NODE_ENV === 'development' ? otpCode : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: "Failed to send OTP", error: String(error) });
  }
});

// Verify OTP
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const worker = await WorkerUser.findOne({ email: email.toLowerCase().trim() });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    if (!worker.otpCode || !worker.otpExpires) {
      return res.status(400).json({ message: "No OTP found. Please request a new OTP" });
    }

    if (worker.otpCode !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    if (new Date() > worker.otpExpires) {
      return res.status(401).json({ message: "OTP has expired. Please request a new OTP" });
    }

    return res.json({ message: "OTP verified successfully", verified: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: "Failed to verify OTP", error: String(error) });
  }
});

// Reset password with OTP
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const worker = await WorkerUser.findOne({ email: email.toLowerCase().trim() });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    if (!worker.otpCode || !worker.otpExpires) {
      return res.status(400).json({ message: "No OTP found. Please request a new OTP" });
    }

    if (worker.otpCode !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    if (new Date() > worker.otpExpires) {
      return res.status(401).json({ message: "OTP has expired. Please request a new OTP" });
    }

    // Update password and clear OTP
    // Note: In production, hash the password before saving
    worker.password = newPassword;
    worker.otpCode = undefined;
    worker.otpExpires = undefined;
    await worker.save();

    console.log(`✅ Password reset for worker: ${worker.name} (${worker.email})`);

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: "Failed to reset password", error: String(error) });
  }
});

// Helper function to get category icon
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Plumber': '🔧',
    'Electrician': '⚡',
    'Carpenter': '🔨',
    'Cleaner': '🧹',
    'Mechanic': '🔩',
    'AC Repair': '❄️',
    'Painter': '🎨',
    'Mason': '🧱',
    'Cook': '👨‍🍳',
    'Driver': '🚗',
    'Security': '🛡️',
    'Beautician': '💅',
    'Technician': '🔌',
    'Delivery': '📦',
    'Gardener': '🌱',
  };
  return icons[category] || '👷';
}

// Helper function to get category color
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'Plumber': '#4A90E2',
    'Electrician': '#F39C12',
    'Carpenter': '#8E44AD',
    'Cleaner': '#27AE60',
    'Mechanic': '#E74C3C',
    'AC Repair': '#3498DB',
    'Painter': '#E67E22',
    'Mason': '#95A5A6',
    'Cook': '#D35400',
    'Driver': '#16A085',
    'Security': '#2C3E50',
    'Beautician': '#E91E63',
    'Technician': '#9C27B0',
    'Delivery': '#00BCD4',
    'Gardener': '#2ECC71',
  };
  return colors[category] || '#7F8C8D';
}

export default router;
