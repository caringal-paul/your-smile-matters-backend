// import mongoose, { Types } from "mongoose";
// import bcrypt from "bcryptjs";
// import { User } from "../models/User";
// import { Customer } from "../models/Customer";
// import {
// 	DayOfWeek,
// 	Photographer,
// 	WeeklySchedule,
// } from "../models/Photographer";
// import { Service } from "../models/Service";
// import { Package } from "../models/Package";
// import { Booking, BookingModel, BookingStatusEnum } from "../models/Booking";
// import { ServiceCategoryEnum } from "../constants/service-category.constant";
// import { faker } from "@faker-js/faker";
// import { Role } from "../models/Role";
// import {
// 	addMinutes,
// 	differenceInMinutes,
// 	format,
// 	isAfter,
// 	parse,
// } from "date-fns";
// import {
// 	PaymentMethodEnum,
// 	Transaction,
// 	TransactionStatus,
// 	TransactionType,
// } from "../models/Transaction";

// const MONGODB_URI =
// 	process.env.MONGODB_URI || "mongodb://localhost:27017/capstone-dev";

// async function connect() {
// 	await mongoose.connect(MONGODB_URI);
// 	console.log("✅ Connected to MongoDB");
// }

// async function disconnect() {
// 	await mongoose.disconnect();
// 	console.log("🔌 Disconnected from MongoDB");
// }

// async function clearCollections() {
// 	await Promise.all([
// 		User.deleteMany({}),
// 		Customer.deleteMany({}),
// 		Photographer.deleteMany({}),
// 		Service.deleteMany({}),
// 		Package.deleteMany({}),
// 		Booking.deleteMany({}),
// 	]);
// }

// async function seedUsers() {
// 	// 1️⃣ Clear existing users
// 	await User.deleteMany({});

// 	// 2️⃣ Find the Role dynamically (example: "Super Admin" role)
// 	const role = await Role.findOne({ name: "Admin" });
// 	if (!role) {
// 		throw new Error("Role 'Super Admin' not found. Please seed roles first.");
// 	}

// 	// 3️⃣ Create superadmin user
// 	const superAdminPassword = await bcrypt.hash("Password_123", 10);
// 	const superAdmin = await User.create({
// 		username: "superadmin",
// 		email: "superadmin@yopmail.com",
// 		first_name: "Super",
// 		last_name: "Admin",
// 		mobile_number: "09171234567",
// 		password: superAdminPassword,
// 		role_id: role._id,
// 		is_active: true,
// 		created_by: new Types.ObjectId(),
// 		updated_by: new Types.ObjectId(),
// 	});

// 	const usersData = [
// 		{
// 			username: "admin_john",
// 			email: "john.admin@yopmail.com",
// 			first_name: "John",
// 			last_name: "Admin",
// 			mobile_number: "09180001111",
// 			password: "Password_123",
// 		},
// 		{
// 			username: "admin_jane",
// 			email: "jane.admin@yopmail.com",
// 			first_name: "Jane",
// 			last_name: "Admin",
// 			mobile_number: "09180002222",
// 			password: "Password_123",
// 		},
// 		{
// 			username: "staff_mike",
// 			email: "mike.staff@yopmail.com",
// 			first_name: "Mike",
// 			last_name: "Staff",
// 			mobile_number: "09180003333",
// 			password: "Staff123!",
// 		},
// 		{
// 			username: "staff_anna",
// 			email: "anna.staff@yopmail.com",
// 			first_name: "Anna",
// 			last_name: "Staff",
// 			mobile_number: "09180004444",
// 			password: "Staff123!",
// 		},
// 		{
// 			username: "staff_ryan",
// 			email: "ryan.staff@yopmail.com",
// 			first_name: "Ryan",
// 			last_name: "Staff",
// 			mobile_number: "09180005555",
// 			password: "Staff123!",
// 		},
// 		{
// 			username: "staff_lisa",
// 			email: "lisa.staff@yopmail.com",
// 			first_name: "Lisa",
// 			last_name: "Staff",
// 			mobile_number: "09180006666",
// 			password: "Staff123!",
// 		},
// 		{
// 			username: "staff_david",
// 			email: "david.staff@yopmail.com",
// 			first_name: "David",
// 			last_name: "Staff",
// 			mobile_number: "09180007777",
// 			password: "Staff123!",
// 		},
// 		{
// 			username: "staff_claire",
// 			email: "claire.staff@yopmail.com",
// 			first_name: "Claire",
// 			last_name: "Staff",
// 			mobile_number: "09180008888",
// 			password: "Staff123!",
// 		},
// 		{
// 			username: "staff_james",
// 			email: "james.staff@yopmail.com",
// 			first_name: "James",
// 			last_name: "Staff",
// 			mobile_number: "09180009999",
// 			password: "Staff123!",
// 		},
// 	];

// 	// 4️⃣ Hash passwords & attach created_by, role_id
// 	const usersToInsert = await Promise.all(
// 		usersData.map(async (user) => ({
// 			...user,
// 			password: await bcrypt.hash(user.password, 10),
// 			role_id: role._id,
// 			created_by: superAdmin._id,
// 			updated_by: superAdmin._id,
// 			is_active: true,
// 		}))
// 	);

// 	// 5️⃣ Insert users
// 	await User.insertMany(usersToInsert);

// 	return superAdmin;
// }

// export async function generateCustomerNumber(): Promise<string> {
// 	const today = new Date();
// 	const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

// 	// Generate a random 4-digit number
// 	const randomSequence = Math.floor(1000 + Math.random() * 9000); // between 1000-9999

// 	return `CUST-${dateStr}-${randomSequence}`;
// }

// async function seedCustomers() {
// 	await Customer.deleteMany({});

// 	const superAdmin = await User.findOne({ email: "superadmin@yopmail.com" });
// 	if (!superAdmin) {
// 		throw new Error("❌ Super admin not found. Seed users first!");
// 	}

// 	const customersData = [
// 		{
// 			email: "john.doe@yopmail.com",
// 			first_name: "John",
// 			last_name: "Doe",
// 			mobile_number: "09170000001",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "123 Mabini St.",
// 			city: "Makati",
// 			province: "Metro Manila",
// 			postal_code: "1200",
// 			country: "Philippines",
// 		},
// 		{
// 			email: "paul.santos@yopmail.com",
// 			first_name: "Paul",
// 			last_name: "Santos",
// 			mobile_number: "09170000002",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "456 Rizal Ave.",
// 			city: "Quezon City",
// 			province: "Metro Manila",
// 			postal_code: "1100",
// 			country: "Philippines",
// 		},
// 		{
// 			email: "angelica.reyes@yopmail.com",
// 			first_name: "Angelica",
// 			last_name: "Reyes",
// 			mobile_number: "09170000003",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "789 Bonifacio St.",
// 			city: "Pasig",
// 			province: "Metro Manila",
// 			postal_code: "1600",
// 		},
// 		{
// 			email: "john.dela.cruz@yopmail.com",
// 			first_name: "John",
// 			last_name: "Dela Cruz",
// 			mobile_number: "09170000004",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "101 Lapu-Lapu St.",
// 			city: "Taguig",
// 			province: "Metro Manila",
// 			postal_code: "1630",
// 		},
// 		{
// 			email: "maria.gonzales@yopmail.com",
// 			first_name: "Maria",
// 			last_name: "Gonzales",
// 			mobile_number: "09170000005",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "202 Maginhawa St.",
// 			city: "Quezon City",
// 			province: "Metro Manila",
// 			postal_code: "1101",
// 		},
// 		{
// 			email: "patrick.tan@yopmail.com",
// 			first_name: "Patrick",
// 			last_name: "Tan",
// 			mobile_number: "09170000006",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "303 Katipunan Ave.",
// 			city: "Quezon City",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "lisa.fernandez@yopmail.com",
// 			first_name: "Lisa",
// 			last_name: "Fernandez",
// 			mobile_number: "09170000007",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "404 Lopez St.",
// 			city: "Mandaluyong",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "mark.delosreyes@yopmail.com",
// 			first_name: "Mark",
// 			last_name: "Delos Reyes",
// 			mobile_number: "09170000008",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "505 Quirino Ave.",
// 			city: "Parañaque",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "kristine.valdez@yopmail.com",
// 			first_name: "Kristine",
// 			last_name: "Valdez",
// 			mobile_number: "09170000009",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "606 Shaw Blvd.",
// 			city: "Pasig",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "ricky.mendoza@yopmail.com",
// 			first_name: "Ricky",
// 			last_name: "Mendoza",
// 			mobile_number: "09170000010",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "707 Ayala Ave.",
// 			city: "Makati",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "nina.cruz@yopmail.com",
// 			first_name: "Nina",
// 			last_name: "Cruz",
// 			mobile_number: "09170000011",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "808 Recto Ave.",
// 			city: "Manila",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "alfred.lim@yopmail.com",
// 			first_name: "Alfred",
// 			last_name: "Lim",
// 			mobile_number: "09170000012",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "909 Taft Ave.",
// 			city: "Manila",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "michelle.ramos@yopmail.com",
// 			first_name: "Michelle",
// 			last_name: "Ramos",
// 			mobile_number: "09170000013",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "111 Legazpi St.",
// 			city: "Makati",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "ken.soriano@yopmail.com",
// 			first_name: "Ken",
// 			last_name: "Soriano",
// 			mobile_number: "09170000014",
// 			password: "Password_123",
// 			gender: "Male",
// 			address: "222 P. Burgos St.",
// 			city: "Mandaluyong",
// 			province: "Metro Manila",
// 		},
// 		{
// 			email: "catherine.uy@yopmail.com",
// 			first_name: "Catherine",
// 			last_name: "Uy",
// 			mobile_number: "09170000015",
// 			password: "Password_123",
// 			gender: "Female",
// 			address: "333 Ortigas Ave.",
// 			city: "Pasig",
// 			province: "Metro Manila",
// 		},
// 	];

// 	const customersToInsert = await Promise.all(
// 		customersData.map(async (customer) => ({
// 			...customer,
// 			customer_no: await generateCustomerNumber(),
// 			password: await bcrypt.hash(customer.password, 10),
// 			created_by: superAdmin._id,
// 			is_active: true,
// 		}))
// 	);

// 	await Customer.insertMany(customersToInsert);
// }

// //------------------------------
// // HELPERS
// //------------------------------

// const defaultWeeklySchedule = [
// 	{
// 		day_of_week: "Monday",
// 		start_time: "09:00",
// 		end_time: "17:00",
// 		is_available: true,
// 	},
// 	{
// 		day_of_week: "Tuesday",
// 		start_time: "09:00",
// 		end_time: "17:00",
// 		is_available: true,
// 	},
// 	{
// 		day_of_week: "Wednesday",
// 		start_time: "09:00",
// 		end_time: "17:00",
// 		is_available: true,
// 	},
// 	{
// 		day_of_week: "Thursday",
// 		start_time: "09:00",
// 		end_time: "17:00",
// 		is_available: true,
// 	},
// 	{
// 		day_of_week: "Friday",
// 		start_time: "09:00",
// 		end_time: "17:00",
// 		is_available: true,
// 	},
// 	{
// 		day_of_week: "Saturday",
// 		start_time: "10:00",
// 		end_time: "15:00",
// 		is_available: true,
// 	},
// 	{
// 		day_of_week: "Sunday",
// 		start_time: "00:00",
// 		end_time: "12:00",
// 		is_available: false,
// 	},
// ];

// // Random specialties (1–3 categories)
// const getRandomSpecialties = () => {
// 	const categories = Object.values(ServiceCategoryEnum);
// 	const count = faker.number.int({ min: 1, max: 3 });
// 	return faker.helpers.arrayElements(categories, count);
// };

// export const seedPhotographers = async () => {
// 	try {
// 		// ✅ Fetch the real Admin (the one created first in seedUsers)
// 		const adminUser = await User.findOne({ email: "superadmin@yopmail.com" })
// 			.sort({ created_at: 1 })
// 			.lean();
// 		if (!adminUser)
// 			throw new Error("Admin user not found — please seed users first.");

// 		const photographers = Array.from({ length: 15 }).map(() => ({
// 			name: faker.person.fullName(),
// 			email: faker.internet.email().toLowerCase(),
// 			mobile_number: `+63 9${faker.string.numeric(9)}`,
// 			bio: faker.lorem.sentences(2),
// 			profile_image: faker.image.avatarGitHub(),
// 			specialties: getRandomSpecialties(),
// 			photo_gallery: faker.helpers.arrayElements(
// 				Array.from({ length: 12 }).map(() =>
// 					faker.image.urlPicsumPhotos({ width: 800, height: 600 })
// 				),
// 				faker.number.int({ min: 3, max: 9 })
// 			),
// 			weekly_schedule: defaultWeeklySchedule,
// 			date_overrides: [
// 				{
// 					date: faker.date.soon({ days: 60 }),
// 					is_available: false,
// 					reason: "Vacation",
// 					notes: "Out of town for a client shoot.",
// 				},
// 			],
// 			booking_lead_time_hours: faker.number.int({ min: 12, max: 72 }),
// 			is_active: true,
// 			created_by: adminUser._id,
// 			updated_by: null,
// 			deleted_by: null,
// 			retrieved_by: null,
// 			deleted_at: null,
// 			retrieved_at: null,
// 		}));

// 		await Photographer.insertMany(photographers);
// 		console.log(
// 			`📸 Seeded ${photographers.length} photographers successfully!`
// 		);
// 	} catch (error) {
// 		console.error("❌ Failed to seed photographers:", error);
// 		throw error;
// 	}
// };

// export const seedServices = async () => {
// 	try {
// 		const admin = await User.findOne({ email: "superadmin@yopmail.com" });
// 		if (!admin) {
// 			console.error("❌ No admin found. Please seed users first.");
// 			return;
// 		}

// 		const servicesData = [
// 			{
// 				name: "Wedding Photography",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 15000,
// 				old_price: 18000,
// 				duration_minutes: 240,
// 				description:
// 					"Capture your special day with professional wedding photography.",
// 			},
// 			{
// 				name: "Prenup Session",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 8000,
// 				old_price: 9500,
// 				duration_minutes: 180,
// 				description: "Elegant and creative prenup photo sessions.",
// 			},
// 			{
// 				name: "Corporate Headshots",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 4000,
// 				old_price: 5000,
// 				duration_minutes: 90,
// 				description:
// 					"Professional headshots for corporate profiles and resumes.",
// 			},
// 			{
// 				name: "Birthday Event Coverage",
// 				category: ServiceCategoryEnum.Equipment,
// 				price: 12000,
// 				old_price: 13000,
// 				duration_minutes: 300,
// 				description:
// 					"Full event coverage for birthdays and private celebrations.",
// 			},
// 			{
// 				name: "Video Editing Service",
// 				category: ServiceCategoryEnum.Other,
// 				price: 6000,
// 				old_price: 7500,
// 				duration_minutes: 120,
// 				description:
// 					"Professional video editing for social media or marketing campaigns.",
// 			},
// 			{
// 				name: "Corporate Video Production",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 20000,
// 				old_price: 25000,
// 				duration_minutes: 360,
// 				description: "High-quality corporate video creation and production.",
// 			},
// 			{
// 				name: "Drone Aerial Shoot",
// 				category: ServiceCategoryEnum.Equipment,
// 				price: 10000,
// 				old_price: 12000,
// 				duration_minutes: 180,
// 				description: "Stunning aerial shots with 4K drone cameras.",
// 			},
// 			{
// 				name: "Product Photography",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 7000,
// 				old_price: 8500,
// 				duration_minutes: 120,
// 				description:
// 					"Detailed product photography for e-commerce and catalogs.",
// 			},
// 			{
// 				name: "Family Portrait Session",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 5000,
// 				old_price: 6000,
// 				duration_minutes: 120,
// 				description:
// 					"Classic and modern family portraits in studio or outdoor.",
// 			},
// 			{
// 				name: "Event Videography",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 18000,
// 				old_price: 20000,
// 				duration_minutes: 360,
// 				description:
// 					"Comprehensive video coverage for weddings, birthdays, and corporate events.",
// 			},
// 			{
// 				name: "Engagement Video Teaser",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 10000,
// 				old_price: 12000,
// 				duration_minutes: 120,
// 				description:
// 					"Short engagement video teasers perfect for social media sharing.",
// 			},
// 			{
// 				name: "Photo Restoration",
// 				category: ServiceCategoryEnum.Other,
// 				price: 2500,
// 				old_price: 3000,
// 				duration_minutes: 120,
// 				description: "Restore old and damaged photos to life.",
// 			},
// 			{
// 				name: "Short Film Production",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 25000,
// 				old_price: 30000,
// 				duration_minutes: 480,
// 				description:
// 					"Full-scale short film production from concept to post-editing.",
// 			},
// 			{
// 				name: "Corporate Live Streaming",
// 				category: ServiceCategoryEnum.Equipment,
// 				price: 15000,
// 				old_price: 18000,
// 				duration_minutes: 240,
// 				description:
// 					"Professional live streaming for corporate events and webinars.",
// 			},
// 			{
// 				name: "Model Portfolio Shoot",
// 				category: ServiceCategoryEnum.Photography,
// 				price: 8000,
// 				old_price: 10000,
// 				duration_minutes: 150,
// 				description:
// 					"Stylized portfolio photography for models and influencers.",
// 			},
// 		].map((service) => ({
// 			...service,
// 			is_available: true,
// 			service_gallery: Array.from(
// 				{ length: faker.number.int({ min: 1, max: 4 }) },
// 				() => faker.image.urlLoremFlickr({ category: "photography" })
// 			),
// 			is_active: true,
// 			created_by: admin._id,
// 			updated_by: null,
// 			deleted_by: null,
// 			retrieved_by: null,
// 			deleted_at: null,
// 			retrieved_at: null,
// 		}));

// 		await Service.deleteMany({});
// 		await Service.insertMany(servicesData);

// 		console.log("✅ Services seeded successfully");
// 	} catch (error) {
// 		console.error("❌ Error seeding services:", error);
// 	}
// };

// export const seedPackages = async () => {
// 	try {
// 		const admin = await User.findOne({ email: "superadmin@yopmail.com" });

// 		if (!admin) {
// 			console.error("❌ No admin found. Please seed users first.");
// 			return;
// 		}

// 		const services = await Service.find({});
// 		if (services.length === 0) {
// 			console.error("❌ No services found. Please seed services first.");
// 			return;
// 		}

// 		const getRandomServices = (count: number) => {
// 			const shuffled = faker.helpers.shuffle(services);
// 			return shuffled.slice(0, count).map((service) => {
// 				const quantity = faker.number.int({ min: 1, max: 3 });
// 				const total_price = service.price * quantity;

// 				return {
// 					service_id: service._id,
// 					quantity,
// 					price_per_unit: service.price,
// 					total_price,
// 					duration_minutes: service.duration_minutes || 60,
// 				};
// 			});
// 		};

// 		const packagesData = [
// 			{
// 				name: "Classic Wedding Package",
// 				description: "A timeless package that covers your wedding essentials.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(3),
// 				looks: 2,
// 			},
// 			{
// 				name: "Premium Wedding Package",
// 				description:
// 					"Complete wedding photo and video coverage with editing services.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(4),
// 				looks: 3,
// 			},
// 			{
// 				name: "Corporate Event Package",
// 				description:
// 					"Professional coverage for corporate events, seminars, and launches.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(3),
// 				looks: 1,
// 			},
// 			{
// 				name: "Birthday Celebration Package",
// 				description:
// 					"Capture special moments from birthdays and private events.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(2),
// 				looks: 1,
// 			},
// 			{
// 				name: "Prenup Package",
// 				description:
// 					"Creative pre-wedding shoot with stylist and location coverage.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(3),
// 				looks: 2,
// 			},
// 			{
// 				name: "Product Shoot Package",
// 				description:
// 					"Perfect for brands looking for professional product photography.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(2),
// 				looks: 1,
// 			},
// 			{
// 				name: "Corporate Branding Package",
// 				description:
// 					"Includes headshots, group photos, and brand visual identity shots.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(3),
// 				looks: 1,
// 			},
// 			{
// 				name: "Family Portrait Package",
// 				description: "Studio or outdoor portrait session for the whole family.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(2),
// 				looks: 1,
// 			},
// 			{
// 				name: "Engagement Highlights Package",
// 				description:
// 					"Capture the essence of your engagement with photo and video coverage.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(3),
// 				looks: 2,
// 			},
// 			{
// 				name: "Fashion Lookbook Package",
// 				description:
// 					"For models and designers who want professional portfolio shots.",
// 				image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
// 				services: getRandomServices(4),
// 				looks: 5,
// 			},
// 		].map((pkg) => {
// 			const total_price = pkg.services.reduce(
// 				(sum, s) => sum + s.total_price,
// 				0
// 			);

// 			return {
// 				...pkg,
// 				package_price: total_price,
// 				is_available: true,
// 				is_active: true,
// 				custom_duration_minutes: faker.number.int({ min: 120, max: 480 }),
// 				created_by: admin._id,
// 				updated_by: null,
// 				deleted_by: null,
// 				retrieved_by: null,
// 				deleted_at: null,
// 				retrieved_at: null,
// 			};
// 		});

// 		await Package.deleteMany({});
// 		await Package.insertMany(packagesData);

// 		console.log("✅ Packages seeded successfully");
// 	} catch (error) {
// 		console.error("❌ Error seeding packages:", error);
// 	}
// };

// //--------------------------
// // HELPER
// //--------------------------
// export async function getAvailableSlotsForSeeder(
// 	photographer: {
// 		_id: mongoose.Types.ObjectId;
// 		weekly_schedule: WeeklySchedule;
// 		date_overrides?: {
// 			date: Date;
// 			is_available: boolean;
// 			reason?: string;
// 			notes?: string;
// 			custom_hours?: WeeklySchedule;
// 		}[];
// 	},
// 	targetDate: Date,
// 	sessionDurationMinutes: number = 120
// ): Promise<string[]> {
// 	const availableSlots: string[] = [];

// 	const getDayName = (dayNum: number): DayOfWeek => {
// 		const days: DayOfWeek[] = [
// 			"Sunday",
// 			"Monday",
// 			"Tuesday",
// 			"Wednesday",
// 			"Thursday",
// 			"Friday",
// 			"Saturday",
// 		];
// 		return days[dayNum];
// 	};

// 	const dayOfWeek = getDayName(targetDate.getDay());
// 	const duration = sessionDurationMinutes;

// 	let schedule: WeeklySchedule[0] | undefined;

// 	if (photographer.date_overrides) {
// 		const override = photographer.date_overrides.find(
// 			(o) => o.date.toDateString() === targetDate.toDateString()
// 		);
// 		if (override) {
// 			if (!override.is_available) return [];
// 			schedule =
// 				override.custom_hours?.find((s) => s.day_of_week === dayOfWeek) ||
// 				photographer.weekly_schedule.find((s) => s.day_of_week === dayOfWeek);
// 		} else {
// 			schedule = photographer.weekly_schedule.find(
// 				(s) => s.day_of_week === dayOfWeek
// 			);
// 		}
// 	} else {
// 		schedule = photographer.weekly_schedule.find(
// 			(s) => s.day_of_week === dayOfWeek
// 		);
// 	}

// 	if (!schedule || !schedule.is_available) return [];

// 	const startOfDay = new Date(targetDate);
// 	startOfDay.setHours(0, 0, 0, 0);
// 	const endOfDay = new Date(targetDate);
// 	endOfDay.setHours(23, 59, 59, 999);

// 	const existingBookings = await Booking.find({
// 		photographer_id: photographer._id,
// 		booking_date: { $gte: startOfDay, $lte: endOfDay },
// 		status: { $nin: ["Cancelled", "Rejected"] },
// 	}).select("start_time end_time session_duration_minutes");

// 	const bookedTimeRanges = existingBookings.map((booking) => {
// 		const startDate = parse(booking.start_time, "HH:mm", targetDate);
// 		const endDate = addMinutes(
// 			startDate,
// 			booking.session_duration_minutes || 120
// 		);
// 		return { start: startDate, end: endDate };
// 	});

// 	const workStart = parse(schedule.start_time, "HH:mm", targetDate);
// 	const workEnd = parse(schedule.end_time, "HH:mm", targetDate);

// 	let current = workStart;
// 	while (!isAfter(addMinutes(current, duration), workEnd)) {
// 		const potentialEnd = addMinutes(current, duration);

// 		let hasConflict = bookedTimeRanges.some(
// 			(booked) => current < booked.end && potentialEnd > booked.start
// 		);

// 		if (!hasConflict) {
// 			availableSlots.push(
// 				`${format(current, "HH:mm")} - ${format(potentialEnd, "HH:mm")}`
// 			);
// 		}

// 		current = addMinutes(current, 30);
// 	}

// 	return availableSlots;
// }

// export const seedBookings = async (admin: any) => {
// 	const photographers = await Photographer.find();
// 	const customers = await Customer.find();
// 	const users = await User.find();
// 	const services = await Service.find();

// 	const createdBookings: BookingModel[] = [];

// 	for (let i = 0; i < 5; i++) {
// 		const customer = faker.helpers.arrayElement(customers);
// 		const createdBy = admin || faker.helpers.arrayElement(users);

// 		// Pick random date within 30 days
// 		const bookingDate = faker.date.soon({ days: 30 });
// 		const photographer = faker.helpers.arrayElement(
// 			photographers
// 		) as unknown as {
// 			_id: mongoose.Types.ObjectId;
// 			name: string;
// 			weekly_schedule: WeeklySchedule;
// 			date_overrides?: {
// 				date: Date;
// 				is_available: boolean;
// 				reason?: string;
// 				notes?: string;
// 				custom_hours?: WeeklySchedule;
// 			}[];
// 		};

// 		// Get available slots for the photographer on the selected date
// 		const availableSlots = await getAvailableSlotsForSeeder(
// 			photographer,
// 			bookingDate
// 		);

// 		if (!availableSlots.length) {
// 			console.warn("No available slots for photographer:", photographer.name);
// 			continue;
// 		}

// 		// Select a random slot from the available slots
// 		const selectedSlot = faker.helpers.arrayElement(availableSlots);

// 		// Extract start and end times from the selected slot
// 		const [start_time, end_time] = selectedSlot.split(" - ");

// 		// Select a random service and calculate its details
// 		const service = faker.helpers.arrayElement(services);
// 		const quantity = faker.number.int({ min: 1, max: 3 });

// 		const servicesList = [
// 			{
// 				service_id: service._id,
// 				quantity,
// 				price_per_unit: service.price,
// 				total_price: service.price * quantity,
// 				duration_minutes: service.duration_minutes || 60,
// 			},
// 		];

// 		// Calculate pricing details
// 		const totalAmount = servicesList.reduce((sum, s) => sum + s.total_price, 0);
// 		const discountAmount = faker.number.int({ min: 0, max: 300 });
// 		const finalAmount = Math.max(totalAmount - discountAmount, 0);

// 		// Calculate session duration
// 		const slotParts = selectedSlot.split(" - ");
// 		const startDate = parse(slotParts[0], "HH:mm", bookingDate);
// 		const endDate = parse(slotParts[1], "HH:mm", bookingDate);
// 		const durationMinutes = differenceInMinutes(endDate, startDate);

// 		// Create the booking
// 		const booking = new Booking({
// 			booking_reference: `BK-${faker.string.alpha(8).toUpperCase()}`,
// 			customer_id: customer._id,
// 			photographer_id: photographer._id,
// 			services: servicesList,
// 			is_customized: true,
// 			customization_notes: faker.lorem.sentence(),
// 			booking_date: bookingDate,
// 			start_time,
// 			end_time,
// 			session_duration_minutes: Math.min(durationMinutes, 480),
// 			location: faker.location.streetAddress(),
// 			theme: faker.helpers.arrayElement([
// 				"Studio",
// 				"Outdoor",
// 				"Event",
// 				"Family",
// 				"Wedding",
// 			]),
// 			special_requests: faker.lorem.sentence(),
// 			status: faker.helpers.arrayElement(Object.values(BookingStatusEnum)),
// 			total_amount: totalAmount,
// 			discount_amount: discountAmount,
// 			final_amount: finalAmount,
// 			created_by: createdBy._id,
// 		});

// 		await booking.save();
// 		createdBookings.push(booking);
// 	}

// 	return createdBookings;
// };

// export const seedTransactions = async (admin: any) => {
// 	try {
// 		// Clear existing transactions
// 		await Transaction.deleteMany({});

// 		const bookings = await Booking.find().populate("customer_id");
// 		if (bookings.length === 0) {
// 			console.error("❌ No bookings found. Please seed bookings first.");
// 			return;
// 		}

// 		const createdTransactions = [];

// 		// Create at least 8 transactions across different bookings
// 		for (let i = 0; i < Math.min(8, bookings.length); i++) {
// 			const booking = bookings[i];

// 			// Generate a unique transaction reference
// 			const generateTransactionRef = () => {
// 				const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
// 				return `TXN-${randomStr}`;
// 			};

// 			// Create different types of transactions
// 			const transactionTypes = [
// 				{
// 					type: "Payment" as TransactionType,
// 					amount: booking.final_amount, // Full payment
// 					status: "Completed" as TransactionStatus,
// 				},
// 				{
// 					type: "Partial" as TransactionType,
// 					amount: Math.floor(booking.final_amount * 0.5), // 50% partial payment
// 					status: "Completed" as TransactionStatus,
// 				},
// 				{
// 					type: "Balance" as TransactionType,
// 					amount: Math.floor(booking.final_amount * 0.5), // Remaining balance
// 					status: "Completed" as TransactionStatus,
// 				},
// 				{
// 					type: "Payment" as TransactionType,
// 					amount: booking.final_amount,
// 					status: "Pending" as TransactionStatus,
// 				},
// 				{
// 					type: "Payment" as TransactionType,
// 					amount: booking.final_amount,
// 					status: "Failed" as TransactionStatus,
// 				},
// 			];

// 			const transactionConfig = transactionTypes[i % transactionTypes.length];

// 			// Ensure amount doesn't exceed remaining balance for payment types
// 			let transactionAmount = transactionConfig.amount;
// 			if (["Payment", "Partial", "Balance"].includes(transactionConfig.type)) {
// 				// Check existing completed transactions for this booking
// 				const existingTransactions = await Transaction.find({
// 					booking_id: booking._id,
// 					status: "Completed",
// 					transaction_type: { $in: ["Payment", "Partial", "Balance"] },
// 				});

// 				const totalPaid = existingTransactions.reduce(
// 					(sum, txn) => sum + txn.amount,
// 					0
// 				);
// 				const remainingBalance = booking.final_amount - totalPaid;

// 				// Adjust amount if it would exceed remaining balance
// 				if (transactionAmount > remainingBalance) {
// 					transactionAmount = remainingBalance;
// 				}
// 			}

// 			// Skip if no remaining balance for payment transactions
// 			if (
// 				transactionAmount <= 0 &&
// 				["Payment", "Partial", "Balance"].includes(transactionConfig.type)
// 			) {
// 				continue;
// 			}

// 			const paymentMethod = faker.helpers.arrayElement(
// 				Object.values(PaymentMethodEnum)
// 			);

// 			const transactionData = {
// 				transaction_reference: generateTransactionRef(),
// 				booking_id: booking._id,
// 				customer_id: booking.customer_id._id,
// 				amount: transactionAmount,
// 				transaction_type: transactionConfig.type,
// 				payment_method: paymentMethod,
// 				status: transactionConfig.status,
// 				payment_proof_images:
// 					paymentMethod === "GCash"
// 						? [
// 								faker.image.urlLoremFlickr({ category: "business" }),
// 								faker.image.urlLoremFlickr({ category: "technology" }),
// 						  ] // Always provide at least one image for GCash
// 						: [],
// 				external_reference:
// 					paymentMethod === "GCash"
// 						? `GCASH-${faker.string.alphanumeric(10).toUpperCase()}`
// 						: null,
// 				transaction_date: faker.date.recent({ days: 30 }),
// 				notes: faker.lorem.sentence(),
// 				created_by: admin._id,
// 				processed_at:
// 					transactionConfig.status === "Completed"
// 						? faker.date.recent({ days: 25 })
// 						: undefined,
// 				failed_at:
// 					transactionConfig.status === "Failed"
// 						? faker.date.recent({ days: 20 })
// 						: undefined,
// 				failure_reason:
// 					transactionConfig.status === "Failed"
// 						? faker.helpers.arrayElement([
// 								"Insufficient funds",
// 								"Payment gateway error",
// 								"Invalid payment details",
// 								"Network timeout",
// 						  ])
// 						: undefined,
// 			};

// 			// Set appropriate timestamps based on status
// 			if (transactionConfig.status === "Completed") {
// 				transactionData.processed_at = faker.date.recent({ days: 25 });
// 			} else if (transactionConfig.status === "Failed") {
// 				transactionData.failed_at = faker.date.recent({ days: 20 });
// 				transactionData.failure_reason = faker.helpers.arrayElement([
// 					"Insufficient funds",
// 					"Payment gateway error",
// 					"Invalid payment details",
// 					"Network timeout",
// 				]);
// 			}

// 			const transaction = new Transaction(transactionData);
// 			await transaction.save();
// 			createdTransactions.push(transaction);
// 		}

// 		// Create a few refund transactions
// 		const completedTransactions = createdTransactions.filter(
// 			(t) => t.status === "Completed"
// 		);

// 		for (let i = 0; i < Math.min(2, completedTransactions.length); i++) {
// 			const originalTransaction = completedTransactions[i];
// 			const refundAmount = Math.floor(originalTransaction.amount * 0.3); // 30% refund

// 			if (refundAmount > 0) {
// 				const refundTransaction = new Transaction({
// 					transaction_reference: `TXN-${Math.random()
// 						.toString(36)
// 						.substr(2, 8)
// 						.toUpperCase()}`,
// 					booking_id: originalTransaction.booking_id,
// 					customer_id: originalTransaction.customer_id,
// 					amount: refundAmount,
// 					transaction_type: "Refund",
// 					payment_method: originalTransaction.payment_method,
// 					status: "Completed",
// 					original_transaction_id: originalTransaction._id,
// 					payment_proof_images:
// 						originalTransaction.payment_method === "GCash"
// 							? [
// 									"https://via.placeholder.com/400x600/ffffff/000000?text=GCash+Refund+Receipt",
// 							  ]
// 							: [],
// 					refund_reason: faker.helpers.arrayElement([
// 						"Customer cancellation",
// 						"Service not delivered",
// 						"Quality issues",
// 						"Scheduling conflict",
// 					]),
// 					transaction_date: faker.date.recent({ days: 15 }),
// 					processed_at: faker.date.recent({ days: 10 }),
// 					refunded_at: faker.date.recent({ days: 10 }),
// 					created_by: admin._id,
// 				});

// 				await refundTransaction.save();
// 				createdTransactions.push(refundTransaction);

// 				// Update the original transaction to reflect the refund
// 				originalTransaction.refund_transaction_id =
// 					refundTransaction._id as mongoose.Types.ObjectId;
// 				originalTransaction.status = "Refunded";
// 				originalTransaction.refunded_at = refundTransaction.refunded_at;
// 				await originalTransaction.save();
// 			}
// 		}

// 		console.log(
// 			`💳 Seeded ${createdTransactions.length} transactions successfully!`
// 		);
// 		return createdTransactions;
// 	} catch (error) {
// 		console.error("❌ Failed to seed transactions:", error);
// 		throw error;
// 	}
// };

// async function runAll() {
// 	try {
// 		await connect();

// 		console.log("🧹 Clearing all collections...");
// 		await clearCollections();

// 		console.log("👤 Seeding users...");
// 		const superAdmin = await seedUsers();

// 		console.log("👥 Seeding customers...");
// 		await seedCustomers();

// 		console.log("📸 Seeding photographers...");
// 		await seedPhotographers();

// 		console.log("🛠️ Seeding services...");
// 		await seedServices();

// 		console.log("🎁 Seeding packages...");
// 		await seedPackages();

// 		console.log("📅 Seeding bookings...");
// 		await seedBookings(superAdmin);

// 		console.log("💳 Seeding transactions...");
// 		await seedTransactions(superAdmin);

// 		console.log("✅ All seeders completed successfully!");
// 	} catch (error) {
// 		console.error("❌ Seeding failed:", error);
// 	} finally {
// 		await disconnect();
// 	}
// }

// // ---------- Execute Seeder ----------
// runAll()
// 	.then(() => process.exit(0))
// 	.catch((error) => {
// 		console.error(error);
// 		process.exit(1);
// 	});

import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Customer } from "../models/Customer";
import {
	DayOfWeek,
	Photographer,
	WeeklySchedule,
} from "../models/Photographer";
import { Service } from "../models/Service";
import { Package } from "../models/Package";
import { Booking, BookingModel, BookingStatusEnum } from "../models/Booking";
import { ServiceCategoryEnum } from "../constants/service-category.constant";
import { faker } from "@faker-js/faker";
import { Role } from "../models/Role";
import {
	addMinutes,
	differenceInMinutes,
	format,
	isAfter,
	parse,
} from "date-fns";
import {
	PaymentMethodEnum,
	Transaction,
	TransactionStatus,
	TransactionType,
} from "../models/Transaction";

const MONGODB_URI =
	process.env.MONGODB_URI || "mongodb://localhost:27017/capstone-dev";

async function connect() {
	await mongoose.connect(MONGODB_URI);
	console.log("✅ Connected to MongoDB");
}

async function disconnect() {
	await mongoose.disconnect();
	console.log("🔌 Disconnected from MongoDB");
}

async function clearCollections() {
	await Promise.all([
		User.deleteMany({}),
		Customer.deleteMany({}),
		Photographer.deleteMany({}),
		Service.deleteMany({}),
		Package.deleteMany({}),
		Booking.deleteMany({}),
	]);
}

async function seedUsers() {
	// 1️⃣ Clear existing users
	await User.deleteMany({});

	// 2️⃣ Find the Role dynamically (example: "Super Admin" role)
	const role = await Role.findOne({ name: "Admin" });
	if (!role) {
		throw new Error("Role 'Super Admin' not found. Please seed roles first.");
	}

	// 3️⃣ Create superadmin user
	const superAdminPassword = await bcrypt.hash("Password_123", 10);
	const superAdmin = await User.create({
		username: "superadmin",
		email: "superadmin@yopmail.com",
		first_name: "Super",
		last_name: "Admin",
		mobile_number: "09171234567",
		password: superAdminPassword,
		role_id: role._id,
		is_active: true,
		created_by: new Types.ObjectId(),
		updated_by: new Types.ObjectId(),
	});

	const usersData = [
		{
			username: "admin_john",
			email: "john.admin@yopmail.com",
			first_name: "John",
			last_name: "Admin",
			mobile_number: "09180001111",
			password: "Password_123",
		},
		{
			username: "admin_jane",
			email: "jane.admin@yopmail.com",
			first_name: "Jane",
			last_name: "Admin",
			mobile_number: "09180002222",
			password: "Password_123",
		},
		{
			username: "staff_mike",
			email: "mike.staff@yopmail.com",
			first_name: "Mike",
			last_name: "Staff",
			mobile_number: "09180003333",
			password: "Staff123!",
		},
		{
			username: "staff_anna",
			email: "anna.staff@yopmail.com",
			first_name: "Anna",
			last_name: "Staff",
			mobile_number: "09180004444",
			password: "Staff123!",
		},
		{
			username: "staff_ryan",
			email: "ryan.staff@yopmail.com",
			first_name: "Ryan",
			last_name: "Staff",
			mobile_number: "09180005555",
			password: "Staff123!",
		},
		{
			username: "staff_lisa",
			email: "lisa.staff@yopmail.com",
			first_name: "Lisa",
			last_name: "Staff",
			mobile_number: "09180006666",
			password: "Staff123!",
		},
		{
			username: "staff_david",
			email: "david.staff@yopmail.com",
			first_name: "David",
			last_name: "Staff",
			mobile_number: "09180007777",
			password: "Staff123!",
		},
		{
			username: "staff_claire",
			email: "claire.staff@yopmail.com",
			first_name: "Claire",
			last_name: "Staff",
			mobile_number: "09180008888",
			password: "Staff123!",
		},
		{
			username: "staff_james",
			email: "james.staff@yopmail.com",
			first_name: "James",
			last_name: "Staff",
			mobile_number: "09180009999",
			password: "Staff123!",
		},
	];

	// 4️⃣ Hash passwords & attach created_by, role_id
	const usersToInsert = await Promise.all(
		usersData.map(async (user) => ({
			...user,
			password: await bcrypt.hash(user.password, 10),
			role_id: role._id,
			created_by: superAdmin._id,
			updated_by: superAdmin._id,
			is_active: true,
		}))
	);

	// 5️⃣ Insert users
	await User.insertMany(usersToInsert);

	return superAdmin;
}

export async function generateCustomerNumber(): Promise<string> {
	const today = new Date();
	const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

	// Generate a random 4-digit number
	const randomSequence = Math.floor(1000 + Math.random() * 9000); // between 1000-9999

	return `CUST-${dateStr}-${randomSequence}`;
}

async function seedCustomers() {
	await Customer.deleteMany({});

	const superAdmin = await User.findOne({ email: "superadmin@yopmail.com" });
	if (!superAdmin) {
		throw new Error("❌ Super admin not found. Seed users first!");
	}

	const customersData = [
		{
			email: "john.doe@yopmail.com",
			first_name: "John",
			last_name: "Doe",
			mobile_number: "09170000001",
			password: "Password_123",
			gender: "Male",
			address: "123 Mabini St.",
			city: "Makati",
			province: "Metro Manila",
			postal_code: "1200",
			country: "Philippines",
		},
		{
			email: "paul.santos@yopmail.com",
			first_name: "Paul",
			last_name: "Santos",
			mobile_number: "09170000002",
			password: "Password_123",
			gender: "Male",
			address: "456 Rizal Ave.",
			city: "Quezon City",
			province: "Metro Manila",
			postal_code: "1100",
			country: "Philippines",
		},
		{
			email: "angelica.reyes@yopmail.com",
			first_name: "Angelica",
			last_name: "Reyes",
			mobile_number: "09170000003",
			password: "Password_123",
			gender: "Female",
			address: "789 Bonifacio St.",
			city: "Pasig",
			province: "Metro Manila",
			postal_code: "1600",
		},
		{
			email: "john.dela.cruz@yopmail.com",
			first_name: "John",
			last_name: "Dela Cruz",
			mobile_number: "09170000004",
			password: "Password_123",
			gender: "Male",
			address: "101 Lapu-Lapu St.",
			city: "Taguig",
			province: "Metro Manila",
			postal_code: "1630",
		},
		{
			email: "maria.gonzales@yopmail.com",
			first_name: "Maria",
			last_name: "Gonzales",
			mobile_number: "09170000005",
			password: "Password_123",
			gender: "Female",
			address: "202 Maginhawa St.",
			city: "Quezon City",
			province: "Metro Manila",
			postal_code: "1101",
		},
		{
			email: "patrick.tan@yopmail.com",
			first_name: "Patrick",
			last_name: "Tan",
			mobile_number: "09170000006",
			password: "Password_123",
			gender: "Male",
			address: "303 Katipunan Ave.",
			city: "Quezon City",
			province: "Metro Manila",
		},
		{
			email: "lisa.fernandez@yopmail.com",
			first_name: "Lisa",
			last_name: "Fernandez",
			mobile_number: "09170000007",
			password: "Password_123",
			gender: "Female",
			address: "404 Lopez St.",
			city: "Mandaluyong",
			province: "Metro Manila",
		},
		{
			email: "mark.delosreyes@yopmail.com",
			first_name: "Mark",
			last_name: "Delos Reyes",
			mobile_number: "09170000008",
			password: "Password_123",
			gender: "Male",
			address: "505 Quirino Ave.",
			city: "Parañaque",
			province: "Metro Manila",
		},
		{
			email: "kristine.valdez@yopmail.com",
			first_name: "Kristine",
			last_name: "Valdez",
			mobile_number: "09170000009",
			password: "Password_123",
			gender: "Female",
			address: "606 Shaw Blvd.",
			city: "Pasig",
			province: "Metro Manila",
		},
		{
			email: "ricky.mendoza@yopmail.com",
			first_name: "Ricky",
			last_name: "Mendoza",
			mobile_number: "09170000010",
			password: "Password_123",
			gender: "Male",
			address: "707 Ayala Ave.",
			city: "Makati",
			province: "Metro Manila",
		},
		{
			email: "nina.cruz@yopmail.com",
			first_name: "Nina",
			last_name: "Cruz",
			mobile_number: "09170000011",
			password: "Password_123",
			gender: "Female",
			address: "808 Recto Ave.",
			city: "Manila",
			province: "Metro Manila",
		},
		{
			email: "alfred.lim@yopmail.com",
			first_name: "Alfred",
			last_name: "Lim",
			mobile_number: "09170000012",
			password: "Password_123",
			gender: "Male",
			address: "909 Taft Ave.",
			city: "Manila",
			province: "Metro Manila",
		},
		{
			email: "michelle.ramos@yopmail.com",
			first_name: "Michelle",
			last_name: "Ramos",
			mobile_number: "09170000013",
			password: "Password_123",
			gender: "Female",
			address: "111 Legazpi St.",
			city: "Makati",
			province: "Metro Manila",
		},
		{
			email: "ken.soriano@yopmail.com",
			first_name: "Ken",
			last_name: "Soriano",
			mobile_number: "09170000014",
			password: "Password_123",
			gender: "Male",
			address: "222 P. Burgos St.",
			city: "Mandaluyong",
			province: "Metro Manila",
		},
		{
			email: "catherine.uy@yopmail.com",
			first_name: "Catherine",
			last_name: "Uy",
			mobile_number: "09170000015",
			password: "Password_123",
			gender: "Female",
			address: "333 Ortigas Ave.",
			city: "Pasig",
			province: "Metro Manila",
		},
	];

	const customersToInsert = await Promise.all(
		customersData.map(async (customer) => ({
			...customer,
			customer_no: await generateCustomerNumber(),
			password: await bcrypt.hash(customer.password, 10),
			created_by: superAdmin._id,
			is_active: true,
		}))
	);

	await Customer.insertMany(customersToInsert);
}

//------------------------------
// HELPERS
//------------------------------

const defaultWeeklySchedule = [
	{
		day_of_week: "Monday",
		start_time: "09:00",
		end_time: "17:00",
		is_available: true,
	},
	{
		day_of_week: "Tuesday",
		start_time: "09:00",
		end_time: "17:00",
		is_available: true,
	},
	{
		day_of_week: "Wednesday",
		start_time: "09:00",
		end_time: "17:00",
		is_available: true,
	},
	{
		day_of_week: "Thursday",
		start_time: "09:00",
		end_time: "17:00",
		is_available: true,
	},
	{
		day_of_week: "Friday",
		start_time: "09:00",
		end_time: "17:00",
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
];

// Random specialties (1–3 categories)
const getRandomSpecialties = () => {
	const categories = Object.values(ServiceCategoryEnum);
	const count = faker.number.int({ min: 1, max: 3 });
	return faker.helpers.arrayElements(categories, count);
};

export const seedPhotographers = async () => {
	try {
		// ✅ Fetch the real Admin (the one created first in seedUsers)
		const adminUser = await User.findOne({ email: "superadmin@yopmail.com" })
			.sort({ created_at: 1 })
			.lean();
		if (!adminUser)
			throw new Error("Admin user not found — please seed users first.");

		const photographers = Array.from({ length: 15 }).map(() => ({
			name: faker.person.fullName(),
			email: faker.internet.email().toLowerCase(),
			mobile_number: `+63 9${faker.string.numeric(9)}`,
			bio: faker.lorem.sentences(2),
			profile_image: `https://source.unsplash.com/400x400/?portrait,professional`,
			specialties: getRandomSpecialties(),
			photo_gallery: Array.from({
				length: faker.number.int({ min: 3, max: 9 }),
			}).map(() => {
				const keyword = faker.helpers.arrayElement([
					"portrait",
					"studio",
					"fashion",
					"wedding",
					"outdoor",
					"photography",
					"model",
					"event",
					"beauty",
					"creative",
				]);
				return `https://source.unsplash.com/800x600/?${keyword}`;
			}),
			weekly_schedule: defaultWeeklySchedule,
			date_overrides: [
				{
					date: faker.date.soon({ days: 60 }),
					is_available: false,
					reason: "Vacation",
					notes: "Out of town for a client shoot.",
				},
			],
			booking_lead_time_hours: faker.number.int({ min: 12, max: 72 }),
			is_active: true,
			created_by: adminUser._id,
			updated_by: null,
			deleted_by: null,
			retrieved_by: null,
			deleted_at: null,
			retrieved_at: null,
		}));

		// const photographers = Array.from({ length: 15 }).map(() => ({
		// 	name: faker.person.fullName(),
		// 	email: faker.internet.email().toLowerCase(),
		// 	mobile_number: `+63 9${faker.string.numeric(9)}`,
		// 	bio: faker.lorem.sentences(2),
		// 	profile_image: `https://source.unsplash.com/400x400/?portrait,professional`,
		// 	specialties: getRandomSpecialties(),
		// 	photo_gallery: faker.helpers.arrayElements(
		// 		Array.from({ length: 12 }).map(
		// 			(_, i) =>
		// 				`https://source.unsplash.com/800x600/?photography,${
		// 					i % 2 === 0 ? "wedding" : "portrait"
		// 				}`
		// 		),
		// 		faker.number.int({ min: 3, max: 9 })
		// 	),
		// 	weekly_schedule: defaultWeeklySchedule,
		// 	date_overrides: [
		// 		{
		// 			date: faker.date.soon({ days: 60 }),
		// 			is_available: false,
		// 			reason: "Vacation",
		// 			notes: "Out of town for a client shoot.",
		// 		},
		// 	],
		// 	booking_lead_time_hours: faker.number.int({ min: 12, max: 72 }),
		// 	is_active: true,
		// 	created_by: adminUser._id,
		// 	updated_by: null,
		// 	deleted_by: null,
		// 	retrieved_by: null,
		// 	deleted_at: null,
		// 	retrieved_at: null,
		// }));

		await Photographer.insertMany(photographers);
		console.log(
			`📸 Seeded ${photographers.length} photographers successfully!`
		);
	} catch (error) {
		console.error("❌ Failed to seed photographers:", error);
		throw error;
	}
};

export const seedServices = async () => {
	try {
		const admin = await User.findOne({ email: "superadmin@yopmail.com" });
		if (!admin) {
			console.error("❌ No admin found. Please seed users first.");
			return;
		}

		const servicesData = [
			{
				name: "Wedding Photography",
				category: ServiceCategoryEnum.Photography,
				price: 15000,
				old_price: 18000,
				duration_minutes: 240,
				description:
					"Capture your special day with professional wedding photography.",
				service_gallery: [
					"https://plus.unsplash.com/premium_photo-1675003662150-2569448d2b3b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8d2VkZGluZ3xlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2VkZGluZ3xlbnwwfHwwfHx8MA%3D%3D",
					"https://plus.unsplash.com/premium_photo-1663076211121-36754a46de8d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8d2VkZGluZ3xlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1519741497674-611481863552?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8d2VkZGluZ3xlbnwwfHwwfHx8MA%3D%3D",
				],
			},
			{
				name: "Prenup Session",
				category: ServiceCategoryEnum.Photography,
				price: 8000,
				old_price: 9500,
				duration_minutes: 180,
				description: "Elegant and creative prenup photo sessions.",
				service_gallery: [
					"https://images.unsplash.com/photo-1671116302821-d6fc9a003505?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cHJlbnVwfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1584141805555-4918fd4679a1?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cHJlbnVwfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1557151058-d6d77f40ffc0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cHJlbnVwfGVufDB8fDB8fHww",
				],
			},
			{
				name: "Corporate Headshots",
				category: ServiceCategoryEnum.Photography,
				price: 4000,
				old_price: 5000,
				duration_minutes: 90,
				description:
					"Professional headshots for corporate profiles and resumes.",
				service_gallery: [
					"https://images.unsplash.com/photo-1508385082359-f38ae991e8f2?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Q09SUE9SQVRFfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1548783300-70b41bc84f56?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8Q09SUE9SQVRFfGVufDB8fDB8fHww",
				],
			},
			{
				name: "Birthday Event Coverage",
				category: ServiceCategoryEnum.Equipment,
				price: 12000,
				old_price: 13000,
				duration_minutes: 300,
				description:
					"Full event coverage for birthdays and private celebrations.",
				service_gallery: [
					"https://images.unsplash.com/photo-1556125574-d7f27ec36a06?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YmlydGhkYXklMjBldmVudHxlbnwwfHwwfHx8MA%3D%3D",
					"https://plus.unsplash.com/premium_photo-1681841200807-458beeca3d80?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8YmlydGhkYXklMjBldmVudHxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGJpcnRoZGF5JTIwZXZlbnR8ZW58MHx8MHx8fDA%3D",
				],
			},
			{
				name: "Video Editing Service",
				category: ServiceCategoryEnum.Other,
				price: 6000,
				old_price: 7500,
				duration_minutes: 120,
				description:
					"Professional video editing for social media or marketing campaigns.",
				service_gallery: [
					"https://images.unsplash.com/photo-1574717025058-2f8737d2e2b7?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8VklERU8lMjBFRElUSU5HfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1490810194309-344b3661ba39?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8VklERU8lMjBFRElUSU5HfGVufDB8fDB8fHww",
				],
			},
			{
				name: "Corporate Video Production",
				category: ServiceCategoryEnum.Photography,
				price: 20000,
				old_price: 25000,
				duration_minutes: 360,
				description: "High-quality corporate video creation and production.",
				service_gallery: [
					"https://plus.unsplash.com/premium_photo-1711061959382-0de7a4bddccf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Q09SUE9SQVRFJTIwVklERU8lMjBQUk9EVUNUSU9OfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1654723011663-2ac59c385b16?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Q09SUE9SQVRFJTIwVklERU8lMjBQUk9EVUNUSU9OfGVufDB8fDB8fHww",
					"https://plus.unsplash.com/premium_photo-1691223714387-a74006933ffb?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTN8fENPUlBPUkFURSUyMFZJREVPJTIwUFJPRFVDVElPTnxlbnwwfHwwfHx8MA%3D%3D",
				],
			},
			{
				name: "Drone Aerial Shoot",
				category: ServiceCategoryEnum.Equipment,
				price: 10000,
				old_price: 12000,
				duration_minutes: 180,
				description: "Stunning aerial shots with 4K drone cameras.",
				service_gallery: [
					"https://images.unsplash.com/photo-1721680838651-1220592a49db?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZHJvbmUlMjBhZXJpYWwlMjBzaG9vdHxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1713016601340-bf05022984cf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZHJvbmUlMjBhZXJpYWwlMjBzaG9vdHxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1713016601373-d7fc233d7fd1?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGRyb25lJTIwYWVyaWFsJTIwc2hvb3R8ZW58MHx8MHx8fDA%3D",
				],
			},
			{
				name: "Product Photography",
				category: ServiceCategoryEnum.Photography,
				price: 7000,
				old_price: 8500,
				duration_minutes: 120,
				description:
					"Detailed product photography for e-commerce and catalogs.",
				service_gallery: [
					"https://plus.unsplash.com/premium_photo-1681711647066-ef84575c0d95?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8UFJPRFVDVCUyMFBIT1RPR1JBUEhZfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8UFJPRFVDVCUyMFBIT1RPR1JBUEhZfGVufDB8fDB8fHww",
					"https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8UFJPRFVDVCUyMFBIT1RPR1JBUEhZfGVufDB8fDB8fHww",
				],
			},
			{
				name: "Family Portrait Session",
				category: ServiceCategoryEnum.Photography,
				price: 5000,
				old_price: 6000,
				duration_minutes: 120,
				description:
					"Classic and modern family portraits in studio or outdoor.",
				service_gallery: [
					"https://source.unsplash.com/800x600/?family,portrait",
					"https://source.unsplash.com/800x600/?family,photography",
					"https://source.unsplash.com/800x600/?outdoor,portrait",
				],
			},
			{
				name: "Event Videography",
				category: ServiceCategoryEnum.Photography,
				price: 18000,
				old_price: 20000,
				duration_minutes: 360,
				description:
					"Comprehensive video coverage for weddings, birthdays, and corporate events.",
				service_gallery: [
					"https://images.unsplash.com/photo-1588979355313-6711a095465f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZmFtaWx5JTIwcG9ydHJhaXR8ZW58MHx8MHx8fDA%3D",
					"https://plus.unsplash.com/premium_photo-1661632569377-c03195fd3394?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8ZmFtaWx5JTIwcG9ydHJhaXR8ZW58MHx8MHx8fDA%3D",
					"https://plus.unsplash.com/premium_photo-1679415150611-9b24a9d3ce48?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8ZmFtaWx5JTIwcG9ydHJhaXR8ZW58MHx8MHx8fDA%3D",
				],
			},
			{
				name: "Engagement Video Teaser",
				category: ServiceCategoryEnum.Photography,
				price: 10000,
				old_price: 12000,
				duration_minutes: 120,
				description:
					"Short engagement video teasers perfect for social media sharing.",
				service_gallery: [
					"https://plus.unsplash.com/premium_photo-1676690611480-38582b52220f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8RU5HQUdFTUVOVHxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1529519195486-16945f0fb37f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8RU5HQUdFTUVOVHxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1614929511547-974944a54c92?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8RU5HQUdFTUVOVHxlbnwwfHwwfHx8MA%3D%3D",
				],
			},
			{
				name: "Photo Restoration",
				category: ServiceCategoryEnum.Other,
				price: 2500,
				old_price: 3000,
				duration_minutes: 120,
				description: "Restore old and damaged photos to life.",
				service_gallery: [
					"https://plus.unsplash.com/premium_photo-1681996729692-05040af4f3bc?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cGhvdG8lMjByZXN0b3JhdGlvbnxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1670405564800-bbb09765317b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cGhvdG8lMjByZXN0b3JhdGlvbnxlbnwwfHwwfHx8MA%3D%3D",
				],
			},
			{
				name: "Short Film Production",
				category: ServiceCategoryEnum.Photography,
				price: 25000,
				old_price: 30000,
				duration_minutes: 480,
				description:
					"Full-scale short film production from concept to post-editing.",
				service_gallery: [
					"https://plus.unsplash.com/premium_photo-1755943759084-ce02e3f09c3c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8U0hPUlQlMjBGSUxNJTIwUFJPRHxlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1686061594212-8904e38bc1f2?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fFNIT1JUJTIwRklMTSUyMFBST0R8ZW58MHx8MHx8fDA%3D",
					"https://images.unsplash.com/photo-1624357590862-7ad826c99807?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fFNIT1JUJTIwRklMTSUyMFBST0R8ZW58MHx8MHx8fDA%3D",
				],
			},
			{
				name: "Corporate Live Streaming",
				category: ServiceCategoryEnum.Equipment,
				price: 15000,
				old_price: 18000,
				duration_minutes: 240,
				description:
					"Professional live streaming for corporate events and webinars.",
				service_gallery: [
					"https://images.unsplash.com/photo-1578920040242-fa9c1ccbe5b5?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8JTIyQ29ycG9yYXRlJTIwTGl2ZSUyMFN0cmVhbWluZ3xlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1728887280230-c22755ca5e4a?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8JTIyQ29ycG9yYXRlJTIwTGl2ZSUyMFN0cmVhbWluZ3xlbnwwfHwwfHx8MA%3D%3D",
					"https://images.unsplash.com/photo-1750186649188-cd605a1390ba?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fCUyMkNvcnBvcmF0ZSUyMExpdmUlMjBTdHJlYW1pbmd8ZW58MHx8MHx8fDA%3D",
				],
			},
			{
				name: "Model Portfolio Shoot",
				category: ServiceCategoryEnum.Photography,
				price: 8000,
				old_price: 10000,
				duration_minutes: 150,
				description:
					"Stylized portfolio photography for models and influencers.",
				service_gallery: [
					"https://images.unsplash.com/photo-1635420714630-39f59e9f4600?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bW9kZWwlMjBwb3J0Zm9saW98ZW58MHx8MHx8fDA%3D",
					"https://images.unsplash.com/photo-1630025081070-ea898abea9a0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8bW9kZWwlMjBwb3J0Zm9saW98ZW58MHx8MHx8fDA%3D",
					"https://images.unsplash.com/photo-1630025081140-46c3f2701607?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8bW9kZWwlMjBwb3J0Zm9saW98ZW58MHx8MHx8fDA%3D",
				],
			},
		].map((service) => ({
			...service,
			is_available: true,
			is_active: true,
			created_by: admin._id,
			updated_by: null,
			deleted_by: null,
			retrieved_by: null,
			deleted_at: null,
			retrieved_at: null,
		}));

		await Service.deleteMany({});
		await Service.insertMany(servicesData);

		console.log("✅ Services seeded successfully");
	} catch (error) {
		console.error("❌ Error seeding services:", error);
	}
};

export const seedPackages = async () => {
	try {
		const admin = await User.findOne({ email: "superadmin@yopmail.com" });

		if (!admin) {
			console.error("❌ No admin found. Please seed users first.");
			return;
		}

		const services = await Service.find({});
		if (services.length === 0) {
			console.error("❌ No services found. Please seed services first.");
			return;
		}

		const getRandomServices = (count: number) => {
			const shuffled = faker.helpers.shuffle(services);
			return shuffled.slice(0, count).map((service) => {
				const quantity = faker.number.int({ min: 1, max: 3 });
				const total_price = service.price * quantity;

				return {
					service_id: service._id,
					quantity,
					price_per_unit: service.price,
					total_price,
					duration_minutes: service.duration_minutes || 60,
				};
			});
		};

		const packagesData = [
			{
				name: "Classic Wedding Package",
				description: "A timeless package that covers your wedding essentials.",
				image:
					"https://plus.unsplash.com/premium_photo-1663076211121-36754a46de8d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8d2VkZGluZ3xlbnwwfHwwfHx8MA%3D%3D,couple",
				services: getRandomServices(3),
				looks: 2,
			},
			{
				name: "Premium Wedding Package",
				description:
					"Complete wedding photo and video coverage with editing services.",
				image:
					"https://images.unsplash.com/photo-1717261664981-12b23eed3092?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fENsYXNzaWMlMjBXZWRkaW5nJTIwUGFja2FnZXxlbnwwfHwwfHx8MA%3D%3D",
				services: getRandomServices(4),
				looks: 3,
			},
			{
				name: "Corporate Event Package",
				description:
					"Professional coverage for corporate events, seminars, and launches.",
				image:
					"https://images.unsplash.com/photo-1718670013939-954787e56385?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Q29ycG9yYXRlJTIwRXZlbnQlMjBQYWNrYWdlfGVufDB8fDB8fHww",
				services: getRandomServices(3),
				looks: 1,
			},
			{
				name: "Birthday Celebration Package",
				description:
					"Capture special moments from birthdays and private events.",
				image:
					"https://images.unsplash.com/photo-1559455208-f82921450174?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8QmlydGhkYXklMjBDZWxlYnJhdGlvbiUyMFBhY2thZ2V8ZW58MHx8MHx8fDA%3D",
				services: getRandomServices(2),
				looks: 1,
			},
			{
				name: "Prenup Package",
				description:
					"Creative pre-wedding shoot with stylist and location coverage.",
				image:
					"https://plus.unsplash.com/premium_photo-1737303072681-5cfd81276767?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8UHJlbnVwJTIwUGFja2FnZXxlbnwwfHwwfHx8MA%3D%3D",
				services: getRandomServices(3),
				looks: 2,
			},
			{
				name: "Product Shoot Package",
				description:
					"Perfect for brands looking for professional product photography.",
				image:
					"https://plus.unsplash.com/premium_photo-1676490643202-34630ee74af1?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTN8fHByb2R1Y3QlMjBzaG9vdHxlbnwwfHwwfHx8MA%3D%3D",
				services: getRandomServices(2),
				looks: 1,
			},
			{
				name: "Corporate Branding Package",
				description:
					"Includes headshots, group photos, and brand visual identity shots.",
				image:
					"https://images.unsplash.com/photo-1731012189558-c2d035998542?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8Y29ycG9yYXRlJTIwYnJhbmRpbmd8ZW58MHx8MHx8fDA%3D",
				services: getRandomServices(3),
				looks: 1,
			},
			{
				name: "Family Portrait Package",
				description: "Studio or outdoor portrait session for the whole family.",
				image:
					"https://images.unsplash.com/photo-1603367563698-67012943fd67?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fEZBTUlMWSUyMFBPUlRSQUlUfGVufDB8fDB8fHww",
				services: getRandomServices(2),
				looks: 1,
			},
			{
				name: "Engagement Highlights Package",
				description:
					"Capture the essence of your engagement with photo and video coverage.",
				image:
					"https://plus.unsplash.com/premium_photo-1676690611480-38582b52220f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8RU5HQUdFTUVOVHxlbnwwfHwwfHx8MA%3D%3D,couple,love",
				services: getRandomServices(3),
				looks: 2,
			},
			{
				name: "Fashion Lookbook Package",
				description:
					"For models and designers who want professional portfolio shots.",
				image:
					"https://images.unsplash.com/photo-1664548324942-4aaa946233e5?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZW5nYWdlbWVudCUyMGhpZ2hsaWdodHN8ZW58MHx8MHx8fDA%3D",
				services: getRandomServices(4),
				looks: 5,
			},
		].map((pkg) => {
			const total_price = pkg.services.reduce(
				(sum, s) => sum + s.total_price,
				0
			);

			return {
				...pkg,
				package_price: total_price,
				is_active: true,
				created_by: admin._id,
				updated_by: null,
				deleted_by: null,
				retrieved_by: null,
				deleted_at: null,
				retrieved_at: null,
			};
		});

		await Package.deleteMany({});
		await Package.insertMany(packagesData);

		console.log("✅ Packages seeded successfully");
	} catch (error) {
		console.error("❌ Error seeding packages:", error);
	}
};

//--------------------------
// HELPER
//--------------------------
export async function getAvailableSlotsForSeeder(
	photographer: {
		_id: mongoose.Types.ObjectId;
		weekly_schedule: WeeklySchedule;
		date_overrides?: {
			date: Date;
			is_available: boolean;
			reason?: string;
			notes?: string;
			custom_hours?: WeeklySchedule;
		}[];
	},
	targetDate: Date,
	sessionDurationMinutes: number = 120
): Promise<string[]> {
	const availableSlots: string[] = [];

	const getDayName = (dayNum: number): DayOfWeek => {
		const days: DayOfWeek[] = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];
		return days[dayNum];
	};

	const dayOfWeek = getDayName(targetDate.getDay());
	const duration = sessionDurationMinutes;

	let schedule: WeeklySchedule[0] | undefined;

	if (photographer.date_overrides) {
		const override = photographer.date_overrides.find(
			(o) => o.date.toDateString() === targetDate.toDateString()
		);
		if (override) {
			if (!override.is_available) return [];
			schedule =
				override.custom_hours?.find((s) => s.day_of_week === dayOfWeek) ||
				photographer.weekly_schedule.find((s) => s.day_of_week === dayOfWeek);
		} else {
			schedule = photographer.weekly_schedule.find(
				(s) => s.day_of_week === dayOfWeek
			);
		}
	} else {
		schedule = photographer.weekly_schedule.find(
			(s) => s.day_of_week === dayOfWeek
		);
	}

	if (!schedule || !schedule.is_available) return [];

	const startOfDay = new Date(targetDate);
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(targetDate);
	endOfDay.setHours(23, 59, 59, 999);

	const existingBookings = await Booking.find({
		photographer_id: photographer._id,
		booking_date: { $gte: startOfDay, $lte: endOfDay },
		status: { $nin: ["Cancelled", "Rejected"] },
	}).select("start_time end_time session_duration_minutes");

	const bookedTimeRanges = existingBookings.map((booking) => {
		const startDate = parse(booking.start_time, "HH:mm", targetDate);
		const endDate = addMinutes(
			startDate,
			booking.session_duration_minutes || 120
		);
		return { start: startDate, end: endDate };
	});

	const workStart = parse(schedule.start_time, "HH:mm", targetDate);
	const workEnd = parse(schedule.end_time, "HH:mm", targetDate);

	let current = workStart;
	while (!isAfter(addMinutes(current, duration), workEnd)) {
		const potentialEnd = addMinutes(current, duration);

		let hasConflict = bookedTimeRanges.some(
			(booked) => current < booked.end && potentialEnd > booked.start
		);

		if (!hasConflict) {
			availableSlots.push(
				`${format(current, "HH:mm")} - ${format(potentialEnd, "HH:mm")}`
			);
		}

		current = addMinutes(current, 30);
	}

	return availableSlots;
}

export const seedBookings = async (admin: any) => {
	const photographers = await Photographer.find();
	const customers = await Customer.find();
	const users = await User.find();
	const services = await Service.find();

	const createdBookings: BookingModel[] = [];

	for (let i = 0; i < 5; i++) {
		const customer = faker.helpers.arrayElement(customers);
		const createdBy = admin || faker.helpers.arrayElement(users);

		// Pick random date within 30 days
		const bookingDate = faker.date.soon({ days: 30 });
		const photographer = faker.helpers.arrayElement(
			photographers
		) as unknown as {
			_id: mongoose.Types.ObjectId;
			name: string;
			weekly_schedule: WeeklySchedule;
			date_overrides?: {
				date: Date;
				is_available: boolean;
				reason?: string;
				notes?: string;
				custom_hours?: WeeklySchedule;
			}[];
		};

		// Get available slots for the photographer on the selected date
		const availableSlots = await getAvailableSlotsForSeeder(
			photographer,
			bookingDate
		);

		if (!availableSlots.length) {
			console.warn("No available slots for photographer:", photographer.name);
			continue;
		}

		// Select a random slot from the available slots
		const selectedSlot = faker.helpers.arrayElement(availableSlots);

		// Extract start and end times from the selected slot
		const [start_time, end_time] = selectedSlot.split(" - ");

		// Select a random service and calculate its details
		const service = faker.helpers.arrayElement(services);
		const quantity = faker.number.int({ min: 1, max: 3 });

		const servicesList = [
			{
				service_id: service._id,
				quantity,
				price_per_unit: service.price,
				total_price: service.price * quantity,
				duration_minutes: service.duration_minutes || 60,
			},
		];

		// Calculate pricing details
		const totalAmount = servicesList.reduce((sum, s) => sum + s.total_price, 0);
		const discountAmount = faker.number.int({ min: 0, max: 300 });
		const finalAmount = Math.max(totalAmount - discountAmount, 0);

		// Calculate session duration
		const slotParts = selectedSlot.split(" - ");
		const startDate = parse(slotParts[0], "HH:mm", bookingDate);
		const endDate = parse(slotParts[1], "HH:mm", bookingDate);
		const durationMinutes = differenceInMinutes(endDate, startDate);

		// Create the booking
		const booking = new Booking({
			booking_reference: `BK-${faker.string.alpha(8).toUpperCase()}`,
			customer_id: customer._id,
			photographer_id: photographer._id,
			services: servicesList,
			is_customized: true,
			customization_notes: faker.lorem.sentence(),
			booking_date: bookingDate,
			start_time,
			end_time,
			session_duration_minutes: Math.min(durationMinutes, 480),
			location: faker.location.streetAddress(),
			theme: faker.helpers.arrayElement([
				"Studio",
				"Outdoor",
				"Event",
				"Family",
				"Wedding",
			]),
			special_requests: faker.lorem.sentence(),
			status: faker.helpers.arrayElement(Object.values(BookingStatusEnum)),
			total_amount: totalAmount,
			discount_amount: discountAmount,
			final_amount: finalAmount,
			created_by: createdBy._id,
		});

		await booking.save();
		createdBookings.push(booking);
	}

	return createdBookings;
};

export const seedTransactions = async (admin: any) => {
	try {
		// Clear existing transactions
		await Transaction.deleteMany({});

		const bookings = await Booking.find().populate("customer_id");
		if (bookings.length === 0) {
			console.error("❌ No bookings found. Please seed bookings first.");
			return;
		}

		const createdTransactions = [];

		// Create at least 8 transactions across different bookings
		for (let i = 0; i < Math.min(8, bookings.length); i++) {
			const booking = bookings[i];

			// Generate a unique transaction reference
			const generateTransactionRef = () => {
				const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
				return `TXN-${randomStr}`;
			};

			// Create different types of transactions
			const transactionTypes = [
				{
					type: "Payment" as TransactionType,
					amount: booking.final_amount, // Full payment
					status: "Completed" as TransactionStatus,
				},
				{
					type: "Partial" as TransactionType,
					amount: Math.floor(booking.final_amount * 0.5), // 50% partial payment
					status: "Completed" as TransactionStatus,
				},
				{
					type: "Balance" as TransactionType,
					amount: Math.floor(booking.final_amount * 0.5), // Remaining balance
					status: "Completed" as TransactionStatus,
				},
				{
					type: "Payment" as TransactionType,
					amount: booking.final_amount,
					status: "Pending" as TransactionStatus,
				},
				{
					type: "Payment" as TransactionType,
					amount: booking.final_amount,
					status: "Failed" as TransactionStatus,
				},
			];

			const transactionConfig = transactionTypes[i % transactionTypes.length];

			// Ensure amount doesn't exceed remaining balance for payment types
			let transactionAmount = transactionConfig.amount;
			if (["Payment", "Partial", "Balance"].includes(transactionConfig.type)) {
				// Check existing completed transactions for this booking
				const existingTransactions = await Transaction.find({
					booking_id: booking._id,
					status: "Completed",
					transaction_type: { $in: ["Payment", "Partial", "Balance"] },
				});

				const totalPaid = existingTransactions.reduce(
					(sum, txn) => sum + txn.amount,
					0
				);
				const remainingBalance = booking.final_amount - totalPaid;

				// Adjust amount if it would exceed remaining balance
				if (transactionAmount > remainingBalance) {
					transactionAmount = remainingBalance;
				}
			}

			// Skip if no remaining balance for payment transactions
			if (
				transactionAmount <= 0 &&
				["Payment", "Partial", "Balance"].includes(transactionConfig.type)
			) {
				continue;
			}

			const paymentMethod = faker.helpers.arrayElement(
				Object.values(PaymentMethodEnum)
			);

			const transactionData = {
				transaction_reference: generateTransactionRef(),
				booking_id: booking._id,
				customer_id: booking.customer_id._id,
				amount: transactionAmount,
				transaction_type: transactionConfig.type,
				payment_method: paymentMethod,
				status: transactionConfig.status,
				payment_proof_images:
					paymentMethod === "GCash"
						? [
								`https://i.pinimg.com/736x/d9/6f/b4/d96fb4c51047e29ad5fec5234ff25760.jpg`,
								`https://i.pinimg.com/1200x/d4/2f/48/d42f48517e638c654ceb46ce481ec608.jpg`,
						  ]
						: [
								"https://plus.unsplash.com/premium_photo-1663126695918-aff6924f33b5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470",
						  ],
				external_reference:
					paymentMethod === "GCash"
						? `GCASH-${faker.string.alphanumeric(10).toUpperCase()}`
						: null,
				transaction_date: faker.date.recent({ days: 30 }),
				notes: faker.lorem.sentence(),
				created_by: admin._id,
				processed_at:
					transactionConfig.status === "Completed"
						? faker.date.recent({ days: 25 })
						: undefined,
				failed_at:
					transactionConfig.status === "Failed"
						? faker.date.recent({ days: 20 })
						: undefined,
				failure_reason:
					transactionConfig.status === "Failed"
						? faker.helpers.arrayElement([
								"Insufficient funds",
								"Payment gateway error",
								"Invalid payment details",
								"Network timeout",
						  ])
						: undefined,
			};

			// Set appropriate timestamps based on status
			if (transactionConfig.status === "Completed") {
				transactionData.processed_at = faker.date.recent({ days: 25 });
			} else if (transactionConfig.status === "Failed") {
				transactionData.failed_at = faker.date.recent({ days: 20 });
				transactionData.failure_reason = faker.helpers.arrayElement([
					"Insufficient funds",
					"Payment gateway error",
					"Invalid payment details",
					"Network timeout",
				]);
			}

			const transaction = new Transaction(transactionData);
			await transaction.save();
			createdTransactions.push(transaction);
		}

		// Create a few refund transactions
		const completedTransactions = createdTransactions.filter(
			(t) => t.status === "Completed"
		);

		for (let i = 0; i < Math.min(2, completedTransactions.length); i++) {
			const originalTransaction = completedTransactions[i];
			const refundAmount = Math.floor(originalTransaction.amount * 0.3); // 30% refund

			if (refundAmount > 0) {
				const refundTransaction = new Transaction({
					transaction_reference: `TXN-${Math.random()
						.toString(36)
						.substr(2, 8)
						.toUpperCase()}`,
					booking_id: originalTransaction.booking_id,
					customer_id: originalTransaction.customer_id,
					amount: refundAmount,
					transaction_type: "Refund",
					payment_method: originalTransaction.payment_method,
					status: "Completed",
					original_transaction_id: originalTransaction._id,
					payment_proof_images:
						originalTransaction.payment_method === "GCash"
							? [
									`https://i.pinimg.com/736x/d9/6f/b4/d96fb4c51047e29ad5fec5234ff25760.jpg`,
							  ]
							: [
									"https://plus.unsplash.com/premium_photo-1663126695918-aff6924f33b5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470",
							  ],
					refund_reason: faker.helpers.arrayElement([
						"Customer cancellation",
						"Service not delivered",
						"Quality issues",
						"Scheduling conflict",
					]),
					transaction_date: faker.date.recent({ days: 15 }),
					processed_at: faker.date.recent({ days: 10 }),
					refunded_at: faker.date.recent({ days: 10 }),
					created_by: admin._id,
				});

				await refundTransaction.save();
				createdTransactions.push(refundTransaction);

				// Update the original transaction to reflect the refund
				originalTransaction.refund_transaction_id =
					refundTransaction._id as mongoose.Types.ObjectId;
				originalTransaction.status = "Refunded";
				originalTransaction.refunded_at = refundTransaction.refunded_at;
				await originalTransaction.save();
			}
		}

		console.log(
			`💳 Seeded ${createdTransactions.length} transactions successfully!`
		);
		return createdTransactions;
	} catch (error) {
		console.error("❌ Failed to seed transactions:", error);
		throw error;
	}
};

async function runAll() {
	try {
		await connect();

		console.log("🧹 Clearing all collections...");
		await clearCollections();

		console.log("👤 Seeding users...");
		const superAdmin = await seedUsers();

		console.log("👥 Seeding customers...");
		await seedCustomers();

		console.log("📸 Seeding photographers...");
		await seedPhotographers();

		console.log("🛠️ Seeding services...");
		await seedServices();

		console.log("🎁 Seeding packages...");
		await seedPackages();

		console.log("📅 Seeding bookings...");
		await seedBookings(superAdmin);

		console.log("💳 Seeding transactions...");
		await seedTransactions(superAdmin);

		console.log("✅ All seeders completed successfully!");
	} catch (error) {
		console.error("❌ Seeding failed:", error);
	} finally {
		await disconnect();
	}
}

// ---------- Execute Seeder ----------
runAll()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
