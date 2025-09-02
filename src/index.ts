import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";

import userRoutes from "./routes/user.routes";
import customerRoutes from "./routes/customer.routes";
import roleRoutes from "./routes/role.routes";
import authRoutes from "./routes/auth.routes";
import permissionRoutes from "./routes/permission.routes";
import { validateEnvironment } from "./utils/validateEnv";

dotenv.config();
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);

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
