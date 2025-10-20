import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { validateEnvironment } from "./utils/validateEnv";

// ADMIN ROUTES
import adminUserRoutes from "./routes/admin.routes/ami.user.routes";
import adminCustomerRoutes from "./routes/admin.routes/ami.customer.routes";
import adminRoleRoutes from "./routes/admin.routes/ami.role.routes";
import adminAuthRoutes from "./routes/admin.routes/ami.auth.routes";
import adminPermissionRoutes from "./routes/admin.routes/ami.permission.routes";
import adminServiceRoutes from "./routes/admin.routes/ami.service.routes";
import adminPackageRoutes from "./routes/admin.routes/ami.package.routes";
import adminBookingRoutes from "./routes/admin.routes/ami.booking.routes";
import adminPromoRoutes from "./routes/admin.routes/ami.promo.routes";
import adminPhotographersRoutes from "./routes/admin.routes/ami.photographer.routes";
import adminEmailRoutes from "./routes/admin.routes/ami.email.routes";
import adminTransactionRoutes from "./routes/admin.routes/ami.transaction.routes";

// CLIENT ROUTES
import clientServiceRoutes from "./routes/client.routes/sf.service.routes";
import clientPackageRoutes from "./routes/client.routes/sf.package.routes";
import clientPromoRoutes from "./routes/client.routes/sf.promo.routes";
import clientPhotographersRoutes from "./routes/client.routes/sf.photographer.routes";
import clientBookingRoutes from "./routes/client.routes/sf.booking.routes";
import clientTransactionRoutes from "./routes/client.routes/sf.transaction.routes";
import clientAuthRoutes from "./routes/client.routes/sf.auth.routes";

dotenv.config();
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Client Routes
app.use("/api/client/photographers", clientPhotographersRoutes);
app.use("/api/client/services", clientServiceRoutes);
app.use("/api/client/packages", clientPackageRoutes);
app.use("/api/client/promos", clientPromoRoutes);
app.use("/api/client/bookings", clientBookingRoutes);
app.use("/api/client/transactions", clientTransactionRoutes);
app.use("/api/client/auth", clientAuthRoutes);

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
