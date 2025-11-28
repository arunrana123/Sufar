import { Router, type Request, type Response } from "express";
import Service from "../models/Service.model";
import Booking from "../models/Booking.model";
import WorkerUser from "../models/WorkerUser.model";
import User from "../models/User.model";
import Notification from "../models/Notification.model";

const router = Router();

// Sync service updates to all connected apps
router.post("/service-update", async (req: Request, res: Response) => {
  try {
    const { serviceId, updates, adminId } = req.body;

    if (!serviceId || !updates) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Update the service
    const service = await Service.findByIdAndUpdate(
      serviceId,
      updates,
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Find all active bookings for this service
    const activeBookings = await Booking.find({
      serviceId,
      status: { $in: ['pending', 'accepted', 'in_progress'] },
    });

    // Update price in active bookings if price changed
    if (updates.price) {
      await Booking.updateMany(
        {
          serviceId,
          status: { $in: ['pending', 'accepted'] }, // Only update pending/accepted, not in_progress
        },
        { price: updates.price }
      );
    }

    // Send notifications to affected users
    const notificationPromises: Promise<any>[] = [];

    for (const booking of activeBookings) {
      // Notify user about service update
      notificationPromises.push(
        Notification.create({
          userId: booking.userId,
          title: 'Service Updated',
          message: `${service.title} has been updated. ${
            updates.price ? `New price: Rs. ${updates.price}` : ''
          }`,
          type: 'service_updated',
          metadata: {
            serviceId,
            bookingId: booking._id,
            updates,
          },
        })
      );

      // Notify worker if assigned
      if (booking.workerId) {
        notificationPromises.push(
          Notification.create({
            userId: booking.workerId,
            title: 'Service Details Updated',
            message: `${service.title} booking details have been updated by admin`,
            type: 'service_updated',
            metadata: {
              serviceId,
              bookingId: booking._id,
              updates,
            },
          })
        );
      }
    }

    await Promise.all(notificationPromises);

    return res.json({
      message: 'Service updated and notifications sent',
      service,
      affectedBookings: activeBookings.length,
    });
  } catch (err) {
    console.error('Service sync error:', err);
    return res.status(500).json({ message: "Failed to sync service update" });
  }
});

// Get sync status for a user (check for updates)
router.get("/user-updates/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { lastSync } = req.query;

    const query: any = { userId };
    if (lastSync) {
      query.createdAt = { $gt: new Date(lastSync as string) };
    }

    // Get new notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    // Get active bookings with updates
    const activeBookings = await Booking.find({
      userId,
      status: { $in: ['pending', 'accepted', 'in_progress'] },
      updatedAt: lastSync ? { $gt: new Date(lastSync as string) } : { $exists: true },
    })
      .populate('workerId', 'name phone rating currentLocation status')
      .populate('serviceId', 'title price category');

    return res.json({
      notifications,
      bookings: activeBookings,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('User sync error:', err);
    return res.status(500).json({ message: "Failed to fetch updates" });
  }
});

// Get sync status for a worker
router.get("/worker-updates/:workerId", async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;
    const { lastSync } = req.query;

    const query: any = { userId: workerId };
    if (lastSync) {
      query.createdAt = { $gt: new Date(lastSync as string) };
    }

    // Get new notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    // Get pending/accepted bookings with updates
    const bookings = await Booking.find({
      workerId,
      status: { $in: ['pending', 'accepted', 'in_progress'] },
      updatedAt: lastSync ? { $gt: new Date(lastSync as string) } : { $exists: true },
    })
      .populate('userId', 'firstName lastName phone')
      .populate('serviceId', 'title price category');

    // Get worker's current status
    const worker = await WorkerUser.findById(workerId);

    return res.json({
      notifications,
      bookings,
      workerStatus: worker?.status,
      availableAfter: worker?.availableAfter,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Worker sync error:', err);
    return res.status(500).json({ message: "Failed to fetch updates" });
  }
});

// Real-time service catalog sync
router.get("/services/changes", async (req: Request, res: Response) => {
  try {
    const { lastSync } = req.query;

    const query: any = {};
    if (lastSync) {
      query.updatedAt = { $gt: new Date(lastSync as string) };
    }

    const services = await Service.find(query).sort({ updatedAt: -1 });

    return res.json({
      services,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Services sync error:', err);
    return res.status(500).json({ message: "Failed to fetch service changes" });
  }
});

export default router;

