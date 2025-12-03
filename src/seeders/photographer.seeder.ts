import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { Photographer } from "../models/Photographer";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { ServiceCategoryEnum } from "../constants/service-category.constant";
import { logError, logInfo, logSuccess } from "./utils/seed.logger";
import { hashPassword } from "../utils/tokenHandler";

export const seedPhotographers = async (count = 100) => {
	logInfo(`🔹 Seeding ${count} photographers...`);

	try {
		// 1️⃣ Find admin user
		const adminUser = await User.findOne({ role_id: { $exists: true } });
		const adminId = adminUser?._id || new Types.ObjectId();

		if (!adminUser) {
			logInfo(
				"⚠️ No admin user found. Photographers will have null created_by."
			);
		}

		// 2️⃣ Find Photographer role
		const photographerRole = await Role.findOne({ name: "Photographer" });
		if (!photographerRole) {
			throw new Error(
				'Seeder failed: "Photographer" role not found in database'
			);
		}
		const roleId = photographerRole._id;

		// 3️⃣ Hash password
		const hashedPassword = await hashPassword("Password_123");

		// 4️⃣ Build photographers
		const photographersToInsert = [];
		for (let i = 0; i < count; i++) {
			const firstName = faker.person.firstName();
			const lastName = faker.person.lastName();

			const specialties = faker.helpers.arrayElements(
				Object.values(ServiceCategoryEnum),
				faker.number.int({ min: 1, max: 3 })
			);

			const photo_gallery = faker.helpers.arrayElements(
				Array.from({ length: 9 }).map(
					(_, idx) =>
						`https://source.unsplash.com/800x600/?portrait&sig=${i}-${idx}`
				),
				faker.number.int({ min: 1, max: 5 })
			);

			photographersToInsert.push({
				name: `${firstName} ${lastName}`,
				email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@yopmail.com`,
				mobile_number: faker.helpers.replaceSymbols("63#########"),
				bio: faker.lorem.paragraph(),
				profile_image: `https://source.unsplash.com/400x400/?portrait&sig=${i}`,
				specialties,
				weekly_schedule: [
					{
						day_of_week: "Monday",
						start_time: "00:00",
						end_time: "24:00",
						is_available: true,
					},
					{
						day_of_week: "Tuesday",
						start_time: "00:00",
						end_time: "24:00",
						is_available: true,
					},
					{
						day_of_week: "Wednesday",
						start_time: "00:00",
						end_time: "24:00",
						is_available: true,
					},
					{
						day_of_week: "Thursday",
						start_time: "00:00",
						end_time: "24:00",
						is_available: true,
					},
					{
						day_of_week: "Friday",
						start_time: "00:00",
						end_time: "24:00",
						is_available: true,
					},
					{
						day_of_week: "Saturday",
						start_time: "10:00",
						end_time: "15:00",
						is_available: true,
					},
					{
						day_of_week: "Sunday",
						start_time: "00:00",
						end_time: "12:00",
						is_available: false,
					},
				],
				password: hashedPassword,
				photo_gallery,
				booking_lead_time_hours: faker.number.int({ min: 0, max: 48 }),
				created_by: adminId,
				role_id: roleId, // ✅ explicitly set Photographer role
				is_active: true,
			});
		}

		// 5️⃣ Insert all photographers
		const result = await Photographer.insertMany(photographersToInsert, {
			ordered: false,
		});
		logSuccess(`✅ Successfully inserted ${result.length} photographers.`);
	} catch (err: any) {
		if (err.writeErrors) {
			const inserted = count - err.writeErrors.length;
			logInfo(`⚠️ ${inserted} photographers inserted (duplicates skipped).`);
			console.log("Sample errors:", err.writeErrors.slice(0, 3));
		} else {
			logError(`❌ Seeder failed: ${err.message}`);
			console.error("Full error:", err);
		}
	}
};
