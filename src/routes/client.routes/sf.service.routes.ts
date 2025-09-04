import { Router, Request, NextFunction } from "express";
import { Service } from "../../models/Service";
import { MetaData, TypedResponse } from "../../types/base.types";

import { customError } from "../../middleware/errorHandler";

const router = Router();

type ServiceListResponse = {
	id: string;
	name: string;
	description?: string | null;
	category: string;
	is_available: boolean;
};

type CategorySummary = {
	category: string;
	services: ServiceListResponse[];
	total_services: number;
	available_services: number;
};

// ==================== PUBLIC/CUSTOMER ENDPOINTS ====================

// GET /api/services/browse (Public - for clients to browse available services)
router.get(
	"/browse",
	async (
		req: Request,
		res: TypedResponse<ServiceListResponse[]>,
		next: NextFunction
	) => {
		try {
			const {
				category,
				available_only = "true",
				search,
				sort_by = "name",
				sort_order = "asc",
			} = req.query;

			// Build filter for public browsing
			const filter: any = {};
			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			if (category && category !== "all") {
				filter.category = category;
			}

			if (search) {
				filter.$or = [
					{ name: { $regex: search, $options: "i" } },
					{ description: { $regex: search, $options: "i" } },
				];
			}

			// Build sort
			const sortObj: any = {};
			sortObj[sort_by as string] = sort_order === "desc" ? -1 : 1;

			const services = await Service.find(filter)
				.select("name description category is_available")
				.sort(sortObj)
				.lean();

			const servicesResponse: ServiceListResponse[] = services.map(
				({ _id: id, ...service }) => ({
					id: id.toString(),
					...service,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Services fetched successfully!",
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching services for browsing:", error);
			next(error);
		}
	}
);

// GET /api/services/categories (Public - get all categories with service counts)
router.get(
	"/categories",
	async (
		req: Request,
		res: TypedResponse<CategorySummary[]>,
		next: NextFunction
	) => {
		try {
			const { available_only = "true" } = req.query;

			const filter: any = {};
			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			const services = await Service.find(filter)
				.select("name description category is_available")
				.sort({ category: 1, name: 1 })
				.lean();

			// Group services by category
			const categoryMap = new Map<string, ServiceListResponse[]>();

			services.forEach((service) => {
				const { _id: id, ...serviceData } = service;
				const serviceResponse: ServiceListResponse = {
					id: id.toString(),
					...serviceData,
				};

				if (!categoryMap.has(service.category)) {
					categoryMap.set(service.category, []);
				}
				categoryMap.get(service.category)!.push(serviceResponse);
			});

			const categorySummaries: CategorySummary[] = Array.from(
				categoryMap.entries()
			).map(([category, categoryServices]) => ({
				category,
				services: categoryServices,
				total_services: categoryServices.length,
				available_services: categoryServices.filter((s) => s.is_available)
					.length,
			}));

			res.status(200).json({
				status: 200,
				message: "Service categories fetched successfully!",
				data: categorySummaries,
			});
		} catch (error) {
			console.error("Error fetching service categories:", error);
			next(error);
		}
	}
);

// GET /api/services/category/:category (Public - get services by category for clients)
router.get(
	"/category/:category",
	async (
		req: Request,
		res: TypedResponse<ServiceListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { category } = req.params;
			const { available_only = "true" } = req.query;

			const validCategories = [
				"Photography",
				"Beauty",
				"Styling",
				"Equipment",
				"Other",
			];

			if (!validCategories.includes(category)) {
				throw customError(400, "Invalid category");
			}

			const filter: any = { category };

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			const services = await Service.find(filter)
				.select("name description category is_available")
				.sort({ name: 1 })
				.lean();

			const servicesResponse: ServiceListResponse[] = services.map(
				({ _id: id, ...service }) => ({
					id: id.toString(),
					...service,
				})
			);

			res.status(200).json({
				status: 200,
				message: `Services in category '${category}' fetched successfully!`,
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching services by category:", error);
			next(error);
		}
	}
);

// GET /api/services/popular (Public - popular services based on category priorities)
router.get(
	"/popular",
	async (
		req: Request,
		res: TypedResponse<ServiceListResponse[]>,
		next: NextFunction
	) => {
		try {
			// TODO: BASED IT ON BOOKING STATS
			// In a real app, this would be based on booking statistics
			// For now, we prioritize Photography and Beauty services as they're core to photoshoots
			const popularCategories = ["Photography", "Beauty", "Styling"];

			const services = await Service.find({
				category: { $in: popularCategories },
				is_available: true,
				is_active: true,
			})
				.select("name description category is_available")
				.sort({
					category: 1, // Photography first, then Beauty, then Styling
					name: 1,
				})
				.limit(8)
				.lean();

			const servicesResponse: ServiceListResponse[] = services.map(
				({ _id: id, ...service }) => ({
					id: id.toString(),
					...service,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Popular services fetched successfully!",
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching popular services:", error);
			next(error);
		}
	}
);

// GET /api/services/essential (Public - essential services for basic photoshoots)
router.get(
	"/essential",
	async (
		req: Request,
		res: TypedResponse<ServiceListResponse[]>,
		next: NextFunction
	) => {
		try {
			// Essential services that most photoshoots would need
			const essentialKeywords = [
				"photography",
				"photographer",
				"photo",
				"shoot",
				"makeup",
				"hair",
				"styling",
			];

			const services = await Service.find({
				$or: essentialKeywords.map((keyword) => ({
					name: { $regex: keyword, $options: "i" },
				})),
				is_available: true,
				is_active: true,
			})
				.select("name description category is_available")
				.sort({ category: 1, name: 1 })
				.lean();

			const servicesResponse: ServiceListResponse[] = services.map(
				({ _id: id, ...service }) => ({
					id: id.toString(),
					...service,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Essential services fetched successfully!",
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching essential services:", error);
			next(error);
		}
	}
);

// GET /api/services/search (Public - search services by name or description)
router.get(
	"/search",
	async (
		req: Request,
		res: TypedResponse<ServiceListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { q: query, category, available_only = "true" } = req.query;

			if (!query || typeof query !== "string" || query.trim().length < 2) {
				throw customError(
					400,
					"Search query must be at least 2 characters long"
				);
			}

			const filter: any = {
				$or: [
					{ name: { $regex: query.trim(), $options: "i" } },
					{ description: { $regex: query.trim(), $options: "i" } },
				],
			};

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			if (category && category !== "all") {
				filter.category = category;
			}

			const services = await Service.find(filter)
				.select("name description category is_available")
				.sort({ name: 1 })
				.limit(20) // Limit search results
				.lean();

			const servicesResponse: ServiceListResponse[] = services.map(
				({ _id: id, ...service }) => ({
					id: id.toString(),
					...service,
				})
			);

			res.status(200).json({
				status: 200,
				message: `Search results for "${query.trim()}" fetched successfully!`,
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error searching services:", error);
			next(error);
		}
	}
);

// GET /api/services/recommendations (Public - service recommendations based on category mix)
// TODO: Improve to look on the newest or the most popular or the most sales it have accumulated
// TODO: based it on TRANSACTION model
router.get(
	"/recommendations",
	async (
		req: Request,
		res: TypedResponse<{
			photography: ServiceListResponse[];
			beauty: ServiceListResponse[];
			styling: ServiceListResponse[];
			equipment: ServiceListResponse[];
		}>,
		next: NextFunction
	) => {
		try {
			// Get recommended services from each main category
			const [photography, beauty, styling, equipment] = await Promise.all([
				Service.find({
					category: "Photography",
					is_available: true,
					is_active: true,
				})
					.select("name description category is_available")
					.sort({ name: 1 })
					.limit(3)
					.lean(),

				Service.find({
					category: "Beauty",
					is_available: true,
					is_active: true,
				})
					.select("name description category is_available")
					.sort({ name: 1 })
					.limit(3)
					.lean(),

				Service.find({
					category: "Styling",
					is_available: true,
					is_active: true,
				})
					.select("name description category is_available")
					.sort({ name: 1 })
					.limit(2)
					.lean(),

				Service.find({
					category: "Equipment",
					is_available: true,
					is_active: true,
				})
					.select("name description category is_available")
					.sort({ name: 1 })
					.limit(2)
					.lean(),
			]);

			const mapServices = (services: any[]): ServiceListResponse[] =>
				services.map(({ _id: id, ...service }) => ({
					id: id.toString(),
					...service,
				}));

			const recommendations = {
				photography: mapServices(photography),
				beauty: mapServices(beauty),
				styling: mapServices(styling),
				equipment: mapServices(equipment),
			};

			res.status(200).json({
				status: 200,
				message: "Service recommendations fetched successfully!",
				data: recommendations,
			});
		} catch (error) {
			console.error("Error fetching service recommendations:", error);
			next(error);
		}
	}
);

export default router;
