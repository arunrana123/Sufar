import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import Order, { IOrder } from '../models/Order.model';
import User from '../models/User.model';

const router = Router();

// Helper to get Socket.IO instance
const getIO = (req: Request): SocketIOServer | null => {
  return req.app.get('io') || null;
};

// Generate unique order ID
const generateOrderId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// Create a new order
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      items,
      subtotal,
      deliveryCharge,
      codExtra,
      rewardPointsUsed,
      discount,
      total,
      paymentMethod,
      walletProvider,
      orderId: providedOrderId,
      status,
      paymentStatus,
      deliveryAddress,
    } = req.body;

    console.log('📦 Creating order:', {
      userId,
      itemsCount: items?.length || 0,
      total,
      paymentMethod,
    });

    // Validate required fields
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Missing required fields: userId and items are required',
        received: {
          userId: !!userId,
          items: items?.length || 0,
        },
      });
    }

    if (!subtotal || !total) {
      return res.status(400).json({
        message: 'Missing required fields: subtotal and total are required',
      });
    }

    // Validate items
    for (const item of items) {
      if (!item.productId || !item.name || !item.price || !item.quantity) {
        return res.status(400).json({
          message: 'Invalid item data. Each item must have productId, name, price, and quantity',
        });
      }
    }

    // Generate order ID if not provided
    let orderId = providedOrderId || generateOrderId();
    
    // Ensure orderId is unique
    let existingOrder = await Order.findOne({ orderId });
    let attempts = 0;
    while (existingOrder && attempts < 10) {
      orderId = generateOrderId();
      existingOrder = await Order.findOne({ orderId });
      attempts++;
    }

    // Extract delivery address from items if not provided
    let finalDeliveryAddress = deliveryAddress;
    if (!finalDeliveryAddress && items && items.length > 0) {
      // Get delivery address from first item that has it
      const itemWithAddress = items.find((item: any) => item.deliveryAddress);
      if (itemWithAddress) {
        finalDeliveryAddress = itemWithAddress.deliveryAddress;
      }
    }

    // Create order
    const order = new Order({
      orderId,
      userId,
      items,
      subtotal: parseFloat(subtotal) || 0,
      deliveryCharge: parseFloat(deliveryCharge) || 50,
      codExtra: parseFloat(codExtra) || 0,
      rewardPointsUsed: parseFloat(rewardPointsUsed) || 0,
      discount: parseFloat(discount) || 0,
      total: parseFloat(total) || 0,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentStatus || 'pending',
      walletProvider: walletProvider || undefined,
      status: status || 'pending',
      deliveryAddress: finalDeliveryAddress,
    });

    await order.save();
    console.log('✅ Order created successfully:', order.orderId);

    // Emit Socket.IO event
    const io = getIO(req);
    if (io) {
      io.emit('order:new', {
        orderId: order.orderId,
        userId: order.userId,
        status: order.status,
        total: order.total,
      });
      
      // Notify admin
      io.emit('admin:new_order', {
        orderId: order.orderId,
        userId: order.userId,
        total: order.total,
        itemsCount: items.length,
      });
    }

    res.status(201).json({
      success: true,
      order: order.toObject(),
      orderId: order.orderId,
      _id: order._id,
    });
  } catch (error: any) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      message: 'Failed to create order',
      error: error.message || 'Unknown error',
    });
  }
});

// Get order by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findOne({
      $or: [
        { _id: id },
        { orderId: id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ success: true, order: order.toObject() });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      message: 'Failed to fetch order',
      error: error.message,
    });
  }
});

// Update order payment status
router.patch('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      paymentStatus,
      transactionId,
      paymentMethod,
      walletProvider,
      paidAt,
      status,
    } = req.body;

    const order = await Order.findOne({
      $or: [
        { _id: id },
        { orderId: id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update payment details
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (transactionId) order.transactionId = transactionId;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (walletProvider) order.walletProvider = walletProvider;
    if (paidAt) order.paidAt = new Date(paidAt);
    if (status) order.status = status;

    // If payment is successful, move to confirmed status
    if (paymentStatus === 'paid' && order.status === 'pending') {
      order.status = 'confirmed';
    }

    await order.save();

    // Deduct reward points if used
    if (order.rewardPointsUsed && order.rewardPointsUsed > 0) {
      const user = await User.findById(order.userId);
      if (user) {
        const currentPoints = user.rewardPoints || 0;
        if (currentPoints >= order.rewardPointsUsed) {
          user.rewardPoints = currentPoints - order.rewardPointsUsed;
          await user.save();

          // Emit reward points update
          const io = getIO(req);
          if (io) {
            io.emit('reward:points_updated', {
              userId: user._id,
              totalPoints: user.rewardPoints,
              pointsUsed: order.rewardPointsUsed,
            });
          }
        }
      }
    }

    // Emit Socket.IO event
    const io = getIO(req);
    if (io) {
      io.emit('order:payment_completed', {
        orderId: order.orderId,
        userId: order.userId,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId,
      });

      if (order.status === 'confirmed') {
        io.emit('order:confirmed', {
          orderId: order.orderId,
          userId: order.userId,
        });
      }
    }

    res.json({
      success: true,
      order: order.toObject(),
    });
  } catch (error: any) {
    console.error('Error updating order payment:', error);
    res.status(500).json({
      message: 'Failed to update order payment',
      error: error.message,
    });
  }
});

// Get orders assigned to delivery boy
router.get('/delivery/:deliveryBoyId', async (req: Request, res: Response) => {
  try {
    const { deliveryBoyId } = req.params;
    const { status } = req.query;

    console.log('📦 Fetching orders for delivery boy:', deliveryBoyId);

    const query: any = { 'deliveryBoy.id': deliveryBoyId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`✅ Found ${orders.length} orders for delivery boy ${deliveryBoyId}`);

    // Fetch user info for each order
    const transformedOrders = await Promise.all(
      orders.map(async (order: any) => {
        let userInfo = null;
        if (order.userId) {
          try {
            const user = await User.findById(order.userId).select('firstName lastName email phone').lean();
            if (user) {
              userInfo = {
                firstName: user.firstName || 'Customer',
                lastName: user.lastName || '',
                email: user.email,
                phone: user.phone,
              };
            }
          } catch (error) {
            console.error('Error fetching user info:', error);
          }
        }

        return {
          ...order,
          userInfo,
        };
      })
    );

    res.json({
      success: true,
      orders: transformedOrders,
    });
  } catch (error: any) {
    console.error('Error fetching delivery orders:', error);
    res.status(500).json({
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
});

// Get user's orders
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const query: any = { userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      orders: orders.map(order => order.toObject()),
    });
  } catch (error: any) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
});

// Assign delivery boy to order
router.patch('/:id/assign-delivery', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deliveryBoy } = req.body;

    if (!deliveryBoy || !deliveryBoy.id || !deliveryBoy.name || !deliveryBoy.phone) {
      return res.status(400).json({
        message: 'Delivery boy information is required (id, name, phone)',
      });
    }

    const order = await Order.findOne({
      $or: [
        { _id: id },
        { orderId: id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.deliveryBoy = {
      id: deliveryBoy.id,
      name: deliveryBoy.name,
      phone: deliveryBoy.phone,
      location: deliveryBoy.location,
    };
    order.status = 'assigned';

    // Set estimated delivery (e.g., 30 minutes from now)
    order.estimatedDelivery = new Date(Date.now() + 30 * 60 * 1000);

    await order.save();

    // Emit Socket.IO event
    const io = getIO(req);
    if (io) {
      io.emit('order:delivery_assigned', {
        orderId: order.orderId,
        userId: order.userId,
        deliveryBoy: order.deliveryBoy,
      });

      // Notify delivery boy
      io.to(`worker:${deliveryBoy.id}`).emit('delivery:new_assignment', {
        orderId: order.orderId,
        order: order.toObject(),
      });
    }

    res.json({
      success: true,
      order: order.toObject(),
    });
  } catch (error: any) {
    console.error('Error assigning delivery boy:', error);
    res.status(500).json({
      message: 'Failed to assign delivery boy',
      error: error.message,
    });
  }
});

// Update delivery boy location
router.patch('/:id/delivery-location', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        message: 'Latitude and longitude are required',
      });
    }

    const order = await Order.findOne({
      $or: [
        { _id: id },
        { orderId: id },
      ],
    });

    if (!order || !order.deliveryBoy) {
      return res.status(404).json({ message: 'Order or delivery boy not found' });
    }

    order.deliveryBoy.location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    };

    await order.save();

    // Emit Socket.IO event for real-time tracking
    const io = getIO(req);
    if (io) {
      io.emit('delivery:location_updated', {
        orderId: order.orderId,
        deliveryBoyId: order.deliveryBoy.id,
        latitude: order.deliveryBoy.location.latitude,
        longitude: order.deliveryBoy.location.longitude,
      });
    }

    res.json({
      success: true,
      location: order.deliveryBoy.location,
    });
  } catch (error: any) {
    console.error('Error updating delivery location:', error);
    res.status(500).json({
      message: 'Failed to update delivery location',
      error: error.message,
    });
  }
});

// Update order status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const order = await Order.findOne({
      $or: [
        { _id: id },
        { orderId: id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;

    if (status === 'delivered') {
      order.deliveredAt = new Date();
      
      // Award reward points to user for completed order (e.g., 1 point per Rs. 10 spent)
      const user = await User.findById(order.userId);
      if (user) {
        const pointsEarned = Math.floor(order.total / 10); // 1 point per Rs. 10
        user.rewardPoints = (user.rewardPoints || 0) + pointsEarned;
        await user.save();

        // Emit reward points update
        const io = getIO(req);
        if (io) {
          io.emit('reward:points_updated', {
            userId: user._id,
            totalPoints: user.rewardPoints,
            pointsEarned: pointsEarned,
            reason: 'order_delivered',
          });
        }
      }
      
      // Update delivery worker stats if order has delivery boy
      if (order.deliveryBoy?.id) {
        const WorkerUser = (await import('../models/WorkerUser.model')).default;
        const deliveryWorker = await WorkerUser.findById(order.deliveryBoy.id);
        
        if (deliveryWorker) {
          // Count completed delivery orders
          const completedDeliveries = await Order.countDocuments({
            'deliveryBoy.id': order.deliveryBoy.id,
            status: 'delivered',
          });
          
          // Calculate total delivery earnings
          const paidDeliveries = await Order.find({
            'deliveryBoy.id': order.deliveryBoy.id,
            status: 'delivered',
            paymentStatus: 'paid',
          });
          
          // Delivery workers earn commission (e.g., 10% of order total or fixed delivery charge)
          const deliveryEarnings = paidDeliveries.reduce((sum, o) => {
            // Use deliveryCharge if available, otherwise 10% of total
            const earnings = o.deliveryCharge || (o.total * 0.1);
            return sum + earnings;
          }, 0);
          
          // Award reward points to delivery worker: 15 points per delivery + 1 point per Rs. 50 earned
          const deliveryRewardPoints = paidDeliveries.reduce((points, o) => {
            let jobPoints = 15; // Base points per delivery (higher than service jobs)
            const deliveryEarning = o.deliveryCharge || (o.total * 0.1);
            jobPoints += Math.floor(deliveryEarning / 50); // 1 point per Rs. 50
            return points + jobPoints;
          }, 0);
          
          // Calculate badge for delivery worker
          let badge: 'Iron' | 'Silver' | 'Gold' | 'Platinum' = 'Iron';
          const totalCompletedJobs = (deliveryWorker.completedJobs || 0) + completedDeliveries - (deliveryWorker.deliveryJobsCompleted || 0);
          if (totalCompletedJobs >= 2000) {
            badge = 'Platinum';
          } else if (totalCompletedJobs >= 1200) {
            badge = 'Gold';
          } else if (totalCompletedJobs >= 500) {
            badge = 'Silver';
          }
          
          // Get delivery worker's service earnings if any
          const Booking = (await import('../models/Booking.model')).default;
          const serviceBookings = await Booking.find({
            workerId: order.deliveryBoy.id,
            status: 'completed',
            paymentStatus: 'paid',
          });
          const serviceEarnings = serviceBookings.reduce((sum, b) => sum + (b.price || 0), 0);
          
          // Calculate total earnings (delivery + service)
          const totalEarnings = deliveryEarnings + serviceEarnings;
          
          // Calculate rating from service bookings (delivery workers can also do service jobs)
          const ratedServiceBookings = await Booking.find({
            workerId: order.deliveryBoy.id,
            status: 'completed',
            rating: { $exists: true, $gt: 0 },
          });
          const serviceRating = ratedServiceBookings.length > 0
            ? ratedServiceBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedServiceBookings.length
            : deliveryWorker.rating || 0;
          
          // Calculate rankScore
          const totalReviews = ratedServiceBookings.length;
          const rankScore = (serviceRating * 20) + (totalReviews * 2) + (totalCompletedJobs * 0.5);
          
          // Update delivery worker stats
          await WorkerUser.findByIdAndUpdate(order.deliveryBoy.id, {
            deliveryJobsCompleted: completedDeliveries,
            serviceJobsCompleted: serviceBookings.length,
            completedJobs: totalCompletedJobs,
            totalEarnings: totalEarnings,
            rewardPoints: (deliveryWorker.rewardPoints || 0) + deliveryRewardPoints,
            rating: Math.round(serviceRating * 10) / 10,
            totalReviews: totalReviews,
            badge: badge,
            rankScore: Math.round(rankScore * 10) / 10,
          });
          
          // Emit reward points update for delivery worker
          const io = getIO(req);
          if (io) {
            io.to(`worker:${order.deliveryBoy.id}`).emit('worker:reward_points_updated', {
              workerId: order.deliveryBoy.id,
              totalPoints: (deliveryWorker.rewardPoints || 0) + deliveryRewardPoints,
              pointsEarned: deliveryRewardPoints,
              reason: 'delivery_completed',
            });
            
            io.to(`worker:${order.deliveryBoy.id}`).emit('worker:stats_updated', {
              workerId: order.deliveryBoy.id,
              badge: badge,
              rankScore: Math.round(rankScore * 10) / 10,
              totalEarnings: totalEarnings,
              completedJobs: totalCompletedJobs,
            });
          }
        }
      }
    } else if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = req.body.cancellationReason;
    }

    await order.save();

    // Emit Socket.IO event
    const io = getIO(req);
    if (io) {
      io.emit('order:status_updated', {
        orderId: order.orderId,
        userId: order.userId,
        status: order.status,
      });
    }

    res.json({
      success: true,
      order: order.toObject(),
    });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      message: 'Failed to update order status',
      error: error.message,
    });
  }
});

// Submit review for order
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, reviews } = req.body;

    if (!reviews || !Array.isArray(reviews)) {
      return res.status(400).json({ message: 'Reviews array is required' });
    }

    const order = await Order.findOne({
      $or: [
        { _id: id },
        { orderId: id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Update product ratings (you would typically have a Product model)
    // For now, we'll emit events to update ratings
    const io = getIO(req);
    if (io) {
      // Emit review events for each product
      reviews.forEach((review: any) => {
        io.emit('product:reviewed', {
          productId: review.productId,
          rating: review.rating,
          comment: review.comment,
          userId: userId,
          orderId: order.orderId,
        });
      });

      // Award reward points (e.g., 100 points per review)
      const pointsEarned = reviews.length * 100;
      const user = await User.findById(userId);
      if (user) {
        user.rewardPoints = (user.rewardPoints || 0) + pointsEarned;
        await user.save();

        io.emit('reward:points_updated', {
          userId: user._id,
          totalPoints: user.rewardPoints,
          pointsEarned: pointsEarned,
          reason: 'order_review',
        });
      }

      io.emit('order:reviewed', {
        orderId: order.orderId,
        userId: order.userId,
        reviews,
        averageRating,
      });
    }

    res.json({
      success: true,
      message: 'Review submitted successfully',
      pointsEarned: reviews.length * 100,
      averageRating,
    });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    res.status(500).json({
      message: 'Failed to submit review',
      error: error.message,
    });
  }
});

export default router;
