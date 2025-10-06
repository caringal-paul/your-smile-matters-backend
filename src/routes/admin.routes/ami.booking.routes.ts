import { Router, Request, NextFunction } from "express";
import { Booking, BookingStatus, PaymentMethod } from "../../models/Booking";
import { Package } from "../../models/Package";
import { Service } from "../../models/Service";
import mongoose, { Types } from "mongoose";
import { TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authMiddleware";
import { customError } from "../../middleware/errorHandler";
import { Promo } from "../../models/Promo";

const router = Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Populated entity types
interface PopulatedCustomer {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
	phone_number?: string;
}

interface PopulatedPackage {
	_id: Types.ObjectId;
	package_name: string;
	package_price: number;
	description?: string;
	is_available: boolean;
}

interface PopulatedPhotographer {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
	specialization?: string;
}

interface PopulatedPromo {
	_id: Types.ObjectId;
	promo_code: string;
	discount_type: string;
	discount_value: number;
}

interface PopulatedService {
	_id: Types.ObjectId;
	service_name: string;
	category: string;
	price: number;
	duration_minutes?: number;
}

interface PopulatedBookingService {
	service_id: PopulatedService;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	duration_minutes?: number | null;
	_id: Types.ObjectId;
}

// Full populated booking type
interface LeanPopulatedBooking {
	_id: Types.ObjectId;
	booking_reference: string;
	customer_id: PopulatedCustomer;
	package_id?: PopulatedPackage | null;
	photographer_id?: PopulatedPhotographer | null;
	promo_id?: PopulatedPromo | null;
	services: PopulatedBookingService[];
	is_customized: boolean;
	customization_notes?: string | null;
	booking_date: Date;
	start_time: string;
	end_time: string;
	session_duration_minutes: number;
	location: string;
	theme?: string | null;
	special_requests?: string | null;
	status: BookingStatus;
	total_amount: number;
	discount_amount: number;
	final_amount: number;
	amount_paid: number;
	method_of_payment?: PaymentMethod | null;
	payment_images: string[];
	is_partially_paid: boolean;
	is_payment_complete: boolean;
	booking_confirmed_at?: Date | null;
	photographer_assigned_at?: Date | null;
	booking_completed_at?: Date | null;
	cancelled_reason?: string | null;
	rescheduled_from?: Date | null;
	photographer_notes?: string | null;
	client_rating?: number | null;
	photographer_rating?: number | null;
	is_active: boolean;
	created_by: Types.ObjectId;
	updated_by: Types.ObjectId;
	deleted_by?: Types.ObjectId | null;
	retrieved_by?: Types.ObjectId | null;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
	created_at: Date;
	updated_at: Date;
}

// Response types
interface BookingListItem {
	id: string;
	booking_reference: string;
	customer_name: string;
	services_summary: string;
	booking_date: Date;
	start_time: string;
	location: string;
	status: BookingStatus;
	final_amount: number;
	photographer_name?: string | null;
}

interface PriceCalculationResponse {
	total_amount: number;
	discount_amount: number;
	final_amount: number;
	promo_applied?: boolean;
}

interface BookingAnalyticsResponse {
	total_bookings: number;
	pending_bookings: number;
	confirmed_bookings: number;
	assigned_bookings: number;
	ongoing_bookings: number;
	completed_bookings: number;
	cancelled_bookings: number;
	rescheduled_bookings: number;
	total_revenue: number;
	today_bookings: number;
	upcoming_bookings: number;
}

// Request body types
interface CalculatePriceRequest {
	services: {
		service_id: string;
		quantity: number;
	}[];
	promo_code?: string;
	booking_date?: string;
}

interface CancelBookingRequest {
	cancelled_reason: string;
}

interface RescheduleBookingRequest {
	new_booking_date: string;
	new_start_time: string;
	new_end_time?: string;
}

// ============================================================================
// ROUTES
// ============================================================================

// POST /api/bookings/calculate-price
router.post(
	"/calculate-price",
	async (
		req: Request<{}, {}, CalculatePriceRequest>,
		res: TypedResponse<PriceCalculationResponse>,
		next: NextFunction
	) => {
		try {
			const { services, promo_code, booking_date } = req.body;

			if (!services || !Array.isArray(services) || services.length === 0) {
				throw customError(400, "Services array is required");
			}

			// Calculate total from services
			let totalAmount = 0;

			for (const serviceItem of services) {
				if (!mongoose.Types.ObjectId.isValid(serviceItem.service_id)) {
					throw customError(400, "Invalid service ID format");
				}

				const service = await Service.findById(serviceItem.service_id);
				if (!service) {
					throw customError(
						404,
						`Service not found: ${serviceItem.service_id}`
					);
				}

				totalAmount += service.price * serviceItem.quantity;
			}

			let discountAmount = 0;
			let promoApplied = false;

			// Check promo if provided
			if (promo_code) {
				const promo = await Promo.findOne({
					promo_code: promo_code.toUpperCase(),
					is_active: true,
				});

				if (promo) {
					const now = new Date();
					const bookingDateTime = booking_date ? new Date(booking_date) : now;

					// Check if promo is currently valid
					if (promo.valid_from <= now && promo.valid_until >= now) {
						let isValidForBooking = true;

						// Check Early Bird promo conditions
						if (promo.promo_type === "Early_Bird" && promo.min_advance_days) {
							const daysDiff = Math.floor(
								(bookingDateTime.getTime() - now.getTime()) /
									(1000 * 60 * 60 * 24)
							);
							if (daysDiff < promo.min_advance_days) {
								isValidForBooking = false;
							}
						}

						// Check minimum booking amount
						if (
							promo.min_booking_amount &&
							totalAmount < promo.min_booking_amount
						) {
							isValidForBooking = false;
						}

						// Check usage limit
						if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
							isValidForBooking = false;
						}

						if (isValidForBooking) {
							// Calculate discount
							if (promo.discount_type === "Percentage") {
								discountAmount = Math.round(
									(totalAmount * promo.discount_value) / 100
								);
							} else if (promo.discount_type === "Fixed_Amount") {
								discountAmount = promo.discount_value;
							}

							// Apply max discount limit
							if (
								promo.max_discount_amount &&
								discountAmount > promo.max_discount_amount
							) {
								discountAmount = promo.max_discount_amount;
							}

							promoApplied = true;
						}
					}
				}
			}

			const finalAmount = totalAmount - discountAmount;

			res.status(200).json({
				status: 200,
				message: "Price calculated successfully!",
				data: {
					total_amount: totalAmount,
					discount_amount: discountAmount,
					final_amount: finalAmount,
					promo_applied: promoApplied,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<BookingListItem[]>,
		next: NextFunction
	) => {
		try {
			const {
				status,
				customer_id,
				photographer_id,
				date_from,
				date_to,
				search,
				sort_by = "booking_date",
				sort_order = "desc",
				page = 1,
				limit = 20,
			} = req.query;

			const filter: any = { is_active: true };

			if (status && status !== "all") {
				filter.status = status;
			}

			if (customer_id) {
				if (!mongoose.Types.ObjectId.isValid(customer_id as string)) {
					throw customError(400, "Invalid customer ID format");
				}
				filter.customer_id = customer_id;
			}

			if (photographer_id) {
				if (!mongoose.Types.ObjectId.isValid(photographer_id as string)) {
					throw customError(400, "Invalid photographer ID format");
				}
				filter.photographer_id = photographer_id;
			}

			if (date_from || date_to) {
				filter.booking_date = {};
				if (date_from) filter.booking_date.$gte = new Date(date_from as string);
				if (date_to) filter.booking_date.$lte = new Date(date_to as string);
			}

			if (search) {
				filter.$or = [
					{ booking_reference: { $regex: search, $options: "i" } },
					{ location: { $regex: search, $options: "i" } },
				];
			}

			const sortObj: any = {};
			sortObj[sort_by as string] = sort_order === "desc" ? -1 : 1;

			const skip = (Number(page) - 1) * Number(limit);

			const bookings = await Booking.find(filter)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name",
				})
				.sort(sortObj)
				.skip(skip)
				.limit(Number(limit))
				.lean<LeanPopulatedBooking[]>();

			const bookingsResponse: BookingListItem[] = bookings.map((booking) => {
				const serviceNames = booking.services
					.map((s) => s.service_id.service_name)
					.join(", ");

				return {
					id: String(booking._id),
					booking_reference: booking.booking_reference,
					customer_name: `${booking.customer_id.first_name} ${booking.customer_id.last_name}`,
					services_summary: serviceNames || "No services",
					booking_date: booking.booking_date,
					start_time: booking.start_time,
					location: booking.location,
					status: booking.status,
					final_amount: booking.final_amount,
					photographer_name: booking.photographer_id
						? `${booking.photographer_id.first_name} ${booking.photographer_id.last_name}`
						: null,
				};
			});

			res.status(200).json({
				status: 200,
				message: "Bookings fetched successfully!",
				data: bookingsResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings/:id
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<LeanPopulatedBooking>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name email phone_number",
				})
				.populate<{ package_id: PopulatedPackage }>({
					path: "package_id",
					select: "package_name package_price description is_available",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name email specialization",
				})
				.populate<{ promo_id: PopulatedPromo }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name category price duration_minutes",
				})
				.lean<LeanPopulatedBooking>();

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			res.status(200).json({
				status: 200,
				message: "Booking fetched successfully!",
				data: booking,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/confirm
router.patch(
	"/:id/confirm",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<LeanPopulatedBooking>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.status !== "Pending") {
				throw customError(
					400,
					`Cannot confirm booking with status: ${booking.status}`
				);
			}

			if (booking.booking_date <= new Date()) {
				throw customError(400, "Cannot confirm booking for past dates");
			}

			booking.status = "Confirmed";
			booking.booking_confirmed_at = new Date();
			booking.updated_by = new Types.ObjectId(userId);

			await booking.save();

			const populatedBooking = await Booking.findById(booking._id)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name email phone_number",
				})
				.populate<{ package_id: PopulatedPackage }>({
					path: "package_id",
					select: "package_name package_price description is_available",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name email specialization",
				})
				.populate<{ promo_id: PopulatedPromo }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name category price duration_minutes",
				})
				.lean<LeanPopulatedBooking>();

			if (!populatedBooking) {
				throw customError(500, "Failed to retrieve updated booking");
			}

			res.status(200).json({
				status: 200,
				message: "Booking confirmed successfully!",
				data: populatedBooking,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/cancel
router.patch(
	"/:id/cancel",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { cancelled_reason } = req.body;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!cancelled_reason || cancelled_reason.trim().length < 5) {
				throw customError(
					400,
					"Cancellation reason is required and must be at least 5 characters"
				);
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (["Cancelled", "Completed"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot cancel booking with status: ${booking.status}`
				);
			}

			booking.status = "Cancelled";
			booking.cancelled_reason = cancelled_reason.trim();
			booking.updated_by = new Types.ObjectId(userId);

			await booking.save();

			res.status(200).json({
				status: 200,
				message: "Booking cancelled successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/reschedule
router.patch(
	"/:id/reschedule",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<LeanPopulatedBooking>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { new_booking_date, new_start_time, new_end_time } = req.body;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!new_booking_date || !new_start_time) {
				throw customError(400, "New booking date and start time are required");
			}

			const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
			if (!timeRegex.test(new_start_time)) {
				throw customError(400, "Invalid start time format (HH:MM)");
			}
			if (new_end_time && !timeRegex.test(new_end_time)) {
				throw customError(400, "Invalid end time format (HH:MM)");
			}

			const newBookingDateTime = new Date(new_booking_date);
			if (newBookingDateTime <= new Date()) {
				throw customError(400, "New booking date must be in the future");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (!["Pending", "Confirmed", "Assigned"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot reschedule booking with status: ${booking.status}`
				);
			}

			// Check photographer availability if assigned
			if (booking.photographer_id) {
				const conflictingBooking = await Booking.findOne({
					_id: { $ne: id },
					photographer_id: booking.photographer_id,
					booking_date: {
						$gte: new Date(newBookingDateTime.setHours(0, 0, 0, 0)),
						$lt: new Date(newBookingDateTime.setHours(23, 59, 59, 999)),
					},
					start_time: new_start_time,
					status: { $nin: ["Cancelled", "Completed"] },
					is_active: true,
				});

				if (conflictingBooking) {
					throw customError(
						400,
						"Photographer is not available at the new time slot"
					);
				}
			}

			const originalDate = booking.booking_date;

			booking.booking_date = newBookingDateTime;
			booking.start_time = new_start_time;
			if (new_end_time) {
				booking.end_time = new_end_time;
			}
			booking.status = "Rescheduled";
			booking.rescheduled_from = originalDate;
			booking.updated_by = new Types.ObjectId(userId);

			await booking.save();

			const populatedBooking = await Booking.findById(booking._id)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name email phone_number",
				})
				.populate<{ package_id: PopulatedPackage }>({
					path: "package_id",
					select: "package_name package_price description is_available",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name email specialization",
				})
				.populate<{ promo_id: PopulatedPromo }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name category price duration_minutes",
				})
				.lean<LeanPopulatedBooking>();

			if (!populatedBooking) {
				throw customError(500, "Failed to retrieve updated booking");
			}

			res.status(200).json({
				status: 200,
				message: "Booking rescheduled successfully!",
				data: populatedBooking,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/start
router.patch(
	"/:id/start",
	authenticateAmiUserToken,
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

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (!["Confirmed", "Assigned"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot start booking with status: ${booking.status}`
				);
			}

			const today = new Date();
			const bookingDate = new Date(booking.booking_date);
			today.setHours(0, 0, 0, 0);
			bookingDate.setHours(0, 0, 0, 0);

			if (bookingDate.getTime() !== today.getTime()) {
				throw customError(400, "Can only start bookings on the scheduled date");
			}

			booking.status = "Ongoing";
			booking.updated_by = new Types.ObjectId(userId);

			await booking.save();

			res.status(200).json({
				status: 200,
				message: "Booking started successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/complete
router.patch(
	"/:id/complete",
	authenticateAmiUserToken,
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

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (!["Confirmed", "Assigned", "Ongoing"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot complete booking with status: ${booking.status}`
				);
			}

			booking.status = "Completed";
			booking.booking_completed_at = new Date();
			booking.updated_by = new Types.ObjectId(userId);

			await booking.save();

			res.status(200).json({
				status: 200,
				message: "Booking completed successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings/customer/:customerId
router.get(
	"/customer/:customerId",
	authenticateAmiUserToken,
	async (
		req: Request<{ customerId: string }>,
		res: TypedResponse<BookingListItem[]>,
		next: NextFunction
	) => {
		try {
			const { customerId } = req.params;
			const { status, upcoming_only = "false" } = req.query;

			if (!mongoose.Types.ObjectId.isValid(customerId)) {
				throw customError(400, "Invalid customer ID format");
			}

			const filter: any = {
				customer_id: customerId,
				is_active: true,
			};

			if (status && status !== "all") {
				filter.status = status;
			}

			if (upcoming_only === "true") {
				filter.booking_date = { $gte: new Date() };
				filter.status = { $nin: ["Cancelled", "Completed"] };
			}

			const bookings = await Booking.find(filter)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name",
				})
				.sort({ booking_date: -1 })
				.lean<LeanPopulatedBooking[]>();

			const bookingsResponse: BookingListItem[] = bookings.map((booking) => {
				const serviceNames = booking.services
					.map((s) => s.service_id.service_name)
					.join(", ");

				return {
					id: String(booking._id),
					booking_reference: booking.booking_reference,
					customer_name: `${booking.customer_id.first_name} ${booking.customer_id.last_name}`,
					services_summary: serviceNames || "No services",
					booking_date: booking.booking_date,
					start_time: booking.start_time,
					location: booking.location,
					status: booking.status,
					final_amount: booking.final_amount,
					photographer_name: booking.photographer_id
						? `${booking.photographer_id.first_name} ${booking.photographer_id.last_name}`
						: null,
				};
			});

			res.status(200).json({
				status: 200,
				message: "Customer bookings fetched successfully!",
				data: bookingsResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings/analytics/summary
router.get(
	"/analytics/summary",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<BookingAnalyticsResponse>,
		next: NextFunction
	) => {
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(today.getDate() + 1);

			const [
				totalBookings,
				pendingBookings,
				confirmedBookings,
				assignedBookings,
				ongoingBookings,
				completedBookings,
				cancelledBookings,
				rescheduledBookings,
				todayBookings,
				upcomingBookings,
			] = await Promise.all([
				Booking.countDocuments({ is_active: true }),
				Booking.countDocuments({ status: "Pending", is_active: true }),
				Booking.countDocuments({ status: "Confirmed", is_active: true }),
				Booking.countDocuments({ status: "Assigned", is_active: true }),
				Booking.countDocuments({ status: "Ongoing", is_active: true }),
				Booking.countDocuments({ status: "Completed", is_active: true }),
				Booking.countDocuments({ status: "Cancelled", is_active: true }),
				Booking.countDocuments({ status: "Rescheduled", is_active: true }),
				Booking.countDocuments({
					booking_date: { $gte: today, $lt: tomorrow },
					status: { $nin: ["Cancelled"] },
					is_active: true,
				}),
				Booking.countDocuments({
					booking_date: { $gte: new Date() },
					status: { $nin: ["Cancelled", "Completed"] },
					is_active: true,
				}),
			]);

			const revenueResult = await Booking.aggregate([
				{
					$match: {
						status: "Completed",
						is_active: true,
					},
				},
				{
					$group: {
						_id: null,
						total_revenue: { $sum: "$final_amount" },
					},
				},
			]);

			const totalRevenue =
				revenueResult.length > 0 ? revenueResult[0].total_revenue : 0;

			res.status(200).json({
				status: 200,
				message: "Booking analytics fetched successfully!",
				data: {
					total_bookings: totalBookings,
					pending_bookings: pendingBookings,
					confirmed_bookings: confirmedBookings,
					assigned_bookings: assignedBookings,
					ongoing_bookings: ongoingBookings,
					completed_bookings: completedBookings,
					cancelled_bookings: cancelledBookings,
					rescheduled_bookings: rescheduledBookings,
					total_revenue: totalRevenue,
					today_bookings: todayBookings,
					upcoming_bookings: upcomingBookings,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings/reference/:reference
router.get(
	"/reference/:reference",
	async (
		req: Request<{ reference: string }>,
		res: TypedResponse<LeanPopulatedBooking>,
		next: NextFunction
	) => {
		try {
			const { reference } = req.params;

			if (!reference.match(/^BK-[A-Z0-9]{8}$/)) {
				throw customError(400, "Invalid booking reference format");
			}

			const booking = await Booking.findOne({
				booking_reference: reference.toUpperCase(),
				is_active: true,
			})
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name email phone_number",
				})
				.populate<{ package_id: PopulatedPackage }>({
					path: "package_id",
					select: "package_name package_price description is_available",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name email specialization",
				})
				.populate<{ promo_id: PopulatedPromo }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name category price duration_minutes",
				})
				.lean<LeanPopulatedBooking>();

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			res.status(200).json({
				status: 200,
				message: "Booking fetched successfully!",
				data: booking,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
