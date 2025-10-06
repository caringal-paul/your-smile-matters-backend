import { Router, Request, NextFunction } from "express";
import { Service } from "../../models/Service";
import mongoose, { Types } from "mongoose";
import { MetaData, TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authMiddleware";
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
	created_by: Types.ObjectId;
	updated_by?: Types.ObjectId;
	deleted_by?: Types.ObjectId;
	retrieved_by?: Types.ObjectId;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
}

type ServiceResponse = MetaData & {
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToResponse(service: ServiceLean): ServiceResponse {
	const { _id, ...serviceData } = service;
	return {
		_id: _id.toString(),
		...serviceData,
	};
}

function convertToListResponse(service: ServiceLean): ServiceListResponse {
	const {
		_id,
		created_by,
		updated_by,
		deleted_by,
		retrieved_by,
		deleted_at,
		retrieved_at,
		is_active,
		created_at,
		updated_at,
		...serviceData
	} = service;
	return {
		_id: _id.toString(),
		...serviceData,
	};
}

// ============================================================================
// ADMIN SERVICE ENDPOINTS
// ============================================================================

// GET ALL /api/services/admin (Admin view with full details)
router.get(
	"/",
	authenticateAmiUserToken,
	// requirePermission("service:read"),
	async (
		req: Request,
		res: TypedResponse<ServiceResponse[]>,
		next: NextFunction
	) => {
		try {
			const {
				category,
				status = "all", // all, active, inactive, available, unavailable
				search,
				sort_by = "name",
				sort_order = "asc",
				include_deleted = "false",
			} = req.query;

			// Build admin filter
			interface ServiceFilter {
				deleted_at?: null | { $ne: null };
				category?: string;
				is_active?: boolean;
				is_available?: boolean;
				$or?: Array<{
					name?: { $regex: string | unknown; $options: string };
					description?: { $regex: string | unknown; $options: string };
				}>;
			}

			const filter: ServiceFilter = {};

			// Exclude soft-deleted by default (unless explicitly requested)
			if (include_deleted !== "true") {
				filter.deleted_at = null;
			}

			if (category && category !== "all") {
				filter.category = category as string;
			}

			if (status !== "all") {
				switch (status) {
					case "active":
						filter.is_active = true;
						break;
					case "inactive":
						filter.is_active = false;
						break;
					case "available":
						filter.is_available = true;
						filter.is_active = true;
						break;
					case "unavailable":
						filter.is_available = false;
						break;
				}
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

			console.log("Fetched services for admin:", services);

			const servicesResponse: ServiceResponse[] =
				services.map(convertToResponse);

			res.status(200).json({
				status: 200,
				message: "Services fetched successfully!",
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching services:", error);
			next(error);
		}
	}
);

// GET /api/services/filter/available (Available services - can be public or admin)
// MOVED BEFORE /:id to prevent route conflict
router.get(
	"/filter/available",
	async (
		req: Request,
		res: TypedResponse<ServiceListResponse[]>,
		next: NextFunction
	) => {
		try {
			const services = await Service.find({
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
				message: "Available services fetched successfully!",
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching available services:", error);
			next(error);
		}
	}
);

// GET /api/services/:id (Detailed service view)
router.get(
	"/:id",
	async (
		req: Request,
		res: TypedResponse<ServiceResponse>,
		next: NextFunction
	) => {
		try {
			// Validate ObjectId format
			if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
				throw customError(400, "Invalid service ID format");
			}

			// For public access, only show available and active services
			// For authenticated users, show all services (including inactive)
			const isAuthenticated = req.headers.authorization;

			interface ServiceDetailFilter {
				_id: string;
				deleted_at: null;
				is_available?: boolean;
				is_active?: boolean;
			}

			const filter: ServiceDetailFilter = {
				_id: req.params.id,
				deleted_at: null,
			};

			if (!isAuthenticated) {
				filter.is_available = true;
				filter.is_active = true;
			}

			const service = await Service.findOne(filter).lean<ServiceLean>();

			if (!service) {
				throw customError(404, "Service not found");
			}

			const serviceResponse: ServiceResponse = convertToResponse(service);

			res.status(200).json({
				status: 200,
				message: "Service fetched successfully!",
				data: serviceResponse,
			});
		} catch (error) {
			console.error("Error fetching service:", error);
			next(error);
		}
	}
);

// POST /api/services
router.post(
	"/",
	authenticateAmiUserToken,
	// requirePermission("service:create"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<ServiceResponse>,
		next: NextFunction
	) => {
		try {
			const {
				name,
				description,
				category,
				price,
				old_price,
				duration_minutes,
				is_available,
				service_gallery,
			} = req.body;

			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			// Validate required fields
			if (!name || !category || price === undefined || !service_gallery) {
				throw customError(
					400,
					"Missing required fields: name, category, price, service_gallery"
				);
			}

			// Validate price
			if (typeof price !== "number" || price < 0) {
				throw customError(400, "Price must be a non-negative number");
			}

			// Validate old_price if provided
			if (
				old_price !== undefined &&
				(typeof old_price !== "number" || old_price < 0)
			) {
				throw customError(400, "Old price must be a non-negative number");
			}

			// Validate duration_minutes if provided
			if (duration_minutes !== undefined && duration_minutes !== null) {
				if (
					typeof duration_minutes !== "number" ||
					duration_minutes < 15 ||
					duration_minutes > 24 * 60
				) {
					throw customError(
						400,
						"Duration must be between 15 minutes and 24 hours"
					);
				}
			}

			// Validate service_gallery
			if (
				!Array.isArray(service_gallery) ||
				service_gallery.length < 1 ||
				service_gallery.length > 4
			) {
				throw customError(400, "Service gallery must contain 1-4 images");
			}

			// Validate each image URL in gallery
			for (const imageUrl of service_gallery) {
				if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
					throw customError(400, "Invalid image URL in service gallery");
				}
			}

			// Validate category
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

			// Check if service name already exists (excluding soft-deleted)
			const existingService = await Service.findOne({
				name: name.trim(),
				deleted_at: null,
			});
			if (existingService) {
				throw customError(400, "Service with this name already exists");
			}

			// Create service
			const service = new Service({
				name: name.trim(),
				description: description?.trim() || null,
				category,
				price,
				old_price: old_price || undefined,
				duration_minutes:
					duration_minutes !== undefined ? duration_minutes : null,
				is_available: is_available !== undefined ? is_available : true,
				service_gallery: service_gallery.map((url: string) => url.trim()),
				is_active: true,
				created_by: new Types.ObjectId(userId),
				updated_by: new Types.ObjectId(userId),
				retrieved_by: null,
				deleted_by: null,
				deleted_at: null,
				retrieved_at: null,
			});

			await service.save();

			const serviceObj = service.toObject() as ServiceLean;
			const serviceResponse: ServiceResponse = convertToResponse(serviceObj);

			res.status(201).json({
				status: 201,
				message: "Service created successfully!",
				data: serviceResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/services/:id
router.patch(
	"/:id",
	authenticateAmiUserToken,
	// requirePermission("service:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<ServiceResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const {
				name,
				description,
				category,
				price,
				old_price,
				duration_minutes,
				is_available,
				is_active,
				service_gallery,
			} = req.body;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid service ID format");
			}

			// Validate price if provided
			if (price !== undefined && (typeof price !== "number" || price < 0)) {
				throw customError(400, "Price must be a non-negative number");
			}

			// Validate old_price if provided
			if (
				old_price !== undefined &&
				old_price !== null &&
				(typeof old_price !== "number" || old_price < 0)
			) {
				throw customError(400, "Old price must be a non-negative number");
			}

			// Validate duration_minutes if provided
			if (duration_minutes !== undefined && duration_minutes !== null) {
				if (
					typeof duration_minutes !== "number" ||
					duration_minutes < 15 ||
					duration_minutes > 24 * 60
				) {
					throw customError(
						400,
						"Duration must be between 15 minutes and 24 hours"
					);
				}
			}

			// Validate service_gallery if provided
			if (service_gallery !== undefined) {
				if (
					!Array.isArray(service_gallery) ||
					service_gallery.length < 1 ||
					service_gallery.length > 4
				) {
					throw customError(400, "Service gallery must contain 1-4 images");
				}
				for (const imageUrl of service_gallery) {
					if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
						throw customError(400, "Invalid image URL in service gallery");
					}
				}
			}

			// Validate category if provided
			if (category) {
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
			}

			// Find service (exclude soft-deleted)
			const service = await Service.findOne({
				_id: id,
				deleted_at: null,
			});

			if (!service) {
				throw customError(404, "Service not found");
			}

			// Check if new name already exists (if name is being updated)
			if (name && name.trim() !== service.name) {
				const existingService = await Service.findOne({
					name: name.trim(),
					_id: { $ne: id },
					deleted_at: null,
				});
				if (existingService) {
					throw customError(400, "Service with this name already exists");
				}
			}

			// Update only provided fields
			if (name !== undefined) service.name = name.trim();
			if (description !== undefined)
				service.description = description?.trim() || null;
			if (category !== undefined) service.category = category;
			if (price !== undefined) service.price = price;
			if (old_price !== undefined) service.old_price = old_price;
			if (duration_minutes !== undefined)
				service.duration_minutes = duration_minutes;
			if (is_available !== undefined) service.is_available = is_available;
			if (is_active !== undefined) service.is_active = is_active;
			if (service_gallery !== undefined)
				service.service_gallery = service_gallery.map((url: string) =>
					url.trim()
				);

			// Track audit info
			service.updated_by = new Types.ObjectId(userId);
			service.updated_at = new Date();

			await service.save();

			const serviceObj = service.toObject() as ServiceLean;
			const serviceResponse: ServiceResponse = convertToResponse(serviceObj);

			res.status(200).json({
				status: 200,
				message: "Service updated successfully!",
				data: serviceResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/services/deactivate/:id
router.patch(
	"/deactivate/:id",
	authenticateAmiUserToken,
	// requirePermission("service:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid service ID format");
			}

			// Find service (exclude already deleted)
			const service = await Service.findOne({
				_id: id,
				deleted_at: null,
			});

			if (!service) {
				throw customError(404, "Service not found or already deactivated");
			}

			// Update audit info
			service.updated_by = new Types.ObjectId(userId);
			service.deleted_by = new Types.ObjectId(userId);
			service.is_active = false;
			service.is_available = false; // Also mark as unavailable when deactivated
			service.updated_at = new Date();
			service.deleted_at = new Date();

			await service.save();

			res.status(200).json({
				status: 200,
				message: "Service deactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/services/reactivate/:id
router.patch(
	"/reactivate/:id",
	authenticateAmiUserToken,
	// requirePermission("service:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid service ID format");
			}

			// Find service (only soft-deleted ones can be reactivated)
			const service = await Service.findOne({
				_id: id,
				deleted_at: { $ne: null }, // Must be soft-deleted
			});

			if (!service) {
				throw customError(404, "Service not found or not deactivated");
			}

			service.updated_by = new Types.ObjectId(userId);
			service.retrieved_by = new Types.ObjectId(userId);
			service.is_active = true;
			service.is_available = true; // Also mark as available when reactivated
			service.updated_at = new Date();
			service.retrieved_at = new Date();
			service.deleted_at = null; // Clear deleted_at

			await service.save();

			res.status(200).json({
				status: 200,
				message: "Service reactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/services/toggle-availability/:id
router.patch(
	"/toggle-availability/:id",
	authenticateAmiUserToken,
	// requirePermission("service:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<ServiceResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid service ID format");
			}

			// Find service (exclude soft-deleted)
			const service = await Service.findOne({
				_id: id,
				deleted_at: null,
			});

			if (!service) {
				throw customError(404, "Service not found");
			}

			// Toggle availability
			service.is_available = !service.is_available;
			service.updated_by = new Types.ObjectId(userId);
			service.updated_at = new Date();

			await service.save();

			const serviceObj = service.toObject() as ServiceLean;
			const serviceResponse: ServiceResponse = convertToResponse(serviceObj);

			res.status(200).json({
				status: 200,
				message: `Service ${
					service.is_available ? "made available" : "made unavailable"
				} successfully!`,
				data: serviceResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
