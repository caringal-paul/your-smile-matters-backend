import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { Photographer } from "../models/Photographer";
import { User } from "../models/User"; // For created_by reference
import { ServiceCategoryEnum } from "../constants/service-category.constant";
import { logError, logInfo, logSuccess } from "./utils/seed.logger";

export const seedPhotographers = async (count = 100) => {
	logInfo(`🔹 Seeding ${count} photographers...`);

	try {
		const adminUser = await User.findOne({ role_id: { $exists: true } });

		if (!adminUser) {
			logInfo(
				"⚠️ No admin user found. Photographers will have null created_by."
			);
		}

		const photographersToInsert = [];

		for (let i = 0; i < count; i++) {
			const firstName = faker.person.firstName();
			const lastName = faker.person.lastName();

			// Random 1-3 specialties
			const allCategories = Object.values(ServiceCategoryEnum);
			const specialties = faker.helpers.arrayElements(
				allCategories,
				faker.number.int({ min: 1, max: 3 })
			);

			// Weekly schedule
			const weeklySchedule = [
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
				"Sunday",
			].map((day) => ({
				day_of_week: day,
				start_time: "00:00",
				end_time: "24:00",
				is_available: true,
			}));

			// Optional gallery (1-5 images)
			const photo_gallery = faker.helpers.arrayElements(
				Array.from({ length: 9 }).map(() => faker.image.url()),
				faker.number.int({ min: 1, max: 5 })
			);

			photographersToInsert.push({
				name: `${firstName} ${lastName}`,
				email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.number.int(
					{ min: 1, max: 999 }
				)}@yopmail.com`,
				mobile_number: faker.helpers.replaceSymbols("09#########"),
				bio: faker.lorem.paragraph(),
				profile_image: faker.image.url(),
				specialties,
				weekly_schedule: weeklySchedule,
				photo_gallery,
				booking_lead_time_hours: faker.number.int({ min: 0, max: 48 }),
				created_by: adminUser?._id || null,
			});
		}

		const result = await Photographer.insertMany(photographersToInsert, {
			ordered: false,
		});
		logSuccess(`✅ Successfully inserted ${result.length} photographers.`);
	} catch (err: any) {
		if (err.writeErrors) {
			const inserted = count - err.writeErrors.length;
			logInfo(`⚠️ ${inserted} photographers inserted (duplicates skipped).`);
		} else {
			logError(`❌ Seeder failed: ${err.message}`);
		}
	}
};
