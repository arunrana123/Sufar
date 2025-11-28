import mongoose, { Schema, Document } from "mongoose";

export interface IAdminActivity extends Document {
  adminId: mongoose.Schema.Types.ObjectId; // Reference to the admin user
  action: string; // e.g., 'approved_worker', 'denied_worker', 'logged_in', 'viewed_users'
  description: string; // Human readable description
  targetId?: mongoose.Schema.Types.ObjectId; // ID of the affected resource (worker, user, etc.)
  targetType?: string; // Type of the affected resource ('worker', 'user', etc.)
  metadata?: any; // Additional data about the action
  createdAt: Date;
}

const AdminActivitySchema: Schema = new Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetType: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IAdminActivity>("AdminActivity", AdminActivitySchema);
