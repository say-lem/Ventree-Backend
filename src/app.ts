import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { authRouter } from "./modules/auth";
import { shopRouter } from "./modules/shops/routes/shop.routes";
import { expensesRouter } from "./modules/expenses/routes/expenses.routes";
import { staffRoutes } from "./modules/staff-management";
//import { inventoryMgtRouter } from "./modules/inventory-mgt";
import { salesRoutes } from "./modules/sales-management";
import { notificationRoutes } from "./modules/notification";
import inventoryMgtRouter from "./modules/inventory-mgt/routes/Inventory.route";
import { userRouter } from "./modules/user";
import { errorHandler, notFoundHandler } from "./shared/middleware/errorHandler";
import dotenv from "dotenv";

dotenv.config();

const app: Application = express();

// Security and performance middlewares
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Request logging (use morgan in dev)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Global rate limiter for API abuse protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  message: "Too many requests, please try again later.",
});
app.use("/api", limiter);

// Root route to satisfy uptime checks
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Ventree API is running ",
  });
});

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Server running" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/v1/shop", shopRouter);
app.use("/api/v1/expenses", expensesRouter);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/inventory", inventoryMgtRouter);
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/user", userRouter);

// 404 handler 
app.use(notFoundHandler);

//global error handler
app.use(errorHandler);

export default app;
