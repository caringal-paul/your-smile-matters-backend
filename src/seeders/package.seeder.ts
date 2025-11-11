import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { Package } from "../models/Package";
import { Service } from "../models/Service";
import { User } from "../models/User";
import { logError, logInfo, logSuccess } from "./utils/seed.logger";

// Curated realistic package names
// Curated realistic package names (120+)
export const REALISTIC_PACKAGE_NAMES = [
	// Photography Packages
	"Premium Wedding Package",
	"Deluxe Wedding Package",
	"Basic Wedding Coverage",
	"Engagement Photography Package",
	"Prenup Photoshoot Package",
	"Birthday Event Photography Package",
	"Corporate Headshot Package",
	"Graduation Memories Package",
	"Newborn Photoshoot Package",
	"Maternity Photography Package",
	"Fashion Photoshoot Package",
	"Portfolio Development Package",
	"Event Photography Bundle",
	"Travel Photography Package",
	"Drone Photography Package",
	"Product Photography Bundle",
	"Commercial Photography Package",
	"Event Live Streaming Package",
	"Music Video Production Package",
	"Video Editing & Retouching Package",

	// Beauty Packages
	"Bridal Glam Package",
	"Bridesmaid Beauty Package",
	"Wedding Hair & Makeup Package",
	"Special Occasion Makeup Package",
	"Makeup Tutorial Session Package",
	"Skincare & Facial Package",
	"Hair Styling Session Package",
	"Nail Art Design Package",
	"Personal Styling Consultation Package",
	"Temporary Hair Coloring Package",
	"Beauty Product Consultation Package",
	"Makeover & Styling Package",
	"Professional Haircut Package",
	"Bridal Hair & Makeup Combo Package",
	"Full Wedding Beauty Package",
	"Evening Glam Package",
	"Corporate Event Beauty Package",
	"Festival Makeup Package",
	"Photo Shoot Makeup Package",
	"Makeup + Hair Combo Package",

	// Styling Packages
	"Wedding Outfit Styling Package",
	"Fashion Styling Consultation Package",
	"Corporate Styling Session Package",
	"Event Styling Consultation Package",
	"Personal Shopper Styling Package",
	"Photo Shoot Styling Package",
	"Video Shoot Styling Package",
	"Editorial Styling Package",
	"Styling Workshop Package",
	"Accessory Coordination Package",
	"Color Analysis & Styling Package",
	"Bridal Outfit Consultation Package",
	"Makeover Consultation Package",
	"Visual Merchandising Consultation Package",
	"Product Display Styling Package",
	"Complete Styling Package",
	"Premium Fashion Styling Package",
	"Photo & Video Styling Combo Package",
	"Luxury Styling Package",
	"Styling + Makeup Combo Package",

	// Equipment Packages
	"Camera Rental Package",
	"Lighting Equipment Rental Package",
	"Tripod Rental Package",
	"Drone Rental Package",
	"Audio Recording Equipment Rental Package",
	"Backdrop Rental Package",
	"Props Rental Package",
	"Projector Rental Package",
	"Photography Kit Rental Package",
	"Video Recording Kit Rental Package",
	"Studio Space Rental Package",
	"Event Equipment Setup Package",
	"Photography Equipment Setup Package",
	"Sound System Rental Package",
	"Lighting Setup Service Package",
	"Complete Equipment Rental Package",
	"Professional Videography Equipment Package",
	"Premium Photography Kit Package",
	"Event Audio & Lighting Package",
	"All-in-One Media Equipment Package",

	// Other Packages
	"Event Coordination Package",
	"Workshop Hosting Package",
	"Consultation Service Package",
	"Custom Design Service Package",
	"Marketing Video Production Package",
	"Social Media Content Creation Package",
	"Creative Direction Package",
	"Script Writing Package",
	"Editing & Post Production Package",
	"Online Tutorial Recording Package",
	"Photo Album Design Package",
	"Invitation Design Service Package",
	"Venue Decoration Consultation Package",
	"Branding Consultation Package",
	"Digital Marketing Content Package",
	"Complete Event Management Package",
	"Premium Media Production Package",
	"Photography + Videography Combo Package",
	"Full Marketing & Branding Package",
	"All-in-One Creative Package",

	// More mixed packages for variety
	"Luxury Wedding Photography Package",
	"Deluxe Corporate Event Package",
	"Birthday Memories Complete Package",
	"Fashion & Styling Combo Package",
	"Bridal Complete Glam Package",
	"Video Production & Editing Package",
	"Premium Social Media Content Package",
	"Full Event Coverage + Styling Package",
	"Photography + Beauty Combo Package",
	"Event Live Streaming + Photography Package",
	"Complete Graduation Package",
	"Engagement & Prenup Package",
	"Travel Photography & Videography Package",
	"Music Video Production + Editing Package",
	"Newborn & Maternity Complete Package",
	"Fashion Photoshoot + Styling Package",
	"Corporate Branding Media Package",
	"Luxury Makeover & Styling Package",
	"Premium Workshop Hosting Package",
	"Creative Media Direction Package",
];

export const seedPackages = async (count = 100) => {
	logInfo(`🔹 Seeding ${count} packages...`);

	try {
		const adminUser = await User.findOne({ role_id: { $exists: true } });
		if (!adminUser) {
			logInfo("⚠️ No admin user found. Packages will have null created_by.");
		}

		const allServices = await Service.find({ is_available: true }).lean();
		if (!allServices.length) {
			logInfo("⚠️ No available services found. Cannot create packages.");
			return;
		}

		const shuffledNames = faker.helpers.shuffle(REALISTIC_PACKAGE_NAMES);
		const packageNames = shuffledNames.slice(0, count);

		const packagesToInsert: any[] = [];

		for (let pkgName of packageNames) {
			// Pick 1–5 services randomly for the package
			const serviceCount = faker.number.int({
				min: 1,
				max: Math.min(5, allServices.length),
			});
			const selectedServices = faker.helpers.arrayElements(
				allServices,
				serviceCount
			);

			const services = selectedServices.map((service) => {
				const quantity = faker.number.int({ min: 1, max: 3 });
				const price_per_unit = service.price;
				const total_price = price_per_unit * quantity;
				return {
					service_id: service._id,
					quantity,
					price_per_unit,
					total_price,
					duration_minutes: service.duration_minutes || 30,
				};
			});

			// Package total price is sum of all services, capped at 5000
			let package_price = services.reduce((sum, s) => sum + s.total_price, 0);
			if (package_price > 5000) package_price = 5000;

			// Looks
			const looks = faker.number.int({ min: 1, max: 10 });

			// Single image for package
			const image = faker.image.url();

			// Unique description
			const description = faker.lorem.sentence(25);

			packagesToInsert.push({
				name: pkgName,
				description,
				image,
				package_price,
				services,
				looks,
				is_available: true,
				created_by: adminUser?._id || null,
			});
		}

		const result = await Package.insertMany(packagesToInsert, {
			ordered: false,
		});
		logSuccess(`✅ Successfully inserted ${result.length} packages.`);
	} catch (err: any) {
		if (err.writeErrors) {
			const inserted = count - err.writeErrors.length;
			logInfo(`⚠️ ${inserted} packages inserted (duplicates skipped).`);
		} else {
			logError(`❌ Seeder failed: ${err.message}`);
		}
	}
};
