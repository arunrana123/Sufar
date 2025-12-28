// USER MODEL - MongoDB schema for customer/user accounts
// Fields: username, name, email, password, profilePhoto, role (user/admin), Google OAuth support
// Features: Password reset tokens, OTP verification for forgot password
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  profilePhoto?: string;
  phone?: string;
  address?: string;
  role?: 'user' | 'admin';
  googleId?: string;
  createdAt: Date;
  resetToken?: string;
  resetTokenExpires?: Date;
  otpCode?: string;
  otpExpires?: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  profilePhoto: { type: String },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  googleId: { type: String, unique: true, sparse: true }, // Google Sign-In ID
  createdAt: { type: Date, default: Date.now },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  otpCode: { type: String },
  otpExpires: { type: Date },
});

export const User = mongoose.model<IUser>("User", UserSchema);
export default User;


