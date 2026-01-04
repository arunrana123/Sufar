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
import syncRoutes from "./src/routes/sync.routes";
import adminRoutes from "./src/routes/admin.routes";
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
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// CORS configuration for web dashboard and mobile apps
app.use(cors({
  origin: true, // Allow all origins for mobile apps
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

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
      socket.join(userType); // 'worker' or 'user'
      socket.join(userId);   // Specific worker/user ID
      
      console.log(`✅ AUTHENTICATED: ${userType} ${userId} joined rooms: ['${userType}', '${userId}']`);
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

  // Worker location updates - broadcast to user
  socket.on('worker:location', (data) => {
    if (data.bookingId) {
      // Emit to the user who made the booking
      io.emit('worker:location', data);
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
app.use("/api/sync", syncRoutes);
app.use("/api/admin", adminRoutes);

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

// Category-specific document upload route
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

connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO server is running`);
  });
});
