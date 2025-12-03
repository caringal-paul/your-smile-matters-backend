import { Router, Request, NextFunction } from "express";
import { Service, ServiceModel } from "../../models/Service";
import { Types } from "mongoose";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import { Transaction } from "../../models/Transaction";
import { ServiceCategory } from "../../constants/service-category.constant";

const router = Router();

// ============================================================================
// RESPONSE TYPES
// ============================================================================

type ServiceLean = {
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
	created_by?: Types.ObjectId | null;
	updated_by?: Types.ObjectId | null;
	deleted_by?: Types.ObjectId | null;
	retrieved_by?: Types.ObjectId | null;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
};

type ServiceListResponse = {
	_id: string;
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
		_id: _id.toString(),
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
		res: TypedResponse<ServiceLean[]>,
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
				.sort(sortObj)
				.lean<ServiceLean[]>();

			res.status(200).json({
				status: 200,
				message: "Services fetched successfully!",
				data: services,
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
 * Public - search services by name or description
 */
router.get(
	"/recommendations",
	async (req: Request, res: TypedResponse<any>, next: NextFunction) => {
		try {
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 90);

			// Aggregate service metrics
			const serviceMetrics = await Transaction.aggregate([
				{
					$match: {
						status: "Completed",
						transaction_type: { $in: ["Payment", "Partial", "Balance"] },
						is_active: true,
						deleted_at: null,
					},
				},
				{
					$lookup: {
						from: "bookings",
						localField: "booking_id",
						foreignField: "_id",
						as: "booking",
					},
				},
				{ $unwind: "$booking" },
				{ $unwind: "$booking.services" },
				{
					$group: {
						_id: "$booking.services.service_id",
						total_revenue: { $sum: "$amount" },
						booking_count: { $sum: 1 },
						recent_bookings: {
							$sum: {
								$cond: [{ $gte: ["$transaction_date", recentDate] }, 1, 0],
							},
						},
						avg_booking_value: { $avg: "$amount" },
					},
				},
				{
					$addFields: {
						popularity_score: {
							$add: [
								{ $multiply: ["$total_revenue", 0.4] },
								{ $multiply: ["$booking_count", 50] },
								{ $multiply: ["$recent_bookings", 100] },
							],
						},
					},
				},
			]);

			const metricsMap = new Map(
				serviceMetrics.map((m) => [m._id.toString(), m])
			);

			// Fetch all active services
			const services = await Service.find({
				is_available: true,
				is_active: true,
				deleted_at: null,
			}).lean();

			// Attach metrics and sort by popularity_score descending, then price ascending
			const recommendedServices = services
				.map((s) => ({
					...s,
					metrics: metricsMap.get(s._id.toString()) ?? {
						popularity_score: 0,
						total_revenue: 0,
						booking_count: 0,
						recent_bookings: 0,
						avg_booking_value: 0,
					},
				}))
				.sort((a, b) => {
					const diff = b.metrics.popularity_score - a.metrics.popularity_score;
					return diff !== 0 ? diff : a.price - b.price;
				})
				.slice(0, 10); // <-- Limit to top 10

			res.status(200).json({
				status: 200,
				message: "Top 10 recommended services fetched successfully!",
				data: recommendedServices,
			});
		} catch (error) {
			console.error("Error fetching service recommendations:", error);
			next(error);
		}
	}
);

/**
 * GET /services/:id
 * Public - for clients to browse available services
 */
router.get(
	"/:id",
	async (
		req: Request<{ id: string }>,
		res: TypedResponse<ServiceLean>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			const service = await Service.findById(id).lean<ServiceLean | null>();

			if (!service) {
				throw customError(404, "Service not found");
			}

			res.status(200).json({
				status: 200,
				message: "Service fetched successfully!",
				data: service,
			});
		} catch (error) {
			console.error("Error fetching service:", error);
			next(error);
		}
	}
);

export default router;
