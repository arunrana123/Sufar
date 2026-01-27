import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import connectDB from "./src/db";
// import itemRoutes from "./src/routes/item.routes"; // UNUSED - Item model not used in app
import userRoutes from "./src/routes/user.routes";
import workerRoutes from "./src/routes/worker.routes";
import notificationRoutes from "./src/routes/notification.routes";
import dashboardRoutes from "./src/routes/dashboard.routes";
import serviceRoutes from "./src/routes/service.routes";
import bookingRoutes from "./src/routes/booking.routes";
import orderRoutes from "./src/routes/order.routes";
import syncRoutes from "./src/routes/sync.routes";
import adminRoutes from "./src/routes/admin.routes";
import marketRoutes from "./src/routes/market.routes";
import { googleAuthRoutes } from "./src/routes/google-auth.routes";

dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins for mobile apps
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
});

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file: Express.Multer.File, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs for document verification
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// CORS configuration for web dashboard and mobile apps
app.use(cors({
  origin: true, // Allow all origins for mobile apps
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
}));

// Increase body size limits for file uploads (50MB for JSON and URL-encoded)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Support URL-encoded bodies
app.use('/uploads', express.static(uploadsDir));

// Add request logging middleware for debugging
app.use((req, res, next) => {
  if (req.path.includes('upload-service-documents')) {
    console.log('📥 Incoming request:', {
      method: req.method,
      path: req.path,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers['authorization'] ? 'present' : 'missing',
      },
      bodyKeys: req.body ? Object.keys(req.body) : [],
      files: req.files ? Object.keys(req.files as any) : [],
    });
  }
  next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('authenticate', (data) => {
    try {
      const { userId, userType } = data;
      if (!userId || !userType) {
        console.error('❌ Invalid authentication data:', data);
        return;
      }
      
      // Join both the user type room and user-specific room
      socket.join(userType); // 'worker' or 'user' or 'admin'
      socket.join(userId);   // Specific worker/user ID
      
      // If admin, also join 'admin' room explicitly for notifications
      if (userType === 'admin') {
        socket.join('admin');
        console.log(`✅ Admin ${userId} joined 'admin' room for notifications`);
      }
      
      console.log(`✅ AUTHENTICATED: ${userType} ${userId} joined rooms: ['${userType}', '${userId}'${userType === 'admin' ? ", 'admin'" : ''}]`);
      console.log(`📊 Socket ${socket.id} is now in rooms:`, Array.from(socket.rooms));
      
      // Send confirmation back to client
      socket.emit('authenticated', { 
        success: true, 
        userId, 
        userType,
        socketId: socket.id,
        rooms: Array.from(socket.rooms)
      });
      
      // For workers, log that they're ready to receive requests
      if (userType === 'worker') {
        console.log(`🎧 WORKER ${userId} is now listening for booking requests in 'worker' room`);
      }
    } catch (error) {
      console.error('❌ Authentication error:', error);
    }
  });

  socket.on('join_room', (data) => {
    socket.join(data.roomId);
    console.log(`User ${socket.id} joined room: ${data.roomId}`);
  });

  socket.on('leave_room', (data) => {
    socket.leave(data.roomId);
    console.log(`User ${socket.id} left room: ${data.roomId}`);
  });

  socket.on('location_update', (data) => {
    socket.broadcast.emit('worker:location_update', {
      workerId: socket.id,
      location: data
    });
  });

  socket.on('booking:request', (data) => {
    console.log('📨 Booking request received:', data);
    // Notify workers in the area
    io.to('worker').emit('booking:request', data);
    console.log('📤 Booking request sent to workers');
  });

  socket.on('booking:accept', (data) => {
    console.log('✅ Booking accept received:', data);
    io.emit('booking:accepted', data);
  });

  socket.on('booking:reject', (data) => {
    console.log('❌ Booking reject received:', data);
    io.emit('booking:rejected', data);
  });

  socket.on('booking:start', (data) => {
    console.log('🚀 Booking start received:', data);
    io.emit('booking:started', data);
  });

  socket.on('booking:complete', (data) => {
    console.log('✅ Booking complete received:', data);
    io.emit('booking:completed', data);
  });

  // Location tracking started - broadcast to user
  socket.on('location:tracking:started', async (data) => {
    console.log('📍 Location tracking started:', data);
    if (data.bookingId) {
      // Get booking to find userId
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          // Emit to the specific user who made the booking
          io.to(String(booking.userId)).emit('location:tracking:started', data);
          console.log('✅ Location tracking started event sent to user:', booking.userId);
        } else {
          // Fallback: emit to all (for backward compatibility)
          io.emit('location:tracking:started', data);
        }
      } catch (error) {
        console.error('Error finding booking for location tracking:', error);
        // Fallback: emit to all
        io.emit('location:tracking:started', data);
      }
    }
  });

  // Navigation events - broadcast to user
  socket.on('navigation:started', async (data) => {
    console.log('🚗 Navigation started:', data);
    if (data.bookingId) {
      // Get booking to find userId
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          io.to(String(booking.userId)).emit('navigation:started', data);
          console.log('✅ Navigation started event sent to user:', booking.userId);
        } else {
          io.emit('navigation:started', data);
        }
      } catch (error) {
        console.error('Error finding booking for navigation:', error);
        io.emit('navigation:started', data);
      }
    }
  });

  socket.on('navigation:arrived', async (data) => {
    console.log('📍 Navigation arrived:', data);
    if (data.bookingId) {
      // Get booking to find userId
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          io.to(String(booking.userId)).emit('navigation:arrived', data);
          console.log('✅ Navigation arrived event sent to user:', booking.userId);
        } else {
          io.emit('navigation:arrived', data);
        }
      } catch (error) {
        console.error('Error finding booking for arrival:', error);
        io.emit('navigation:arrived', data);
      }
    }
  });

  socket.on('navigation:ended', async (data) => {
    console.log('✅ Navigation ended:', data);
    if (data.bookingId) {
      // Get booking to find userId
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          io.to(String(booking.userId)).emit('navigation:ended', data);
          console.log('✅ Navigation ended event sent to user:', booking.userId);
        } else {
          io.emit('navigation:ended', data);
        }
      } catch (error) {
        console.error('Error finding booking for navigation end:', error);
        io.emit('navigation:ended', data);
      }
    }
  });

  // Work events - broadcast to user
  socket.on('work:started', async (data) => {
    console.log('🔨 Work started:', data);
    if (data.bookingId) {
      // Get booking to find userId
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          io.to(String(booking.userId)).emit('work:started', data);
          console.log('✅ Work started event sent to user:', booking.userId, 'Start time:', data.startTime);
        } else {
          io.emit('work:started', data);
        }
      } catch (error) {
        console.error('Error finding booking for work started:', error);
        io.emit('work:started', data);
      }
    }
  });

  socket.on('work:completed', async (data) => {
    console.log('✅ Work completed:', data);
    if (data.bookingId) {
      // Get booking to find userId and worker info
      try {
        const Booking = require('./src/models/Booking.model').default;
        const Notification = require('./src/models/Notification.model').default;
        const WorkerUser = require('./src/models/WorkerUser.model').default;
        
        const booking = await Booking.findById(data.bookingId).populate('workerId').lean();
        
        if (booking && booking.userId) {
          // Get worker name
          const workerName = booking.workerId?.firstName 
            ? `${booking.workerId.firstName} ${booking.workerId.lastName || ''}`.trim()
            : 'Worker';
          
          // Create notification for user
          const notification = new Notification({
            userId: booking.userId,
            type: 'booking',
            title: '✅ Service Completed!',
            message: `${workerName} has completed your ${booking.serviceName || 'service'}. Payment method: ${data.paymentMethod || 'N/A'}`,
            data: {
              bookingId: data.bookingId,
              workerId: data.workerId,
              paymentMethod: data.paymentMethod,
              paymentStatus: data.paymentStatus,
              duration: data.duration,
            },
            read: false,
          });
          await notification.save();
          console.log('✅ Completion notification saved for user:', booking.userId);

          // Emit work completed event to user
          io.to(String(booking.userId)).emit('work:completed', {
            ...data,
            workerName,
            serviceName: booking.serviceName,
          });
          
          // Also emit notification event
          io.to(String(booking.userId)).emit('notification:new', {
            _id: notification._id,
            type: 'booking',
            title: '✅ Service Completed!',
            message: `${workerName} has completed your ${booking.serviceName || 'service'}. Payment: ${data.paymentMethod || 'N/A'}`,
            data: notification.data,
            createdAt: notification.createdAt,
          });
          
          console.log('✅ Work completed event and notification sent to user:', booking.userId);
        } else {
          io.emit('work:completed', data);
        }
      } catch (error) {
        console.error('Error finding booking for work completed:', error);
        io.emit('work:completed', data);
      }
    }
  });

  // Enhanced worker location updates - broadcast to specific user with distance tracking
  socket.on('worker:location', async (data) => {
    if (data.bookingId) {
      console.log('📍 Broadcasting enhanced worker location:', {
        workerId: data.workerId,
        bookingId: data.bookingId,
        distanceTraveled: data.distanceTraveled,
        distanceRemaining: data.distanceRemaining
      });
      
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          // Emit to the specific user who made the booking
          io.to(String(booking.userId)).emit('worker:location', data);
          console.log('✅ Enhanced location data sent to user:', booking.userId);
        } else {
          // Fallback: emit to all (for backward compatibility)
          io.emit('worker:location', data);
        }
      } catch (error) {
        console.error('Error finding booking for location update:', error);
        // Fallback: emit to all
        io.emit('worker:location', data);
      }
    }
  });

  // Enhanced route updates - broadcast real-time route changes to user
  socket.on('route:updated', async (data) => {
    console.log('🗺️ Broadcasting route update:', {
      bookingId: data.bookingId,
      distance: data.distance,
      duration: data.duration,
      distanceTraveled: data.distanceTraveled,
      distanceRemaining: data.distanceRemaining
    });
    
    if (data.bookingId) {
      try {
        const Booking = require('./src/models/Booking.model').default;
        const booking = await Booking.findById(data.bookingId).lean();
        if (booking && booking.userId) {
          // Emit to the specific user who made the booking
          io.to(String(booking.userId)).emit('route:updated', data);
          console.log('✅ Route update sent to user:', booking.userId);
        } else {
          // Fallback: emit to all (for backward compatibility)
          io.emit('route:updated', data);
        }
      } catch (error) {
        console.error('Error finding booking for route update:', error);
        // Fallback: emit to all
        io.emit('route:updated', data);
      }
    }
  });

  socket.on('notification:send', (data) => {
    console.log('📬 Notification send:', data);
    io.to(data.userId).emit('notification:new', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ User disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Make io available to routes
app.set('io', io);

// app.use("/api/items", itemRoutes); // UNUSED - Item model not used in app
app.use("/api/users", userRoutes);
app.use("/api/users", googleAuthRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/market", marketRoutes);

// Document upload route
app.post('/api/workers/upload-documents', upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'certificate', maxCount: 1 },
  { name: 'citizenship', maxCount: 1 },
  { name: 'license', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const workerId = req.body.workerId;

    // Save document paths to database
    const documentPaths = {
      profilePhoto: files.profilePhoto?.[0]?.filename,
      certificate: files.certificate?.[0]?.filename,
      citizenship: files.citizenship?.[0]?.filename,
      license: files.license?.[0]?.filename,
    };

    // Update worker document status
    const WorkerUser = require('./src/models/WorkerUser.model').default;
    
    // Get existing verification status or create new one
    const existingWorker = await WorkerUser.findById(workerId);
    const existingVerificationStatus = existingWorker?.verificationStatus || {};
    
    // Create verification status object with all documents as pending
    const verificationStatus = {
      profilePhoto: documentPaths.profilePhoto ? 'pending' : existingVerificationStatus.profilePhoto || 'pending',
      certificate: documentPaths.certificate ? 'pending' : existingVerificationStatus.certificate || 'pending',
      citizenship: documentPaths.citizenship ? 'pending' : existingVerificationStatus.citizenship || 'pending',
      license: documentPaths.license ? 'pending' : existingVerificationStatus.license || 'pending',
      overall: 'pending',
    };
    
    console.log('📤 Saving documents to database:', documentPaths);
    console.log('📊 Verification status:', verificationStatus);
    console.log('👤 Worker ID:', workerId);

    const updatedWorker = await WorkerUser.findByIdAndUpdate(
      workerId,
      {
        documents: documentPaths,
        verificationStatus: verificationStatus,
        verificationSubmitted: true,
        submittedAt: new Date().toISOString(),
      },
      { new: true }
    );

    if (!updatedWorker) {
      console.error('❌ Worker not found:', workerId);
      return res.status(404).json({ message: 'Worker not found' });
    }

    console.log('✅ Worker updated successfully:', updatedWorker.name);
    console.log('📄 Saved documents:', updatedWorker.documents);
    console.log('✅ verificationSubmitted:', updatedWorker.verificationSubmitted);

    // Emit Socket.IO event for real-time notification
    if (updatedWorker && io) {
      const workerData = {
        _id: String(updatedWorker._id),
        name: updatedWorker.name,
        email: updatedWorker.email,
        phone: updatedWorker.phone,
        profileImage: updatedWorker.profileImage,
        submittedAt: updatedWorker.submittedAt,
      };
      io.emit('document:verification:submitted', workerData);
      console.log(`📢 Document verification submitted event emitted: ${updatedWorker.name} to ${io.sockets.sockets.size} clients`);
    }

    // Return the updated worker data including the saved document paths
    res.json({ 
      success: true, 
      message: 'Documents uploaded successfully',
      documents: documentPaths,
      worker: {
        _id: String(updatedWorker._id),
        name: updatedWorker.name,
        verificationSubmitted: updatedWorker.verificationSubmitted,
        submittedAt: updatedWorker.submittedAt,
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ message: 'Failed to upload documents' });
  }
});

// NEW: Service category document upload route
// Handles all documents for service category verification: drivingLicense, citizenship, serviceCertificate, experienceCertificate
// experienceCertificate can be multiple files (for multi-page documents)
// Add error handling middleware before multer to catch errors
app.post('/api/workers/upload-service-documents', (req, res, next) => {
  console.log('📥 Upload route hit - before multer');
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📋 Content-Length:', req.headers['content-length']);
  next();
}, upload.fields([
  { name: 'drivingLicense', maxCount: 1 },
  { name: 'citizenship', maxCount: 1 },
  { name: 'serviceCertificate', maxCount: 1 },
  { name: 'experienceCertificate', maxCount: 10 } // Allow up to 10 images for experience certificate
]), async (req, res) => {
  console.log('📥 Received upload-service-documents request');
  console.log('📋 Request body fields:', Object.keys(req.body));
  console.log('📋 Request files:', req.files ? Object.keys(req.files as any) : 'no files');
  console.log('👤 Worker ID:', req.body.workerId);
  console.log('📂 Category:', req.body.category);
  console.log('📊 Files received:', req.files ? JSON.stringify(Object.keys((req.files as any))) : 'none');
  
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const workerId = req.body.workerId;
    const category = req.body.category;

    if (!workerId || !category) {
      console.error('❌ Missing required fields:', { workerId: !!workerId, category: !!category });
      return res.status(400).json({ message: 'Worker ID and category are required' });
    }

    // Check required documents
    // experienceCertificate can be single or multiple files
    if (!files.citizenship?.[0] || !files.serviceCertificate?.[0] || !files.experienceCertificate || files.experienceCertificate.length === 0) {
      return res.status(400).json({ 
        message: 'Citizenship, Service Certificate, and at least one Experience Certificate image are required' 
      });
    }

    const WorkerUser = require('./src/models/WorkerUser.model').default;
    const worker = await WorkerUser.findById(workerId);

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Get existing documents
    const existingDocuments = worker.documents || {};
    const existingCategoryDocuments = worker.categoryDocuments || {};
    const existingCategoryStatus = worker.categoryVerificationStatus || {};
    const existingVerificationStatus = worker.verificationStatus || {};

    // Update general documents (citizenship, license)
    const updatedDocuments = {
      ...existingDocuments,
      citizenship: files.citizenship?.[0]?.filename || existingDocuments.citizenship,
      license: files.drivingLicense?.[0]?.filename || existingDocuments.license,
    };

    // Update category-specific documents
    // Handle multiple experience certificate files (store as array of filenames)
    const experienceFiles = files.experienceCertificate || [];
    const experienceFilenames = experienceFiles.map(f => f.filename).filter(Boolean);
    
    const categoryDocuments = {
      ...existingCategoryDocuments,
      [category]: {
        skillProof: files.serviceCertificate?.[0]?.filename,
        experience: experienceFilenames.length === 1 
          ? experienceFilenames[0] 
          : experienceFilenames, // Store as array if multiple files
      }
    };

    // Set verification status to pending
    const verificationStatus = {
      ...existingVerificationStatus,
      citizenship: files.citizenship?.[0] ? 'pending' : existingVerificationStatus.citizenship,
      license: files.drivingLicense?.[0] ? 'pending' : existingVerificationStatus.license,
      overall: 'pending',
    };

    // Set category verification status to pending
    const categoryVerificationStatus = {
      ...existingCategoryStatus,
      [category]: 'pending',
    };

    console.log(`📤 Saving service documents for ${category}:`, {
      drivingLicense: files.drivingLicense?.[0]?.filename,
      citizenship: files.citizenship?.[0]?.filename,
      serviceCertificate: files.serviceCertificate?.[0]?.filename,
      experienceCertificate: experienceFilenames.length > 1 
        ? `${experienceFilenames.length} files: ${experienceFilenames.join(', ')}`
        : experienceFilenames[0],
    });

    const updatedWorker = await WorkerUser.findByIdAndUpdate(
      workerId,
      {
        documents: updatedDocuments,
        categoryDocuments,
        categoryVerificationStatus,
        verificationStatus,
        verificationSubmitted: true,
        submittedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    console.log(`✅ Service documents saved for ${category}`);

    // Create admin notification
    try {
      const Notification = require('./src/models/Notification.model').default;
      const User = require('./src/models/User.model').default;
      
      const admin = await User.findOne({ role: 'admin' });
      const adminId = admin ? admin._id : '000000000000000000000000';
      
      await Notification.create({
        userId: adminId,
        type: 'category_verification_submitted',
        title: 'New Service Category Verification',
        message: `${worker.name} has submitted verification documents for ${category} service category`,
        data: {
          workerId: String(workerId),
          workerName: worker.name,
          category: category,
          documents: {
            drivingLicense: files.drivingLicense?.[0]?.filename,
            citizenship: files.citizenship?.[0]?.filename,
            serviceCertificate: files.serviceCertificate?.[0]?.filename,
            experienceCertificate: experienceFilenames,
          },
          submittedAt: new Date().toISOString(),
        },
        priority: 'high',
      });
      console.log(`📧 Admin notification created for category verification: ${category}`);
    } catch (notificationError) {
      console.error('⚠️ Failed to create admin notification:', notificationError);
    }

    // Emit Socket.IO event
    if (io) {
      // Emit to admin dashboard
      io.to('admin').emit('category:verification:submitted', {
        workerId: String(workerId),
        workerName: worker.name,
        category,
        documents: {
          drivingLicense: files.drivingLicense?.[0]?.filename,
          citizenship: files.citizenship?.[0]?.filename,
          serviceCertificate: files.serviceCertificate?.[0]?.filename,
          experienceCertificate: experienceFilenames,
        },
        timestamp: new Date().toISOString(),
      });
      
      // Emit to worker for confirmation (workers join their userId room)
      io.to(String(workerId)).emit('category:verification:submitted', {
        workerId: String(workerId),
        category,
        status: 'pending',
        message: 'Your documents have been submitted for verification',
        timestamp: new Date().toISOString(),
      });
      
      // Emit globally for other clients
      io.emit('document:verification:submitted', {
        workerId: String(workerId),
        category,
        documents: updatedDocuments,
      });
      
      console.log(`📢 Service verification submitted event emitted for ${category}`);
    }

    console.log('✅ Service documents saved successfully for category:', category);
    console.log('📤 Sending success response...');
    
    res.json({
      success: true,
      message: `Service documents uploaded successfully for ${category}`,
      category,
      documents: {
        drivingLicense: files.drivingLicense?.[0]?.filename,
        citizenship: files.citizenship?.[0]?.filename,
        serviceCertificate: files.serviceCertificate?.[0]?.filename,
        experienceCertificate: experienceFilenames.length > 0 ? experienceFilenames[0] : files.experienceCertificate?.[0]?.filename,
      },
    });
    
    console.log('✅ Response sent successfully');
  } catch (error: any) {
    console.error('❌ Service document upload error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    
    // Handle multer errors specifically
    if (error.name === 'MulterError') {
      console.error('❌ Multer error:', error.code, error.field);
      return res.status(400).json({ 
        message: `File upload error: ${error.message || error.code}`,
        error: error.code || 'MULTER_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to upload service documents',
      error: error.message || String(error)
    });
  }
});

// Category-specific document upload route (legacy - kept for backward compatibility)
// Handles skill proof and experience documents for service category verification
app.post('/api/workers/upload-category-documents', upload.fields([
  { name: 'skillProof', maxCount: 1 },
  { name: 'experience', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const workerId = req.body.workerId;
    const category = req.body.category;

    if (!workerId || !category) {
      return res.status(400).json({ message: 'Worker ID and category are required' });
    }

    if (!files.skillProof?.[0] || !files.experience?.[0]) {
      return res.status(400).json({ message: 'Both skill proof and experience documents are required' });
    }

    const WorkerUser = require('./src/models/WorkerUser.model').default;
    const worker = await WorkerUser.findById(workerId);

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Get existing category documents or create new object
    const existingCategoryDocuments = worker.categoryDocuments || {};
    const existingCategoryStatus = worker.categoryVerificationStatus || {};

    // Update category documents
    const categoryDocuments = {
      ...existingCategoryDocuments,
      [category]: {
        skillProof: files.skillProof[0].filename,
        experience: files.experience[0].filename,
      }
    };

    // Set category verification status to pending
    const categoryVerificationStatus = {
      ...existingCategoryStatus,
      [category]: 'pending',
    };

    console.log(`📤 Saving category documents for ${category}:`, {
      skillProof: files.skillProof[0].filename,
      experience: files.experience[0].filename,
    });

    const updatedWorker = await WorkerUser.findByIdAndUpdate(
      workerId,
      {
        categoryDocuments,
        categoryVerificationStatus,
      },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    console.log(`✅ Category documents saved for ${category}`);

    // Create admin notification for category verification
    try {
      const Notification = require('./src/models/Notification.model').default;
      const User = require('./src/models/User.model').default;
      
      // Find admin user (assuming admin has role 'admin')
      const admin = await User.findOne({ role: 'admin' });
      const adminId = admin ? admin._id : '000000000000000000000000'; // Fallback admin ID
      
      await Notification.create({
        userId: adminId,
        type: 'category_verification_submitted',
        title: 'New Service Category Verification',
        message: `${worker.name} has submitted verification documents for ${category} service category`,
        data: {
          workerId: String(workerId),
          workerName: worker.name,
          category: category,
          skillProof: files.skillProof[0].filename,
          experience: files.experience[0].filename,
          submittedAt: new Date().toISOString(),
        },
        priority: 'high',
      });
      console.log(`📧 Admin notification created for category verification: ${category}`);
    } catch (notificationError) {
      console.error('⚠️ Failed to create admin notification:', notificationError);
      // Don't fail the request if notification creation fails
    }

    // Emit Socket.IO event for real-time notification
    if (io) {
      // Emit to admin room
      io.to('admin').emit('category:verification:submitted', {
        workerId: String(workerId),
        workerName: worker.name,
        category,
        skillProof: files.skillProof[0].filename,
        experience: files.experience[0].filename,
        timestamp: new Date().toISOString(),
      });
      
      // Also emit general event
      io.emit('category:verification:submitted', {
        workerId: String(workerId),
        category,
        skillProof: files.skillProof[0].filename,
        experience: files.experience[0].filename,
      });
      
      console.log(`📢 Category verification submitted event emitted for ${category}`);
    }

    res.json({
      success: true,
      message: `Category documents uploaded successfully for ${category}`,
      category,
      documents: {
        skillProof: files.skillProof[0].filename,
        experience: files.experience[0].filename,
      },
    });
  } catch (error) {
    console.error('Category document upload error:', error);
    res.status(500).json({ message: 'Failed to upload category documents' });
  }
});

app.get("/", (req, res) => {
    res.send("Welcome to the Item API");
});

// Health check endpoint to verify backend and database connection
app.get("/health", async (req, res) => {
  try {
    const { getConnectionStatus } = require('./src/db');
    const dbStatus = getConnectionStatus();
    
    // Test database operation
    const User = require('./src/models/User.model').default;
    const userCount = await User.countDocuments();
    
    const WorkerUser = require('./src/models/WorkerUser.model').default;
    const workerCount = await WorkerUser.countDocuments();
    
    const Booking = require('./src/models/Booking.model').default;
    const bookingCount = await Booking.countDocuments();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      backend: {
        status: 'running',
        port: process.env.PORT || 5001,
        environment: process.env.NODE_ENV || 'development',
      },
      database: {
        connected: dbStatus.isConnected,
        readyState: dbStatus.readyState,
        database: dbStatus.database,
        error: dbStatus.error ? dbStatus.error.message : null,
      },
      counts: {
        users: userCount,
        workers: workerCount,
        bookings: bookingCount,
      },
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      backend: {
        status: 'running',
        port: process.env.PORT || 5001,
      },
      database: {
        connected: false,
        error: error.message,
      },
      error: error.message,
    });
  }
});

const PORT = Number(process.env.PORT) || 5001;

// Add error handling to prevent crash loops
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error('   Please kill the process using this port or use a different port.');
    console.error('   To find and kill: lsof -ti:5001 | xargs kill -9');
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions to prevent crash loops
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('   Stack:', error.stack);
  // Exit after logging to prevent infinite restart loops
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
  // Log but don't exit for unhandled rejections (they're less critical)
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('✅ HTTP server closed.');
    io.close(() => {
      console.log('✅ Socket.IO server closed.');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

connectDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
      console.log(`📱 For mobile devices, use your computer's IP address:`);
      console.log(`   Example: http://192.168.1.66:${PORT}`);
      console.log(`   Find your IP with: ifconfig (Mac/Linux) or ipconfig (Windows)`);
      console.log(`🔌 Socket.IO server is running`);
      console.log(`✅ Backend is stable and ready to accept requests`);
      console.log(`\n📋 Network Configuration:`);
      console.log(`   - Listening on: 0.0.0.0 (all network interfaces)`);
      console.log(`   - Port: ${PORT}`);
      console.log(`   - CORS: Enabled for all origins`);
      console.log(`   - File upload limit: 10MB per file`);
      console.log(`   - Body size limit: 50MB`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to connect to database:', error);
    console.error('   Server will not start without database connection.');
    console.error('   Please check your MongoDB connection and try again.');
    process.exit(1);
  });
