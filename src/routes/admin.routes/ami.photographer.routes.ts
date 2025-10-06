import { Router, Request, NextFunction } from "express";
import { Types } from "mongoose";
import { Photographer, PhotographerModel } from "../../models/Photographer";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";

const router = Router();

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface PhotographerLean {
	_id: Types.ObjectId;
	name: string;
	email: string;
	mobile_number?: string | null;
	bio?: string | null;
	profile_image?: string | null;
	specialties: string[];
	photo_gallery?: string[] | null;
	weekly_schedule?: unknown[] | null;
	date_overrides?: unknown[] | null;
	total_bookings: number;
	completed_bookings: number;
	booking_lead_time_hours?: number | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
	created_by: Types.ObjectId;
	updated_by?: Types.ObjectId | null;
}

interface PhotographerResponse {
	_id: string;
	name: string;
	email: string;
	mobile_number?: string | null;
	bio?: string | null;
	profile_image?: string | null;
	specialties: string[];
	photo_gallery?: string[] | null;
	weekly_schedule?: unknown[] | null;
	date_overrides?: unknown[] | null;
	total_bookings: number;
	completed_bookings: number;
	booking_lead_time_hours?: number | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

interface AvailablePhotographerSlot {
	photographer: PhotographerResponse;
	availableSlots: string[];
}

interface AvailablePhotographerResponse {
	photographer: PhotographerResponse;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToResponse(
	photographer: PhotographerLean
): PhotographerResponse {
	const { _id, created_by, updated_by, ...photographerData } = photographer;
	return {
		_id: _id.toString(),
		...photographerData,
	};
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * GET /photographers
 * Fetch all photographers (with optional filters)
 */
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerResponse[]>,
		next: NextFunction
	) => {
		try {
			const { is_active, specialties } = req.query;

			const filter: Record<string, unknown> = {};

			if (is_active !== undefined) {
				filter.is_active = is_active === "true";
			}

			if (specialties) {
				const specialtiesArray = Array.isArray(specialties)
					? specialties
					: [specialties];
				filter.specialties = { $in: specialtiesArray };
			}

			const photographers = await Photographer.find(filter)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.lean<PhotographerLean[]>();

			const photographerResponse: PhotographerResponse[] =
				photographers.map(convertToResponse);

			res.status(200).json({
				status: 200,
				message: "Photographers fetched successfully!",
				data: photographerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /photographers/:id
 * Fetch single photographer by ID
 */
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!Types.ObjectId.isValid(id)) {
				return res.status(400).json({
					status: 400,
					message: "Invalid photographer ID",
				});
			}

			const photographer = await Photographer.findById(id)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.lean<PhotographerLean>();

			if (!photographer) {
				return res.status(404).json({
					status: 404,
					message: "Photographer not found",
				});
			}

			const photographerResponse = convertToResponse(photographer);

			res.status(200).json({
				status: 200,
				message: "Photographer fetched successfully!",
				data: photographerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * POST /photographers
 * Create new photographer
 */
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerResponse>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const photographerData = {
				...req.body,
				created_by: userId,
			};

			const newPhotographer = await Photographer.create(photographerData);
			const photographer = await Photographer.findById(newPhotographer._id)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.lean<PhotographerLean>();

			if (!photographer) {
				return res.status(500).json({
					status: 500,
					message: "Failed to create photographer",
				});
			}

			const photographerResponse = convertToResponse(photographer);

			res.status(201).json({
				status: 201,
				message: "Photographer created successfully!",
				data: photographerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PUT /photographers/:id
 * Update photographer
 */
router.put(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const updateData = {
				...req.body,
				updated_by: userId,
			};

			const updatedPhotographer = await Photographer.findByIdAndUpdate(
				id,
				updateData,
				{ new: true, runValidators: true }
			)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.lean<PhotographerLean>();

			if (!updatedPhotographer) {
				return res.status(404).json({
					status: 404,
					message: "Photographer not found",
				});
			}

			const photographerResponse = convertToResponse(updatedPhotographer);

			res.status(200).json({
				status: 200,
				message: "Photographer updated successfully!",
				data: photographerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * DELETE /photographers/:id (soft delete)
 * Soft delete photographer
 */
router.delete(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<{ id: string }>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");
			const photographer = await Photographer.findByIdAndUpdate(
				id,
				{
					is_active: false,
					deleted_by: userId,
					deleted_at: new Date(),
				},
				{ new: true }
			);

			if (!photographer) {
				return res.status(404).json({
					status: 404,
					message: "Photographer not found",
				});
			}

			res.status(200).json({
				status: 200,
				message: "Photographer deleted successfully!",
				data: { id },
			});
		} catch (error) {
			next(error);
		}
	}
);

// ============================================================================
// STATUS MANAGEMENT
// ============================================================================

/**
 * PATCH /photographers/:id/activate
 * Activate photographer
 */
router.patch(
	"/:id/activate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");
			const photographer = await Photographer.findByIdAndUpdate(
				id,
				{
					is_active: true,
					retrieved_by: userId,
					retrieved_at: new Date(),
					deleted_by: null,
					deleted_at: null,
				},
				{ new: true }
			)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.lean<PhotographerLean>();

			if (!photographer) {
				return res.status(404).json({
					status: 404,
					message: "Photographer not found",
				});
			}

			const photographerResponse = convertToResponse(photographer);

			res.status(200).json({
				status: 200,
				message: "Photographer activated successfully!",
				data: photographerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PATCH /photographers/:id/deactivate
 * Deactivate photographer
 */
router.patch(
	"/:id/deactivate",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");
			const photographer = await Photographer.findByIdAndUpdate(
				id,
				{
					is_active: false,
					deleted_by: userId,
					deleted_at: new Date(),
				},
				{ new: true }
			)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.lean<PhotographerLean>();

			if (!photographer) {
				return res.status(404).json({
					status: 404,
					message: "Photographer not found",
				});
			}

			const photographerResponse = convertToResponse(photographer);

			res.status(200).json({
				status: 200,
				message: "Photographer deactivated successfully!",
				data: photographerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
