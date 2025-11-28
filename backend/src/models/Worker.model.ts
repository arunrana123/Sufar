import mongoose, { Schema, Document } from "mongoose";

export interface IWorker extends Document {
  userId: mongoose.Schema.Types.ObjectId; // Reference to the User who registered as a worker
  name: string;
  dateOfBirth: Date;
  typeOfWork: string; // e.g., Plumber, Electrician
  idCardImage: string; // URI or URL to the uploaded ID card image
  phoneNumber: string;
  skillProofDocument: string; // URI or URL to the uploaded skill proof document
  status: 'pending' | 'approved' | 'denied'; // For admin verification
  createdAt: Date;
}

const WorkerSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  typeOfWork: { type: String, required: true, trim: true },
  idCardImage: { type: String, required: true },
  phoneNumber: { type: String, required: true, trim: true },
  skillProofDocument: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IWorker>("Worker", WorkerSchema);
