import { Router, type Request, type Response } from "express";
import User from "../models/User.model";
import WorkerUser from "../models/WorkerUser.model";
import Booking from "../models/Booking.model";
import Service from "../models/Service.model";
import AdminActivity from "../models/AdminActivity.model";

const router = Router();

// Get dashboard statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    console.log('📊 Fetching dashboard stats...');
    
    // Get user counts
    let totalUsers = 0;
    let totalAdmins = 0;
    try {
      totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
      totalAdmins = await User.countDocuments({ role: 'admin' });
      console.log('✅ User counts:', { totalUsers, totalAdmins });
    } catch (userError: any) {
      console.error('❌ Error fetching user counts:', userError);
      throw new Error(`Failed to fetch user counts: ${userError.message}`);
    }

    // Get worker counts (from WorkerUser model)
    let totalWorkers = 0;
    let pendingWorkers = 0;
    let approvedWorkers = 0;
    let deniedWorkers = 0;
    try {
      totalWorkers = await WorkerUser.countDocuments();
      pendingWorkers = await WorkerUser.countDocuments({ 
        verificationStatus: { $in: ['pending', 'submitted'] } 
      });
      approvedWorkers = await WorkerUser.countDocuments({ 
        verificationStatus: 'verified' 
      });
      deniedWorkers = await WorkerUser.countDocuments({ 
        verificationStatus: 'rejected' 
      });
      console.log('✅ Worker counts:', { totalWorkers, pendingWorkers, approvedWorkers, deniedWorkers });
    } catch (workerError: any) {
      console.error('❌ Error fetching worker counts:', workerError);
      throw new Error(`Failed to fetch worker counts: ${workerError.message}`);
    }

    // Get booking counts
    let totalBookings = 0;
    let recentBookings = 0;
    try {
      totalBookings = await Booking.countDocuments();
      recentBookings = await Booking.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      console.log('✅ Booking counts:', { totalBookings, recentBookings });
    } catch (bookingError: any) {
      console.error('❌ Error fetching booking counts:', bookingError);
      throw new Error(`Failed to fetch booking counts: ${bookingError.message}`);
    }

    // Get service counts
    let activeServices = 0;
    let totalServices = 0;
    try {
      activeServices = await Service.countDocuments({ isActive: true });
      totalServices = await Service.countDocuments();
      console.log('✅ Service counts:', { activeServices, totalServices });
    } catch (serviceError: any) {
      console.error('❌ Error fetching service counts:', serviceError);
      throw new Error(`Failed to fetch service counts: ${serviceError.message}`);
    }

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let recentUsers = 0;
    let recentWorkers = 0;
    try {
      recentUsers = await User.countDocuments({ 
        role: { $ne: 'admin' },
        createdAt: { $gte: sevenDaysAgo } 
      });
      recentWorkers = await WorkerUser.countDocuments({ 
        createdAt: { $gte: sevenDaysAgo } 
      });
      console.log('✅ Recent registrations:', { recentUsers, recentWorkers });
    } catch (recentError: any) {
      console.error('❌ Error fetching recent registrations:', recentError);
      // Don't throw here, just use 0 as default
      recentUsers = 0;
      recentWorkers = 0;
    }

    // Calculate total users (users + workers)
    const totalAllUsers = totalUsers + totalWorkers;

    const stats = {
      users: {
        total: totalAllUsers, // Combined users + workers
        regularUsers: totalUsers,
        workers: totalWorkers,
        recent: recentUsers + recentWorkers,
      },
      admins: {
        total: totalAdmins,
      },
      workers: {
        total: totalWorkers,
        pending: pendingWorkers,
        approved: approvedWorkers,
        denied: deniedWorkers,
        recent: recentWorkers,
      },
      bookings: {
        total: totalBookings,
        recent: recentBookings,
      },
      services: {
        active: activeServices,
        total: totalServices,
      },
    };

    console.log('✅ Dashboard stats fetched successfully');
    return res.json(stats);
  } catch (err: any) {
    console.error('❌ Dashboard stats error:', err);
    console.error('Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name
    });
    return res.status(500).json({ 
      message: "Failed to fetch dashboard stats",
      error: err?.message || String(err),
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
});

// Get recent admin activities
router.get("/activities", async (req: Request, res: Response) => {
  try {
    const activities = await AdminActivity.find()
      .populate('adminId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json(activities);
  } catch (err) {
    console.error('Fetch activities error:', err);
    return res.status(500).json({ message: "Failed to fetch activities" });
  }
});

// Delete all admin activities
router.delete("/activities", async (req: Request, res: Response) => {
  try {
    const result = await AdminActivity.deleteMany({});
    return res.json({ 
      message: "All activities cleared successfully", 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Clear activities error:', err);
    return res.status(500).json({ message: "Failed to clear activities" });
  }
});

// Log admin activity (helper function used by other routes)
export const logAdminActivity = async (
  adminId: string,
  action: string,
  description: string,
  targetId?: string,
  targetType?: string,
  metadata?: any
) => {
  try {
    await AdminActivity.create({
      adminId,
      action,
      description,
      targetId: targetId || undefined,
      targetType: targetType || undefined,
      metadata: metadata || undefined,
    });
  } catch (err) {
    console.error('Log activity error:', err);
  }
};

export default router;
