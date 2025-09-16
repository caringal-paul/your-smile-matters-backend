import { Router, Request, Response, NextFunction } from "express";
import { Package } from "../../models/Package";
import { Service } from "../../models/Service";
import mongoose from "mongoose";
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
			// TODO: BASED IT ON POPULARITY
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

export default router;
