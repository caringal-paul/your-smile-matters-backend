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

// CLIENT ROUTES
import clientServiceRoutes from "./routes/client.routes/sf.service.routes";

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
app.use("/api/admin/roles", adminRoleRoutes);
app.use("/api/admin/permissions", adminPermissionRoutes);
app.use("/api/admin/services", adminServiceRoutes);

// Client Routes
app.use("/api/client/services", clientServiceRoutes);

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
