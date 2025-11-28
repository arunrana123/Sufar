import mongoose, { Schema, Document } from "mongoose";

export interface IService extends Document {
  title: string;
  description: string;
  price: number;
  priceType: 'hour' | 'per_foot' | 'fixed' | 'customize';
  category: string;
  subCategory?: string; // Specific service within category (e.g., "Waste Pipe Leakage Repair")
  rating: number;
  reviewCount: number;
  isActive: boolean;
  imageUrl?: string;
  isMainCategory?: boolean; // True if this is a main category, false if it's a sub-service
  parentCategory?: string; // Reference to parent category if it's a sub-service
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema: Schema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  priceType: { 
    type: String, 
    enum: ['hour', 'per_foot', 'fixed', 'customize'], 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    trim: true,
    enum: ['Plumber', 'Electrician', 'Carpenter', 'Cleaner', 'Mechanic', 'AC Repair', 'Painter', 'Mason', 'Cook', 'Driver', 'Security', 'Beautician', 'Technician', 'Delivery', 'Gardener']
  },
  subCategory: { 
    type: String, 
    trim: true,
    maxlength: 100
  },
  isMainCategory: { 
    type: Boolean, 
    default: false 
  },
  parentCategory: { 
    type: String, 
    trim: true
  },
  rating: { 
    type: Number, 
    default: 5,
    min: 0,
    max: 5
  },
  reviewCount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  imageUrl: { 
    type: String,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field before saving
ServiceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IService>("Service", ServiceSchema);
