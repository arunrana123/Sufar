// BOOKING ROUTES - Handles all booking CRUD operations and status updates
// Endpoints: POST /create, GET /user/:userId, GET /:id, DELETE /:id, PUT /:id/status
// Features: Create bookings, fetch user bookings, update status, cancel bookings, Socket.IO notifications
import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.model';
import WorkerUser from '../models/WorkerUser.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import Service from '../models/Service.model';

const router = Router();

// Cache for booking queries to reduce database load
const bookingCache = new Map<string, { data: any, timestamp: number }>();
const BOOKING_CACHE_TTL = 60000; // 1 minute cache for bookings

// Creates new booking and notifies nearby workers via Socket.IO
// POST / - Body: userId, serviceId, serviceName, location, scheduledDate, price
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      serviceId,
      serviceName,
      serviceCategory,
      description,
      images,
      location,
      scheduledDate,
      price
    } = req.body;

    console.log('Received booking data:', {
      userId,
      serviceId,
      serviceName,
      serviceCategory,
      description,
      images: images?.length || 0,
      location,
      scheduledDate,
      price
    });

    // Validate required fields
    if (!userId || !serviceId || !serviceName || !serviceCategory || !description || !location || !price) {
      console.error('Missing required fields:', {
        userId: !!userId,
        serviceId: !!serviceId,
        serviceName: !!serviceName,
        serviceCategory: !!serviceCategory,
        description: !!description,
        location: !!location,
        price: !!price
      });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate location structure
    if (!location.address || !location.coordinates || !location.coordinates.latitude || !location.coordinates.longitude) {
      console.error('Invalid location data:', location);
      return res.status(400).json({ 
        message: 'Invalid location data. Address and coordinates are required.',
        received: location 
      });
    }

    // Ensure address is a non-empty string
    const locationAddress = location.address && location.address.trim() !== ''
      ? location.address.trim()
      : `Location at ${location.coordinates.latitude}, ${location.coordinates.longitude}`;

    // Check if this is a scheduled booking (for future date/time)
    const isScheduled = scheduledDate && new Date(scheduledDate) > new Date();
    
    const booking = new Booking({
      userId,
      serviceId,
      serviceName,
      serviceCategory,
      description,
      images: images || [],
      location: {
        address: locationAddress,
        coordinates: {
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude,
        },
      },
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      price: parseFloat(price) || 0,
      isScheduled: isScheduled || false,
    });

    console.log('Creating booking with data:', booking.toObject());
    console.log('Scheduled date:', scheduledDate ? new Date(scheduledDate) : 'Instant booking');
    console.log('Is scheduled booking:', isScheduled);
    await booking.save();
    console.log('Booking saved successfully:', booking._id);
    console.log('Booking status:', booking.status);

    // Clear relevant booking caches when new booking is created
    for (const [key] of bookingCache.entries()) {
      if (key.includes('worker_bookings') || key.includes(`user_${userId}`)) {
        bookingCache.delete(key);
      }
    }

    // Emit real-time event to notify workers (only verified workers for this service category)
    const io = req.app.get('io');
    if (io) {
      // Find available workers with location for distance calculation
      const userLat = location.coordinates.latitude;
      const userLng = location.coordinates.longitude;
      
      // Helper function to calculate distance between two coordinates (Haversine formula)
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
      };
      
      // Find all workers who:
      // 1. Have this service category in their serviceCategories array
      // 2. Are available (status === 'available' and isActive === true)
      // 3. Are verified for this service category
      try {
        // Normalize category name for matching (handle variations like "Carpenter" vs "Carpentry")
        const normalizeCategory = (cat: string): string => {
          const normalized = cat.toLowerCase().trim();
          // Handle common variations
          if (normalized.includes('carpenter') || normalized.includes('carpentry')) {
            return 'carpenter';
          }
          return normalized;
        };
        
        const normalizedCategory = normalizeCategory(booking.serviceCategory);
        
        // Use more flexible regex that matches category variations
        // Match "Carpenter", "Carpentry", etc. for carpenter-related services
        const categoryPattern = normalizedCategory === 'carpenter' 
          ? '(carpenter|carpentry)' 
          : normalizedCategory;
        
        // First, check all workers with this category (for debugging)
        const allWorkersWithCategory = await WorkerUser.find({
          serviceCategories: { $elemMatch: { $regex: new RegExp(categoryPattern, 'i') } },
        }).select('_id name serviceCategories categoryVerificationStatus status isActive').lean();
        
        console.log(`🔍 Diagnostic: Found ${allWorkersWithCategory.length} total workers with category matching "${booking.serviceCategory}"`);
        allWorkersWithCategory.forEach(w => {
          console.log(`   - ${w.name}: status=${w.status}, isActive=${w.isActive}, categories=${w.serviceCategories?.join(', ')}, verified=${Object.keys(w.categoryVerificationStatus || {}).join(', ')}`);
        });
        
        // Now query for available workers
        const availableWorkers = await WorkerUser.find({
          serviceCategories: { $elemMatch: { $regex: new RegExp(categoryPattern, 'i') } },
          isActive: true,
          status: 'available',
        }).select('_id name email phone serviceCategories categoryVerificationStatus currentLocation rating completedJobs badge rankScore');

        console.log(`✅ Found ${availableWorkers.length} available workers (isActive=true, status=available) with service category matching "${booking.serviceCategory}"`);
        console.log(`📋 Available workers details:`, availableWorkers.map(w => ({
          name: w.name,
          id: w._id,
          categories: w.serviceCategories,
          verificationStatus: w.categoryVerificationStatus,
          status: w.status,
          isActive: w.isActive,
        })));

        // Filter workers who:
        // 1. Have this service category (case-insensitive, handle variations)
        // 2. Are VERIFIED for this service category (handle category variations)
        const eligibleWorkers = availableWorkers
          .filter((worker) => {
            // Check if worker has the category (flexible matching)
            const hasCategory = worker.serviceCategories?.some((cat: string) => {
              const workerCat = normalizeCategory(cat);
              const bookingCat = normalizedCategory;
              return workerCat === bookingCat || 
                     workerCat.includes(bookingCat) || 
                     bookingCat.includes(workerCat);
            });
            
            if (!hasCategory) {
              console.log(`⚠️ Worker ${worker.name} does not have category "${booking.serviceCategory}"`);
              console.log(`   Worker categories:`, worker.serviceCategories);
              return false;
            }
            
            // CRITICAL: Only include workers who are VERIFIED for this category
            // Check verification status with flexible category matching
            let categoryStatus = worker.categoryVerificationStatus?.[booking.serviceCategory];
            
            // If not found with exact match, try to find matching category in verification status
            if (!categoryStatus && worker.categoryVerificationStatus) {
              const matchingCategory = Object.keys(worker.categoryVerificationStatus).find(cat => {
                const normalizedCat = normalizeCategory(cat);
                const normalizedBookingCat = normalizedCategory;
                // Handle variations like "Carpenter" vs "Carpentry"
                if (normalizedBookingCat.includes('carpenter') || normalizedBookingCat.includes('carpentry')) {
                  return normalizedCat.includes('carpenter') || normalizedCat.includes('carpentry');
                }
                return normalizedCat === normalizedBookingCat || 
                       normalizedCat.includes(normalizedBookingCat) || 
                       normalizedBookingCat.includes(normalizedCat);
              });
              
              if (matchingCategory) {
                categoryStatus = worker.categoryVerificationStatus[matchingCategory];
                console.log(`✅ Found matching verification status for worker ${worker.name}: "${matchingCategory}" -> ${categoryStatus}`);
              }
            }
            
            const isVerified = categoryStatus === 'verified';
            
            if (!isVerified) {
              console.log(`⚠️ Worker ${worker.name} has category "${booking.serviceCategory}" but is not verified`);
              console.log(`   Verification status: ${categoryStatus || 'not found'}`);
              console.log(`   Available verification keys:`, Object.keys(worker.categoryVerificationStatus || {}));
              return false;
            }
            
            console.log(`✅ Worker ${worker.name} is eligible: has category and is verified`);
            return true;
          })
          .map((worker) => {
            // Calculate distance if worker has location
            let distance = Infinity;
            const workerLoc = worker.currentLocation;
            if (workerLoc?.coordinates?.latitude && workerLoc?.coordinates?.longitude) {
              distance = calculateDistance(
                userLat, userLng,
                workerLoc.coordinates.latitude,
                workerLoc.coordinates.longitude
              );
            }
            
            // Calculate badge priority (higher = better)
            // Platinum (2000+): 4, Gold (1200-1999): 3, Silver (500-1199): 2, Iron (0-499): 1
            const completedJobs = worker.completedJobs || 0;
            const workerBadge = worker.badge || 'Iron';
            let badgePriority = 1; // Iron
            if (workerBadge === 'Platinum' || completedJobs >= 2000) {
              badgePriority = 4; // Platinum
            } else if (workerBadge === 'Gold' || completedJobs >= 1200) {
              badgePriority = 3; // Gold
            } else if (workerBadge === 'Silver' || completedJobs >= 500) {
              badgePriority = 2; // Silver
            }
            
            // Use rankScore if available, otherwise calculate from badge and rating
            const rating = worker.rating || 0;
            const rankScore = worker.rankScore || 0;
            const priorityScore = rankScore > 0 
              ? rankScore 
              : (badgePriority * 100) + (rating * 10); // Badge is more important than rating
            
            return { worker, distance, badgePriority, priorityScore };
          })
          .sort((a, b) => {
            // First sort by priority score (higher is better), then by distance (lower is better)
            if (b.priorityScore !== a.priorityScore) {
              return b.priorityScore - a.priorityScore;
            }
            return a.distance - b.distance;
          });

        console.log(`✅ Found ${eligibleWorkers.length} eligible workers, sorted by badge priority and distance`);
        console.log(`📋 Booking category: "${booking.serviceCategory}" (normalized: "${normalizedCategory}")`);
        eligibleWorkers.slice(0, 5).forEach((w, i) => {
          const badgeName = w.badgePriority === 4 ? 'Platinum' : w.badgePriority === 3 ? 'Gold' : w.badgePriority === 2 ? 'Silver' : 'Iron';
          const verificationStatus = w.worker.categoryVerificationStatus?.[booking.serviceCategory] || 'unknown';
          console.log(`  ${i+1}. ${w.worker.name} - ${badgeName} (${w.worker.completedJobs || 0} jobs, ${(w.worker.rating || 0).toFixed(1)}★, verified: ${verificationStatus}) - ${w.distance === Infinity ? 'Unknown' : w.distance.toFixed(2) + ' km'}`);
        });

        // Populate userId so workers receive customer name and phone for display and call
        await booking.populate('userId', 'firstName lastName profilePhoto phone');
        const bookingRequest = {
          _id: booking._id,
          userId: booking.userId,
          serviceId: booking.serviceId,
          serviceName: booking.serviceName,
          serviceCategory: booking.serviceCategory,
          price: booking.price,
          location: booking.location,
          scheduledDate: booking.scheduledDate,
          isScheduled: isScheduled,
          createdAt: booking.createdAt,
        };

        // Check how many workers are in the 'worker' room
        const workerRoom = io.sockets.adapter.rooms.get('worker');
        const workersInRoom = workerRoom ? workerRoom.size : 0;
        console.log(`📊 Workers currently in 'worker' socket room: ${workersInRoom}`);

        if (eligibleWorkers.length === 0) {
          console.warn(`⚠️ No eligible workers found for service category: "${booking.serviceCategory}"`);
          console.warn(`📊 Summary:`);
          console.warn(`   - Total workers found in initial query: ${availableWorkers.length}`);
          console.warn(`   - Workers filtered out (no category match or not verified): ${availableWorkers.length}`);
          console.warn(`   - Booking category: "${booking.serviceCategory}" (normalized: "${normalizedCategory}")`);
          console.warn(`   - Workers in socket room: ${workersInRoom}`);
          
          // Still emit to worker room as fallback - let worker app filter by verification
          // This ensures workers who are online but might have slight category name differences still get notified
          console.log(`📡 Emitting booking request to all ${workersInRoom} workers in 'worker' room as fallback`);
          io.to('worker').emit('booking:request', {
            ...bookingRequest,
            requiresVerification: true,
            serviceCategory: booking.serviceCategory,
          });
        } else {
          // For instant bookings, send to nearest available worker first
          // For scheduled bookings, send to all eligible workers
          if (isScheduled) {
            // Scheduled booking - send to all eligible workers
            console.log(`📅 Scheduled booking - notifying all ${eligibleWorkers.length} eligible workers`);
            io.to('worker').emit('booking:request', {
              ...bookingRequest,
              requiresVerification: true,
              serviceCategory: booking.serviceCategory,
              isScheduled: true,
            });
          } else {
            // Instant booking - prioritize nearest workers
            // Send to the nearest 3 workers (or all if less than 3)
            const nearestWorkers = eligibleWorkers.slice(0, 3);
            console.log(`🚀 Instant booking - notifying ${nearestWorkers.length} nearest workers`);
            
            nearestWorkers.forEach(({ worker, distance }) => {
              const workerId = String(worker._id);
              console.log(`  📤 Sending request to ${worker.name} (${distance === Infinity ? 'unknown distance' : distance.toFixed(2) + ' km'})`);
              
              // Send to specific worker by their ID room
              io.to(workerId).emit('booking:request', {
                ...bookingRequest,
                requiresVerification: true,
                serviceCategory: booking.serviceCategory,
                distanceFromUser: distance,
              });
            });
            
            // Also emit to general worker room as fallback
            const workerRoom = io.sockets.adapter.rooms.get('worker');
            const workersInRoom = workerRoom ? workerRoom.size : 0;
            console.log(`📡 Also emitting to ${workersInRoom} workers in 'worker' room as fallback`);
            io.to('worker').emit('booking:request', {
              ...bookingRequest,
              requiresVerification: true,
              serviceCategory: booking.serviceCategory,
            });
          }
          
          console.log(`✅ Booking request sent to workers`);
        }
      } catch (workerQueryError) {
        console.error('❌ Error querying workers:', workerQueryError);
        // Fallback: Send to all workers
        io.to('worker').emit('booking:request', {
          _id: booking._id,
          userId: booking.userId,
          serviceId: booking.serviceId,
          serviceName: booking.serviceName,
          serviceCategory: booking.serviceCategory,
          price: booking.price,
          location: booking.location,
          createdAt: booking.createdAt,
        });
      }
      
      // Also emit general booking created event
      io.emit('booking:created', booking);
    } else {
      console.error('❌ Socket.IO not available!');
    }

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: 'Failed to create booking', error: errorMessage });
  }
});

// Get user's bookings
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const filter: any = { userId };
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate('workerId', 'firstName lastName profileImage rating')
      .exec();

    res.json(bookings);
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// Get worker's bookings - Optimized with intelligent caching
// Returns: 1) Bookings assigned to this worker, 2) Pending bookings matching worker's service categories
router.get('/worker/:workerId', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;
    const { status } = req.query;

    // Create cache key based on workerId and status filter
    const cacheKey = `worker_bookings_${workerId}_${status || 'all'}`;
    const cachedData = bookingCache.get(cacheKey);
    const now = Date.now();

    // Return cached data if available and not expired
    if (cachedData && (now - cachedData.timestamp < BOOKING_CACHE_TTL)) {
      console.log(`📋 Returning cached bookings for worker ${workerId} (${cachedData.data.length} bookings)`);
      return res.json(cachedData.data);
    }

    // Get worker's service categories
    const worker = await WorkerUser.findById(workerId).select('serviceCategories');
    const workerCategories = worker?.serviceCategories || [];

    // Build filter: bookings assigned to this worker OR pending bookings matching worker's categories
    const filter: any = {
      $or: [
        { workerId: workerId }, // Bookings assigned to this worker (any status)
        {
          // Pending bookings that match worker's service categories
          status: 'pending',
          $or: [
            { workerId: null }, // No worker assigned yet
            { workerId: { $exists: false } }, // workerId field doesn't exist
            { workerId: '' }, // Empty string workerId
          ],
          // Match worker's categories OR if worker has no categories, show all pending
          ...(workerCategories.length > 0 
            ? { serviceCategory: { $in: workerCategories } }
            : {}
          ),
        },
      ],
    };

    // If status filter is provided, apply it
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName profilePhoto phone')
      .exec();

    console.log(`✅ Fetched ${bookings.length} bookings for worker ${workerId} from database`);
    
    // Cache the results
    bookingCache.set(cacheKey, { data: bookings, timestamp: now });

    // Clear old cache entries periodically (simple cleanup)
    if (bookingCache.size > 100) {
      const oldestAllowed = now - (BOOKING_CACHE_TTL * 2);
      for (const [key, value] of bookingCache.entries()) {
        if (value.timestamp < oldestAllowed) {
          bookingCache.delete(key);
        }
      }
    }

    res.json(bookings);
  } catch (error) {
    console.error('Get worker bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// Update booking status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, workerId, notes, workStartTime } = req.body;

    const updateData: any = { status };
    if (workerId) updateData.workerId = workerId;
    if (notes) updateData.workerNotes = notes;
    if (workStartTime) updateData.workStartTime = new Date(workStartTime);

    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const booking = await Booking.findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'firstName lastName profilePhoto phone')
      .populate('workerId', 'firstName lastName profileImage')
      .exec();

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Create notification for user when work status changes
    const io = req.app.get('io');
    let userNotification = null;
    const userId = String(booking.userId);

    try {
      // Create notification for work started (in_progress)
      if (status === 'in_progress') {
        const userObjectId = typeof booking.userId === 'string' 
          ? new mongoose.Types.ObjectId(booking.userId)
          : booking.userId;

        userNotification = await Notification.create({
          userId: userObjectId,
          title: 'Work Started',
          message: `The worker has started working on your ${booking.serviceName} service.`,
          type: 'booking',
          isRead: false,
          data: {
            bookingId: booking._id,
            serviceName: booking.serviceName,
            workerId: booking.workerId,
            status: 'in_progress',
            workStartTime: new Date(),
          },
        });
        console.log('✅ Work started notification created:', userNotification._id);
      }
      
      // Create notification for work completed
      if (status === 'completed') {
        const userObjectId = typeof booking.userId === 'string' 
          ? new mongoose.Types.ObjectId(booking.userId)
          : booking.userId;

        // Create notification for USER (customer)
        userNotification = await Notification.create({
          userId: userObjectId,
          title: 'Service Completed',
          message: `Great news! Your ${booking.serviceName} service has been completed successfully.`,
          type: 'booking',
          isRead: false,
          data: {
            bookingId: booking._id,
            serviceName: booking.serviceName,
            workerId: booking.workerId,
            status: 'completed',
          },
        });
        console.log('✅ Work completed notification created for user:', userNotification._id);
        
        // Create notification for WORKER who completed the job
        if (booking.workerId) {
          try {
            const workerId = typeof booking.workerId === 'object' ? (booking.workerId as any)._id : booking.workerId;
            const workerObjectId = typeof workerId === 'string' 
              ? new mongoose.Types.ObjectId(workerId)
              : workerId;

            // Create notification for worker
            const workerNotif = await Notification.create({
              userId: workerObjectId, // Worker ID stored in userId field
              title: 'Job Completed',
              message: `You have successfully completed the ${booking.serviceName} job. Great work!`,
              type: 'job',
              isRead: false,
              data: {
                bookingId: booking._id,
                serviceName: booking.serviceName,
                workerId: workerId,
                status: 'completed',
              },
            });
            console.log('✅ Job completed notification created for worker:', workerNotif._id);

            // Emit notification to worker
            if (io) {
              io.to(String(workerId)).emit('notification:new', workerNotif.toObject());
              io.to('worker').emit('notification:new', workerNotif.toObject());
              console.log('✅ Job completed notification sent to worker:', workerId);
            }
            
            // Count actual completed bookings for this worker
            const completedBookingsCount = await Booking.countDocuments({
              workerId: workerId,
              status: 'completed',
            });
            
            // Calculate real average rating from all completed bookings with ratings
            const ratedBookings = await Booking.find({
              workerId: workerId,
              status: 'completed',
              rating: { $exists: true, $gt: 0 },
            });
            
            const totalRating = ratedBookings.reduce((sum, b) => sum + (b.rating || 0), 0);
            const avgRating = ratedBookings.length > 0 ? totalRating / ratedBookings.length : 0;
            
            // Calculate badge based on completed jobs
            let badge: 'Iron' | 'Silver' | 'Gold' | 'Platinum' = 'Iron';
            if (completedBookingsCount >= 2000) {
              badge = 'Platinum';
            } else if (completedBookingsCount >= 1200) {
              badge = 'Gold';
            } else if (completedBookingsCount >= 500) {
              badge = 'Silver';
            }
            
            // Calculate rankScore: (rating * 20) + (reviews * 2) + (completedJobs * 0.5)
            const totalReviews = ratedBookings.length;
            const rankScore = (avgRating * 20) + (totalReviews * 2) + (completedBookingsCount * 0.5);
            
            // Calculate total earnings from completed paid bookings
            const paidBookings = await Booking.find({
              workerId: workerId,
              status: 'completed',
              paymentStatus: 'paid',
            });
            const totalEarnings = paidBookings.reduce((sum, b) => sum + (b.price || 0), 0);
            
            // Update worker with all stats (reward points are updated separately when payment is confirmed)
            await WorkerUser.findByIdAndUpdate(workerId, {
              status: 'available',
              currentBookingId: null,
              completedJobs: completedBookingsCount,
              serviceJobsCompleted: completedBookingsCount, // Service jobs
              rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
              totalReviews: totalReviews,
              badge: badge,
              rankScore: Math.round(rankScore * 10) / 10, // Round to 1 decimal
              totalEarnings: totalEarnings,
            });
            
            console.log('✅ Worker stats updated:', {
              workerId,
              completedJobs: completedBookingsCount,
              rating: Math.round(avgRating * 10) / 10,
            });
          } catch (workerStatusError) {
            console.error('⚠️ Error updating worker stats or creating notification:', workerStatusError);
          }
        }
      }
    } catch (notifError) {
      console.error('⚠️ Error creating status notification:', notifError);
    }

    // Emit real-time events
    if (io) {
      // Emit booking:updated to the specific user who made the booking
      io.to(userId).emit('booking:updated', booking.toObject());
      console.log('✅ booking:updated event sent to user:', userId);
      
      // Also emit to worker room so workers can see status updates
      if (booking.workerId) {
        io.to(String(booking.workerId)).emit('booking:updated', booking.toObject());
        io.to('worker').emit('booking:updated', booking.toObject());
      }
      
      // Emit notification:new to user if notification was created
      if (userNotification) {
        io.to(userId).emit('notification:new', userNotification.toObject());
        io.to('user').emit('notification:new', userNotification.toObject());
        console.log('✅ Status notification sent to user:', userId);
      }
    }

    res.json(booking);
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Failed to update booking' });
  }
});

// Assign worker to booking
router.patch('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { workerId, status: 'accepted' },
      { new: true }
    )
      .populate('userId', 'firstName lastName profilePhoto phone')
      .populate('workerId', 'firstName lastName profileImage')
      .exec();

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('booking:assigned', booking);
    }

    res.json(booking);
  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(500).json({ message: 'Failed to assign worker' });
  }
});

// Update booking status (for navigation and work progress)
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, workStartTime } = req.body;

    console.log('📝 Update booking status:', { bookingId: id, status, workStartTime });

    const updateData: any = { status };
    if (workStartTime) {
      updateData.workStartTime = new Date(workStartTime);
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    console.log('✅ Booking status updated:', booking.status);

    // Clear relevant booking caches when booking status is updated
    for (const [key] of bookingCache.entries()) {
      if (key.includes('worker_bookings') || key.includes(`user_${booking.userId}`)) {
        bookingCache.delete(key);
      }
    }

    // Emit real-time event to user and worker
    const io = req.app.get('io');
    if (io) {
      io.to(String(booking.userId)).emit('booking:status_updated', {
        bookingId: booking._id,
        status: booking.status,
        workStartTime: booking.status === 'in_progress' ? new Date() : booking.updatedAt,
      });
      
      // Also emit to worker if booking is completed (so they can see updated stats)
      if (status === 'completed' && booking.workerId) {
        const workerId = typeof booking.workerId === 'object' ? (booking.workerId as any)._id : booking.workerId;
        io.to(String(workerId)).emit('booking:status_updated', {
          bookingId: booking._id,
          status: booking.status,
          workerId: workerId,
        });
        io.to(String(workerId)).emit('worker:stats_updated', {
          workerId: workerId,
          message: 'Your stats have been updated',
        });
      }
    }

    res.json(booking);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// Add review and rating - updates worker profile and ranking
router.patch('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    console.log('📝 Adding review for booking:', id, { rating, comment });

    const booking = await Booking.findByIdAndUpdate(
      id,
      { rating, review: comment },
      { new: true }
    )
      .populate('userId', 'firstName lastName profilePhoto phone')
      .populate('workerId', 'firstName lastName profileImage rating totalReviews')
      .exec();

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update worker's average rating and total reviews
    if (booking.workerId) {
      const workerId = typeof booking.workerId === 'object' ? (booking.workerId as any)._id : booking.workerId;
      
      // Get all rated bookings for this worker
      const workerBookings = await Booking.find({ 
        workerId: workerId, 
        rating: { $exists: true, $gt: 0 } 
      });
      
      const totalReviews = workerBookings.length;
      const avgRating = totalReviews > 0 
        ? workerBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / totalReviews 
        : 0;
      
      // Calculate badge based on completed jobs
      const completedJobs = await Booking.countDocuments({
        workerId: workerId,
        status: 'completed',
      });
      
      let badge: 'Iron' | 'Silver' | 'Gold' | 'Platinum' = 'Iron';
      if (completedJobs >= 2000) {
        badge = 'Platinum';
      } else if (completedJobs >= 1200) {
        badge = 'Gold';
      } else if (completedJobs >= 500) {
        badge = 'Silver';
      }
      
      // Calculate rankScore: (rating * 20) + (reviews * 2) + (completedJobs * 0.5)
      const rankScore = (avgRating * 20) + (totalReviews * 2) + (completedJobs * 0.5);
      
      await WorkerUser.findByIdAndUpdate(workerId, { 
        rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        totalReviews: totalReviews,
        rankScore: Math.round(rankScore * 10) / 10, // Round to 1 decimal
        badge: badge,
        completedJobs: completedJobs,
      });
      
      console.log('✅ Worker profile updated:', {
        workerId,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews,
        rankScore,
      });

      // Send notification to worker about new review
      const io = req.app.get('io');
      if (io) {
        const userName = booking.userId 
          ? `${(booking.userId as any).firstName || ''} ${(booking.userId as any).lastName || ''}`.trim() 
          : 'Customer';
        
        io.to(String(workerId)).emit('notification:new', {
          type: 'review',
          title: '⭐ New Review!',
          message: `${userName} gave you ${rating} stars${comment ? `: "${comment}"` : ''}`,
          data: { bookingId: id, rating, comment },
          createdAt: new Date(),
        });
      }
    }

    // Update service rating and review count
    if (booking.serviceId) {
      const serviceId = booking.serviceId;
      
      // Get all rated bookings for this service
      const serviceBookings = await Booking.find({ 
        serviceId: serviceId, 
        rating: { $exists: true, $gt: 0 } 
      });
      
      const totalServiceReviews = serviceBookings.length;
      const avgServiceRating = totalServiceReviews > 0 
        ? serviceBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / totalServiceReviews 
        : 0;
      
      await Service.findByIdAndUpdate(serviceId, { 
        rating: Math.round(avgServiceRating * 10) / 10, // Round to 1 decimal
        reviewCount: totalServiceReviews,
      });
      
      console.log('✅ Service rating updated:', {
        serviceId,
        avgRating: Math.round(avgServiceRating * 10) / 10,
        reviewCount: totalServiceReviews,
      });
    }

    res.json({ 
      success: true, 
      message: 'Review submitted successfully',
      booking 
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Failed to add review' });
  }
});

// Confirm payment (user or worker)
router.patch('/:id/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmedBy, userId, workerId } = req.body; // confirmedBy: 'user' | 'worker'

    console.log('💳 Confirm payment request:', { bookingId: id, confirmedBy, userId, workerId });

    if (!confirmedBy || (confirmedBy !== 'user' && confirmedBy !== 'worker')) {
      return res.status(400).json({ message: 'confirmedBy must be "user" or "worker"' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify the user/worker has permission to confirm
    if (confirmedBy === 'user' && String(booking.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized: User does not match booking' });
    }
    if (confirmedBy === 'worker' && String(booking.workerId) !== String(workerId)) {
      return res.status(403).json({ message: 'Unauthorized: Worker does not match booking' });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Payment can only be confirmed for completed bookings' });
    }

    // Update confirmation status
    const updateData: any = {};
    if (confirmedBy === 'user') {
      updateData.userConfirmedPayment = true;
    } else {
      updateData.workerConfirmedPayment = true;
    }

    // Check if both parties have confirmed
    const willHaveUserConfirmed = confirmedBy === 'user' ? true : booking.userConfirmedPayment;
    const willHaveWorkerConfirmed = confirmedBy === 'worker' ? true : booking.workerConfirmedPayment;

    if (willHaveUserConfirmed && willHaveWorkerConfirmed) {
      // Both confirmed - update payment status to paid
      updateData.paymentStatus = 'paid';
      updateData.paymentConfirmedAt = new Date();
      console.log('✅ Both parties confirmed payment - updating to paid');
      
      // Calculate and award reward points (10 points per Rs. 100 paid)
      // Use finalAmount if available (after discount), otherwise use price
      const amountPaid = booking.finalAmount || booking.price;
      const pointsEarned = Math.floor(amountPaid / 100) * 10; // 10 points per Rs. 100
      
      // Deduct reward points if used
      if (booking.rewardPointsUsed && booking.rewardPointsUsed > 0) {
        const User = (await import('../models/User.model')).default;
        const user = await User.findById(booking.userId);
        if (user) {
          const currentPoints = user.rewardPoints || 0;
          const newPoints = Math.max(0, currentPoints - booking.rewardPointsUsed);
          await User.findByIdAndUpdate(booking.userId, { rewardPoints: newPoints });
          console.log(`💰 Deducted ${booking.rewardPointsUsed} reward points from user ${booking.userId}`);
        }
      }
      
      // Award reward points to user
      if (pointsEarned > 0) {
        const User = (await import('../models/User.model')).default;
        const user = await User.findById(booking.userId);
        if (user) {
          const currentPoints = user.rewardPoints || 0;
          const newPoints = currentPoints + pointsEarned;
          await User.findByIdAndUpdate(booking.userId, { rewardPoints: newPoints });
          console.log(`🎁 Awarded ${pointsEarned} reward points to user ${booking.userId} (Total: ${newPoints})`);
          
          // Emit reward points update
          const io = req.app.get('io');
          if (io) {
            io.to(String(booking.userId)).emit('reward:points_updated', {
              userId: booking.userId,
              pointsEarned,
              totalPoints: newPoints,
              bookingId: id,
            });
          }
        }
      }
      
      // Award reward points to worker: 10 points per job + 1 point per Rs. 100 earned
      if (booking.workerId) {
        const worker = await WorkerUser.findById(booking.workerId);
        if (worker) {
          let workerPoints = 10; // Base points per completed job
          if (amountPaid) {
            workerPoints += Math.floor(amountPaid / 100); // 1 point per Rs. 100
          }
          
          const currentWorkerPoints = worker.rewardPoints || 0;
          const newWorkerPoints = currentWorkerPoints + workerPoints;
          
          // Update worker earnings and reward points
          const currentEarnings = worker.totalEarnings || 0;
          const newEarnings = currentEarnings + amountPaid;
          
          await WorkerUser.findByIdAndUpdate(booking.workerId, {
            rewardPoints: newWorkerPoints,
            totalEarnings: newEarnings,
          });
          
          console.log(`🎁 Awarded ${workerPoints} reward points to worker ${booking.workerId} (Total: ${newWorkerPoints})`);
          console.log(`💰 Updated worker earnings: Rs. ${newEarnings}`);
          
          // Emit worker reward points update
          const io = req.app.get('io');
          if (io) {
            io.to(String(booking.workerId)).emit('worker:reward_points_updated', {
              workerId: booking.workerId,
              pointsEarned: workerPoints,
              totalPoints: newWorkerPoints,
              earningsUpdated: newEarnings,
              bookingId: id,
            });
          }
        }
      }
    }

    const updatedBooking = await Booking.findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'firstName lastName profilePhoto phone')
      .populate('workerId', 'firstName lastName profileImage')
      .exec();

    if (!updatedBooking) {
      return res.status(404).json({ message: 'Booking not found after update' });
    }

    // Emit real-time events (include workerId so worker app can refresh wallet/earnings)
    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: id,
        paymentStatus: updatedBooking.paymentStatus,
        userConfirmed: updatedBooking.userConfirmedPayment,
        workerConfirmed: updatedBooking.workerConfirmedPayment,
        workerId: booking.workerId ? String(booking.workerId) : undefined,
        booking: updatedBooking.toObject(),
      };
      io.to(String(booking.userId)).emit('payment:status_updated', payload);
      if (booking.workerId) {
        io.to(String(booking.workerId)).emit('payment:status_updated', payload);
      }

      // Also emit booking:updated for general updates
      io.to(String(booking.userId)).emit('booking:updated', updatedBooking.toObject());
      if (booking.workerId) {
        io.to(String(booking.workerId)).emit('booking:updated', updatedBooking.toObject());
      }

      console.log('✅ Payment confirmation events emitted');
    }

    res.json({
      booking: updatedBooking,
      message: willHaveUserConfirmed && willHaveWorkerConfirmed 
        ? 'Payment confirmed by both parties. Status updated to paid.' 
        : `Payment confirmed by ${confirmedBy}. Waiting for ${confirmedBy === 'user' ? 'worker' : 'user'} confirmation.`,
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
});

// Process payment with reward points support
router.patch('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { method, transactionId, rewardPointsUsed, discountAmount, finalAmount } = req.body;

    console.log('💳 Process payment request:', { bookingId: id, method, transactionId, rewardPointsUsed, discountAmount, finalAmount });

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Validate reward points usage
    if (rewardPointsUsed && rewardPointsUsed > 0) {
      const user = await User.findById(booking.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const currentPoints = user.rewardPoints || 0;
      if (currentPoints < rewardPointsUsed) {
        return res.status(400).json({ message: 'Insufficient reward points' });
      }

      // Validate discount calculation
      if (discountAmount === undefined || finalAmount === undefined) {
        return res.status(400).json({ message: 'Discount amount and final amount are required when using reward points' });
      }

      // Update booking with reward points info
      booking.rewardPointsUsed = rewardPointsUsed;
      booking.discountAmount = discountAmount;
      booking.finalAmount = finalAmount;
    }

    // Update payment info and mark both parties confirmed (online payment is automatic)
    booking.paymentMethod = method;
    booking.paymentId = transactionId || `PAYMENT_${Date.now()}`;
    booking.paymentStatus = 'paid';
    booking.paymentConfirmedAt = new Date();
    booking.userConfirmedPayment = true;
    booking.workerConfirmedPayment = true;
    await booking.save();

    // Deduct reward points if used
    if (rewardPointsUsed && rewardPointsUsed > 0) {
      const user = await User.findById(booking.userId);
      if (user) {
        const currentPoints = user.rewardPoints || 0;
        const newPoints = Math.max(0, currentPoints - rewardPointsUsed);
        await User.findByIdAndUpdate(booking.userId, { rewardPoints: newPoints });
        console.log(`💰 Deducted ${rewardPointsUsed} reward points from user ${booking.userId}`);
      }
    }

    // Award user reward points (10 points per Rs. 100 paid)
    const amountPaidForUser = booking.finalAmount ?? booking.price;
    if (amountPaidForUser > 0) {
      const pointsEarned = Math.floor(amountPaidForUser / 100) * 10;
      if (pointsEarned > 0) {
        const user = await User.findById(booking.userId);
        if (user) {
          const currentPoints = user.rewardPoints || 0;
          const newPoints = currentPoints + pointsEarned;
          await User.findByIdAndUpdate(booking.userId, { rewardPoints: newPoints });
          const io = req.app.get('io');
          if (io) {
            io.to(String(booking.userId)).emit('reward:points_updated', {
              userId: booking.userId,
              pointsEarned,
              totalPoints: newPoints,
              bookingId: id,
            });
          }
        }
      }
    }

    // Credit worker wallet: service charge / cost of service (totalEarnings + reward points)
    const amountPaid = booking.finalAmount ?? booking.price;
    if (booking.workerId && amountPaid > 0) {
      const worker = await WorkerUser.findById(booking.workerId);
      if (worker) {
        const currentEarnings = worker.totalEarnings || 0;
        const newEarnings = currentEarnings + amountPaid;
        let workerPoints = 10;
        workerPoints += Math.floor(amountPaid / 100);
        const currentWorkerPoints = worker.rewardPoints || 0;
        const newWorkerPoints = currentWorkerPoints + workerPoints;
        await WorkerUser.findByIdAndUpdate(booking.workerId, {
          totalEarnings: newEarnings,
          rewardPoints: newWorkerPoints,
        });
        console.log(`💰 Updated worker wallet: Rs. ${newEarnings} (earnings) for worker ${booking.workerId}`);
        const io = req.app.get('io');
        if (io) {
          io.to(String(booking.workerId)).emit('worker:reward_points_updated', {
            workerId: booking.workerId,
            pointsEarned: workerPoints,
            totalPoints: newWorkerPoints,
            earningsUpdated: newEarnings,
            bookingId: id,
          });
        }
      }
    }

    // Emit real-time events (include workerId so worker app can refresh wallet/earnings)
    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: id,
        paymentStatus: booking.paymentStatus,
        userConfirmed: true,
        workerConfirmed: true,
        workerId: booking.workerId ? String(booking.workerId) : undefined,
        booking: booking.toObject(),
      };
      io.to(String(booking.userId)).emit('payment:status_updated', payload);
      if (booking.workerId) {
        io.to(String(booking.workerId)).emit('payment:status_updated', payload);
      }
    }

    res.json({
      booking,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Failed to process payment' });
  }
});

// Accept booking request
router.patch('/:id/accept', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    console.log('📨 Accept booking request:', { bookingId: id, workerId });

    if (!workerId) {
      console.error('❌ Worker ID is required');
      return res.status(400).json({ message: 'Worker ID is required' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      console.error('❌ Booking not found:', id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if booking is already accepted
    if (booking.status === 'accepted' && booking.workerId) {
      console.log('⚠️ Booking already accepted by worker:', booking.workerId);
      return res.status(400).json({ message: 'Booking already accepted by another worker' });
    }

    // Save userId before populating - ensure it's a string for socket rooms
    const userId = String(booking.userId);
    console.log('✅ User ID for notification:', userId);
    console.log('✅ User ID type:', typeof userId);

    // Update booking - save ALL booking data
    booking.workerId = workerId;
    booking.status = 'accepted';
    // Ensure all booking fields are preserved (location, price, serviceName, etc.)
    await booking.save();
    
    // Reload booking to ensure all populated fields are included
    const savedBooking = await Booking.findById(id)
      .populate('userId', 'firstName lastName profilePhoto phone')
      .populate('workerId', 'name phone email currentLocation.coordinates')
      .lean();
    
    console.log('✅ Booking updated and saved:', {
      id: booking._id,
      status: booking.status,
      workerId: booking.workerId,
      serviceName: booking.serviceName,
      location: booking.location,
      price: booking.price,
      hasAllData: !!savedBooking,
    });

    // Set worker status to 'busy' so they can't accept other bookings
    try {
      await WorkerUser.findByIdAndUpdate(workerId, {
        status: 'busy',
        currentBookingId: booking._id,
      });
      console.log('✅ Worker status set to busy:', workerId);
    } catch (workerStatusError) {
      console.error('⚠️ Error updating worker status:', workerStatusError);
    }

    // Use saved booking with all populated fields for response
    const populatedBooking = savedBooking;

    // Create notifications for both USER (customer) and WORKER
    const io = req.app.get('io');
    let userNotification = null;
    let workerNotification = null;

    // IMPORTANT: Create notifications FIRST before emitting socket events
    try {
      // Ensure userId is in correct format (ObjectId)
      const userObjectId = typeof booking.userId === 'string' 
        ? new mongoose.Types.ObjectId(booking.userId)
        : booking.userId;

      // Create notification for USER (customer)
      userNotification = await Notification.create({
        userId: userObjectId, // This is the USER (customer), not worker
        title: 'Booking Accepted',
        message: `Great news! Your ${booking.serviceName} booking has been accepted by a worker. The worker will start location tracking shortly.`,
        type: 'booking',
        isRead: false,
        data: {
          bookingId: booking._id,
          serviceName: booking.serviceName,
          workerId: booking.workerId,
          status: 'accepted',
        },
      });
      console.log('✅ User notification created successfully:', {
        notificationId: userNotification._id,
        userId: userObjectId,
        message: userNotification.message,
      });

      // Create notification for WORKER who accepted the booking
      if (workerId) {
        const workerObjectId = typeof workerId === 'string' 
          ? new mongoose.Types.ObjectId(workerId)
          : workerId;

        workerNotification = await Notification.create({
          userId: workerObjectId, // Worker ID stored in userId field
          title: 'Job Request Accepted',
          message: `You have accepted a ${booking.serviceName} booking. Navigate to the location to start.`,
          type: 'job',
          isRead: false,
          data: {
            bookingId: booking._id,
            serviceName: booking.serviceName,
            workerId: workerId,
            status: 'accepted',
          },
        });
        console.log('✅ Worker notification created successfully:', {
          notificationId: workerNotification._id,
          workerId: workerObjectId,
          message: workerNotification.message,
        });
      }
    } catch (notifError) {
      console.error('⚠️ Error creating notifications:', notifError);
      // Continue even if notification creation fails - still emit socket events
    }

    // Emit socket events - ONLY to user app for notifications
    if (io) {
      // Use populated booking data (with all fields) for socket events
      const fullBookingData = populatedBooking || booking.toObject();
      const bookingData = {
        bookingId: booking._id,
        booking: fullBookingData, // Include full populated booking data
        workerId: booking.workerId,
        serviceName: booking.serviceName,
      };

      console.log('📤 Emitting booking:accepted to USER:', userId);
      console.log('📤 Booking data:', {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        workerId: booking.workerId,
        userId: userId,
      });

      // FIRST: Send notification:new event to user (this is the notification)
      if (userNotification) {
        const notificationData = userNotification.toObject();
        console.log('📬 Sending notification:new to user:', userId);
        console.log('📬 Notification data:', {
          id: notificationData._id,
          title: notificationData.title,
          message: notificationData.message,
          userId: userId,
        });
        
        // CRITICAL: Emit to user's specific room (userId)
        // The user must be connected and authenticated to receive this
        io.to(userId).emit('notification:new', notificationData);
        console.log('✅ notification:new event emitted to user room:', userId);
        
        // Also emit to 'user' room as backup (all users in user room)
        io.to('user').emit('notification:new', notificationData);
        console.log('✅ notification:new event also emitted to user room (backup)');
        
        // Log active rooms for debugging
        const userRoom = io.sockets.adapter.rooms.get(userId);
        const userRoomCount = userRoom ? userRoom.size : 0;
        const generalUserRoom = io.sockets.adapter.rooms.get('user');
        const generalUserRoomCount = generalUserRoom ? generalUserRoom.size : 0;
        console.log(`📊 Socket rooms: userId room (${userId}): ${userRoomCount} sockets, 'user' room: ${generalUserRoomCount} sockets`);
        
        if (userRoomCount === 0 && generalUserRoomCount === 0) {
          console.warn('⚠️ WARNING: No users connected to receive notification! User may not be online.');
        }
      } else {
        console.warn('⚠️ No notification object to send - notification creation may have failed');
      }

      // Send notification:new event to worker who accepted the booking
      if (workerNotification && booking.workerId) {
        const workerNotificationData = workerNotification.toObject();
        console.log('📬 Sending notification:new to worker:', booking.workerId);
        
        // Emit to worker's specific room
        io.to(String(booking.workerId)).emit('notification:new', workerNotificationData);
        console.log('✅ notification:new event emitted to worker room:', booking.workerId);
        
        // Also emit to 'worker' room as backup
        io.to('worker').emit('notification:new', workerNotificationData);
        console.log('✅ notification:new event also emitted to worker room (backup)');
      }

      // SECOND: Send booking:accepted event (for live tracking updates)
      // Send to user for their tracking screen
      io.to(userId).emit('booking:accepted', {
        ...bookingData,
        booking: populatedBooking || booking.toObject(), // Include full booking data
        status: 'accepted',
        message: 'Worker accepted your request. Waiting for worker to start location tracking...',
        timestamp: new Date().toISOString(),
      });
      console.log('✅ booking:accepted event emitted to user:', userId);
      
      // ALSO send booking:accepted to the worker who accepted it (for their tracking page)
      if (booking.workerId) {
        io.to(String(booking.workerId)).emit('booking:accepted', {
          ...bookingData,
          booking: populatedBooking || booking.toObject(), // Include full booking data
          status: 'accepted',
          message: 'You have accepted this booking. It will appear in your tracking page.',
          timestamp: new Date().toISOString(),
        });
        console.log('✅ booking:accepted event emitted to worker:', booking.workerId);
      }
      
      // Emit booking:updated to worker room so other workers know this booking is taken
      // Include full booking data so workers see all request details
      io.to('worker').emit('booking:updated', populatedBooking || booking.toObject());
      console.log('✅ booking:updated event emitted to worker room with full data');

      console.log('✅ All socket events emitted correctly - user notification sent');
    } else {
      console.warn('⚠️ Socket.IO not available - cannot send real-time notifications');
    }

    // Return full booking data with all fields populated
    res.json(populatedBooking || booking);
  } catch (error) {
    console.error('❌ Accept booking error:', error);
    res.status(500).json({ message: 'Failed to accept booking', error: String(error) });
  }
});

// Reject booking request
router.patch('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only update status if it's still pending
    // Keep status as 'pending' so other workers can accept
    if (booking.status === 'pending') {
      await booking.save();
    }
    
    // Reload booking to ensure all fields are included in response
    const savedBooking = await Booking.findById(id)
      .populate('userId', 'firstName lastName profilePhoto phone')
      .lean();

    // Emit socket event with full booking data
    const io = req.app.get('io');
    if (io) {
      io.to(String(booking.userId)).emit('booking:rejected', {
        bookingId: booking._id,
        workerId,
        booking: savedBooking || booking.toObject(), // Include full booking data
      });
      
      // Also emit booking:updated to worker room so other workers see the rejection
      io.to('worker').emit('booking:updated', savedBooking || booking.toObject());
      console.log('✅ booking:rejected and booking:updated events emitted with full data');
    }

    // Return full booking data
    res.json({ message: 'Booking rejected', booking: savedBooking || booking });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ message: 'Failed to reject booking', error: String(error) });
  }
});

// Cancel booking (by user)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // Optional: verify user owns the booking

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify user owns the booking if userId is provided
    if (userId && String(booking.userId) !== String(userId)) {
      return res.status(403).json({ message: 'You do not have permission to cancel this booking' });
    }

    // Only allow deletion if booking is pending, accepted, or already cancelled
    if (!['pending', 'accepted', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ 
        message: `Cannot delete booking with status: ${booking.status}` 
      });
    }

    // Get booking details before deletion for notifications
    const bookingDetails = {
      _id: booking._id,
      userId: booking.userId,
      workerId: booking.workerId,
      serviceName: booking.serviceName,
      status: booking.status
    };

    // Actually delete the booking from database
    await Booking.findByIdAndDelete(id);
    console.log(`✅ Booking ${id} permanently deleted from database`);

    // Create notification for the USER only (not worker)
    // Workers don't have User model IDs, so we use socket events for them
    const io = req.app.get('io');
    let userNotification = null;

    // Create notification for the USER (customer) only
    try {
      userNotification = await Notification.create({
        userId: bookingDetails.userId, // This is the USER (customer), not worker
        title: 'Booking Deleted',
        message: `Your ${bookingDetails.serviceName} booking has been deleted successfully.`,
        type: 'booking',
        isRead: false,
        data: {
          bookingId: bookingDetails._id,
          serviceName: bookingDetails.serviceName,
          status: 'deleted',
        },
      });
      console.log('✅ User notification created:', userNotification._id);
    } catch (notifError) {
      console.error('⚠️ Error creating user notification:', notifError);
    }

    // Emit socket events
    if (io) {
      // Notify the USER (customer) who cancelled - ONLY to user app
      const cancelledData = {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        message: 'Your service booking has been cancelled successfully',
        booking: booking.toObject(),
      };
      
      // Send booking:cancelled ONLY to the user (customer)
      io.to(String(booking.userId)).emit('booking:cancelled', cancelledData);
      
      // Emit notification:new event ONLY for the user (customer) - NOT for worker
      if (userNotification) {
        io.to(String(booking.userId)).emit('notification:new', userNotification.toObject());
        console.log('📤 Emitted notification:new to USER only:', booking.userId);
      }

      // Notify the WORKER if one was assigned - use socket event, NOT notification model
      // Workers don't have User model IDs, so we use socket events only
      if (booking.workerId) {
        // Send booking:cancelled event to worker room (for worker app)
        // This goes to all workers, the worker app will filter by workerId
        io.to('worker').emit('booking:cancelled', {
          bookingId: booking._id,
          workerId: booking.workerId,
          serviceName: booking.serviceName,
          message: 'A booking you were assigned to has been cancelled',
          booking: booking.toObject(),
        });
        console.log('📤 Emitted booking:cancelled to WORKER room only (no notification record)');
      }

      // Emit general booking update to both rooms
      io.to('user').emit('booking:updated', booking.toObject());
      io.to('worker').emit('booking:updated', booking.toObject());
    }

    console.log('✅ Booking deleted successfully:', id);

    res.json({ 
      message: 'Booking deleted successfully', 
      deletedBookingId: bookingDetails._id,
      notification: userNotification 
    });
  } catch (error) {
    console.error('❌ Delete booking error:', error);
    res.status(500).json({ 
      message: 'Failed to delete booking', 
      error: String(error) 
    });
  }
});

// Get nearby workers for a service
router.get('/nearby-workers', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, serviceCategory, maxDistance = 10000 } = req.query;

    const workers = await WorkerUser.find({
      serviceCategories: serviceCategory,
      verificationStatus: 'verified',
      status: 'available',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude as string), parseFloat(latitude as string)]
          },
          $maxDistance: parseInt(maxDistance as string)
        }
      }
    })
    .select('firstName lastName profileImage rating location serviceCategories')
    .limit(10);

    res.json(workers);
  } catch (error) {
    console.error('Get nearby workers error:', error);
    res.status(500).json({ message: 'Failed to find nearby workers' });
  }
});

// Update booking location (e.g. for test location - 12–13 km from worker)
// PATCH /:id/location - Body: { location: { address?, coordinates: { latitude, longitude } } }
router.patch('/:id/location', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { location } = req.body;

    if (!location?.coordinates?.latitude || !location?.coordinates?.longitude) {
      return res.status(400).json({
        message: 'Invalid location. coordinates.latitude and coordinates.longitude are required.',
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const address =
      location.address && String(location.address).trim() !== ''
        ? String(location.address).trim()
        : `Location at ${location.coordinates.latitude}, ${location.coordinates.longitude}`;

    booking.location = {
      address,
      coordinates: {
        latitude: Number(location.coordinates.latitude),
        longitude: Number(location.coordinates.longitude),
      },
    };
    await booking.save();

    const io = req.app.get('io');
    if (io && booking.userId) {
      io.to(String(booking.userId)).emit('booking:updated', booking.toObject());
    }
    if (io && booking.workerId) {
      const workerId = typeof booking.workerId === 'object' ? (booking.workerId as any)._id : booking.workerId;
      if (workerId) io.to(String(workerId)).emit('booking:updated', booking.toObject());
    }

    return res.json({ booking, message: 'Booking location updated.' });
  } catch (error) {
    console.error('Update booking location error:', error);
    res.status(500).json({ message: 'Failed to update booking location' });
  }
});

// Get booking details with live worker location for tracking
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching booking details for ID:', id);
    
    const booking = await Booking.findById(id).lean();
    if (!booking) {
      console.error('❌ Booking not found:', id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    console.log('✅ Booking found:', {
      id: booking._id,
      status: booking.status,
      workerId: booking.workerId,
      serviceName: booking.serviceName,
    });

    let workerLocation: { latitude: number; longitude: number; lastUpdated: string } | null = null;
    let worker: { 
      name?: string; 
      firstName?: string; 
      lastName?: string; 
      phone?: string; 
      profileImage?: string; 
      image?: string; 
    } | null = null;

    if (booking.workerId) {
      const workerDoc = await WorkerUser.findById(booking.workerId).lean();
      if (workerDoc) {
        console.log('✅ Worker found:', {
          id: workerDoc._id,
          name: workerDoc.name,
          phone: workerDoc.phone,
          profileImage: workerDoc.profileImage,
          hasLocation: !!workerDoc.currentLocation?.coordinates,
        });
        
        // Extract name into firstName/lastName if possible, or use full name
        const nameParts = workerDoc.name ? workerDoc.name.trim().split(' ') : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        worker = { 
          name: workerDoc.name,
          firstName: firstName || workerDoc.name,
          lastName: lastName,
          phone: workerDoc.phone,
          profileImage: workerDoc.profileImage || workerDoc.documents?.profilePhoto,
          image: workerDoc.profileImage || workerDoc.documents?.profilePhoto,
        };
        
        if (workerDoc.currentLocation?.coordinates) {
          workerLocation = {
            latitude: workerDoc.currentLocation.coordinates.latitude,
            longitude: workerDoc.currentLocation.coordinates.longitude,
            lastUpdated: new Date().toISOString(),
          };
          console.log('📍 Worker location:', workerLocation);
        } else {
          console.warn('⚠️ Worker has no location data');
        }
      } else {
        console.warn('⚠️ Worker document not found for ID:', booking.workerId);
      }
    } else {
      console.log('ℹ️ No worker assigned to booking yet');
    }

    // Include customer (user) name and phone for worker app JobNavigationScreen and Call
    let userName: string | undefined;
    let userId: { firstName?: string; lastName?: string; phone?: string } | undefined;
    if (booking.userId) {
      try {
        const userDoc = await User.findById(booking.userId).lean();
        if (userDoc) {
          const u = userDoc as { firstName?: string; lastName?: string; name?: string; phone?: string };
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
          userName = (u.name ?? fullName) || undefined;
          userId = {
            firstName: u.firstName,
            lastName: u.lastName,
            phone: u.phone,
          };
        }
      } catch (_) {}
    }

    const response = {
      _id: booking._id,
      serviceName: booking.serviceName,
      serviceTitle: booking.serviceName,
      serviceCategory: booking.serviceCategory,
      status: booking.status,
      location: booking.location,
      workerId: booking.workerId,
      workerLocation,
      worker,
      userName,
      userId,
      startTime: booking.status === 'in_progress' ? booking.updatedAt : booking.createdAt,
      estimatedDuration: booking.estimatedDuration,
      remainingTime: booking.estimatedDuration,
      price: booking.price,
      createdAt: booking.createdAt,
    };

    console.log('📤 Returning booking details:', {
      hasWorker: !!worker,
      hasWorkerLocation: !!workerLocation,
      status: response.status,
    });

    return res.json(response);
  } catch (error) {
    console.error('❌ Get booking details error:', error);
    res.status(500).json({ message: 'Failed to get booking details', error: String(error) });
  }
});

export default router;