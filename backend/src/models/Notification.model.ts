import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Schema.Types.ObjectId; // Reference to the User who should receive the notification
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'worker' | 'system' | 'promotion' | 'worker_approved' | 'worker_denied' | 'general' | 'document_verification' | 'verification_submitted' | 'verification_complete';
  isRead: boolean;
  data?: any; // Additional data for the notification
  imageUrl?: string; // Optional image URL
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['booking', 'payment', 'worker', 'system', 'promotion', 'worker_approved', 'worker_denied', 'general', 'document_verification', 'verification_submitted', 'verification_complete'], 
    default: 'general' 
  },
  isRead: { type: Boolean, default: false },
  data: { type: Schema.Types.Mixed }, // Additional data for the notification
  imageUrl: { type: String }, // Optional image URL
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<INotification>("Notification", NotificationSchema);
