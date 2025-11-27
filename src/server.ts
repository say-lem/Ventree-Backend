import dotenv from "dotenv";

// Load environment variables FIRST before any other imports
dotenv.config();

import http from "http";
import mongoose from "mongoose";
import app from "./app";
import { redisConfig } from "./shared/config/redis.config";
import { closeNotificationEmitter } from "./modules/notification/emitters/notification-emitter.instance";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "";

if (!MONGO_URI) {
  console.error(" MONGO_URI is missing in .env");
  process.exit(1);
}

const server = http.createServer(app);

// Initialize Redis connections (non-blocking)
// If Redis is not available, the app will still work but notifications won't be emitted via Redis
async function initializeRedis() {
  try {
    const isConnected = await redisConfig.testConnection();
    if (isConnected) {
      // Initialize publisher and subscriber connections
      redisConfig.getPublisher();
      redisConfig.getSubscriber();
      console.log("✅ Redis initialized successfully");
    } else {
      console.warn("⚠️ Redis connection test failed. Notifications will only be stored in database.");
    }
  } catch (error) {
    console.warn("⚠️ Redis initialization failed. Notifications will only be stored in database:", error);
  }
}

// Start server
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected successfully");
    
    // Initialize Redis (non-blocking)
    await initializeRedis();
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const shutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      // Close MongoDB connection
      await mongoose.connection.close();
      console.log("🧹 MongoDB connection closed.");
      
      // Close Redis connections and notification emitter
      await closeNotificationEmitter();
      console.log("🧹 Redis connections closed.");
      
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
