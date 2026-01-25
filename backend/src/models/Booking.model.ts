// BOOKING MODEL - MongoDB schema for service booking records
// Fields: userId, workerId, service details, location, status, payment info, ratings, timestamps
// Statuses: pending -> accepted -> in_progress -> completed/cancelled
import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  userId: string;
  workerId?: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  description: string;
  images?: string[];
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  scheduledDate?: Date;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: 'esewa' | 'khalti' | 'phonepe' | 'cash' | 'online';
  paymentId?: string;
  userConfirmedPayment?: boolean;
  workerConfirmedPayment?: boolean;
  paymentConfirmedAt?: Date;
  rewardPointsUsed?: number;
  discountAmount?: number;
  finalAmount?: number;
  rating?: number;
  review?: string;
  workerNotes?: string;
  userNotes?: string;
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

const BookingSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  workerId: { type: String, index: true },
  serviceId: { type: String, required: true },
  serviceName: { type: String, required: true },
  serviceCategory: { type: String, required: true },
  description: { type: String, required: true },
  images: [{ type: String }],
  location: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  scheduledDate: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  price: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['esewa', 'khalti', 'phonepe', 'cash', 'online']
  },
  paymentId: { type: String },
  userConfirmedPayment: { type: Boolean, default: false },
  workerConfirmedPayment: { type: Boolean, default: false },
  paymentConfirmedAt: { type: Date },
  rewardPointsUsed: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  finalAmount: { type: Number },
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  workerNotes: { type: String },
  userNotes: { type: String },
  estimatedDuration: { type: Number },
  actualDuration: { type: Number },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancellationReason: { type: String }
}, {
  timestamps: true
});

// Indexes for better performance
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ workerId: 1, status: 1 });
BookingSchema.index({ status: 1, createdAt: -1 });
BookingSchema.index({ 'location.coordinates': '2dsphere' });

export default mongoose.model<IBooking>('Booking', BookingSchema);