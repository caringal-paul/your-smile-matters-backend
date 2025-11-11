import { faker } from "@faker-js/faker";
import { Service } from "../models/Service";
import { User } from "../models/User";
import { ServiceCategoryEnum } from "../constants/service-category.constant";
import { logError, logInfo, logSuccess } from "./utils/seed.logger";

// Curated realistic service names per category (expand as needed for 100+ services)
const REALISTIC_SERVICE_NAMES = [
	// Photography
	"Wedding Photography",
	"Prenup Session",
	"Corporate Headshots",
	"Birthday Event Coverage",
	"Engagement Shoot",
	"Product Photography",
	"Fashion Shoot",
	"Event Videography",
	"Newborn Photography",
	"Graduation Photoshoot",
	"Drone Photography",
	"Landscape Photography",
	"Video Editing Service",
	"Corporate Video Production",
	"Music Video Production",
	"Photo Retouching",
	"Event Live Streaming",
	"Portfolio Photography",
	"Commercial Photography",
	"Travel Photography",

	// Beauty
	"Bridal Makeup",
	"Bridesmaid Makeup",
	"Hair Styling Session",
	"Makeup Consultation",
	"Facial Treatment",
	"Manicure & Pedicure",
	"Professional Haircut",
	"Skincare Consultation",
	"Bridal Hair & Makeup",
	"Special Occasion Makeup",
	"Makeup Tutorial Session",
	"Personal Styling Consultation",
	"Beauty Product Consultation",
	"Temporary Hair Coloring",
	"Nail Art Design",

	// Styling
	"Wedding Outfit Styling",
	"Fashion Styling Consultation",
	"Corporate Styling Session",
	"Event Styling Consultation",
	"Personal Shopper Session",
	"Makeover Consultation",
	"Bridal Outfit Consultation",
	"Photo Shoot Styling",
	"Video Shoot Styling",
	"Editorial Styling",
	"Product Display Styling",
	"Visual Merchandising Consultation",
	"Styling Workshop",
	"Accessory Coordination",
	"Color Analysis & Styling",

	// Equipment
	"Camera Rental",
	"Lighting Equipment Rental",
	"Tripod Rental",
	"Drone Rental",
	"Audio Recording Equipment Rental",
	"Backdrop Rental",
	"Props Rental",
	"Projector Rental",
	"Photography Kit Rental",
	"Studio Space Rental",
	"Video Recording Kit Rental",
	"Event Equipment Setup",
	"Photography Equipment Setup",
	"Sound System Rental",
	"Lighting Setup Service",

	// Other
	"Event Coordination",
	"Workshop Hosting",
	"Consultation Service",
	"Custom Design Service",
	"Marketing Video Production",
	"Social Media Content Creation",
	"Creative Direction",
	"Script Writing",
	"Editing & Post Production",
	"Online Tutorial Recording",
	"Photo Album Design",
	"Invitation Design Service",
	"Venue Decoration Consultation",
	"Branding Consultation",
	"Digital Marketing Content",
];

export const seedServices = async (count = 100) => {
	logInfo(`🔹 Seeding ${count} services...`);

	try {
		const adminUser = await User.findOne({ role_id: { $exists: true } });
		if (!adminUser) {
			logInfo("⚠️ No admin user found. Services will have null created_by.");
		}

		// Shuffle the service names and pick only `count` items
		const shuffledNames = faker.helpers.shuffle(REALISTIC_SERVICE_NAMES);
		const serviceNames = shuffledNames.slice(0, count);

		const categories = Object.values(ServiceCategoryEnum);
		const servicesToInsert: any[] = [];

		for (let name of serviceNames) {
			const category = faker.helpers.arrayElement(categories);
			const duration_minutes = faker.helpers.arrayElement([30, 60, 90, 120]);
			const price = faker.number.int({ min: 50, max: 1250 });
			const galleryCount = faker.number.int({ min: 1, max: 4 });
			const service_gallery = Array.from({ length: galleryCount }).map(() =>
				faker.image.url()
			);
			const description = faker.lorem.sentence(25);

			servicesToInsert.push({
				name,
				description,
				category,
				price,
				duration_minutes,
				is_available: true,
				service_gallery,
				created_by: adminUser?._id || null,
			});
		}

		const result = await Service.insertMany(servicesToInsert, {
			ordered: false,
		});
		logSuccess(`✅ Successfully inserted ${result.length} services.`);
	} catch (err: any) {
		if (err.writeErrors) {
			const inserted = count - err.writeErrors.length;
			logInfo(`⚠️ ${inserted} services inserted (duplicates skipped).`);
		} else {
			logError(`❌ Seeder failed: ${err.message}`);
		}
	}
};
