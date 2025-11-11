import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { logError, logInfo, logSuccess } from "./utils/seed.logger";

export const seedUsers = async () => {
	logInfo("🔹 Seeding users (including Super Admin)...");

	// 1. Fetch all existing roles
	const roles = await Role.find({ is_active: true });
	if (!roles || roles.length === 0) {
		throw new Error("❌ No roles found. Please seed roles first.");
	}

	// 2. Ensure Super Admin exists
	const superAdminEmail = "superadmin@yopmail.com";
	let superAdmin = await User.findOne({ email: superAdminEmail });

	if (!superAdmin) {
		const superAdminPassword = await bcrypt.hash("Password_123", 10);

		// Assign Super Admin role (pick "Admin" role if exists, fallback to first role)
		const adminRole = roles.find((r) => /Admin/i.test(r.name)) || roles[0];

		superAdmin = await User.create({
			username: "superadmin",
			email: superAdminEmail,
			first_name: "Super",
			last_name: "Admin",
			mobile_number: "09171234567",
			password: superAdminPassword,
			role_id: adminRole._id,
			is_active: true,
			created_by: new Types.ObjectId(),
			updated_by: new Types.ObjectId(),
		});

		logSuccess(`✅ Super Admin account created: ${superAdminEmail}`);
	} else {
		logInfo("ℹ️ Super Admin already exists, skipping creation.");
	}

	// 3. Hash password once for all users
	const hashedPassword = await bcrypt.hash("Password_123", 10);

	// 4. Generate 100 random users
	const usersToInsert = Array.from({ length: 100 }).map(() => {
		const firstName = faker.person.firstName();
		const lastName = faker.person.lastName();
		const username = faker.internet
			.username({ firstName, lastName })
			.toLowerCase();

		// Pick a random role from existing roles
		const randomRole = faker.helpers.arrayElement(roles);

		return {
			username,
			email: `${username}@yopmail.com`,
			first_name: firstName,
			last_name: lastName,
			mobile_number: faker.helpers.replaceSymbols("+63##########"),
			password: hashedPassword,
			role_id: randomRole._id, // 🔹 assigned from existing roles
			is_active: true,
			created_by: null,
			updated_by: null,
			deleted_by: null,
			retrieved_by: null,
			deleted_at: null,
			retrieved_at: null,
		};
	});

	// 5. Insert without deleting existing
	try {
		const result = await User.insertMany(usersToInsert, { ordered: false });
		logSuccess(`✅ Successfully inserted ${result.length} users.`);
	} catch (err: any) {
		if (err.writeErrors) {
			const inserted = 100 - err.writeErrors.length;
			logInfo(`⚠️ ${inserted} users inserted (duplicates skipped).`);
		} else {
			logError(`❌ Seeder failed: ${err.message}`);
		}
	}
};
