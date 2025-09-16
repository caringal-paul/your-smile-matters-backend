import { Router, Request, Response, NextFunction } from "express";
import { Package } from "../../models/Package";
import { Service } from "../../models/Service";
import mongoose, { Types } from "mongoose";
import { MetaData, TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authMiddleware";
import { customError } from "../../middleware/errorHandler";

const router = Router();

type ServiceInfo = {
	id: string;
	name: string;
	category: string;
	description?: string | null;
	is_available: boolean;
};

type PackageResponse = MetaData & {
	id: string;
	name: string;
	description?: string | null;
	price: number;
	looks: number;
	included_services: ServiceInfo[];
	is_available: boolean;
	total_services_count: number;
};

type PackageListResponse = MetaData & {
	id: string;
	name: string;
	description?: string | null;
	price: number;
	looks: number;
	included_services_count: number;
	is_available: boolean;
};

// GET /api/packages/admin (Admin view with full details)
router.get(
	"/",
	authenticateAmiUserToken,
	// requirePermission("package:read"),
	async (
		req: Request,
		res: TypedResponse<PackageResponse[]>,
		next: NextFunction
	) => {
		try {
			const packages = await Package.find()
				.populate({
					path: "included_services",
					select: "name category description is_available",
				})
				.lean();

			const packagesResponse: PackageResponse[] = packages.map(
				({ _id: id, included_services, ...pkg }) => {
					const services: ServiceInfo[] = included_services.map(
						(service: any) => ({
							id: service._id.toString(),
							name: service.name,
							category: service.category,
							description: service.description,
							is_available: service.is_available,
						})
					);

					return {
						id: id.toString(),
						...pkg,
						included_services: services,
						total_services_count: services.length,
					};
				}
			);

			res.status(200).json({
				status: 200,
				message: "Packages fetched successfully!",
				data: packagesResponse,
			});
		} catch (error) {
			console.error("Error fetching packages:", error);
			next(error);
		}
	}
);

// GET /api/packages/:id (Detailed package view for booking)
router.get(
	"/:id",
	async (
		req: Request,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
				throw customError(400, "Invalid package ID format");
			}

			const packageDoc = await Package.findById(req.params.id)
				.populate({
					path: "included_services",
					select: "name category description is_available",
				})
				.lean();

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			const { _id, included_services, ...packageWithoutObjectId } = packageDoc;

			const services: ServiceInfo[] = included_services.map((service: any) => ({
				id: service._id.toString(),
				name: service.name,
				category: service.category,
				description: service.description,
				is_available: service.is_available,
			}));

			const packageResponse: PackageResponse = {
				id: _id.toString(),
				...packageWithoutObjectId,
				included_services: services,
				total_services_count: services.length,
			};

			res.status(200).json({
				status: 200,
				message: "Package fetched successfully!",
				data: packageResponse,
			});
		} catch (error) {
			console.error("Error fetching package:", error);
			next(error);
		}
	}
);

// POST /api/packages (Create new package)
router.post(
	"/",
	authenticateAmiUserToken,
	// requirePermission("package:create"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			const {
				name,
				description,
				price,
				looks,
				included_services,
				is_available,
			} = req.body;
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			// Validate included_services
			if (
				!included_services ||
				!Array.isArray(included_services) ||
				included_services.length === 0
			) {
				throw customError(400, "Package must include at least one service");
			}

			// Validate all service IDs
			for (const serviceId of included_services) {
				if (!mongoose.Types.ObjectId.isValid(serviceId)) {
					throw customError(400, "Invalid service ID format");
				}
			}

			// Check if all services exist and are available
			const services = await Service.find({
				_id: { $in: included_services },
			});

			if (services.length !== included_services.length) {
				throw customError(400, "One or more services do not exist");
			}

			const unavailableServices = services.filter(
				(service) => !service.is_available || !service.is_active
			);
			if (unavailableServices.length > 0) {
				throw customError(
					400,
					`The following services are not available: ${unavailableServices
						.map((s) => s.name)
						.join(", ")}`
				);
			}

			// Check if package name already exists
			const existingPackage = await Package.findOne({ name: name.trim() });
			if (existingPackage) {
				throw customError(400, "Package with this name already exists");
			}

			// Create package
			const packageDoc = new Package({
				name: name.trim(),
				description: description?.trim() || null,
				price,
				looks,
				included_services,
				is_available: is_available !== undefined ? is_available : true,
				is_active: true,
				created_by: new Types.ObjectId(userId),
				updated_by: new Types.ObjectId(userId),
				retrieved_by: null,
				deleted_by: null,
				deleted_at: null,
				retrieved_at: null,
			});

			await packageDoc.save();

			// Populate services for response
			await packageDoc.populate({
				path: "included_services",
				select: "name category description is_available",
			});

			const populatedServices: ServiceInfo[] = (
				packageDoc.included_services as any[]
			).map((service: any) => ({
				id: service._id.toString(),
				name: service.name,
				category: service.category,
				description: service.description,
				is_available: service.is_available,
			}));

			const packageResponse: PackageResponse = {
				id: String(packageDoc._id),
				name: packageDoc.name,
				description: packageDoc.description,
				price: packageDoc.price,
				looks: packageDoc.looks,
				included_services: populatedServices,
				is_available: packageDoc.is_available,
				total_services_count: populatedServices.length,
				created_at: packageDoc.created_at,
				updated_at: packageDoc.updated_at,
				is_active: packageDoc.is_active,
				created_by: packageDoc.created_by,
				updated_by: packageDoc.updated_by,
			};

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

// PATCH /api/packages/:id (Update package)
router.patch(
	"/:id",
	authenticateAmiUserToken,
	// requirePermission("package:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackageResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const {
				name,
				description,
				price,
				looks,
				included_services,
				is_available,
				is_active,
			} = req.body;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid package ID format");
			}

			// Find package
			const packageDoc = await Package.findById(id);

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			// Check if new name already exists (if name is being updated)
			if (name && name.trim() !== packageDoc.name) {
				const existingPackage = await Package.findOne({
					name: name.trim(),
					_id: { $ne: id },
				});
				if (existingPackage) {
					throw customError(400, "Package with this name already exists");
				}
			}

			// Validate included_services if provided
			if (included_services) {
				if (
					!Array.isArray(included_services) ||
					included_services.length === 0
				) {
					throw customError(400, "Package must include at least one service");
				}

				// Validate all service IDs
				for (const serviceId of included_services) {
					if (!mongoose.Types.ObjectId.isValid(serviceId)) {
						throw customError(400, "Invalid service ID format");
					}
				}

				// Check if all services exist and are available
				const services = await Service.find({
					_id: { $in: included_services },
				});

				if (services.length !== included_services.length) {
					throw customError(400, "One or more services do not exist");
				}

				const unavailableServices = services.filter(
					(service) => !service.is_available || !service.is_active
				);
				if (unavailableServices.length > 0) {
					throw customError(
						400,
						`The following services are not available: ${unavailableServices
							.map((s) => s.name)
							.join(", ")}`
					);
				}
			}

			// Update only provided fields
			if (name !== undefined) packageDoc.name = name.trim();
			if (description !== undefined)
				packageDoc.description = description?.trim() || null;
			if (price !== undefined) packageDoc.price = price;
			if (looks !== undefined) packageDoc.looks = looks;
			if (included_services !== undefined)
				packageDoc.included_services = included_services;
			if (is_available !== undefined) packageDoc.is_available = is_available;
			if (is_active !== undefined) packageDoc.is_active = is_active;

			// Track audit info
			packageDoc.updated_by = new Types.ObjectId(userId);
			packageDoc.updated_at = new Date();

			await packageDoc.save();

			// Populate services for response
			await packageDoc.populate({
				path: "included_services",
				select: "name category description is_available",
			});

			const populatedServices: ServiceInfo[] = (
				packageDoc.included_services as any[]
			).map((service: any) => ({
				id: service._id.toString(),
				name: service.name,
				category: service.category,
				description: service.description,
				is_available: service.is_available,
			}));

			const packageResponse: PackageResponse = {
				id: String(packageDoc._id),
				name: packageDoc.name,
				description: packageDoc.description,
				price: packageDoc.price,
				looks: packageDoc.looks,
				included_services: populatedServices,
				is_available: packageDoc.is_available,
				total_services_count: populatedServices.length,
				created_at: packageDoc.created_at,
				updated_at: packageDoc.updated_at,
				is_active: packageDoc.is_active,
				created_by: packageDoc.created_by,
				updated_by: packageDoc.updated_by,
				deleted_by: packageDoc.deleted_by,
				retrieved_by: packageDoc.retrieved_by,
				deleted_at: packageDoc.deleted_at,
				retrieved_at: packageDoc.retrieved_at,
			};

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

// PATCH /api/packages/deactivate/:id (Deactivate package)
router.patch(
	"/deactivate/:id",
	authenticateAmiUserToken,
	// requirePermission("package:update"),
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
				throw customError(400, "Invalid package ID format");
			}

			// Find package
			const packageDoc = await Package.findById(id);

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			// Update audit info
			packageDoc.updated_by = new Types.ObjectId(userId);
			packageDoc.deleted_by = new Types.ObjectId(userId);
			packageDoc.is_active = false;
			packageDoc.is_available = false; // Also mark as unavailable
			packageDoc.updated_at = new Date();
			packageDoc.deleted_at = new Date();

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

// PATCH /api/packages/reactivate/:id (Reactivate package)
router.patch(
	"/reactivate/:id",
	authenticateAmiUserToken,
	// requirePermission("package:update"),
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
				throw customError(400, "Invalid package ID format");
			}

			// Find package
			const packageDoc = await Package.findById(id);

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			// Check if all included services are still available
			const services = await Service.find({
				_id: { $in: packageDoc.included_services },
			});

			const unavailableServices = services.filter(
				(service) => !service.is_available || !service.is_active
			);
			if (unavailableServices.length > 0) {
				throw customError(
					400,
					`Cannot reactivate package. The following services are not available: ${unavailableServices
						.map((s) => s.name)
						.join(", ")}`
				);
			}

			packageDoc.updated_by = new Types.ObjectId(userId);
			packageDoc.retrieved_by = new Types.ObjectId(userId);
			packageDoc.is_active = true;
			packageDoc.is_available = true;
			packageDoc.updated_at = new Date();
			packageDoc.retrieved_at = new Date();

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

// PATCH /api/packages/toggle-availability/:id (Toggle package availability)
router.patch(
	"/toggle-availability/:id",
	authenticateAmiUserToken,
	// requirePermission("package:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackageResponse>,
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
				throw customError(400, "Invalid package ID format");
			}

			// Find package
			const packageDoc = await Package.findById(id);

			if (!packageDoc) {
				throw customError(404, "Package not found");
			}

			// If making available, check if all services are available
			if (!packageDoc.is_available) {
				const services = await Service.find({
					_id: { $in: packageDoc.included_services },
				});

				const unavailableServices = services.filter(
					(service) => !service.is_available || !service.is_active
				);
				if (unavailableServices.length > 0) {
					throw customError(
						400,
						`Cannot make package available. The following services are not available: ${unavailableServices
							.map((s) => s.name)
							.join(", ")}`
					);
				}
			}

			// Toggle availability
			packageDoc.is_available = !packageDoc.is_available;
			packageDoc.updated_by = new Types.ObjectId(userId);
			packageDoc.updated_at = new Date();

			await packageDoc.save();

			// Populate services for response
			await packageDoc.populate({
				path: "included_services",
				select: "name category description is_available",
			});

			const populatedServices: ServiceInfo[] = (
				packageDoc.included_services as any[]
			).map((service: any) => ({
				id: service._id.toString(),
				name: service.name,
				category: service.category,
				description: service.description,
				is_available: service.is_available,
			}));

			const packageResponse: PackageResponse = {
				id: String(packageDoc._id),
				name: packageDoc.name,
				description: packageDoc.description,
				price: packageDoc.price,
				looks: packageDoc.looks,
				included_services: populatedServices,
				is_available: packageDoc.is_available,
				total_services_count: populatedServices.length,
				created_at: packageDoc.created_at,
				updated_at: packageDoc.updated_at,
				is_active: packageDoc.is_active,
				created_by: packageDoc.created_by,
				updated_by: packageDoc.updated_by,
				deleted_by: packageDoc.deleted_by,
				retrieved_by: packageDoc.retrieved_by,
				deleted_at: packageDoc.deleted_at,
				retrieved_at: packageDoc.retrieved_at,
			};

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
