import { Router, Request, NextFunction } from "express";
import { Types } from "mongoose";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";
import { TypedResponse } from "../../types/base.types";
import { Package } from "../../models/Package";
import { Service } from "../../models/Service";
import { customError } from "../../middleware/errorHandler";
import { ServiceCategory } from "../../constants/service-category.constant";

const router = Router();

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export type ServiceDetailsLean = {
	_id: Types.ObjectId;
	name: string;
	description?: string | null;
	category: ServiceCategory;
	price: number;
	old_price?: number;
	duration_minutes?: number | null;
	is_available: boolean;
	service_gallery: string[];
};

interface ServiceInPackage {
	service_id: string;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	duration_minutes?: number | null;
}

export interface ServiceInPackageWithDetails extends ServiceInPackage {
	service_details?: ServiceDetailsLean;
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
	created_by: Types.ObjectId;
	updated_by?: Types.ObjectId | null;
	deleted_by?: Types.ObjectId | null;
	retrieved_by?: Types.ObjectId | null;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
	created_at: Date;
	updated_at: Date;
}

interface PackageResponse {
	_id: string;
	name: string;
	description?: string | null;
	image?: string | null;
	package_price: number;
	// discount_percentage?: number | null;
	// discount_amount?: number | null;
	// final_price?: number;
	services: ServiceInPackageWithDetails[];
	looks: number;
	is_available: boolean;
	custom_duration_minutes?: number | null;
	total_services_count: number;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
	created_by: Types.ObjectId;
	updated_by?: Types.ObjectId | null;
	deleted_by?: Types.ObjectId | null;
	retrieved_by?: Types.ObjectId | null;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
}

interface CreatePackageBody {
	name: string;
	description?: string;
	image?: string;
	package_price: number;
	// discount_percentage?: number;
	// discount_amount?: number;
	looks: number;
	services: Array<{
		service_id: string;
		quantity: number;
	}>;
	custom_duration_minutes?: number;
	is_available?: boolean;
}

interface ServiceLean {
	_id: Types.ObjectId;
	price: number;
	duration_minutes?: number | null;
	is_available: boolean;
	is_active: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToResponse(pkg: PackageLean): PackageResponse {
	const { _id, ...packageData } = pkg;
	return {
		_id: _id.toString(),
		...packageData,
		total_services_count: pkg.services.length,
	};
}

// function calculateFinalPrice(
// 	basePrice: number,
// 	discountPercentage?: number | null,
// 	discountAmount?: number | null
// ): number {
// 	let finalPrice = basePrice;

// 	if (discountPercentage) {
// 		finalPrice -= (finalPrice * discountPercentage) / 100;
// 	}

// 	if (discountAmount) {
// 		finalPrice -= discountAmount;
// 	}

// 	return Math.max(0, finalPrice);
// }

// ============================================================================
// ADMIN PACKAGE ENDPOINTS
// ============================================================================

/**
 * GET /packages
 * Get all packages (admin view)
 * Query params: is_active, is_available, include_deleted
 */
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<PackageResponse[]>,
		next: NextFunction
	) => {
		try {
			const { is_active, is_available, include_deleted = "false" } = req.query;

			interface PackageFilter {
				deleted_at?: null | { $ne: null };
				is_active?: boolean;
				is_available?: boolean;
			}

			const filter: PackageFilter = {};

			if (include_deleted !== "true") filter.deleted_at = null;
			if (is_active !== undefined) filter.is_active = is_active === "true";
			if (is_available !== undefined)
				filter.is_available = is_available === "true";

			const packages = await Package.find(filter).lean<PackageLean[]>();

			// Fetch all service IDs in one go for better performance
			const allServiceIds = packages.flatMap((pkg) =>
				pkg.services.map((s) => s.service_id)
			);

			const services = await Service.find({ _id: { $in: allServiceIds } }).lean<
				ServiceDetailsLean[]
			>();

			// Map for quick lookup
			const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

			// Attach details to each service in every package
			const packagesResponse: PackageResponse[] = packages.map((pkg) => {
				const servicesWithDetails = pkg.services.map((s) => ({
					...s,
					service_details: serviceMap.get(s.service_id.toString()) || undefined,
				}));

				return {
					...convertToResponse(pkg),
					services: servicesWithDetails,
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
 * Get single package by ID
 */
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			const packageDoc = await Package.findOne({
				_id: id,
				deleted_at: null,
			}).lean<PackageLean>();

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			const serviceIds = packageDoc.services.map((s) => s.service_id);
			const serviceDocs = await Service.find({
				_id: { $in: serviceIds },
			}).lean<ServiceDetailsLean[]>();

			const serviceMap = new Map(serviceDocs.map((s) => [s._id.toString(), s]));

			const servicesWithDetails: ServiceInPackageWithDetails[] =
				packageDoc.services.map((s) => ({
					...s,
					service_details: serviceMap.get(s.service_id.toString()) || undefined,
				}));

			const packageResponse = {
				...convertToResponse(packageDoc),
				services: servicesWithDetails,
			};

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

/**
 * POST /packages
 * Create new package
 */
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId) {
				throw customError(401, "User not authenticated");
			}

			const body: CreatePackageBody = req.body;

			// Validate required fields
			if (!body.name || !body.package_price || !body.looks || !body.services) {
				throw customError(
					400,
					"Missing required fields: name, package_price, looks, services"
				);
			}

			// Validate package_price
			if (typeof body.package_price !== "number" || body.package_price < 0) {
				throw customError(400, "Package price must be a non-negative number");
			}

			// Validate looks
			if (typeof body.looks !== "number" || body.looks < 1 || body.looks > 10) {
				throw customError(400, "Looks must be between 1 and 10");
			}

			// Validate discount_percentage if provided
			// if (
			// 	body.discount_percentage !== undefined &&
			// 	body.discount_percentage !== null
			// ) {
			// 	if (
			// 		typeof body.discount_percentage !== "number" ||
			// 		body.discount_percentage < 0 ||
			// 		body.discount_percentage > 100
			// 	) {
			// 		throw customError(
			// 			400,
			// 			"Discount percentage must be between 0 and 100"
			// 		);
			// 	}
			// }

			// Validate discount_amount if provided
			// if (body.discount_amount !== undefined && body.discount_amount !== null) {
			// 	if (
			// 		typeof body.discount_amount !== "number" ||
			// 		body.discount_amount < 0
			// 	) {
			// 		throw customError(400, "Discount amount must be non-negative");
			// 	}
			// }

			// Validate custom_duration_minutes if provided
			if (
				body.custom_duration_minutes !== undefined &&
				body.custom_duration_minutes !== null
			) {
				if (
					typeof body.custom_duration_minutes !== "number" ||
					body.custom_duration_minutes < 0
				) {
					throw customError(
						400,
						"Custom duration must be a non-negative number"
					);
				}
			}

			// Validate services array
			if (!Array.isArray(body.services) || body.services.length === 0) {
				throw customError(400, "Package must include at least one service");
			}

			// Validate service structure
			for (const service of body.services) {
				if (!service.service_id || typeof service.quantity !== "number") {
					throw customError(
						400,
						"Each service must have service_id and quantity"
					);
				}
				if (service.quantity < 1) {
					throw customError(400, "Service quantity must be at least 1");
				}
			}

			// Validate service IDs
			const serviceIds = body.services.map((s) => s.service_id);
			for (const serviceId of serviceIds) {
				if (!Types.ObjectId.isValid(serviceId)) {
					throw customError(400, `Invalid service ID format: ${serviceId}`);
				}
			}

			// Check if package name already exists (excluding soft-deleted)
			const existingPackage = await Package.findOne({
				name: body.name.trim(),
				deleted_at: null,
			});

			if (existingPackage) {
				throw customError(400, "Package with this name already exists");
			}

			// Fetch all services to validate and get pricing/duration
			const services = await Service.find({
				_id: { $in: serviceIds },
				deleted_at: null,
			}).lean<ServiceLean[]>();

			if (services.length !== serviceIds.length) {
				throw customError(400, "One or more services do not exist");
			}

			// Check if all services are available
			const unavailableServices = services.filter(
				(service) => !service.is_available || !service.is_active
			);

			if (unavailableServices.length > 0) {
				throw customError(400, "All services must be available and active");
			}

			// Build services array with pricing snapshot
			const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

			const servicesData: ServiceInPackage[] = body.services.map((item) => {
				const service = serviceMap.get(item.service_id);
				if (!service) {
					throw customError(500, `Service ${item.service_id} not found`);
				}

				// FIXED: Ensure we have valid numbers before calculation
				const pricePerUnit = service.price || 0;
				const quantity = item.quantity || 1;
				const totalPrice = pricePerUnit * quantity;

				return {
					service_id: item.service_id,
					quantity: quantity,
					price_per_unit: pricePerUnit,
					total_price: totalPrice,
					duration_minutes: service.duration_minutes || null,
				};
			});

			// Calculate final price
			// const finalPrice = calculateFinalPrice(
			// 	body.package_price,
			// 	body.discount_percentage,
			// 	body.discount_amount
			// );

			// Create package
			const newPackage = await Package.create({
				name: body.name.trim(),
				description: body.description?.trim() || null,
				image: body.image || null,
				package_price: body.package_price,
				// discount_percentage: body.discount_percentage || null,
				// discount_amount: body.discount_amount || null,
				// final_price: finalPrice,
				services: servicesData,
				looks: body.looks,
				custom_duration_minutes: body.custom_duration_minutes || null,
				is_available:
					body.is_available !== undefined ? body.is_available : true,
				is_active: true,
				created_by: userId,
				updated_by: userId,
			});

			const packageDoc = await Package.findById(
				newPackage._id
			).lean<PackageLean>();

			if (!packageDoc) {
				throw customError(500, "Failed to create package");
			}

			const packageResponse = convertToResponse(packageDoc);

			res.status(201).json({
				status: 201,
				message: "Package created successfully!",
				data: packageResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PUT /packages/:id
 * Update package (full update)
 */
router.put(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			if (!userId) {
				throw customError(401, "User not authenticated");
			}

			const packageDoc = await Package.findOne({
				_id: id,
				deleted_at: null,
			});

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			const body: Partial<CreatePackageBody> = req.body;

			// Validate discount_percentage if provided
			// if (
			// 	body.discount_percentage !== undefined &&
			// 	body.discount_percentage !== null &&
			// 	(typeof body.discount_percentage !== "number" ||
			// 		body.discount_percentage < 0 ||
			// 		body.discount_percentage > 100)
			// ) {
			// 	throw customError(400, "Discount percentage must be between 0 and 100");
			// }

			// Validate discount_amount if provided
			// if (
			// 	body.discount_amount !== undefined &&
			// 	body.discount_amount !== null &&
			// 	(typeof body.discount_amount !== "number" || body.discount_amount < 0)
			// ) {
			// 	throw customError(400, "Discount amount must be non-negative");
			// }

			// Validate looks if provided
			if (
				body.looks !== undefined &&
				(typeof body.looks !== "number" || body.looks < 1 || body.looks > 10)
			) {
				throw customError(400, "Looks must be between 1 and 10");
			}

			// Check if name is being updated and already exists
			if (body.name && body.name.trim() !== packageDoc.name) {
				const existingPackage = await Package.findOne({
					name: body.name.trim(),
					_id: { $ne: id },
					deleted_at: null,
				});

				if (existingPackage) {
					throw customError(400, "Package with this name already exists");
				}
			}

			// If services are being updated, validate and rebuild
			if (body.services) {
				if (!Array.isArray(body.services) || body.services.length === 0) {
					throw customError(400, "Package must include at least one service");
				}

				// Validate service structure
				for (const service of body.services) {
					if (!service.service_id || typeof service.quantity !== "number") {
						throw customError(
							400,
							"Each service must have service_id and quantity"
						);
					}
					if (service.quantity < 1) {
						throw customError(400, "Service quantity must be at least 1");
					}
				}

				const serviceIds = body.services.map((s) => s.service_id);

				// Validate IDs
				for (const serviceId of serviceIds) {
					if (!Types.ObjectId.isValid(serviceId)) {
						throw customError(400, `Invalid service ID format: ${serviceId}`);
					}
				}

				// Fetch services
				const services = await Service.find({
					_id: { $in: serviceIds },
					deleted_at: null,
				}).lean<ServiceLean[]>();

				if (services.length !== serviceIds.length) {
					throw customError(400, "One or more services do not exist");
				}

				const unavailableServices = services.filter(
					(service) => !service.is_available || !service.is_active
				);

				if (unavailableServices.length > 0) {
					throw customError(400, "All services must be available and active");
				}

				// Rebuild services with updated pricing
				const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

				const servicesData: ServiceInPackage[] = body.services.map((item) => {
					const service = serviceMap.get(item.service_id);
					if (!service)
						throw customError(500, `Service ${item.service_id} not found`);

					return {
						service_id: item.service_id,
						quantity: item.quantity,
						price_per_unit: service.price,
						total_price: service.price * item.quantity,
						duration_minutes: service.duration_minutes,
					};
				});

				packageDoc.services = servicesData as never;
			}

			// Update other fields
			if (body.name !== undefined) packageDoc.name = body.name.trim();
			if (body.description !== undefined)
				packageDoc.description = body.description?.trim() || null;
			if (body.image !== undefined) packageDoc.image = body.image || null;
			if (body.package_price !== undefined)
				packageDoc.package_price = body.package_price;
			// if (body.discount_percentage !== undefined)
			// 	packageDoc.discount_percentage = body.discount_percentage || null;
			// if (body.discount_amount !== undefined)
			// 	packageDoc.discount_amount = body.discount_amount || null;
			if (body.looks !== undefined) packageDoc.looks = body.looks;
			if (body.custom_duration_minutes !== undefined)
				packageDoc.custom_duration_minutes =
					body.custom_duration_minutes || null;
			if (body.is_available !== undefined)
				packageDoc.is_available = body.is_available;

			// Recalculate final price
			// packageDoc.final_price = calculateFinalPrice(
			// 	packageDoc.package_price,
			// 	packageDoc.discount_percentage,
			// 	packageDoc.discount_amount
			// );

			packageDoc.updated_by = userId as never;

			await packageDoc.save();

			const updatedPackage = await Package.findById(id).lean<PackageLean>();

			if (!updatedPackage) {
				throw customError(500, "Failed to update package");
			}

			const packageResponse = convertToResponse(updatedPackage);

			res.status(200).json({
				status: 200,
				message: "Package updated successfully!",
				data: packageResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PATCH /packages/:id/deactivate
 * Deactivate package (soft delete)
 */
router.patch(
	"/:id/deactivate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			if (!userId) {
				throw customError(401, "User not authenticated");
			}

			const packageDoc = await Package.findOne({
				_id: id,
				deleted_at: null,
			});

			if (!packageDoc) {
				throw customError(404, "Package not found or already deactivated");
			}

			packageDoc.is_active = false;
			packageDoc.is_available = false;
			packageDoc.deleted_by = userId as never;
			packageDoc.deleted_at = new Date();
			packageDoc.updated_by = userId as never;

			await packageDoc.save();

			res.status(200).json({
				status: 200,
				message: "Package deactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PATCH /packages/:id/reactivate
 * Reactivate package (renamed from activate)
 */
router.patch(
	"/:id/reactivate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			if (!userId) {
				throw customError(401, "User not authenticated");
			}

			const packageDoc = await Package.findOne({
				_id: id,
				deleted_at: { $ne: null },
			});

			if (!packageDoc) {
				throw customError(404, "Package not found or not deactivated");
			}

			// Verify all services are still available
			const serviceIds = packageDoc.services.map((s) => s.service_id);
			const services = await Service.find({
				_id: { $in: serviceIds },
				deleted_at: null,
			}).lean<Array<{ is_available: boolean; is_active: boolean }>>();

			const unavailableServices = services.filter(
				(service) => !service.is_available || !service.is_active
			);

			if (unavailableServices.length > 0) {
				throw customError(
					400,
					"Cannot reactivate package. Some services are no longer available"
				);
			}

			packageDoc.is_active = true;
			packageDoc.is_available = true;
			packageDoc.retrieved_by = userId as never;
			packageDoc.retrieved_at = new Date();
			packageDoc.deleted_at = null;
			packageDoc.updated_by = userId as never;

			await packageDoc.save();

			res.status(200).json({
				status: 200,
				message: "Package reactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PATCH /packages/:id/toggle-availability
 * Toggle package availability
 */
router.patch(
	"/:id/toggle-availability",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			if (!userId) {
				throw customError(401, "User not authenticated");
			}

			const packageDoc = await Package.findOne({
				_id: id,
				deleted_at: null,
			});

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			// If making available, check services
			if (!packageDoc.is_available) {
				const serviceIds = packageDoc.services.map((s) => s.service_id);
				const services = await Service.find({
					_id: { $in: serviceIds },
					deleted_at: null,
				}).lean<Array<{ is_available: boolean; is_active: boolean }>>();

				const unavailableServices = services.filter(
					(service) => !service.is_available || !service.is_active
				);

				if (unavailableServices.length > 0) {
					throw customError(
						400,
						"Cannot make package available. Some services are not available"
					);
				}
			}

			packageDoc.is_available = !packageDoc.is_available;
			packageDoc.updated_by = userId as never;

			await packageDoc.save();

			const updatedPackage = await Package.findById(id).lean<PackageLean>();

			if (!updatedPackage) {
				throw customError(500, "Failed to toggle availability");
			}

			const packageResponse = convertToResponse(updatedPackage);

			res.status(200).json({
				status: 200,
				message: `Package ${
					packageDoc.is_available ? "made available" : "made unavailable"
				} successfully!`,
				data: packageResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
