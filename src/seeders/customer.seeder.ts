import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { Customer } from "../models/Customer";
import { User } from "../models/User"; // For created_by reference
import { logError, logInfo, logSuccess } from "./utils/seed.logger";

export const seedCustomers = async (count = 100) => {
	logInfo(`🔹 Seeding ${count} customers...`);

	try {
		// 1️⃣ Hash password once
		const hashedPassword = await bcrypt.hash("Password_123", 10);

		// 2️⃣ Fetch an admin user as creator
		const adminUser = await User.findOne({ role_id: { $exists: true } });
		if (!adminUser) {
			logInfo("⚠️ No admin user found. Customers will have null created_by.");
		}

		// 3️⃣ Get the last customer created today to start sequence
		const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		const lastCustomer = await Customer.findOne({
			customer_no: new RegExp(`^CUST-${todayStr}-`),
		})
			.sort({ customer_no: -1 })
			.lean();

		let sequence = lastCustomer
			? parseInt(lastCustomer.customer_no.slice(-4), 10) + 1
			: 1;

		const customersToInsert = [];

		// 4️⃣ Generate customers sequentially to ensure unique customer_no
		for (let i = 0; i < count; i++) {
			const firstName = faker.person.firstName();
			const lastName = faker.person.lastName();
			const gender = faker.helpers.arrayElement(["Male", "Female", "Other"]);

			const customer_no = `CUST-${todayStr}-${String(sequence).padStart(
				4,
				"0"
			)}`;
			sequence++;

			customersToInsert.push({
				customer_no,
				first_name: firstName,
				last_name: lastName,
				email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.number.int(
					{ min: 1, max: 999 }
				)}@yopmail.com`,
				mobile_number: faker.helpers.replaceSymbols("09#########"), // 11-digit PH number
				gender,
				address: faker.location.streetAddress(),
				barangay: faker.location.city(),
				city: faker.location.city(),
				province: faker.location.state(),
				postal_code: faker.location.zipCode(),
				country: "Philippines",
				password: hashedPassword,
				created_by: adminUser?._id || null,
			});
		}

		// 5️⃣ Insert into database without removing existing
		const result = await Customer.insertMany(customersToInsert, {
			ordered: false,
		});
		logSuccess(`✅ Successfully inserted ${result.length} customers.`);
	} catch (err: any) {
		if (err.writeErrors) {
			const inserted = count - err.writeErrors.length;
			logInfo(`⚠️ ${inserted} customers inserted (duplicates skipped).`);
		} else {
			logError(`❌ Seeder failed: ${err.message}`);
		}
	}
};
