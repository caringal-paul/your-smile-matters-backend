import mongoose from "mongoose";

export const connectDatabase = async (): Promise<void> => {
	try {
		const mongoUri =
			process.env.MONGODB_URI || "mongodb://localhost:27017/capstone-dev";
		const environment = process.env.NODE_ENV || "development";

		// Environment-specific options
		const options: mongoose.ConnectOptions = {
			...(environment === "development" && {
				serverSelectionTimeoutMS: 5000,
			}),
			...(environment !== "development" && {
				retryWrites: true,
				w: "majority" as mongoose.mongo.WriteConcern["w"], // ✅ match type
			}),
		};

		await mongoose.connect(mongoUri, options);

		// Enable query logging only in development
		if (environment === "development") {
			mongoose.set("debug", true);
		}

		// Get database info
		const dbName = mongoose.connection.name;
		const host = mongoose.connection.host;
		const port = mongoose.connection.port;
		const isLocal =
			mongoUri.includes("localhost") || mongoUri.includes("127.0.0.1");

		console.log(`✅ Connected to MongoDB`);
		console.log(`🌍 Environment: ${environment}`);
		console.log(`📍 Database: ${dbName}`);
		console.log(`🔗 Connection: ${isLocal ? "Local" : "Atlas Cloud"}`);
		console.log(`🏠 Host: ${isLocal ? `${host}:${port}` : "Atlas Cluster"}`);

		if (!isLocal) {
			console.log(`☁️  Atlas Cluster: Connected to cloud database`);
		}
	} catch (error) {
		console.error("❌ MongoDB connection error:", error);
		throw error;
	}
};

// Connection event handlers
mongoose.connection.on("connected", () => {
	const isLocal = process.env.MONGODB_URI?.includes("localhost");
	console.log(
		`📡 MongoDB connection established ${isLocal ? "(Local)" : "(Atlas)"}`
	);
});

mongoose.connection.on("disconnected", () => {
	console.log("📡 MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
	console.error("❌ MongoDB error:", error);
});

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("\n🛑 Shutting down gracefully...");
	await mongoose.connection.close();
	console.log("📡 MongoDB connection closed");
	process.exit(0);
});
