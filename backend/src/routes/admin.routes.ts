import express from 'express';
import mongoose from 'mongoose';
import WorkerUser from '../models/WorkerUser.model';
import AdminActivity from '../models/AdminActivity.model';
import Notification from '../models/Notification.model';
import { Server as SocketIOServer } from 'socket.io';

// Helper to get io from request
const getIO = (req: express.Request): SocketIOServer | null => {
  const app = req.app;
  return app.get('io') || null;
};

const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes working', timestamp: new Date().toISOString() });
});

// Test database connection and model
router.get('/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    
    // Test basic database operation
    const count = await WorkerUser.countDocuments();
    console.log('Worker count:', count);
    
    // Test creating a simple worker
    const simpleWorker = new WorkerUser({
      name: 'Simple Test',
      email: 'simple@test.com',
      phone: '+977-1111111111',
      password: 'test123',
      skills: ['Test']
    });
    
    console.log('Creating simple worker...');
    const saved = await simpleWorker.save();
    console.log('Simple worker saved:', saved._id);
    
    res.json({ 
      message: 'Database test successful', 
      count,
      workerId: saved._id
    });
  } catch (error) {
    console.error('Database test failed:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      message: 'Database test failed', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all workers with verification status
router.get('/workers', async (req, res) => {
  try {
    console.log('Fetching workers for admin dashboard...');
    
    // First, let's check all workers in the database
    const allWorkers = await WorkerUser.find({})
      .select('name email phone skills documents verificationStatus verificationNotes profileImage');
    
    console.log(`Total workers in database: ${allWorkers.length}`);
    console.log('All workers:', allWorkers.map(w => ({ 
      name: w.name, 
      verificationStatus: w.verificationStatus,
      hasDocuments: !!w.documents
    })));
    
    // If no workers exist, create a test worker
    if (allWorkers.length === 0) {
      console.log('No workers found, creating test worker...');
      try {
        const testWorker = new WorkerUser({
          name: 'Test Worker',
          email: 'test@worker.com',
          phone: '+977-1234567890',
          password: 'hashedpassword',
          skills: ['Plumbing', 'Electrical'],
          experience: '5 years',
          rating: 4.5,
          completedJobs: 25,
          profileImage: 'https://via.placeholder.com/150',
          documents: {
            profilePhoto: 'https://via.placeholder.com/300x200/FF0000/FFFFFF?text=Profile+Photo',
            certificate: 'https://via.placeholder.com/300x200/00FF00/FFFFFF?text=Certificate',
            citizenship: 'https://via.placeholder.com/300x200/0000FF/FFFFFF?text=Citizenship',
            license: 'https://via.placeholder.com/300x200/FFFF00/000000?text=License'
          },
          verificationStatus: 'pending',
          verificationSubmitted: true,
          submittedAt: new Date()
        });
        
        console.log('Test worker object created:', testWorker);
        const savedWorker = await testWorker.save();
        console.log('Test worker saved successfully:', savedWorker);
      } catch (createError) {
        console.error('Error creating test worker:', createError instanceof Error ? createError.message : String(createError));
        if (createError instanceof Error) {
          console.error('Error details:', createError.message);
          console.error('Error stack:', createError.stack);
        }
      }
    }
    
    // Find ALL workers first to debug
    const allWorkersDebug = await WorkerUser.find({})
      .select('name verificationSubmitted documents')
      .lean();
    
    console.log(`📊 Total workers in database: ${allWorkersDebug.length}`);
    allWorkersDebug.forEach((w: any) => {
      const docKeys = w.documents ? Object.keys(w.documents).filter(k => w.documents[k]) : [];
      console.log(`  - ${w.name}: Submitted=${w.verificationSubmitted}, Docs=[${docKeys.join(', ')}]`);
    });
    
    // Find workers who have submitted documents for verification
    // Check for workers with verificationSubmitted: true OR with any document field populated
    const allWorkersWithDocs = await WorkerUser.find({
      $or: [
        { verificationSubmitted: true },
        { 'documents.profilePhoto': { $exists: true, $ne: null } },
        { 'documents.certificate': { $exists: true, $ne: null } },
        { 'documents.citizenship': { $exists: true, $ne: null } },
        { 'documents.license': { $exists: true, $ne: null } },
      ]
    })
      .select('name email phone skills documents verificationStatus verificationNotes verificationSubmitted submittedAt profileImage rating completedJobs experience createdAt')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    
    // Filter to only include workers with non-empty document values
    const workers = allWorkersWithDocs.filter((worker: any) => {
      if (!worker.documents) return false;
      const docKeys = Object.keys(worker.documents).filter(key => {
        const value = worker.documents[key];
        return value && value !== null && value !== '';
      });
      return docKeys.length > 0;
    });
    
    console.log(`✅ Found ${workers.length} workers with verification submitted or documents`);
    
    // Log details for debugging
    workers.forEach((worker: any) => {
      const docKeys = worker.documents ? Object.keys(worker.documents).filter(key => {
        const value = worker.documents[key];
        return value && value !== null && value !== '';
      }) : [];
      const docCount = docKeys.length;
      console.log(`  ✅ ${worker.name}: Submitted=${worker.verificationSubmitted}, Documents=${docCount} [${docKeys.join(', ')}]`);
    });
    
    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ message: 'Failed to fetch workers' });
  }
});

// Delete a single worker request (admin only)
router.delete('/workers/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    
    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker request not found' });
    }
    
    await WorkerUser.findByIdAndDelete(workerId);
    
    // Log admin activity (if adminId is available)
    try {
      const adminId = (req as any).user?.id || (req as any).admin?.id;
      if (adminId) {
        const { logAdminActivity } = require('./dashboard.routes');
        await logAdminActivity(
          adminId,
          'delete',
          `Deleted worker request: ${worker.name} (${worker.email})`,
          workerId,
          'worker'
        );
      }
    } catch (logError) {
      console.warn('Could not log admin activity:', logError);
    }
    
    return res.json({ message: 'Worker request deleted successfully', deletedWorkerId: workerId });
  } catch (error) {
    console.error('Delete worker request error:', error);
    return res.status(500).json({ message: 'Failed to delete worker request' });
  }
});

// Delete all worker requests by status (admin only)
router.delete('/workers', async (req, res) => {
  try {
    const { status } = req.query; // 'pending', 'approved', 'rejected', or undefined for all
    
    let query: any = { verificationSubmitted: true };
    if (status && ['pending', 'verified', 'rejected'].includes(status as string)) {
      query.verificationStatus = status;
    }
    
    const result = await WorkerUser.deleteMany(query);
    
    // Log admin activity (if adminId is available)
    try {
      const adminId = (req as any).user?.id || (req as any).admin?.id;
      if (adminId) {
        const { logAdminActivity } = require('./dashboard.routes');
        await logAdminActivity(
          adminId,
          'delete_all',
          `Deleted all worker requests${status ? ` (${status})` : ''} (${result.deletedCount} workers)`,
          undefined,
          'worker'
        );
      }
    } catch (logError) {
      console.warn('Could not log admin activity:', logError);
    }
    
    return res.json({ 
      message: `All worker requests${status ? ` (${status})` : ''} deleted successfully`, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Delete all worker requests error:', error);
    return res.status(500).json({ message: 'Failed to delete worker requests' });
  }
});

// Verify a specific document
router.post('/verify-document', async (req, res) => {
  try {
    const { workerId, documentType, status } = req.body;

    if (!workerId || !documentType || !status) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const worker = await WorkerUser.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Update the specific document status
    // Ensure verificationStatus is an object
    const currentVerificationStatus = typeof worker.verificationStatus === 'object' && worker.verificationStatus !== null && !Array.isArray(worker.verificationStatus)
      ? worker.verificationStatus
      : {
          profilePhoto: 'pending',
          certificate: 'pending',
          citizenship: 'pending',
          license: 'pending',
          overall: 'pending',
        };
    
    const updatedVerificationStatus = {
      ...currentVerificationStatus,
      [documentType]: status
    };

    // Check overall status
    const allStatuses = Object.values(updatedVerificationStatus).filter(s => s !== 'pending');
    let overallStatus = 'pending';
    if (allStatuses.length > 0) {
      if (allStatuses.every(s => s === 'verified')) {
        overallStatus = 'verified';
      } else if (allStatuses.some(s => s === 'rejected')) {
        overallStatus = 'rejected';
      }
    }

    updatedVerificationStatus.overall = overallStatus;

    await WorkerUser.findByIdAndUpdate(workerId, {
      verificationStatus: updatedVerificationStatus
    });

    // Log admin activity
    await AdminActivity.create({
      adminId: new mongoose.Types.ObjectId(), // Use a default admin ID
      action: `Document verification: ${documentType} ${status}`,
      description: `${documentType} document ${status} for worker ${worker.name}`,
      targetId: workerId,
      targetType: 'worker',
      metadata: {
        documentType,
        status,
        workerName: worker.name
      }
    });

    // Send notification to worker
    const notificationMessage = status === 'verified' 
      ? `Your ${documentType.replace(/([A-Z])/g, ' $1')} has been approved!`
      : `Your ${documentType.replace(/([A-Z])/g, ' $1')} has been rejected. Please review and resubmit.`;

    await Notification.create({
      userId: workerId,
      type: 'document_verification',
      title: status === 'verified' ? 'Document Approved' : 'Document Rejected',
      message: notificationMessage,
      data: {
        documentType,
        status,
        overallStatus,
        verifiedAt: new Date().toISOString()
      }
    });

    // If overall status is verified, send a special notification
    if (overallStatus === 'verified') {
      await Notification.create({
        userId: workerId,
        type: 'verification_complete',
        title: 'Verification Complete!',
        message: 'Your document is verified. Now you are ready to use your worker service.',
        data: {
          overallStatus,
          verifiedAt: new Date().toISOString(),
          allDocumentsVerified: true
        }
      });
    }

    // Emit Socket.IO event for real-time notification to worker
    const io = getIO(req);
    if (io) {
      const updateData = {
        workerId: String(workerId),
        documentType,
        status,
        overallStatus,
      };
      
      // Emit to specific worker room for targeted delivery
      io.to(`worker:${workerId}`).emit('document:verification:updated', updateData);
      
      // Emit globally for admin dashboard and other clients
      io.emit('document:verification:updated', updateData);
      
      // Emit specific event for admin dashboard stats update
      io.emit('admin:dashboard:worker-stats-updated', {
        workerId: String(workerId),
        overallStatus,
        action: 'verification_updated',
      });
      
      console.log(`📢 Document verification update emitted: ${documentType} ${status} for worker ${workerId}`);
    }

    res.json({ 
      success: true, 
      message: 'Document verification updated successfully',
      overallStatus
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ message: 'Failed to verify document' });
  }
});

// Get notifications for admin dashboard
router.get('/notifications', async (req, res) => {
  try {
    // Get admin notifications (using the special admin ObjectId)
    const adminId = new mongoose.Types.ObjectId('000000000000000000000000');
    const notifications = await Notification.find({ userId: adminId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Create notification (for worker app to send notifications)
router.post('/notifications', async (req, res) => {
  try {
    const { type, workerId, workerName, message, priority, data } = req.body;

    // Create a special admin ObjectId for admin notifications
    const adminId = new mongoose.Types.ObjectId('000000000000000000000000');

    const notification = await Notification.create({
      userId: adminId, // Admin notification
      type: type || 'document_verification',
      title: 'New Document Verification',
      message: message || `${workerName} has submitted documents for verification`,
      data: data || {}
    });

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Failed to create notification' });
  }
});

// Get admin activity log
router.get('/activity', async (req, res) => {
  try {
    const activities = await AdminActivity.find()
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching admin activity:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch admin activity' });
  }
});

// Update worker verification submission
router.post('/submit-verification', async (req, res) => {
  try {
    const { workerId, documents, verificationStatus } = req.body;

    console.log('Updating worker verification submission:', { workerId, documents, verificationStatus });

    // Ensure verificationStatus is an object, not a string
    const verificationStatusObj = typeof verificationStatus === 'object' && verificationStatus !== null
      ? verificationStatus
      : {
          profilePhoto: 'pending',
          certificate: 'pending',
          citizenship: 'pending',
          license: 'pending',
          overall: 'pending',
        };

    // Get existing worker to preserve existing documents
    const existingWorker = await WorkerUser.findById(workerId);
    if (!existingWorker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Merge new documents with existing documents
    // Preserve existing documents if new ones are not provided
    const existingDocuments = existingWorker.documents || {};
    const mergedDocuments: any = { ...existingDocuments };
    
    if (documents) {
      Object.entries(documents).forEach(([key, value]) => {
        if (value && value !== null && value !== '') {
          // Extract filename from full URL if it's a URL
          if (typeof value === 'string' && value.startsWith('http')) {
            // Extract filename from URL (e.g., "http://localhost:5001/uploads/profilePhoto-123.jpg" -> "profilePhoto-123.jpg")
            const urlParts = value.split('/');
            const filename = urlParts[urlParts.length - 1];
            mergedDocuments[key] = filename;
          } else {
            mergedDocuments[key] = value;
          }
        }
      });
    }

    console.log('📄 Existing documents:', existingDocuments);
    console.log('📄 New documents received:', documents);
    console.log('📄 Merged documents:', mergedDocuments);

    const updatedWorker = await WorkerUser.findByIdAndUpdate(
      workerId,
      {
        documents: mergedDocuments,
        verificationStatus: verificationStatusObj,
        verificationSubmitted: true,
        submittedAt: new Date().toISOString(),
      },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    console.log('✅ Worker verification updated successfully:', updatedWorker.name);
    console.log('📄 Documents saved:', mergedDocuments);
    console.log('📊 Verification status:', verificationStatusObj);
    console.log('✅ verificationSubmitted:', updatedWorker.verificationSubmitted);

    // Emit Socket.IO event for real-time notification
    const io = getIO(req);
    if (io) {
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
    } else {
      console.warn('⚠️ Socket.IO not available - cannot emit real-time notification');
    }

    res.json({ 
      success: true, 
      message: 'Verification submitted successfully',
      worker: updatedWorker
    });
  } catch (error) {
    console.error('Error updating worker verification:', error);
    res.status(500).json({ message: 'Failed to update worker verification' });
  }
});

// Get verification statistics
router.get('/verification-stats', async (req, res) => {
  try {
    const totalWorkers = await WorkerUser.countDocuments({ verificationSubmitted: true });
    const pendingWorkers = await WorkerUser.countDocuments({ 
      verificationSubmitted: true,
      'verificationStatus.overall': 'pending'
    });
    const verifiedWorkers = await WorkerUser.countDocuments({ 
      verificationSubmitted: true,
      'verificationStatus.overall': 'verified'
    });
    const rejectedWorkers = await WorkerUser.countDocuments({ 
      verificationSubmitted: true,
      'verificationStatus.overall': 'rejected'
    });

    res.json({
      total: totalWorkers,
      pending: pendingWorkers,
      verified: verifiedWorkers,
      rejected: rejectedWorkers
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ message: 'Failed to fetch verification stats' });
  }
});

// Test endpoint to create a sample worker for testing
router.post('/create-test-worker', async (req, res) => {
  try {
    // First check if test worker already exists
    const existingWorker = await WorkerUser.findOne({ email: 'test@worker.com' });
    if (existingWorker) {
      // Update existing worker to have verificationSubmitted: true
      await WorkerUser.findByIdAndUpdate(existingWorker._id, {
        verificationSubmitted: true,
        submittedAt: new Date()
      });
      
      const updatedWorker = await WorkerUser.findById(existingWorker._id);
      return res.json({ 
        success: true, 
        message: 'Test worker updated for verification',
        worker: updatedWorker
      });
    }

    const testWorker = new WorkerUser({
      name: 'Test Worker',
      email: 'test@worker.com',
      phone: '+977-1234567890',
      password: 'hashedpassword',
      skills: ['Plumbing', 'Electrical'],
      rating: 4.5,
      completedJobs: 25,
      profileImage: 'https://via.placeholder.com/150',
      documents: {
        profilePhoto: 'https://via.placeholder.com/300x200/FF0000/FFFFFF?text=Profile+Photo',
        certificate: 'https://via.placeholder.com/300x200/00FF00/FFFFFF?text=Certificate',
        citizenship: 'https://via.placeholder.com/300x200/0000FF/FFFFFF?text=Citizenship',
        license: 'https://via.placeholder.com/300x200/FFFF00/000000?text=License'
      },
      verificationStatus: 'pending',
      verificationSubmitted: true,
      submittedAt: new Date(),
      verificationNotes: 'Test worker for verification testing'
    });

    await testWorker.save();
    console.log('Test worker created successfully:', testWorker.name);

    res.json({ 
      success: true, 
      message: 'Test worker created successfully',
      worker: testWorker
    });
  } catch (error) {
    console.error('Error creating test worker:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      message: 'Failed to create test worker', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
