import { Router, Request, NextFunction } from "express";
import { Service } from "../../models/Service";
import { Types } from "mongoose";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";

const router = Router();

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface ServiceLean {
	_id: Types.ObjectId;
	name: string;
	description?: string | null;
	category: string;
	price: number;
	old_price?: number;
	duration_minutes?: number | null;
	is_available: boolean;
	service_gallery: string[];
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

type ServiceListResponse = {
	id: string;
	name: string;
	description?: string | null;
	category: string;
	price: number;
	old_price?: number;
	duration_minutes?: number | null;
	is_available: boolean;
	service_gallery: string[];
};

type CategorySummary = {
	category: string;
	services: ServiceListResponse[];
	total_services: number;
	available_services: number;
};

type RecommendationsResponse = {
	photography: ServiceListResponse[];
	beauty: ServiceListResponse[];
	styling: ServiceListResponse[];
	equipment: ServiceListResponse[];
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToListResponse(service: ServiceLean): ServiceListResponse {
	const { _id, is_active, created_at, updated_at, ...serviceData } = service;
	return {
		id: _id.toString(),
		...serviceData,
	};
}

// ============================================================================
// PUBLIC/CUSTOMER ENDPOINTS
// ============================================================================

/**
 * GET /services/browse
 * Public - for clients to browse available services
 * Query params: category, available_only, search, sort_by, sort_order
 */
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
			interface BrowseFilter {
				is_available?: boolean;
				is_active?: boolean;
				deleted_at: null;
				category?: string;
				$or?: Array<{
					name?: { $regex: string | unknown; $options: string };
					description?: { $regex: string | unknown; $options: string };
				}>;
			}

			const filter: BrowseFilter = {
				deleted_at: null,
			};

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			if (category && category !== "all") {
				filter.category = category as string;
			}

			if (search) {
				filter.$or = [
					{ name: { $regex: search, $options: "i" } },
					{ description: { $regex: search, $options: "i" } },
				];
			}

			// Build sort
			interface SortObject {
				[key: string]: 1 | -1;
			}

			const sortObj: SortObject = {};
			const sortField = sort_by as string;
			sortObj[sortField] = sort_order === "desc" ? -1 : 1;

			const services = await Service.find(filter)
				.select(
					"name description category price old_price duration_minutes is_available service_gallery"
				)
				.sort(sortObj)
				.lean<ServiceLean[]>();

			const servicesResponse: ServiceListResponse[] = services.map(
				convertToListResponse
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

/**
 * GET /services/categories
 * Public - get all categories with service counts
 * Query params: available_only
 */
router.get(
	"/categories",
	async (
		req: Request,
		res: TypedResponse<CategorySummary[]>,
		next: NextFunction
	) => {
		try {
			const { available_only = "true" } = req.query;

			interface CategoryFilter {
				is_available?: boolean;
				is_active?: boolean;
				deleted_at: null;
			}

			const filter: CategoryFilter = {
				deleted_at: null,
			};

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			const services = await Service.find(filter)
				.select(
					"name description category price old_price duration_minutes is_available service_gallery"
				)
				.sort({ category: 1, name: 1 })
				.lean<ServiceLean[]>();

			// Group services by category
			const categoryMap = new Map<string, ServiceListResponse[]>();

			services.forEach((service) => {
				const serviceResponse: ServiceListResponse =
					convertToListResponse(service);

				if (!categoryMap.has(service.category)) {
					categoryMap.set(service.category, []);
				}
				const categoryServices = categoryMap.get(service.category);
				if (categoryServices) {
					categoryServices.push(serviceResponse);
				}
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

/**
 * GET /services/category/:category
 * Public - get services by category for clients
 * Query params: available_only
 */
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

			interface CategoryParamFilter {
				category: string;
				is_available?: boolean;
				is_active?: boolean;
				deleted_at: null;
			}

			const filter: CategoryParamFilter = {
				category,
				deleted_at: null,
			};

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			const services = await Service.find(filter)
				.select(
					"name description category price old_price duration_minutes is_available service_gallery"
				)
				.sort({ name: 1 })
				.lean<ServiceLean[]>();

			const servicesResponse: ServiceListResponse[] = services.map(
				convertToListResponse
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

/**
 * GET /services/popular
 * Public - popular services based on category priorities
 * TODO: Base it on booking stats from Transaction model
 */
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
				deleted_at: null,
			})
				.select(
					"name description category price old_price duration_minutes is_available service_gallery"
				)
				.sort({
					category: 1, // Photography first, then Beauty, then Styling
					name: 1,
				})
				.limit(8)
				.lean<ServiceLean[]>();

			const servicesResponse: ServiceListResponse[] = services.map(
				convertToListResponse
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

/**
 * GET /services/essential
 * Public - essential services for basic photoshoots
 */
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
				deleted_at: null,
			})
				.select(
					"name description category price old_price duration_minutes is_available service_gallery"
				)
				.sort({ category: 1, name: 1 })
				.lean<ServiceLean[]>();

			const servicesResponse: ServiceListResponse[] = services.map(
				convertToListResponse
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

/**
 * GET /services/search
 * Public - search services by name or description
 * Query params: q (query), category, available_only
 */
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

			interface SearchFilter {
				$or: Array<{
					name?: { $regex: string; $options: string };
					description?: { $regex: string; $options: string };
				}>;
				is_available?: boolean;
				is_active?: boolean;
				deleted_at: null;
				category?: string;
			}

			const filter: SearchFilter = {
				$or: [
					{ name: { $regex: query.trim(), $options: "i" } },
					{ description: { $regex: query.trim(), $options: "i" } },
				],
				deleted_at: null,
			};

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			if (category && category !== "all") {
				filter.category = category as string;
			}

			const services = await Service.find(filter)
				.select(
					"name description category price old_price duration_minutes is_available service_gallery"
				)
				.sort({ name: 1 })
				.limit(20) // Limit search results
				.lean<ServiceLean[]>();

			const servicesResponse: ServiceListResponse[] = services.map(
				convertToListResponse
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

/**
 * GET /services/recommendations
 * Public - service recommendations based on category mix
 * TODO: Improve to look at the newest or most popular or most sales accumulated
 * TODO: Base it on TRANSACTION model
 */
router.get(
	"/recommendations",
	async (
		req: Request,
		res: TypedResponse<RecommendationsResponse>,
		next: NextFunction
	) => {
		try {
			// Get recommended services from each main category
			const [photography, beauty, styling, equipment] = await Promise.all([
				Service.find({
					category: "Photography",
					is_available: true,
					is_active: true,
					deleted_at: null,
				})
					.select(
						"name description category price old_price duration_minutes is_available service_gallery"
					)
					.sort({ name: 1 })
					.limit(3)
					.lean<ServiceLean[]>(),

				Service.find({
					category: "Beauty",
					is_available: true,
					is_active: true,
					deleted_at: null,
				})
					.select(
						"name description category price old_price duration_minutes is_available service_gallery"
					)
					.sort({ name: 1 })
					.limit(3)
					.lean<ServiceLean[]>(),

				Service.find({
					category: "Styling",
					is_available: true,
					is_active: true,
					deleted_at: null,
				})
					.select(
						"name description category price old_price duration_minutes is_available service_gallery"
					)
					.sort({ name: 1 })
					.limit(2)
					.lean<ServiceLean[]>(),

				Service.find({
					category: "Equipment",
					is_available: true,
					is_active: true,
					deleted_at: null,
				})
					.select(
						"name description category price old_price duration_minutes is_available service_gallery"
					)
					.sort({ name: 1 })
					.limit(2)
					.lean<ServiceLean[]>(),
			]);

			const mapServices = (services: ServiceLean[]): ServiceListResponse[] =>
				services.map(convertToListResponse);

			const recommendations: RecommendationsResponse = {
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
