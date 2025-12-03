import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { logError, logInfo, logSuccess } from "./utils/seed.logger";
import { seedUsers } from "./user.seeder";
import { seedCustomers } from "./customer.seeder";
import { seedPhotographers } from "./photographer.seeder";
import { seedServices } from "./service.seeder";
import { seedPackages } from "./package.seeder";
import { seedBookingsAndTransactions } from "./booking-transaction.seeder";
import { seedBookingModifications } from "./booking-modification.seeder";

const MONGO_URI =
	process.env.MONGODB_URI || "mongodb://localhost:27017/capstone-dev";

const run = async () => {
	const arg = process.argv[2]; // e.g. "users", "photographers", etc.

	if (!arg) {
		logError(
			"❌ Please specify which seeder to run (e.g., npm run seed users)"
		);
		process.exit(1);
	}

	try {
		logInfo(`🚀 Connecting to MongoDB...`);
		await mongoose.connect(MONGO_URI);
		logSuccess("✅ MongoDB connected successfully.");

		switch (arg.toLowerCase()) {
			case "users":
				await seedUsers();
				break;
			case "customers":
				await seedCustomers();
				break;
			case "photographers":
				await seedPhotographers();
				break;
			case "services":
				await seedServices();
				break;
			case "packages":
				await seedPackages();
				break;
			case "bookings-transactions":
				await seedBookingsAndTransactions();
				break;
			case "booking-modifications":
				await seedBookingModifications();
				break;
			default:
				logError(`❌ Unknown seeder: ${arg}`);
				break;
		}

		logSuccess("🌱 Seeding complete!");
	} catch (err: any) {
		logError(`❌ Seeder failed: ${err.message}`);
	} finally {
		await mongoose.disconnect();
		logInfo("🔌 Disconnected from MongoDB.");
		process.exit(0);
	}
};

run();
