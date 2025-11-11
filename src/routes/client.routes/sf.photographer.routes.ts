import { Router, Request, NextFunction } from "express";
import { Types } from "mongoose";
import { Photographer, PhotographerModel } from "../../models/Photographer";
import { TypedResponse } from "../../types/base.types";
import { Service } from "../../models/Service";
import { authenticateCustomerToken } from "../../middleware/authCustomerMiddleware";
import { Booking } from "../../models/Booking";

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

	booking_lead_time_hours?: number | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

interface AvailablePhotographerSlot {
	photographer: PhotographerResponse;
	availableSlots: string[];
}

interface PhotographerWithSlots {
	photographer: PhotographerModel;
	availableSlots: string[];
}

interface PhotographerWrapper {
	photographer: PhotographerModel;
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
// AVAILABILITY ENDPOINTS (BOOKING PROCESS)
// ============================================================================

/**
 * POST /photographers/availability/by-date
 * STEP 2: Get all available time slots for a specific date
 * Input: date, session_duration_minutes (optional, calculated from services if not provided)
 * Output: Aggregated list of unique available time slots across all photographers
 */
router.post(
	"/availability/by-date",
	async (req: Request, res: TypedResponse<string[]>, next: NextFunction) => {
		try {
			const { date, session_duration_minutes, service_ids } = req.body;

			if (!date) {
				return res.status(400).json({
					status: 400,
					message: "Date is required",
				});
			}

			const targetDate = new Date(date);

			if (isNaN(targetDate.getTime())) {
				return res.status(400).json({
					status: 400,
					message: "Invalid date format",
				});
			}

			// Calculate session duration from services if not provided
			let duration = session_duration_minutes;

			if (
				!duration &&
				service_ids &&
				Array.isArray(service_ids) &&
				service_ids.length > 0
			) {
				const services = await Service.find({
					_id: { $in: service_ids },
				})
					.select("duration_minutes")
					.lean<Array<{ duration_minutes?: number }>>();

				duration = services.reduce(
					(total, service) => total + (service.duration_minutes || 0),
					0
				);
			}

			// Default to 120 minutes if still not provided
			duration = duration || 120;

			// Get all active photographers
			const photographers = await Photographer.find({ is_active: true });

			// Collect all available slots from all photographers
			const allSlotsSet = new Set<string>();

			for (const photographer of photographers) {
				const slots = await photographer.getAvailableSlots(
					targetDate,
					duration
				);
				slots.forEach((slot) => allSlotsSet.add(slot));
			}

			// Convert Set to sorted array
			const availableSlots = Array.from(allSlotsSet).sort((a, b) => {
				// Extract start time from slot string (e.g., "8:00 am - 10:00 am" -> "8:00 am")
				const timeA = a.split(" - ")[0];
				const timeB = b.split(" - ")[0];

				// Parse times for comparison
				const parseTime = (timeStr: string) => {
					const [time, period] = timeStr.split(" ");
					const [hours, minutes] = time.split(":").map(Number);
					let hour24 = hours;

					if (period.toLowerCase() === "pm" && hours !== 12) {
						hour24 += 12;
					} else if (period.toLowerCase() === "am" && hours === 12) {
						hour24 = 0;
					}

					return hour24 * 60 + minutes;
				};

				return parseTime(timeA) - parseTime(timeB);
			});

			res.status(200).json({
				status: 200,
				message: `Found ${availableSlots.length} available time slots`,
				data: availableSlots,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * POST /photographers/availability/by-time-range
 * STEP 3: Get photographers available for a specific time range
 * Input: date, start_time (HH:mm), end_time (HH:mm)
 * Output: List of photographers available for that specific time slot
 */
router.post(
	"/availability/by-time-range",
	async (
		req: Request,
		res: TypedResponse<
			(PhotographerModel & {
				completed_bookings: number;
				total_bookings: number;
			})[]
		>,
		next: NextFunction
	) => {
		try {
			const {
				date,
				start_time,
				end_time,
				session_duration_minutes = 120,
			} = req.body;

			if (!date || !start_time || !end_time) {
				return res.status(400).json({
					status: 400,
					message: "Date, start_time, and end_time are required",
				});
			}

			const targetDate = new Date(date);

			if (isNaN(targetDate.getTime())) {
				return res.status(400).json({
					status: 400,
					message: "Invalid date format",
				});
			}

			// Validate time format (HH:mm)
			const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
			if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
				return res.status(400).json({
					status: 400,
					message: "Invalid time format. Use HH:mm (24-hour format)",
				});
			}

			const photographerModel = Photographer as typeof Photographer & {
				getAvailablePhotographers: (
					date: Date,
					startTime: string,
					endTime: string,
					sessionDurationMinutes?: number
				) => Promise<PhotographerModel[]>;
			};

			const availablePhotographers =
				await photographerModel.getAvailablePhotographers(
					targetDate,
					start_time,
					end_time,
					session_duration_minutes
				);

			const results = await Promise.all(
				availablePhotographers.map(async (photographer) => {
					const total_bookings = await Booking.countDocuments({
						photographer_id: photographer._id,
					});

					const completed_bookings = await Booking.countDocuments({
						photographer_id: photographer._id,
						status: "Completed",
					});

					return {
						...photographer.toObject(),
						total_bookings,
						completed_bookings,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: `Found ${results.length} photographers available from ${start_time} to ${end_time}`,
				data: results,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /photographers/:id/availability/slots
 * Get available slots for a specific photographer and date
 * Query params: date, session_duration_minutes OR service_id
 */
router.get(
	"/:id/availability/slots",
	async (
		req: Request,
		res: TypedResponse<{ slots: string[] }>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { date, session_duration_minutes, service_id } = req.query;

			if (!Types.ObjectId.isValid(id)) {
				return res.status(400).json({
					status: 400,
					message: "Invalid photographer ID",
				});
			}

			if (!date) {
				return res.status(400).json({
					status: 400,
					message: "Date is required",
				});
			}

			const photographer = await Photographer.findById(id);

			if (!photographer) {
				return res.status(404).json({
					status: 404,
					message: "Photographer not found",
				});
			}

			const targetDate = new Date(date as string);

			if (isNaN(targetDate.getTime())) {
				return res.status(400).json({
					status: 400,
					message: "Invalid date format",
				});
			}

			let slots: string[];

			const duration = session_duration_minutes
				? parseInt(session_duration_minutes as string, 10)
				: 120;
			slots = await photographer.getAvailableSlots(targetDate, duration);

			// if (service_id && typeof service_id === "string") {
			// 	slots = await photographer.getAvailableSlotsForService(
			// 		targetDate,
			// 		service_id
			// 	);
			// } else {

			// }

			res.status(200).json({
				status: 200,
				message: "Available slots fetched successfully!",
				data: { slots },
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /photographers/search/by-categories
 * Find photographers by service categories
 * Query params: categories (comma-separated)
 */
router.get(
	"/search/by-categories",
	async (
		req: Request,
		res: TypedResponse<PhotographerResponse[]>,
		next: NextFunction
	) => {
		try {
			const { categories } = req.query;

			if (!categories || typeof categories !== "string") {
				return res.status(400).json({
					status: 400,
					message: "Categories parameter is required",
				});
			}

			const categoryArray = categories.split(",");

			const photographerModel = Photographer as typeof Photographer & {
				findByServiceCategories: (
					categories: string[]
				) => Promise<PhotographerModel[]>;
			};

			const photographers = await photographerModel.findByServiceCategories(
				categoryArray
			);

			const photographerResponse: PhotographerResponse[] = photographers.map(
				(photographer) => {
					const photographerObj = photographer.toObject() as PhotographerLean;
					return convertToResponse(photographerObj);
				}
			);

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

export default router;
