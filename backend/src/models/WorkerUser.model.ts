// WORKER USER MODEL - MongoDB schema for service provider accounts
// Fields: name, email, phone, skills, serviceCategories, location, status, documents, verification
// Features: Document upload (photo, certificate, citizenship, license), verification workflow, ratings
import mongoose, { Schema, Document } from "mongoose";

export interface IWorkerUser extends Document {
  name: string;
  email: string;
  phone: string;
  password: string;
  skills: string[];
  serviceCategories: string[];
  isActive: boolean;
  status: 'available' | 'busy';
  currentLocation?: {
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  rating: number;
  totalJobs: number;
  completedJobs: number;
  availableAfter?: Date;
  profileImage?: string;
  googleId?: string;
  documents?: {
    profilePhoto?: string;
    certificate?: string;
    citizenship?: string;
    license?: string;
  };
  verificationStatus?: {
    profilePhoto?: 'pending' | 'verified' | 'rejected';
    certificate?: 'pending' | 'verified' | 'rejected';
    citizenship?: 'pending' | 'verified' | 'rejected';
    license?: 'pending' | 'verified' | 'rejected';
    overall?: 'pending' | 'verified' | 'rejected';
  } | 'pending' | 'verified' | 'rejected';
  verificationNotes?: string;
  verificationSubmitted?: boolean;
  submittedAt?: Date;
  experience?: string;
  otpCode?: string;
  otpExpires?: Date;
  categoryDocuments?: {
    [category: string]: {
      skillProof?: string;
      experience?: string;
    };
  };
  categoryVerificationStatus?: {
    [category: string]: 'pending' | 'verified' | 'rejected';
  };
  createdAt: Date;
  updatedAt: Date;
}

const WorkerUserSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true }, // Not required for Google sign-in
  password: { type: String, required: true },
  skills: [{ type: String, trim: true }],
  serviceCategories: [{ type: String, trim: true }], // Add service categories field
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['available', 'busy'], default: 'available' },
  currentLocation: {
    city: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
  rating: { type: Number, default: 0 },
  totalJobs: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  availableAfter: { type: Date },
  profileImage: { type: String },
  googleId: { type: String, unique: true, sparse: true }, // Google Sign-In ID
  documents: {
    profilePhoto: { type: String },
    certificate: { type: String },
    citizenship: { type: String },
    license: { type: String },
  },
  verificationStatus: { 
    type: Schema.Types.Mixed,
    default: {
      profilePhoto: 'pending',
      certificate: 'pending',
      citizenship: 'pending',
      license: 'pending',
      overall: 'pending'
    }
  },
  verificationNotes: { type: String },
  verificationSubmitted: { type: Boolean, default: false },
  submittedAt: { type: Date },
  experience: { type: String },
  otpCode: { type: String },
  otpExpires: { type: Date },
  categoryDocuments: {
    type: Schema.Types.Mixed,
    default: {},
  },
  categoryVerificationStatus: {
    type: Schema.Types.Mixed,
    default: {},
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
WorkerUserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IWorkerUser>("WorkerUser", WorkerUserSchema);
