import { Router, Request, Response, NextFunction } from "express";
import { PackageModel, Package } from "../../models/Package";
import { ServiceModel, Service } from "../../models/Service";
import mongoose, { Types } from "mongoose";
import { MetaData, TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authMiddleware";
import { requirePermission } from "../../middleware/permissionMiddleware";
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

// GET ALL /api/packages (Public - for clients to browse)
router.get(
	"/",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			const {
				available_only = "true",
				min_price,
				max_price,
				min_looks,
				max_looks,
				sort_by = "price",
				sort_order = "asc",
			} = req.query;

			// Build filter
			const filter: any = {};
			if (available_only === "true") {
				filter.is_available = true;
				filter.is_active = true;
			}

			if (min_price)
				filter.price = { ...filter.price, $gte: Number(min_price) };
			if (max_price)
				filter.price = { ...filter.price, $lte: Number(max_price) };
			if (min_looks)
				filter.looks = { ...filter.looks, $gte: Number(min_looks) };
			if (max_looks)
				filter.looks = { ...filter.looks, $lte: Number(max_looks) };

			// Build sort
			const sortObj: any = {};
			sortObj[sort_by as string] = sort_order === "desc" ? -1 : 1;

			const packages = await Package.find(filter)
				.populate({
					path: "included_services",
					select: "name category is_available",
				})
				.sort(sortObj)
				.lean();

			const packagesResponse: PackageListResponse[] = packages.map(
				({ _id: id, included_services, ...pkg }) => ({
					id: id.toString(),
					...pkg,
					included_services_count: included_services.length,
				})
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

// GET /api/packages/admin (Admin view with full details)
router.get(
	"/admin",
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

// GET /api/packages/price-range/:min/:max (Filter by price range)
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
				price: { $gte: minPrice, $lte: maxPrice },
				is_available: true,
				is_active: true,
			})
				.populate({
					path: "included_services",
					select: "name category",
				})
				.sort({ price: 1 })
				.lean();

			const packagesResponse: PackageListResponse[] = packages.map(
				({ _id: id, included_services, ...pkg }) => ({
					id: id.toString(),
					...pkg,
					included_services_count: included_services.length,
				})
			);

			res.status(200).json({
				status: 200,
				message: `Packages in price range ₱${minPrice} - ₱${maxPrice} fetched successfully!`,
				data: packagesResponse,
			});
		} catch (error) {
			console.error("Error fetching packages by price range:", error);
			next(error);
		}
	}
);

// GET /api/packages/looks/:count (Filter by number of looks)
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
			})
				.populate({
					path: "included_services",
					select: "name category",
				})
				.sort({ price: 1 })
				.lean();

			const packagesResponse: PackageListResponse[] = packages.map(
				({ _id: id, included_services, ...pkg }) => ({
					id: id.toString(),
					...pkg,
					included_services_count: included_services.length,
				})
			);

			res.status(200).json({
				status: 200,
				message: `Packages with ${looksCount} look(s) fetched successfully!`,
				data: packagesResponse,
			});
		} catch (error) {
			console.error("Error fetching packages by looks:", error);
			next(error);
		}
	}
);

// GET /api/packages/popular (Most popular packages - could be based on bookings)
router.get(
	"/filter/popular",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			// For now, we'll consider packages with 3+ looks as "popular"
			// In a real app, this would be based on booking statistics
			const packages = await Package.find({
				looks: { $gte: 3 },
				is_available: true,
				is_active: true,
			})
				.populate({
					path: "included_services",
					select: "name category",
				})
				.sort({ looks: -1, price: 1 })
				.limit(6)
				.lean();

			const packagesResponse: PackageListResponse[] = packages.map(
				({ _id: id, included_services, ...pkg }) => ({
					id: id.toString(),
					...pkg,
					included_services_count: included_services.length,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Popular packages fetched successfully!",
				data: packagesResponse,
			});
		} catch (error) {
			console.error("Error fetching popular packages:", error);
			next(error);
		}
	}
);

// GET /api/packages/service/:serviceId (Packages containing specific service)
router.get(
	"/service/:serviceId",
	async (
		req: Request,
		res: TypedResponse<PackageListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { serviceId } = req.params;

			if (!mongoose.Types.ObjectId.isValid(serviceId)) {
				throw customError(400, "Invalid service ID format");
			}

			// Verify service exists
			const service = await Service.findById(serviceId);
			if (!service) {
				throw customError(404, "Service not found");
			}

			const packages = await Package.find({
				included_services: serviceId,
				is_available: true,
				is_active: true,
			})
				.populate({
					path: "included_services",
					select: "name category",
				})
				.sort({ price: 1 })
				.lean();

			const packagesResponse: PackageListResponse[] = packages.map(
				({ _id: id, included_services, ...pkg }) => ({
					id: id.toString(),
					...pkg,
					included_services_count: included_services.length,
				})
			);

			res.status(200).json({
				status: 200,
				message: `Packages including "${service.name}" service fetched successfully!`,
				data: packagesResponse,
			});
		} catch (error) {
			console.error("Error fetching packages by service:", error);
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
