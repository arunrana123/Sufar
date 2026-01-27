import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: string;
  name: string;
  label?: string;
  price: number;
  quantity: number;
  deliveryAddress?: string;
  images?: string[];
  category?: string;
}

export interface IDeliveryBoy {
  id: string;
  name: string;
  phone: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface IOrder extends Document {
  orderId: string;
  userId: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryCharge: number;
  codExtra?: number;
  rewardPointsUsed?: number;
  discount?: number;
  total: number;
  paymentMethod: 'online' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  walletProvider?: 'phonepay' | 'esewa' | 'stripe';
  transactionId?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'assigned' | 'picked' | 'on_way' | 'delivered' | 'cancelled';
  deliveryBoy?: IDeliveryBoy;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  label: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  deliveryAddress: { type: String },
  images: [{ type: String }],
  category: { type: String },
}, { _id: false });

const DeliveryBoySchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
}, { _id: false });

const OrderSchema: Schema = new Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  items: {
    type: [OrderItemSchema],
    required: true,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  deliveryCharge: {
    type: Number,
    required: true,
    default: 50,
    min: 0,
  },
  codExtra: {
    type: Number,
    default: 0,
    min: 0,
  },
  rewardPointsUsed: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cod'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  walletProvider: {
    type: String,
    enum: ['phonepay', 'esewa', 'stripe'],
  },
  transactionId: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'assigned', 'picked', 'on_way', 'delivered', 'cancelled'],
    default: 'pending',
  },
  deliveryAddress: {
    type: String,
  },
  deliveryBoy: {
    type: DeliveryBoySchema,
  },
  estimatedDelivery: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
  paidAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for better performance
OrderSchema.index({ userId: 1, status: 1 });
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'deliveryBoy.id': 1 });

const Order = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
