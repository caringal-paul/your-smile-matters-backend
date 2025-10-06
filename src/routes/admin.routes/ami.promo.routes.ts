import { Router, NextFunction } from "express";
import {
	Promo,
	PromoModel,
	PromoType,
	DiscountType,
	PromoDocument,
} from "../../models/Promo";
import { Booking } from "../../models/Booking";
import mongoose, { Types } from "mongoose";
import { MetaData, TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";

const router = Router();

// Types for admin responses
type AdminPromoResponse = MetaData & {
	_id: string;
	promo_code: string;
	name: string;
	description?: string | null;
	promo_type: string;
	discount_type: string;
	discount_value: number;
	min_advance_days?: number | null;
	min_booking_amount?: number | null;
	max_discount_amount?: number | null;
	valid_from: Date;
	valid_until: Date;
	usage_limit?: number | null;
	usage_count: number;
	is_active: boolean;
	conditions?: string | null;
	status: "Active" | "Expired" | "Inactive" | "Usage Exceeded";
	effectiveness?: {
		usage_rate: number;
		days_remaining: number;
		revenue_generated?: number;
	};
};

type PromoCreateAuthenticatedRequest = {
	promo_code: string;
	name: string;
	description?: string;
	promo_type: PromoType;
	discount_type: DiscountType;
	discount_value: number;
	min_advance_days?: number;
	min_booking_amount?: number;
	max_discount_amount?: number;
	valid_from: string;
	valid_until: string;
	usage_limit?: number;
	conditions?: string;
	is_active?: boolean;
};

type PromoUpdateAuthenticatedRequest = Partial<PromoCreateAuthenticatedRequest>;

type PromoStatsResponse = {
	total_promos: number;
	active_promos: number;
	expired_promos: number;
	total_usage: number;
	revenue_impact: number;
	top_performing: Array<{
		promo_code: string;
		name: string;
		usage_count: number;
		usage_rate: number;
	}>;
	promo_type_breakdown: Array<{
		type: string;
		count: number;
		usage: number;
	}>;
};

type BulkActionResponse = {
	success_count: number;
	failed_count: number;
	failed_items?: Array<{
		promo_code: string;
		error: string;
	}>;
};

// Helper function to get promo status
const getPromoStatus = (
	promo: PromoModel
): "Active" | "Expired" | "Inactive" | "Usage Exceeded" => {
	const now = new Date();

	if (!promo.is_active) return "Inactive";
	if (now > promo.valid_until) return "Expired";
	if (promo.usage_limit && promo.usage_count >= promo.usage_limit)
		return "Usage Exceeded";
	return "Active";
};

// Helper function to calculate promo effectiveness
const calculateEffectiveness = (promo: PromoModel) => {
	const now = new Date();
	const daysRemaining = Math.max(
		0,
		Math.ceil(
			(promo.valid_until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		)
	);
	const usageRate = promo.usage_limit
		? (promo.usage_count / promo.usage_limit) * 100
		: 0;

	return {
		usage_rate: Math.round(usageRate * 100) / 100,
		days_remaining: daysRemaining,
	};
};

// POST /api/admin/promos (Create new promo)
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse>,
		next: NextFunction
	) => {
		try {
			const {
				promo_code,
				name,
				description,
				promo_type,
				discount_type,
				discount_value,
				min_advance_days,
				min_booking_amount,
				max_discount_amount,
				valid_from,
				valid_until,
				usage_limit,
				conditions,
				is_active = true,
			} = req.body;

			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			// Validate required fields
			if (
				!promo_code ||
				!name ||
				!promo_type ||
				!discount_type ||
				!discount_value ||
				!valid_from ||
				!valid_until
			) {
				throw customError(400, "Missing required fields");
			}

			// Check if promo code already exists
			const existingPromo = await Promo.findOne({
				promo_code: promo_code.toUpperCase(),
				deleted_at: null,
			});

			if (existingPromo) {
				throw customError(400, "Promo code already exists");
			}

			// Validate dates
			const fromDate = new Date(valid_from);
			const untilDate = new Date(valid_until);

			if (fromDate >= untilDate) {
				throw customError(
					400,
					"Valid until date must be after valid from date"
				);
			}

			const newPromo: PromoDocument = new Promo({
				promo_code: promo_code.toUpperCase(),
				name,
				description,
				promo_type,
				discount_type,
				discount_value,
				min_advance_days,
				min_booking_amount,
				max_discount_amount,
				valid_from: fromDate,
				valid_until: untilDate,
				usage_limit,
				conditions,
				is_active,
				usage_count: 0,
				created_by: userId,
			});

			await newPromo.save();

			const adminPromoResponse: AdminPromoResponse = {
				_id: newPromo._id.toString(),
				promo_code: newPromo.promo_code,
				name: newPromo.name,
				description: newPromo.description,
				promo_type: newPromo.promo_type,
				discount_type: newPromo.discount_type,
				discount_value: newPromo.discount_value,
				min_advance_days: newPromo.min_advance_days,
				min_booking_amount: newPromo.min_booking_amount,
				max_discount_amount: newPromo.max_discount_amount,
				valid_from: newPromo.valid_from,
				valid_until: newPromo.valid_until,
				usage_limit: newPromo.usage_limit,
				usage_count: newPromo.usage_count,
				is_active: newPromo.is_active,
				conditions: newPromo.conditions,
				created_at: newPromo.created_at,
				updated_at: newPromo.updated_at,
				created_by: newPromo.created_by,
				updated_by: undefined,
				status: getPromoStatus(newPromo),
				effectiveness: calculateEffectiveness(newPromo),
			};

			res.status(201).json({
				status: 201,
				message: "Promo created successfully!",
				data: adminPromoResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// POST /api/admin/promos/bulk/deactivate (Bulk deactivate promos)
router.post(
	"/bulk/deactivate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BulkActionResponse>,
		next: NextFunction
	) => {
		try {
			const { promo_ids } = req.body;

			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			if (!promo_ids || !Array.isArray(promo_ids) || promo_ids.length === 0) {
				throw customError(400, "Promo IDs array is required");
			}

			const failedItems: Array<{ promo_code: string; error: string }> = [];
			let successCount = 0;

			for (const promoId of promo_ids) {
				try {
					const promo = await Promo.findOne({
						$or: [
							{ _id: mongoose.isValidObjectId(promoId) ? promoId : null },
							{ promo_code: promoId.toUpperCase() },
						],
						deleted_at: null,
					});

					if (!promo) {
						failedItems.push({ promo_code: promoId, error: "Promo not found" });
						continue;
					}

					promo.is_active = false;
					promo.updated_by = new Types.ObjectId(userId) || promo.updated_by;
					await promo.save();
					successCount++;
				} catch (error) {
					failedItems.push({ promo_code: promoId, error: "Failed to update" });
				}
			}

			const bulkResponse: BulkActionResponse = {
				success_count: successCount,
				failed_count: failedItems.length,
				...(failedItems.length > 0 && { failed_items: failedItems }),
			};

			res.status(200).json({
				status: 200,
				message: `Bulk deactivation completed: ${successCount} successful, ${failedItems.length} failed`,
				data: bulkResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// POST /api/admin/promos/duplicate/:id (Duplicate existing promo)
router.post(
	"/duplicate/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { new_promo_code, new_name } = req.body;

			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			if (!new_promo_code) {
				throw customError(400, "New promo code is required");
			}

			// Find original promo
			const originalPromo = await Promo.findOne({
				$or: [
					{ _id: mongoose.isValidObjectId(id) ? id : null },
					{ promo_code: id.toUpperCase() },
				],
				deleted_at: null,
			});

			if (!originalPromo) {
				throw customError(404, "Original promo not found");
			}

			// Check if new promo code already exists
			const existingPromo = await Promo.findOne({
				promo_code: new_promo_code.toUpperCase(),
				deleted_at: null,
			});

			if (existingPromo) {
				throw customError(400, "New promo code already exists");
			}

			// Create duplicate promo
			const duplicatedPromo = new Promo({
				promo_code: new_promo_code.toUpperCase(),
				name: new_name || `${originalPromo.name} (Copy)`,
				description: originalPromo.description,
				promo_type: originalPromo.promo_type,
				discount_type: originalPromo.discount_type,
				discount_value: originalPromo.discount_value,
				min_advance_days: originalPromo.min_advance_days,
				min_booking_amount: originalPromo.min_booking_amount,
				max_discount_amount: originalPromo.max_discount_amount,
				valid_from: originalPromo.valid_from,
				valid_until: originalPromo.valid_until,
				usage_limit: originalPromo.usage_limit,
				conditions: originalPromo.conditions,
				is_active: false, // Start as inactive for review
				usage_count: 0,
				created_by: new Types.ObjectId(userId),
			});

			await duplicatedPromo.save();

			const adminPromoResponse: AdminPromoResponse = {
				_id: duplicatedPromo._id.toString(),
				promo_code: duplicatedPromo.promo_code,
				name: duplicatedPromo.name,
				description: duplicatedPromo.description,
				promo_type: duplicatedPromo.promo_type,
				discount_type: duplicatedPromo.discount_type,
				discount_value: duplicatedPromo.discount_value,
				min_advance_days: duplicatedPromo.min_advance_days,
				min_booking_amount: duplicatedPromo.min_booking_amount,
				max_discount_amount: duplicatedPromo.max_discount_amount,
				valid_from: duplicatedPromo.valid_from,
				valid_until: duplicatedPromo.valid_until,
				usage_limit: duplicatedPromo.usage_limit,
				usage_count: duplicatedPromo.usage_count,
				is_active: duplicatedPromo.is_active,
				conditions: duplicatedPromo.conditions,
				created_at: duplicatedPromo.created_at,
				updated_at: duplicatedPromo.updated_at,
				created_by: duplicatedPromo.created_by,
				updated_by: undefined,
				status: getPromoStatus(duplicatedPromo),
				effectiveness: calculateEffectiveness(duplicatedPromo),
			};

			res.status(201).json({
				status: 201,
				message: "Promo duplicated successfully!",
				data: adminPromoResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/admin/promos/expiring-soon (Get promos expiring within next 7 days)
router.get(
	"/expiring-soon",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse[]>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const { days = 7 } = req.query;
			const now = new Date();
			const futureDate = new Date(
				now.getTime() + parseInt(days as string) * 24 * 60 * 60 * 1000
			);

			const expiringPromos = await Promo.find({
				deleted_at: null,
				is_active: true,
				valid_until: {
					$gte: now,
					$lte: futureDate,
				},
			})
				.populate("created_by", "first_name last_name email")
				.sort({ valid_until: 1 })
				.lean();

			const adminPromosResponse: AdminPromoResponse[] = expiringPromos.map(
				(promo) => ({
					_id: promo._id.toString(),
					promo_code: promo.promo_code,
					name: promo.name,
					description: promo.description,
					promo_type: promo.promo_type,
					discount_type: promo.discount_type,
					discount_value: promo.discount_value,
					min_advance_days: promo.min_advance_days,
					min_booking_amount: promo.min_booking_amount,
					max_discount_amount: promo.max_discount_amount,
					valid_from: promo.valid_from,
					valid_until: promo.valid_until,
					usage_limit: promo.usage_limit,
					usage_count: promo.usage_count,
					is_active: promo.is_active,
					conditions: promo.conditions,
					created_at: promo.created_at,
					updated_at: promo.updated_at,
					created_by: promo.created_by,
					updated_by: promo.updated_by,
					status: getPromoStatus(promo as PromoModel),
					effectiveness: calculateEffectiveness(promo as PromoModel),
				})
			);

			res.status(200).json({
				status: 200,
				message: `Promos expiring within ${days} days fetched successfully!`,
				data: adminPromosResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/admin/promos (Get all promos with filters and pagination)
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<{
			promos: AdminPromoResponse[];
			pagination: {
				current_page: number;
				total_pages: number;
				total_items: number;
				items_per_page: number;
			};
		}>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const {
				page = 1,
				limit = 10,
				promo_type,
				status,
				search,
				sort_by = "created_at",
				sort_order = "desc",
				date_from,
				date_to,
			} = req.query;

			const pageNum = parseInt(page as string);
			const limitNum = parseInt(limit as string);
			const skip = (pageNum - 1) * limitNum;

			// Build filter
			const filter: any = { deleted_at: null };

			if (promo_type && promo_type !== "all") {
				filter.promo_type = promo_type;
			}

			if (search) {
				filter.$or = [
					{ promo_code: { $regex: search, $options: "i" } },
					{ name: { $regex: search, $options: "i" } },
					{ description: { $regex: search, $options: "i" } },
				];
			}

			if (date_from || date_to) {
				filter.created_at = {};
				if (date_from) filter.created_at.$gte = new Date(date_from as string);
				if (date_to) filter.created_at.$lte = new Date(date_to as string);
			}

			// Handle status filter
			const now = new Date();
			if (status) {
				switch (status) {
					case "Active":
						filter.is_active = true;
						filter.valid_until = { $gte: now };
						filter.$expr = {
							$or: [
								{ $eq: ["$usage_limit", null] },
								{ $lt: ["$usage_count", "$usage_limit"] },
							],
						};
						break;
					case "Expired":
						filter.valid_until = { $lt: now };
						break;
					case "Inactive":
						filter.is_active = false;
						break;
					case "Usage Exceeded":
						filter.$expr = {
							$and: [
								{ $ne: ["$usage_limit", null] },
								{ $gte: ["$usage_count", "$usage_limit"] },
							],
						};
						break;
				}
			}

			// Build sort
			const sortOrder = sort_order === "desc" ? -1 : 1;
			const sortObj: any = {};
			sortObj[sort_by as string] = sortOrder;

			// Get promos with pagination
			const [promos, totalCount] = await Promise.all([
				Promo.find(filter)
					.populate("created_by", "first_name last_name email")
					.populate("updated_by", "first_name last_name email")
					.sort(sortObj)
					.skip(skip)
					.limit(limitNum)
					.lean(),
				Promo.countDocuments(filter),
			]);

			const adminPromosResponse: AdminPromoResponse[] = promos.map((promo) => ({
				_id: promo._id.toString(),
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				min_advance_days: promo.min_advance_days,
				min_booking_amount: promo.min_booking_amount,
				max_discount_amount: promo.max_discount_amount,
				valid_from: promo.valid_from,
				valid_until: promo.valid_until,
				usage_limit: promo.usage_limit,
				usage_count: promo.usage_count,
				is_active: promo.is_active,
				conditions: promo.conditions,
				created_at: promo.created_at,
				updated_at: promo.updated_at,
				created_by: promo.created_by,
				updated_by: promo.updated_by,
				status: getPromoStatus(promo as PromoModel),
				effectiveness: calculateEffectiveness(promo as PromoModel),
			}));

			const totalPages = Math.ceil(totalCount / limitNum);

			res.status(200).json({
				status: 200,
				message: "Promos fetched successfully!",
				data: {
					promos: adminPromosResponse,
					pagination: {
						current_page: pageNum,
						total_pages: totalPages,
						total_items: totalCount,
						items_per_page: limitNum,
					},
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/admin/promos/:id (Get specific promo details)
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse & { usage_history?: any[] }>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const { id } = req.params;
			const { include_usage_history } = req.query;

			const promo = await Promo.findOne({
				$or: [
					{ _id: mongoose.isValidObjectId(id) ? id : null },
					{ promo_code: id.toUpperCase() },
				],
				deleted_at: null,
			})
				.populate("created_by", "first_name last_name email")
				.populate("updated_by", "first_name last_name email")
				.lean();

			if (!promo) {
				throw customError(404, "Promo not found");
			}

			let usageHistory: any[] = [];

			if (include_usage_history === "true") {
				// Get recent bookings that used this promo
				usageHistory = await Booking.find({
					promo_code: promo.promo_code,
					is_active: true,
				})
					.select(
						"booking_date total_amount discount_amount customer_id created_at status"
					)
					.populate("customer_id", "first_name last_name email")
					.sort({ created_at: -1 })
					.limit(20)
					.lean();
			}

			const adminPromoResponse: AdminPromoResponse & { usage_history?: any[] } =
				{
					_id: promo._id.toString(),
					promo_code: promo.promo_code,
					name: promo.name,
					description: promo.description,
					promo_type: promo.promo_type,
					discount_type: promo.discount_type,
					discount_value: promo.discount_value,
					min_advance_days: promo.min_advance_days,
					min_booking_amount: promo.min_booking_amount,
					max_discount_amount: promo.max_discount_amount,
					valid_from: promo.valid_from,
					valid_until: promo.valid_until,
					usage_limit: promo.usage_limit,
					usage_count: promo.usage_count,
					is_active: promo.is_active,
					conditions: promo.conditions,
					created_at: promo.created_at,
					updated_at: promo.updated_at,
					created_by: promo.created_by,
					updated_by: promo.updated_by,
					status: getPromoStatus(promo as PromoModel),
					effectiveness: calculateEffectiveness(promo as PromoModel),
					...(include_usage_history === "true" && {
						usage_history: usageHistory,
					}),
				};

			res.status(200).json({
				status: 200,
				message: "Promo details fetched successfully!",
				data: adminPromoResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PUT /api/admin/promos/:id (Update promo)
router.patch(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const { id } = req.params;
			const updateData = req.body;

			const promo = await Promo.findOne({
				$or: [
					{ _id: mongoose.isValidObjectId(id) ? id : null },
					{ promo_code: id.toUpperCase() },
				],
				deleted_at: null,
			});

			if (!promo) {
				throw customError(404, "Promo not found");
			}

			// Validate promo code uniqueness if being updated
			if (
				updateData.promo_code &&
				updateData.promo_code.toUpperCase() !== promo.promo_code
			) {
				const existingPromo = await Promo.findOne({
					promo_code: updateData.promo_code.toUpperCase(),
					deleted_at: null,
					_id: { $ne: promo._id },
				});

				if (existingPromo) {
					throw customError(400, "Promo code already exists");
				}
			}

			// Validate dates if being updated
			if (updateData.valid_from || updateData.valid_until) {
				const fromDate = updateData.valid_from
					? new Date(updateData.valid_from)
					: promo.valid_from;
				const untilDate = updateData.valid_until
					? new Date(updateData.valid_until)
					: promo.valid_until;

				if (fromDate >= untilDate) {
					throw customError(
						400,
						"Valid until date must be after valid from date"
					);
				}
			}

			// Update fields
			Object.keys(updateData).forEach((key) => {
				if (key === "promo_code" && updateData[key]) {
					promo[key] = updateData[key]!.toUpperCase();
				} else if (key === "valid_from" || key === "valid_until") {
					promo[key] = new Date(updateData[key] as string);
				} else if (
					updateData[key as keyof PromoUpdateAuthenticatedRequest] !== undefined
				) {
					(promo as any)[key] =
						updateData[key as keyof PromoUpdateAuthenticatedRequest];
				}
			});

			promo.updated_by = new Types.ObjectId(userId) || promo.updated_by;
			await promo.save();

			const adminPromoResponse: AdminPromoResponse = {
				_id: promo._id.toString(),
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				min_advance_days: promo.min_advance_days,
				min_booking_amount: promo.min_booking_amount,
				max_discount_amount: promo.max_discount_amount,
				valid_from: promo.valid_from,
				valid_until: promo.valid_until,
				usage_limit: promo.usage_limit,
				usage_count: promo.usage_count,
				is_active: promo.is_active,
				conditions: promo.conditions,
				created_at: promo.created_at,
				updated_at: promo.updated_at,
				created_by: promo.created_by,
				updated_by: promo.updated_by,
				status: getPromoStatus(promo),
				effectiveness: calculateEffectiveness(promo),
			};

			res.status(200).json({
				status: 200,
				message: "Promo updated successfully!",
				data: adminPromoResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// DELETE /api/admin/promos/:id (Soft delete promo)
router.delete(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<{ message: string }>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const { id } = req.params;

			const promo = await Promo.findOne({
				$or: [
					{ _id: mongoose.isValidObjectId(id) ? id : null },
					{ promo_code: id.toUpperCase() },
				],
				deleted_at: null,
			});

			if (!promo) {
				throw customError(404, "Promo not found");
			}

			// Soft delete
			promo.deleted_at = new Date();
			promo.deleted_by = new Types.ObjectId(userId) || promo.updated_by;

			promo.is_active = false;
			await promo.save();

			res.status(200).json({
				status: 200,
				message: "Promo deleted successfully!",
				data: { message: `Promo ${promo.promo_code} has been deleted` },
			});
		} catch (error) {
			next(error);
		}
	}
);

// POST /api/admin/promos/:id/activate (Activate promo)
router.post(
	"/:id/activate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const { id } = req.params;

			const promo = await Promo.findOne({
				$or: [
					{ _id: mongoose.isValidObjectId(id) ? id : null },
					{ promo_code: id.toUpperCase() },
				],
				deleted_at: null,
			});

			if (!promo) {
				throw customError(404, "Promo not found");
			}

			// Check if promo can be activated (not expired)
			const now = new Date();
			if (now > promo.valid_until) {
				throw customError(400, "Cannot activate expired promo");
			}

			promo.is_active = true;
			promo.updated_by = new Types.ObjectId(userId) || promo.updated_by;
			await promo.save();

			const adminPromoResponse: AdminPromoResponse = {
				_id: promo._id.toString(),
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				min_advance_days: promo.min_advance_days,
				min_booking_amount: promo.min_booking_amount,
				max_discount_amount: promo.max_discount_amount,
				valid_from: promo.valid_from,
				valid_until: promo.valid_until,
				usage_limit: promo.usage_limit,
				usage_count: promo.usage_count,
				is_active: promo.is_active,
				conditions: promo.conditions,
				created_at: promo.created_at,
				updated_at: promo.updated_at,
				created_by: promo.created_by,
				updated_by: promo.updated_by,
				status: getPromoStatus(promo),
				effectiveness: calculateEffectiveness(promo),
			};

			res.status(200).json({
				status: 200,
				message: "Promo activated successfully!",
				data: adminPromoResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// POST /api/admin/promos/:id/deactivate (Deactivate promo)
router.post(
	"/:id/deactivate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<AdminPromoResponse>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const { id } = req.params;

			const promo = await Promo.findOne({
				$or: [
					{ _id: mongoose.isValidObjectId(id) ? id : null },
					{ promo_code: id.toUpperCase() },
				],
				deleted_at: null,
			});

			if (!promo) {
				throw customError(404, "Promo not found");
			}

			promo.is_active = false;
			promo.updated_by = new Types.ObjectId(userId) || promo.updated_by;
			await promo.save();

			const adminPromoResponse: AdminPromoResponse = {
				_id: promo._id.toString(),
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				min_advance_days: promo.min_advance_days,
				min_booking_amount: promo.min_booking_amount,
				max_discount_amount: promo.max_discount_amount,
				valid_from: promo.valid_from,
				valid_until: promo.valid_until,
				usage_limit: promo.usage_limit,
				usage_count: promo.usage_count,
				is_active: promo.is_active,
				conditions: promo.conditions,
				created_at: promo.created_at,
				updated_at: promo.updated_at,
				created_by: promo.created_by,
				updated_by: promo.updated_by,
				status: getPromoStatus(promo),
				effectiveness: calculateEffectiveness(promo),
			};

			res.status(200).json({
				status: 200,
				message: "Promo deactivated successfully!",
				data: adminPromoResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/admin/promos/stats/dashboard (Get promo statistics for dashboard)
router.get(
	"/stats/dashboard",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PromoStatsResponse>,
		next: NextFunction
	) => {
		try {
			const now = new Date();

			// Get basic counts
			const [totalPromos, activePromos, expiredPromos] = await Promise.all([
				Promo.countDocuments({ deleted_at: null }),
				Promo.countDocuments({
					deleted_at: null,
					is_active: true,
					valid_until: { $gte: now },
					$expr: {
						$or: [
							{ $eq: ["$usage_limit", null] },
							{ $lt: ["$usage_count", "$usage_limit"] },
						],
					},
				}),
				Promo.countDocuments({ deleted_at: null, valid_until: { $lt: now } }),
			]);

			// Get usage statistics
			const usageStats = await Promo.aggregate([
				{ $match: { deleted_at: null } },
				{
					$group: {
						_id: null,
						total_usage: { $sum: "$usage_count" },
					},
				},
			]);

			// Get top performing promos
			const topPerforming = await Promo.aggregate([
				{ $match: { deleted_at: null, usage_count: { $gt: 0 } } },
				{
					$addFields: {
						usage_rate: {
							$cond: [
								{ $eq: ["$usage_limit", null] },
								0,
								{ $divide: ["$usage_count", "$usage_limit"] },
							],
						},
					},
				},
				{ $sort: { usage_count: -1 } },
				{ $limit: 5 },
				{
					$project: {
						promo_code: 1,
						name: 1,
						usage_count: 1,
						usage_rate: { $multiply: ["$usage_rate", 100] },
					},
				},
			]);

			// Get promo type breakdown
			const promoTypeBreakdown = await Promo.aggregate([
				{ $match: { deleted_at: null } },
				{
					$group: {
						_id: "$promo_type",
						count: { $sum: 1 },
						usage: { $sum: "$usage_count" },
					},
				},
				{
					$project: {
						type: "$_id",
						count: 1,
						usage: 1,
						_id: 0,
					},
				},
				{ $sort: { count: -1 } },
			]);

			const statsResponse: PromoStatsResponse = {
				total_promos: totalPromos,
				active_promos: activePromos,
				expired_promos: expiredPromos,
				total_usage: usageStats[0]?.total_usage || 0,
				revenue_impact: 0, // This would need booking data integration
				top_performing: topPerforming,
				promo_type_breakdown: promoTypeBreakdown,
			};

			res.status(200).json({
				status: 200,
				message: "Promo statistics fetched successfully!",
				data: statsResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// POST /api/admin/promos/bulk/activate (Bulk activate promos)
router.post(
	"/bulk/activate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BulkActionResponse>,
		next: NextFunction
	) => {
		try {
			const { promo_ids } = req.body;
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			if (!promo_ids || !Array.isArray(promo_ids) || promo_ids.length === 0) {
				throw customError(400, "Promo IDs array is required");
			}

			const now = new Date();
			const failedItems: Array<{ promo_code: string; error: string }> = [];
			let successCount = 0;

			for (const promoId of promo_ids) {
				try {
					const promo = await Promo.findOne({
						$or: [
							{ _id: mongoose.isValidObjectId(promoId) ? promoId : null },
							{ promo_code: promoId.toUpperCase() },
						],
						deleted_at: null,
					});

					if (!promo) {
						failedItems.push({ promo_code: promoId, error: "Promo not found" });
						continue;
					}

					if (now > promo.valid_until) {
						failedItems.push({
							promo_code: promo.promo_code,
							error: "Promo has expired",
						});
						continue;
					}

					promo.is_active = true;
					promo.updated_by = new Types.ObjectId(userId) || promo.updated_by;
					await promo.save();
					successCount++;
				} catch (error) {
					failedItems.push({ promo_code: promoId, error: "Failed to update" });
				}
			}

			const bulkResponse: BulkActionResponse = {
				success_count: successCount,
				failed_count: failedItems.length,
				...(failedItems.length > 0 && { failed_items: failedItems }),
			};

			res.status(200).json({
				status: 200,
				message: `Bulk activation completed: ${successCount} successful, ${failedItems.length} failed`,
				data: bulkResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
