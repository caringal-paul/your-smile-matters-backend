import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { fileURLToPath } from "url";
import { validateEnvironment } from "./utils/validateEnv";

// ADMIN ROUTES
import adminUserRoutes from "./routes/admin.routes/ami.user.routes";
import adminRoleRoutes from "./routes/admin.routes/ami.role.routes";
import adminAuthRoutes from "./routes/admin.routes/ami.auth.routes";
import adminPermissionRoutes from "./routes/admin.routes/ami.permission.routes";
import adminServiceRoutes from "./routes/admin.routes/ami.service.routes";
import adminPackageRoutes from "./routes/admin.routes/ami.package.routes";
import adminBookingRoutes from "./routes/admin.routes/ami.booking.routes";
import adminCustomerRoutes from "./routes/admin.routes/ami.customer.routes";
import adminPromoRoutes from "./routes/admin.routes/ami.promo.routes";
import adminPhotographersRoutes from "./routes/admin.routes/ami.photographer.routes";
import adminEmailRoutes from "./routes/admin.routes/ami.email.routes";
import adminTransactionRoutes from "./routes/admin.routes/ami.transaction.routes";
import adminAnalyticsRoutes from "./routes/admin.routes/ami.analytics.routes";
import adminRatingRoutes from "./routes/admin.routes/ami.rating.routes";
import adminBookingRequestRoutes from "./routes/admin.routes/ami.booking-request.routes";
import adminTransactionRequestRoutes from "./routes/admin.routes/ami.transaction-request.routes";

// SHARED ROUTES
import uploadImageRoutes from "./routes/shared.routes/upload-image.routes";
import supportRoutes from "./routes/shared.routes/send-support.routes";

// CLIENT ROUTES
import clientServiceRoutes from "./routes/client.routes/sf.service.routes";
import clientPackageRoutes from "./routes/client.routes/sf.package.routes";
import clientCustomerRoutes from "./routes/client.routes/sf.customer.routes";
import clientPromoRoutes from "./routes/client.routes/sf.promo.routes";
import clientPhotographersRoutes from "./routes/client.routes/sf.photographer.routes";
import clientBookingRoutes from "./routes/client.routes/sf.booking.routes";
import clientTransactionRoutes from "./routes/client.routes/sf.transaction.routes";
import clientAuthRoutes from "./routes/client.routes/sf.auth.routes";
import clientRatingRoutes from "./routes/client.routes/sf.rating.routes";
import clientBookingRequestRoutes from "./routes/client.routes/sf.booking-request.routes";
import clientTransactionRequestRoutes from "./routes/client.routes/sf.transaction-request.routes";

dotenv.config();
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Admin Routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin/photographers", adminPhotographersRoutes);
app.use("/api/admin/roles", adminRoleRoutes);
app.use("/api/admin/permissions", adminPermissionRoutes);
app.use("/api/admin/services", adminServiceRoutes);
app.use("/api/admin/packages", adminPackageRoutes);
app.use("/api/admin/bookings", adminBookingRoutes);
app.use("/api/admin/promos", adminPromoRoutes);
app.use("/api/admin/emails", adminEmailRoutes);
app.use("/api/admin/transactions", adminTransactionRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin/booking-requests", adminBookingRequestRoutes);
app.use("/api/admin/transaction-requests", adminTransactionRequestRoutes);
app.use("/api/admin/ratings", adminRatingRoutes);

// Shared Routes
app.use("/api/admin/upload", uploadImageRoutes);
app.use("/api/admin/send-support", supportRoutes);

// Client Routes
app.use("/api/client/photographers", clientPhotographersRoutes);
app.use("/api/client/services", clientServiceRoutes);
app.use("/api/client/packages", clientPackageRoutes);
app.use("/api/client/promos", clientPromoRoutes);
app.use("/api/client/bookings", clientBookingRoutes);
app.use("/api/client/transactions", clientTransactionRoutes);
app.use("/api/client/auth", clientAuthRoutes);
app.use("/api/client/booking-requests", clientBookingRequestRoutes);
app.use("/api/client/transaction-requests", clientTransactionRequestRoutes);
app.use("/api/client/ratings", clientRatingRoutes);
app.use("/api/client/customers", clientCustomerRoutes);

// Health check
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ message: "Server is running!" });
});

// Not-found middleware
app.use((req: Request, res: Response) => {
	res.status(404).json({ status: 404, message: "Route not found" });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
	try {
		await connectDatabase();
		app.listen(PORT, () => {
			console.log(`Server running on http://localhost:${PORT}`);
		});
	} catch (error) {
		console.error(
			"Failed to start server:",
			error instanceof Error ? error.message : error
		);
		process.exit(1);
	}
};

startServer();
