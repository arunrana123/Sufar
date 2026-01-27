import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  label?: string;
  price: number;
  originalPrice?: number;
  discount?: number; // Percentage discount (0-100)
  images: string[];
  videoUrl?: string;
  category: string;
  description?: string;
  deliveryLocation?: string;
  phoneNumber?: string;
  inStock: boolean;
  rating?: number;
  reviewCount?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  label: {
    type: String,
    trim: true,
    maxlength: 300,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  originalPrice: {
    type: Number,
    min: 0,
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  images: {
    type: [String],
    default: [],
  },
  videoUrl: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  deliveryLocation: {
    type: String,
    trim: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  inStock: {
    type: Boolean,
    default: true,
    index: true,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  reviewCount: {
    type: Number,
    min: 0,
    default: 0,
  },
  isPopular: {
    type: Boolean,
    default: false,
    index: true,
  },
  isRecommended: {
    type: Boolean,
    default: false,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
ProductSchema.index({ category: 1, isActive: 1, inStock: 1 });
ProductSchema.index({ isPopular: 1, isActive: 1 });
ProductSchema.index({ isRecommended: 1, isActive: 1 });
ProductSchema.index({ createdAt: -1 });

// Calculate discount percentage if originalPrice is provided
ProductSchema.pre('save', function(next) {
  if (this.originalPrice && this.originalPrice > this.price) {
    this.discount = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  next();
});

export default mongoose.model<IProduct>('Product', ProductSchema);
