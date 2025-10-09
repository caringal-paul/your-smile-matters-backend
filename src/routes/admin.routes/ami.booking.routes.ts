import { NextFunction, Router } from "express";
import { Types } from "mongoose";
import { Booking, BookingStatus } from "../../models/Booking";
import {
	PaymentMethod,
	Transaction,
	TransactionType,
} from "../../models/Transaction";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import mongoose from "mongoose";
import { Promo } from "../../models/Promo";
import { Service } from "../../models/Service";
import { Gender } from "../../types/literal.types";

const router = Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Populated entity types
interface PopulatedCustomer {
	_id: Types.ObjectId;
	customer_no: string;
	first_name: string;
	last_name: string;
	email: string;
	mobile_number?: string;
	profile_image?: string | null;
	gender: Gender;
}

interface PopulatedPackage {
	_id: Types.ObjectId;
	name: string;
	package_price: number;
	description?: string;
	is_available: boolean;
}

interface PopulatedPhotographer {
	_id: Types.ObjectId;
	name: string;
	email: string;
	specialties?: string;
	bio?: string;
	profile_image?: string | null;
	mobile_number?: string | null;
}

interface PopulatedPromo {
	_id: Types.ObjectId;
	promo_code: string;
	discount_type: string;
	discount_value: number;
}

interface PopulatedService {
	_id: Types.ObjectId;
	name: string;
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

// Transaction populated type
interface PopulatedTransaction {
	_id: Types.ObjectId;
	transaction_reference: string;
	amount: number;
	transaction_type: string;
	payment_method: string;
	status: string;
	transaction_date: Date;
	payment_proof_images: string[];
	external_reference?: string | null;
	notes?: string | null;
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
	booking_confirmed_at?: Date | null;
	booking_completed_at?: Date | null;
	cancelled_reason?: string | null;
	rescheduled_from?: Date | null;
	photographer_notes?: string | null;
	client_rating?: number | null;
	photographer_rating?: number | null;
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

// Booking with payment status
interface BookingWithPaymentStatus extends LeanPopulatedBooking {
	payment_status: {
		amount_paid: number;
		remaining_balance: number;
		is_partially_paid: boolean;
		is_payment_complete: boolean;
		transactions: PopulatedTransaction[];
	};
}

// Response types
interface BookingListItem {
	_id: string;
	booking_reference: string;
	customer_name: string;
	services_summary: string;
	booking_date: Date;
	start_time: string;
	end_time: string;
	location: string;
	status: BookingStatus;
	final_amount: number;
	amount_paid: number;
	remaining_balance: number;
	is_payment_complete: boolean;
	photographer_name?: string | null;
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
	total_paid: number;
	total_pending_payment: number;
	today_bookings: number;
}

// WORKON DETERMINE THE POSSIBLE ENDPOINTS FOR AMI BOOKING AND TRANSACTIONS

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getBookingPaymentStatus(bookingId: string) {
	const transactions = await Transaction.find({
		booking_id: bookingId,
		status: "Completed",
		is_active: true,
	}).lean<PopulatedTransaction[]>();

	const amountPaid = transactions
		.filter((t: PopulatedTransaction) =>
			["Payment", "Partial", "Deposit", "Balance"].includes(t.transaction_type)
		)
		.reduce((sum: number, t: PopulatedTransaction) => sum + t.amount, 0);

	const booking = await Booking.findById(bookingId);
	const finalAmount = booking?.final_amount || 0;

	return {
		amount_paid: amountPaid,
		remaining_balance: finalAmount - amountPaid,
		is_partially_paid: amountPaid > 0 && amountPaid < finalAmount,
		is_payment_complete: amountPaid >= finalAmount,
		transactions,
	};
}

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/bookings/:id/payment-status
// ? CHECKS THE BOOKING AND TRANSACTION RELATIONSHIPS THIS RETURNS THE TRANSACTIONS INSIDE THAT BOOKING.
router.get(
	"/:id/payment-status",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<{
			total_amount: number;
			discount_amount: number;
			final_amount: number;
			amount_paid: number;
			remaining_balance: number;
			is_partially_paid: boolean;
			is_payment_complete: boolean;
			transactions: PopulatedTransaction[];
		}>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id).lean<LeanPopulatedBooking>();
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			const paymentStatus = await getBookingPaymentStatus(
				booking._id.toString()
			);

			res.status(200).json({
				status: 200,
				message: "Payment status fetched successfully!",
				data: {
					total_amount: booking.total_amount,
					discount_amount: booking.discount_amount,
					final_amount: booking.final_amount,
					...paymentStatus,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings
// ? GET ALL BOOKINGS FOR TABLE OF AMI
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
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
				payment_status,
				sort_by = "booking_date",
				sort_order = "desc",
				page = 1,
				limit = 20,
			} = req.query;

			const filter: mongoose.FilterQuery<typeof Booking> = { is_active: true };

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

			const sortObj: Record<string, 1 | -1> = {};
			sortObj[sort_by as string] = sort_order === "desc" ? -1 : 1;

			const skip = (Number(page) - 1) * Number(limit);

			const bookings = await Booking.find(filter)
				.populate<{ customer_id: PopulatedCustomer }>(
					"customer_id",
					"first_name last_name email mobile_number profile_image gender customer_no"
				)
				.populate<{ photographer_id: PopulatedPhotographer }>(
					"photographer_id",
					"name email specialties bio profile_image mobile_number"
				)
				.populate<{ services: PopulatedBookingService[] }>(
					"services.service_id",
					"name"
				)
				.sort(sortObj)
				.skip(skip)
				.limit(Number(limit))
				.lean<LeanPopulatedBooking[]>();

			const bookingsWithPayment = await Promise.all(
				bookings.map(async (booking) => {
					const paymentStatus = await getBookingPaymentStatus(
						booking._id.toString()
					);
					return { booking, paymentStatus };
				})
			);

			let filteredBookings = bookingsWithPayment;

			if (payment_status === "paid") {
				filteredBookings = bookingsWithPayment.filter(
					(b) => b.paymentStatus.is_payment_complete
				);
			} else if (payment_status === "unpaid") {
				filteredBookings = bookingsWithPayment.filter(
					(b) => b.paymentStatus.amount_paid === 0
				);
			} else if (payment_status === "partial") {
				filteredBookings = bookingsWithPayment.filter(
					(b) => b.paymentStatus.is_partially_paid
				);
			}

			console.log(bookings);

			const bookingsResponse: BookingListItem[] = filteredBookings.map(
				({ booking, paymentStatus }) => {
					const serviceNames = booking.services
						.map((s: PopulatedBookingService) => s.service_id.name)
						.join(", ");

					return {
						_id: String(booking._id),
						booking_reference: booking.booking_reference,
						customer_name: `${booking.customer_id.first_name} ${booking.customer_id.last_name}`,
						services_summary: serviceNames || "No services",
						booking_date: booking.booking_date,
						start_time: booking.start_time,
						end_time: booking.end_time,
						location: booking.location,
						status: booking.status,
						final_amount: booking.final_amount,
						amount_paid: paymentStatus.amount_paid,
						remaining_balance: paymentStatus.remaining_balance,
						is_payment_complete: paymentStatus.is_payment_complete,
						photographer_id: booking.photographer_id?._id,
						photographer_name: booking.photographer_id
							? `${booking.photographer_id.name}`
							: null,
					};
				}
			);

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
		res: TypedResponse<BookingWithPaymentStatus>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id)
				.populate<{ customer_id: PopulatedCustomer }>(
					"customer_id",
					"first_name last_name email mobile_number profile_image gender customer_no"
				)
				.populate<{ package_id: PopulatedPackage }>(
					"package_id",
					"name package_price description is_available"
				)
				.populate<{ photographer_id: PopulatedPhotographer }>(
					"photographer_id",
					"name email specialties bio profile_image mobile_number"
				)
				.populate<{ promo_id: PopulatedPromo }>(
					"promo_id",
					"promo_code discount_type discount_value"
				)
				.populate<{ services: PopulatedBookingService[] }>(
					"services.service_id",
					"name category price duration_minutes"
				)
				.lean<LeanPopulatedBooking>();

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			const paymentStatus = await getBookingPaymentStatus(
				booking._id.toString()
			);

			const bookingWithPayment: BookingWithPaymentStatus = {
				...booking,
				payment_status: paymentStatus,
			};

			res.status(200).json({
				status: 200,
				message: "Booking fetched successfully!",
				data: bookingWithPayment,
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
		res: TypedResponse<BookingWithPaymentStatus>,
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
				.populate<{ customer_id: PopulatedCustomer }>(
					"customer_id",
					"first_name last_name email mobile_number profile_image gender customer_no"
				)
				.populate<{ package_id: PopulatedPackage }>(
					"package_id",
					"name package_price description is_available"
				)
				.populate<{ photographer_id: PopulatedPhotographer }>(
					"photographer_id",
					"name email specialties bio profile_image mobile_number"
				)
				.populate<{ promo_id: PopulatedPromo }>(
					"promo_id",
					"promo_code discount_type discount_value"
				)
				.populate<{ services: PopulatedBookingService[] }>(
					"services.service_id",
					"name category price duration_minutes"
				)
				.lean<LeanPopulatedBooking>();

			if (!populatedBooking) {
				throw customError(500, "Failed to retrieve updated booking");
			}

			const updatedPaymentStatus = await getBookingPaymentStatus(
				populatedBooking._id.toString()
			);

			const bookingWithPayment: BookingWithPaymentStatus = {
				...populatedBooking,
				payment_status: updatedPaymentStatus,
			};

			res.status(200).json({
				status: 200,
				message: "Booking confirmed successfully!",
				data: bookingWithPayment,
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
		req: AuthenticatedRequest<{ id: string }, {}, { cancelled_reason: string }>,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { cancelled_reason } = req.body || {};
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
		res: TypedResponse<BookingWithPaymentStatus>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { new_booking_date, new_start_time, new_end_time } = req.body || {};
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!new_booking_date || (!new_start_time && !new_end_time)) {
				throw customError(
					400,
					"New booking date, start time, and end time are required"
				);
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

			if (!["Pending", "Confirmed"].includes(booking.status)) {
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
					end_time: new_end_time,
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
			booking.end_time = new_end_time;
			booking.status = "Rescheduled";
			booking.rescheduled_from = originalDate;
			booking.updated_by = new Types.ObjectId(userId);

			await booking.save();

			const populatedBooking = await Booking.findById(booking._id)
				.populate<{ customer_id: PopulatedCustomer }>(
					"customer_id",
					"first_name last_name email mobile_number profile_image gender customer_no"
				)
				.populate<{ package_id: PopulatedPackage }>(
					"package_id",
					"name package_price description is_available"
				)
				.populate<{ photographer_id: PopulatedPhotographer }>(
					"photographer_id",
					"name email specialties bio profile_image mobile_number"
				)
				.populate<{ promo_id: PopulatedPromo }>(
					"promo_id",
					"promo_code discount_type discount_value"
				)
				.populate<{ services: PopulatedBookingService[] }>(
					"services.service_id",
					"name category price duration_minutes"
				)
				.lean<LeanPopulatedBooking>();

			if (!populatedBooking) {
				throw customError(500, "Failed to retrieve updated booking");
			}

			const paymentStatus = await getBookingPaymentStatus(
				populatedBooking._id.toString()
			);

			const bookingWithPayment: BookingWithPaymentStatus = {
				...populatedBooking,
				payment_status: paymentStatus,
			};

			res.status(200).json({
				status: 200,
				message: "Booking rescheduled successfully!",
				data: bookingWithPayment,
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

			if (!["Confirmed"].includes(booking.status)) {
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

			if (!["Confirmed", "Ongoing"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot complete booking with status: ${booking.status}`
				);
			}

			// Check if payment is complete
			const paymentStatus = await getBookingPaymentStatus(id);
			if (!paymentStatus.is_payment_complete) {
				throw customError(
					400,
					"Cannot complete booking with incomplete payment"
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
		req: AuthenticatedRequest,
		res: TypedResponse<BookingListItem[]>,
		next: NextFunction
	) => {
		try {
			const { customerId } = req.params;
			const { status, upcoming_only = "false" } = req.query;

			if (!mongoose.Types.ObjectId.isValid(customerId)) {
				throw customError(400, "Invalid customer ID format");
			}

			const filter: mongoose.FilterQuery<typeof Booking> = {
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
				.populate<{ customer_id: PopulatedCustomer }>(
					"customer_id",
					"first_name last_name email mobile_number profile_image gender customer_no"
				)
				.populate<{ photographer_id: PopulatedPhotographer }>(
					"photographer_id",
					"name"
				)
				.populate<{ services: PopulatedBookingService[] }>(
					"services.service_id",
					"name"
				)
				.sort({ booking_date: -1 })
				.lean<LeanPopulatedBooking[]>();

			const bookingsWithPayment = await Promise.all(
				bookings.map(async (booking) => {
					const paymentStatus = await getBookingPaymentStatus(
						booking._id.toString()
					);
					return { booking, paymentStatus };
				})
			);

			const bookingsResponse: BookingListItem[] = bookingsWithPayment.map(
				({ booking, paymentStatus }) => {
					const serviceNames = booking.services
						.map((s: PopulatedBookingService) => s.service_id.name)
						.join(", ");

					return {
						_id: String(booking._id),
						booking_reference: booking.booking_reference,
						customer_name: `${booking.customer_id.first_name} ${booking.customer_id.last_name}`,
						services_summary: serviceNames || "No services",
						booking_date: booking.booking_date,
						end_time: booking.end_time,
						start_time: booking.start_time,
						location: booking.location,
						status: booking.status,
						final_amount: booking.final_amount,
						amount_paid: paymentStatus.amount_paid,
						remaining_balance: paymentStatus.remaining_balance,
						is_payment_complete: paymentStatus.is_payment_complete,
						photographer_name: booking.photographer_id
							? `${booking.photographer_id.name}`
							: null,
					};
				}
			);

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
		req: AuthenticatedRequest,
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
			] = await Promise.all([
				Booking.countDocuments({ is_active: true }),
				Booking.countDocuments({ status: "Pending", is_active: true }),
				Booking.countDocuments({ status: "Confirmed", is_active: true }),

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

			// Calculate total paid from completed transactions
			const paidResult = await Transaction.aggregate([
				{
					$match: {
						status: "Completed",
						transaction_type: {
							$in: ["Payment", "Partial", "Deposit", "Balance"],
						},
						is_active: true,
					},
				},
				{
					$group: {
						_id: null,
						total_paid: { $sum: "$amount" },
					},
				},
			]);

			const totalPaid = paidResult.length > 0 ? paidResult[0].total_paid : 0;

			// Calculate pending payments
			const allBookings = await Booking.find({
				status: { $nin: ["Cancelled"] },
				is_active: true,
			}).lean<LeanPopulatedBooking[]>();

			let totalPendingPayment = 0;
			for (const booking of allBookings) {
				const paymentStatus = await getBookingPaymentStatus(
					booking._id.toString()
				);
				totalPendingPayment += paymentStatus.remaining_balance;
			}

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
					total_paid: totalPaid,
					total_pending_payment: totalPendingPayment,
					today_bookings: todayBookings,
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
		req: AuthenticatedRequest,
		res: TypedResponse<BookingWithPaymentStatus>,
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
				.populate<{ customer_id: PopulatedCustomer }>(
					"customer_id",
					"first_name last_name email mobile_number profile_image gender customer_no"
				)
				.populate<{ package_id: PopulatedPackage }>(
					"package_id",
					"name package_price description is_available"
				)
				.populate<{ photographer_id: PopulatedPhotographer }>(
					"photographer_id",
					"name email specialties bio profile_image mobile_number"
				)
				.populate<{ promo_id: PopulatedPromo }>(
					"promo_id",
					"promo_code discount_type discount_value"
				)
				.populate<{ services: PopulatedBookingService[] }>(
					"services.service_id",
					"name category price duration_minutes"
				)
				.lean<LeanPopulatedBooking>();

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			const paymentStatus = await getBookingPaymentStatus(
				booking._id.toString()
			);

			const bookingWithPayment: BookingWithPaymentStatus = {
				...booking,
				payment_status: paymentStatus,
			};

			res.status(200).json({
				status: 200,
				message: "Booking fetched successfully!",
				data: bookingWithPayment,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
