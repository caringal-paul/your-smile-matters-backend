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

type ServiceResponse = MetaData & {
	id: string;
	name: string;
	description?: string | null;
	category: string;
	is_available: boolean;
};

type ServiceListResponse = {
	id: string;
	name: string;
	description?: string | null;
	category: string;
	is_available: boolean;
};

// GET ALL /api/services/admin (Admin view with full details)
router.get(
	"/admin",
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
			} = req.query;

			// Build admin filter
			const filter: any = {};

			if (category && category !== "all") {
				filter.category = category;
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
			const sortObj: any = {};
			sortObj[sort_by as string] = sort_order === "desc" ? -1 : 1;

			const services = await Service.find(filter).sort(sortObj).lean();

			console.log("Fetched services for admin:", services);

			const servicesResponse: ServiceResponse[] = services.map(
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
			console.error("Error fetching services:", error);
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
			// For authenticated users, show all services
			const isAuthenticated = req.headers.authorization;

			const filter: any = { _id: req.params.id };
			if (!isAuthenticated) {
				filter.is_available = true;
				filter.is_active = true;
			}

			const service = await Service.findOne(filter).lean();

			if (!service) {
				throw customError(404, "Service not found");
			}

			const { _id, ...serviceWithoutObjectId } = service;

			const serviceResponse: ServiceResponse = {
				id: _id.toString(),
				...serviceWithoutObjectId,
			};

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

// GET /api/services/filter/available (Available services - can be public or admin)
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
				message: "Available services fetched successfully!",
				data: servicesResponse,
			});
		} catch (error) {
			console.error("Error fetching available services:", error);
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
			const { name, description, category, is_available } = req.body;

			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");

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

			// Check if service name already exists
			const existingService = await Service.findOne({ name: name.trim() });
			if (existingService) {
				throw customError(400, "Service with this name already exists");
			}

			// Create service
			const service = new Service({
				name: name.trim(),
				description: description?.trim() || null,
				category,
				is_available: is_available !== undefined ? is_available : true,
				is_active: true,
				created_by: new Types.ObjectId(userId),
				updated_by: new Types.ObjectId(userId),
				retrieved_by: null,
				deleted_by: null,
				deleted_at: null,
				retrieved_at: null,
			});

			await service.save();

			const serviceResponse: ServiceResponse = {
				id: String(service._id),
				name: service.name,
				description: service.description,
				category: service.category,
				is_available: service.is_available,
				created_at: service.created_at,
				updated_at: service.updated_at,
				is_active: service.is_active,
				created_by: service.created_by,
				updated_by: service.updated_by,
			};

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
			const { name, description, category, is_available, is_active } = req.body;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid service ID format");
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

			// Find service
			const service = await Service.findById(id);

			if (!service) {
				throw customError(404, "Service not found");
			}

			// Check if new name already exists (if name is being updated)
			if (name && name.trim() !== service.name) {
				const existingService = await Service.findOne({
					name: name.trim(),
					_id: { $ne: id },
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
			if (is_available !== undefined) service.is_available = is_available;
			if (is_active !== undefined) service.is_active = is_active;

			// Track audit info
			service.updated_by = new Types.ObjectId(userId);
			service.updated_at = new Date();

			await service.save();

			const serviceResponse: ServiceResponse = {
				id: String(service._id),
				name: service.name,
				description: service.description,
				category: service.category,
				is_available: service.is_available,
				created_at: service.created_at,
				updated_at: service.updated_at,
				is_active: service.is_active,
				created_by: service.created_by,
				updated_by: service.updated_by,
				deleted_by: service.deleted_by,
				retrieved_by: service.retrieved_by,
				deleted_at: service.deleted_at,
				retrieved_at: service.retrieved_at,
			};

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

			// Find service
			const service = await Service.findById(id);

			if (!service) {
				throw customError(404, "Service not found");
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

			// Find service
			const service = await Service.findById(id);

			if (!service) {
				throw customError(404, "Service not found");
			}

			service.updated_by = new Types.ObjectId(userId);
			service.retrieved_by = new Types.ObjectId(userId);
			service.is_active = true;
			service.is_available = true; // Also mark as available when reactivated
			service.updated_at = new Date();
			service.retrieved_at = new Date();

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

			// Find service
			const service = await Service.findById(id);

			if (!service) {
				throw customError(404, "Service not found");
			}

			// Toggle availability
			service.is_available = !service.is_available;
			service.updated_by = new Types.ObjectId(userId);
			service.updated_at = new Date();

			await service.save();

			const serviceResponse: ServiceResponse = {
				id: String(service._id),
				name: service.name,
				description: service.description,
				category: service.category,
				is_available: service.is_available,
				created_at: service.created_at,
				updated_at: service.updated_at,
				is_active: service.is_active,
				created_by: service.created_by,
				updated_by: service.updated_by,
				deleted_by: service.deleted_by,
				retrieved_by: service.retrieved_by,
				deleted_at: service.deleted_at,
				retrieved_at: service.retrieved_at,
			};

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
