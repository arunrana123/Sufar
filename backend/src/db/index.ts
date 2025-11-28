import mongoose from "mongoose";

let isConnected = false;
let connectionError: Error | null = null;

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/ts-crud";
    await mongoose.connect(mongoUri);
    isConnected = true;
    connectionError = null;
    console.log("✅ MongoDB Connected");  
    
    // Monitor connection status
    mongoose.connection.on('error', (err) => {
      console.error("❌ MongoDB connection error:", err);
      isConnected = false;
      connectionError = err;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn("⚠️ MongoDB disconnected");
      isConnected = false;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log("✅ MongoDB reconnected");
      isConnected = true;
      connectionError = null;
    });
  } catch (err) {
    isConnected = false;
    connectionError = err as Error;
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

export const getConnectionStatus = () => {
  return {
    isConnected: isConnected && mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    error: connectionError,
    database: mongoose.connection.db?.databaseName || null,
  };
};

export default connectDB;
