import { Router, Request, NextFunction } from "express";
import { Types } from "mongoose";
import { TypedResponse } from "../../types/base.types";
import { Package } from "../../models/Package";
import { Service } from "../../models/Service";
import { customError } from "../../middleware/errorHandler";

const router = Router();

// ============================================================================
// CLIENT GET ALL PACKAGE DTO
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

interface GetAllPackageDTO {
	_id: Types.ObjectId;
	name: string;
	description?: string | null;
	image?: string | null;
	package_price: number;
	looks: number;
	custom_duration_minutes?: number | null;
	is_available: boolean;
	is_active: boolean;
	services: Array<{
		_id?: Types.ObjectId;
		service_id: string;
		quantity: number;
		price_per_unit: number;
		total_price: number;
		duration_minutes?: number | null;
		service_details?: ServiceLean | null;
	}>;
	created_at: Date;
	updated_at: Date;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface ServiceInPackage {
	service_id: string;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	duration_minutes?: number | null;
}

interface PackageLean {
	_id: Types.ObjectId;
	name: string;
	description?: string | null;
	image?: string | null;
	package_price: number;
	// discount_percentage?: number | null;
	// discount_amount?: number | null;
	// final_price?: number;
	services: ServiceInPackage[];
	looks: number;
	is_available: boolean;
	custom_duration_minutes?: number | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
	created_by: Date;
	updated_by: Date;
	deleted_by?: Date | null;
	retrieved_by?: Date | null;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
}

interface PackageListResponse {
	_id: string;
	name: string;
	description?: string | null;
	image?: string | null;
	package_price: number;
	// final_price?: number;
	// discount_percentage?: number | null;
	looks: number;
	services_count: number;
	is_available: boolean;
}

interface PackageDetailResponse {
	id: string;
	name: string;
	description?: string | null;
	image?: string | null;
	package_price: number;
	// discount_percentage?: number | null;
	// discount_amount?: number | null;
	// final_price?: number;
	services: ServiceInPackage[];
	looks: number;
	custom_duration_minutes?: number | null;
	total_duration_minutes?: number;
	is_available: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToListResponse(pkg: PackageLean): PackageListResponse {
	return {
		_id: pkg._id.toString(),
		name: pkg.name,
		description: pkg.description,
		image: pkg.image,
		package_price: pkg.package_price,
		// final_price: pkg.final_price,
		// discount_percentage: pkg.discount_percentage,
		looks: pkg.looks,
		services_count: pkg.services.length,
		is_available: pkg.is_available,
	};
}

function convertToDetailResponse(pkg: PackageLean): PackageDetailResponse {
	// Calculate total duration
	let totalDuration = 0;
	if (pkg.custom_duration_minutes) {
		totalDuration = pkg.custom_duration_minutes;
	} else {
		for (const service of pkg.services) {
			if (service.duration_minutes) {
				totalDuration += service.duration_minutes * service.quantity;
			}
		}
	}

	return {
		id: pkg._id.toString(),
		name: pkg.name,
		description: pkg.description,
		image: pkg.image,
		package_price: pkg.package_price,
		// discount_percentage: pkg.discount_percentage,
		// discount_amount: pkg.discount_amount,
		// final_price: pkg.final_price,
		services: pkg.services,
		looks: pkg.looks,
		custom_duration_minutes: pkg.custom_duration_minutes,
		total_duration_minutes: totalDuration,
		is_available: pkg.is_available,
	};
}

// ============================================================================
// PUBLIC/CLIENT ENDPOINTS
// ============================================================================

/**
 * GET /packages/filter/popular
 * Public - Get popular packages (based on looks count for now)
 * MOVED BEFORE /:id to prevent route conflict
 */
router.get(
	"/filter/popular",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			// TODO: Base this on actual booking statistics
			// For now, packages with 3+ looks are considered "popular"
			const packages = await Package.find({
				looks: { $gte: 3 },
				is_available: true,
				is_active: true,
				deleted_at: null,
			})
				.sort({ looks: -1, final_price: 1 })
				.limit(6)
				.lean<PackageLean[]>();

			const packagesResponse = packages.map(convertToListResponse);

			res.status(200).json({
				status: 200,
				message: "Popular packages fetched successfully!",
				data: packagesResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /packages/filter/featured
 * Public - Get featured packages (best value/most discounted)
 * MOVED BEFORE /:id to prevent route conflict
 */
router.get(
	"/filter/featured",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			// Get packages with the highest discount percentage
			const packages = await Package.find({
				is_available: true,
				is_active: true,
				deleted_at: null,
			})
				.limit(6)
				.lean<PackageLean[]>();

			const packagesResponse = packages.map(convertToListResponse);

			res.status(200).json({
				status: 200,
				message: "Featured packages fetched successfully!",
				data: packagesResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /packages/price-range/:min/:max
 * Public - Filter packages by price range
 * MOVED BEFORE /:id to prevent route conflict
 */
router.get(
	"/price-range/:min/:max",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { min, max } = req.params;
			const minPrice = Number(min);
			const maxPrice = Number(max);

			if (
				isNaN(minPrice) ||
				isNaN(maxPrice) ||
				minPrice < 0 ||
				maxPrice < minPrice
			) {
				throw customError(400, "Invalid price range");
			}

			const packages = await Package.find({
				final_price: { $gte: minPrice, $lte: maxPrice },
				is_available: true,
				is_active: true,
				deleted_at: null,
			})
				.sort({ final_price: 1 })
				.lean<PackageLean[]>();

			const packagesResponse = packages.map(convertToListResponse);

			res.status(200).json({
				status: 200,
				message: `Packages in price range ₱${minPrice} - ₱${maxPrice} fetched successfully!`,
				data: packagesResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /packages/looks/:count
 * Public - Filter packages by number of looks
 * MOVED BEFORE /:id to prevent route conflict
 */
router.get(
	"/looks/:count",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { count } = req.params;
			const looksCount = Number(count);

			if (isNaN(looksCount) || looksCount < 1 || looksCount > 10) {
				throw customError(400, "Invalid looks count. Must be between 1-10");
			}

			const packages = await Package.find({
				looks: looksCount,
				is_available: true,
				is_active: true,
				deleted_at: null,
			})
				.sort({ final_price: 1 })
				.lean<PackageLean[]>();

			const packagesResponse = packages.map(convertToListResponse);

			res.status(200).json({
				status: 200,
				message: `Packages with ${looksCount} look(s) fetched successfully!`,
				data: packagesResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /packages/service/:serviceId
 * Public - Get packages containing a specific service
 * MOVED BEFORE /:id to prevent route conflict
 */
router.get(
	"/service/:serviceId",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { serviceId } = req.params;

			if (!Types.ObjectId.isValid(serviceId)) {
				throw customError(400, "Invalid service ID format");
			}

			// Verify service exists
			const service = await Service.findOne({
				_id: serviceId,
				deleted_at: null,
			});

			if (!service) {
				throw customError(404, "Service not found");
			}

			// Find packages that include this service
			const packages = await Package.find({
				"services.service_id": serviceId,
				is_available: true,
				is_active: true,
				deleted_at: null,
			})
				.sort({ final_price: 1 })
				.lean<PackageLean[]>();

			const packagesResponse = packages.map(convertToListResponse);

			res.status(200).json({
				status: 200,
				message: `Packages including "${service.name}" service fetched successfully!`,
				data: packagesResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /packages
 * Public - Browse all available packages with filtering and sorting
 */
router.get(
	"/",
	async (
		req: Request,
		res: TypedResponse<GetAllPackageDTO[]>,
		next: NextFunction
	) => {
		try {
			const {
				available_only = "true",
				min_price,
				max_price,
				min_looks,
				max_looks,
				sort_by = "final_price",
				sort_order = "asc",
			} = req.query;

			// Build filter
			interface BrowseFilter {
				is_available?: boolean;
				is_active?: boolean;
				deleted_at: null;
				final_price?: {
					$gte?: number;
					$lte?: number;
				};
				looks?: {
					$gte?: number;
					$lte?: number;
				};
			}

			const filter: BrowseFilter = {
				deleted_at: null,
			};

			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			// Price range filter (use final_price for accurate filtering)
			if (min_price || max_price) {
				const priceFilter: { $gte?: number; $lte?: number } = {};
				if (min_price) priceFilter.$gte = Number(min_price);
				if (max_price) priceFilter.$lte = Number(max_price);
				filter.final_price = priceFilter;
			}

			// Looks filter
			if (min_looks || max_looks) {
				const looksFilter: { $gte?: number; $lte?: number } = {};
				if (min_looks) looksFilter.$gte = Number(min_looks);
				if (max_looks) looksFilter.$lte = Number(max_looks);
				filter.looks = looksFilter;
			}

			// Build sort
			interface SortObject {
				[key: string]: 1 | -1;
			}

			const sortField = sort_by as string;
			const sortDirection = sort_order === "desc" ? -1 : 1;
			const sortObj: SortObject = { [sortField]: sortDirection };

			// Fetch packages with only needed fields (exclude audit fields)
			const packages = await Package.find(filter)
				.select(
					"-created_by -updated_by -deleted_by -retrieved_by -deleted_at -retrieved_at"
				)
				.sort(sortObj)
				.lean<PackageLean[]>();

			// Extract all unique service IDs from all packages
			const allServiceIds = new Set<string>();
			packages.forEach((pkg) => {
				pkg.services.forEach((svc) => {
					allServiceIds.add(svc.service_id.toString());
				});
			});

			// Fetch all services in one query (also exclude audit fields)
			const services = await Service.find({
				_id: { $in: Array.from(allServiceIds) },
				deleted_at: null,
			})
				.select(
					"-created_by -updated_by -deleted_by -retrieved_by -deleted_at -retrieved_at"
				)
				.lean<ServiceLean[]>();

			// Create a map for quick service lookup
			const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

			// Transform packages to DTO format
			const packagesResponse: GetAllPackageDTO[] = packages.map((pkg) => {
				// Add service_details to each service in the services array
				const servicesWithDetails = pkg.services.map((svc) => {
					const fullService = serviceMap.get(svc.service_id.toString());

					return {
						...svc,
						service_details: fullService || null,
					};
				});

				return {
					_id: pkg._id,
					name: pkg.name,
					description: pkg.description,
					image: pkg.image,
					package_price: pkg.package_price,
					// discount_percentage: pkg.discount_percentage,
					// discount_amount: pkg.discount_amount,
					// final_price: pkg.final_price,
					looks: pkg.looks,
					custom_duration_minutes: pkg.custom_duration_minutes,
					is_available: pkg.is_available,
					is_active: pkg.is_active,
					services: servicesWithDetails,
					created_at: pkg.created_at,
					updated_at: pkg.updated_at,
				};
			});

			res.status(200).json({
				status: 200,
				message: "Packages fetched successfully!",
				data: packagesResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /packages/:id
 * Public - Get detailed package information for booking
 */
router.get(
	"/:id",
	async (
		req: Request,
		res: TypedResponse<PackageDetailResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			const packageDoc = await Package.findOne({
				_id: id,
				is_available: true,
				is_active: true,
				deleted_at: null,
			}).lean<PackageLean>();

			if (!packageDoc) {
				throw customError(404, "Package not found or not available");
			}

			const packageResponse = convertToDetailResponse(packageDoc);

			res.status(200).json({
				status: 200,
				message: "Package fetched successfully!",
				data: packageResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
