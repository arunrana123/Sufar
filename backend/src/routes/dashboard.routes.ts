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
    // Get user counts
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // Get worker counts (from WorkerUser model)
    const totalWorkers = await WorkerUser.countDocuments();
    const pendingWorkers = await WorkerUser.countDocuments({ 
      verificationStatus: { $in: ['pending', 'submitted'] } 
    });
    const approvedWorkers = await WorkerUser.countDocuments({ 
      verificationStatus: 'verified' 
    });
    const deniedWorkers = await WorkerUser.countDocuments({ 
      verificationStatus: 'rejected' 
    });

    // Get booking counts
    const totalBookings = await Booking.countDocuments();
    const recentBookings = await Booking.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Get service counts
    const activeServices = await Service.countDocuments({ isActive: true });
    const totalServices = await Service.countDocuments();

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await User.countDocuments({ 
      role: { $ne: 'admin' },
      createdAt: { $gte: sevenDaysAgo } 
    });
    const recentWorkers = await WorkerUser.countDocuments({ 
      createdAt: { $gte: sevenDaysAgo } 
    });

    // Calculate total users (users + workers)
    const totalAllUsers = totalUsers + totalWorkers;

    return res.json({
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
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ message: "Failed to fetch dashboard stats" });
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
