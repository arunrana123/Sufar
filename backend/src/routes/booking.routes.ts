// BOOKING ROUTES - Handles all booking CRUD operations and status updates
// Endpoints: POST /create, GET /user/:userId, GET /:id, DELETE /:id, PUT /:id/status
// Features: Create bookings, fetch user bookings, update status, cancel bookings, Socket.IO notifications
import { Router, Request, Response } from 'express';
import Booking from '../models/Booking.model';
import WorkerUser from '../models/WorkerUser.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';

const router = Router();

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
      price: parseFloat(price) || 0
    });

    console.log('Creating booking with data:', booking.toObject());
    console.log('Scheduled date:', scheduledDate ? new Date(scheduledDate) : 'Not scheduled');
    await booking.save();
    console.log('Booking saved successfully:', booking._id);
    console.log('Booking status:', booking.status);

    // Emit real-time event to notify workers
    const io = req.app.get('io');
    if (io) {
      const bookingRequest = {
        _id: booking._id,
        userId: booking.userId,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        serviceCategory: booking.serviceCategory,
        price: booking.price,
        location: booking.location,
        createdAt: booking.createdAt,
        workerId: booking.workerId, // Include assigned worker ID if present
      };
      
      console.log('📤 EMITTING booking:request to "worker" room');
      console.log('📋 Booking details:', {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        serviceCategory: booking.serviceCategory,
        assignedTo: booking.workerId || 'Not assigned yet',
      });
      
      // Check how many sockets are in the worker room
      const workerRoom = io.sockets.adapter.rooms.get('worker');
      const workerCount = workerRoom ? workerRoom.size : 0;
      console.log(`🎧 Currently ${workerCount} worker(s) listening in 'worker' room`);
      
      if (workerCount === 0) {
        console.warn('⚠️ WARNING: No workers connected to receive this request!');
      }
      
      // Send booking request to all workers in the 'worker' room
      io.to('worker').emit('booking:request', bookingRequest);
      console.log('✅ Booking request emitted successfully');
      
      // Also emit general booking created event
      io.emit('booking:created', booking);
    } else {
      console.error('❌ Socket.IO not available!');
    }

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Failed to create booking', error: error.message });
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

// Get worker's bookings
router.get('/worker/:workerId', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;
    const { status } = req.query;

    const filter: any = { workerId };
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName profilePhoto')
      .exec();

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
    const { status, workerId, notes } = req.body;

    const updateData: any = { status };
    if (workerId) updateData.workerId = workerId;
    if (notes) updateData.workerNotes = notes;

    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const booking = await Booking.findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'firstName lastName profilePhoto')
      .populate('workerId', 'firstName lastName profileImage')
      .exec();

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('booking:updated', booking);
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
      .populate('userId', 'firstName lastName profilePhoto')
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

    // Emit real-time event to user
    const io = req.app.get('io');
    if (io) {
      io.to(String(booking.userId)).emit('booking:status_updated', {
        bookingId: booking._id,
        status: booking.status,
        workStartTime: booking.workStartTime,
      });
    }

    res.json(booking);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// Add review and rating
router.patch('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { rating, review },
      { new: true }
    )
      .populate('userId', 'firstName lastName profilePhoto')
      .populate('workerId', 'firstName lastName profileImage')
      .exec();

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update worker's average rating
    if (booking.workerId) {
      const workerBookings = await Booking.find({ 
        workerId: booking.workerId, 
        rating: { $exists: true } 
      });
      
      const avgRating = workerBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / workerBookings.length;
      
      await WorkerUser.findByIdAndUpdate(booking.workerId, { rating: avgRating });
    }

    res.json(booking);
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Failed to add review' });
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

    // Save userId before populating
    const userId = String(booking.userId);
    console.log('✅ User ID for notification:', userId);

    // Update booking
    booking.workerId = workerId;
    booking.status = 'accepted';
    await booking.save();
    console.log('✅ Booking updated:', {
      id: booking._id,
      status: booking.status,
      workerId: booking.workerId,
    });

    // Populate for response
    await booking.populate('userId', 'firstName lastName profilePhoto');
    await booking.populate('workerId', 'name phone email currentLocation.coordinates');

    // Create notification for USER (customer) only - NOT for worker
    const io = req.app.get('io');
    let userNotification = null;

    try {
      userNotification = await Notification.create({
        userId: booking.userId, // This is the USER (customer), not worker
        title: 'Booking Accepted',
        message: `Your ${booking.serviceName} booking has been accepted! A worker is on their way.`,
        type: 'booking',
        isRead: false,
        data: {
          bookingId: booking._id,
          serviceName: booking.serviceName,
          workerId: booking.workerId,
          status: 'accepted',
        },
      });
      console.log('✅ User notification created:', userNotification._id);
    } catch (notifError) {
      console.error('⚠️ Error creating user notification:', notifError);
    }

    // Emit socket events - ONLY to user app for notifications
    if (io) {
      const bookingData = {
        bookingId: booking._id,
        booking: booking.toObject(),
        workerId: booking.workerId,
      };

      console.log('📤 Emitting booking:accepted to USER:', userId);
      console.log('📤 Booking data:', {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        workerId: booking.workerId,
      });

      // Send booking:accepted ONLY to the specific user who made the booking
      // This should only go to user app, not worker app
      io.to(userId).emit('booking:accepted', bookingData);
      
      // Emit notification:new ONLY to the user (customer) - NOT to worker
      if (userNotification) {
        io.to(userId).emit('notification:new', userNotification.toObject());
        console.log('📤 Emitted notification:new to USER only:', userId);
      }
      
      // Emit booking:updated to worker room so other workers know this booking is taken
      // But this is just an update event, NOT a notification
      io.to('worker').emit('booking:updated', booking.toObject());

      console.log('✅ Socket events emitted correctly - user notification only to user app');
    } else {
      console.warn('⚠️ Socket.IO not available');
    }

    res.json(booking);
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
    if (booking.status === 'pending') {
      booking.status = 'pending'; // Keep pending so other workers can accept
      await booking.save();
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(String(booking.userId)).emit('booking:rejected', {
        bookingId: booking._id,
        workerId,
      });
    }

    res.json({ message: 'Booking rejected', booking });
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

    // Only allow cancellation if booking is pending or accepted
    if (!['pending', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ 
        message: `Cannot cancel booking with status: ${booking.status}` 
      });
    }

    // Update booking status to cancelled
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    // Populate booking with user and worker details
    await booking.populate('userId', 'firstName lastName email');
    if (booking.workerId) {
      await booking.populate('workerId', 'firstName lastName phone');
    }

    // Create notification for the USER only (not worker)
    // Workers don't have User model IDs, so we use socket events for them
    const io = req.app.get('io');
    let userNotification = null;

    // Create notification for the USER (customer) only
    try {
      userNotification = await Notification.create({
        userId: booking.userId, // This is the USER (customer), not worker
        title: 'Booking Cancelled',
        message: `Your ${booking.serviceName} booking has been cancelled successfully. ${booking.workerId ? 'The assigned worker has been notified.' : ''}`,
        type: 'booking',
        isRead: false,
        data: {
          bookingId: booking._id,
          serviceName: booking.serviceName,
          status: 'cancelled',
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

    console.log('✅ Booking cancelled successfully:', id);

    res.json({ 
      message: 'Booking cancelled successfully', 
      booking: booking.toObject() 
    });
  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({ 
      message: 'Failed to cancel booking', 
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
      startTime: booking.startedAt,
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