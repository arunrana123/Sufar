import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.model";

const router = Router();

// Get notifications for a user
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Check if userId is valid and not undefined
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.json([]);
    }
    
    // Convert string userId to ObjectId if needed
    const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const notifications = await Notification.find({ userId: userIdObj }).sort({ createdAt: -1 });
    return res.json(notifications);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Mark notification as read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Emit real-time event for notification read
    const io = req.app.get('io');
    if (io && notification.userId) {
      io.to(String(notification.userId)).emit('notification:read', { 
        notificationId: id,
        userId: notification.userId 
      });
    }

    return res.json({ message: "Notification marked as read", notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return res.status(500).json({ message: "Failed to update notification" });
  }
});

// Get unread count for a user
router.get("/user/:userId/unread-count", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Check if userId is valid and not undefined
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.json({ count: 0 });
    }
    
    // Convert string userId to ObjectId if needed
    const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const count = await Notification.countDocuments({ userId: userIdObj, isRead: false });
    return res.json({ count });
  } catch (err) {
    console.error('Fetch unread count error:', err);
    return res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

// Mark all notifications as read for a user
router.patch("/user/:userId/mark-all-read", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Check if userId is valid and not undefined
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.json({ message: "Invalid user ID", updatedCount: 0 });
    }
    
    // Convert string userId to ObjectId if needed
    const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    // Get all unread notifications before updating
    const unreadNotifications = await Notification.find({ 
      userId: userIdObj, 
      isRead: false 
    });
    
    const result = await Notification.updateMany(
      { userId: userIdObj, isRead: false },
      { isRead: true }
    );

    // Emit real-time event for all notifications read
    const io = req.app.get('io');
    if (io) {
      // Emit individual read events for each notification
      unreadNotifications.forEach((notif) => {
        io.to(String(userId)).emit('notification:read', { 
          notificationId: notif._id,
          userId: userId 
        });
      });
      // Also emit a general cleared event
      io.to(String(userId)).emit('notifications:all-read', { userId });
    }

    return res.json({ 
      message: "All notifications marked as read", 
      updatedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    return res.status(500).json({ message: "Failed to mark all notifications as read" });
  }
});

// Delete a single notification
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Emit real-time event for deletion
    const io = req.app.get('io');
    if (io) {
      io.to(String(notification.userId)).emit('notification:deleted', { notificationId: id });
    }

    return res.json({ message: "Notification deleted successfully" });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ message: "Failed to delete notification" });
  }
});

// Delete all notifications for a user
router.delete("/user/:userId/all", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Check if userId is valid and not undefined
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.json({ message: "Invalid user ID", deletedCount: 0 });
    }
    
    // Convert string userId to ObjectId if needed
    const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const result = await Notification.deleteMany({ userId: userIdObj });

    // Emit real-time event for clearing all
    const io = req.app.get('io');
    if (io) {
      io.to(String(userId)).emit('notifications:cleared', { userId });
    }

    return res.json({ 
      message: "All notifications deleted successfully", 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Delete all notifications error:', err);
    return res.status(500).json({ message: "Failed to delete all notifications" });
  }
});

// Create a test notification
router.post("/test/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type = 'general', title, message } = req.body;
    
    // Convert string userId to ObjectId if needed
    const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const notification = new Notification({
      userId: userIdObj,
      title: title || 'Test Notification',
      message: message || 'This is a test notification',
      type,
      isRead: false,
      data: { test: true }
    });

    await notification.save();

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('notification:new', notification);
    }

    return res.json(notification);
  } catch (err) {
    console.error('Create test notification error:', err);
    return res.status(500).json({ message: "Failed to create test notification" });
  }
});

export default router;
