import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import {
	authenticateCustomerToken,
	CustomerAuthenticatedRequest,
} from "../../middleware/authCustomerMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import {
	BookingRequest,
	BookingRequestModel,
} from "../../models/BookingRequest";
import { Booking } from "../../models/Booking";

const router = Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type PopulatedBookingInfo = {
	_id: Types.ObjectId;
	booking_reference: string;
	booking_date: Date;
	start_time: string;
	status: string;
};

type PopulatedCustomerInfo = {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
};

type PopulatedPhotographerInfo = {
	_id: Types.ObjectId;
	name: string;
	email: string;
};

type PopulatedReviewerInfo = {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
};

type PopulatedBookingRequest = Omit<
	BookingRequestModel,
	"booking_id" | "customer_id" | "new_photographer_id" | "reviewed_by"
> & {
	booking_id: PopulatedBookingInfo;
	customer_id: PopulatedCustomerInfo;
	new_photographer_id?: PopulatedPhotographerInfo | null;
	reviewed_by?: PopulatedReviewerInfo | null;
};

type RequestCancellationBody = {
	cancellation_reason: string;
};

type RequestRescheduleBody = {
	new_booking_date: string;
	new_start_time: string;
	new_end_time?: string;
	new_photographer_id?: string;
	reschedule_reason: string;
};

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/bookings/:id/request-cancellation
 * @desc    Customer requests to cancel their booking
 * @access  Customer
 */
router.post(
	"/:id/request-cancellation",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<
			{ id: string },
			{},
			RequestCancellationBody
		>,
		res: TypedResponse<PopulatedBookingRequest>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { cancellation_reason } = req.body;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!cancellation_reason || cancellation_reason.trim().length < 5) {
				throw customError(
					400,
					"Cancellation reason is required and must be at least 5 characters"
				);
			}

			const booking = await Booking.findById(id);
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.customer_id.toString() !== customerId.toString()) {
				throw customError(
					403,
					"You can only request cancellation for your own bookings"
				);
			}

			if (["Cancelled", "Completed"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot request cancellation for booking with status: ${booking.status}`
				);
			}

			const existingRequest = await BookingRequest.findOne({
				booking_id: booking._id,
				customer_id: new Types.ObjectId(customerId),
				request_type: "Cancellation",
				status: "Pending",
				is_active: true,
			});

			if (existingRequest) {
				throw customError(
					400,
					"You already have a pending cancellation request for this booking"
				);
			}

			const cancellationRequest = new BookingRequest({
				booking_id: booking._id,
				customer_id: new Types.ObjectId(customerId),
				request_type: "Cancellation",
				status: "Pending",
				cancellation_reason: cancellation_reason.trim(),
				created_by: new Types.ObjectId(customerId),
			});

			await cancellationRequest.save();

			const populatedRequest = await BookingRequest.findById(
				cancellationRequest._id
			)
				.populate<{ booking_id: PopulatedBookingInfo }>("booking_id")
				.populate<{ customer_id: PopulatedCustomerInfo }>("customer_id")
				.lean<PopulatedBookingRequest>();

			if (!populatedRequest) {
				throw customError(500, "Failed to retrieve created request");
			}

			res.status(201).json({
				status: 201,
				message:
					"Cancellation request submitted successfully! An admin will review your request.",
				data: populatedRequest,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   POST /api/bookings/:id/request-reschedule
 * @desc    Customer requests to reschedule their booking
 * @access  Customer
 */
router.post(
	"/:id/request-reschedule",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<
			{ id: string },
			{},
			RequestRescheduleBody
		>,
		res: TypedResponse<PopulatedBookingRequest>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const {
				new_booking_date,
				new_start_time,
				new_end_time,
				new_photographer_id,
				reschedule_reason,
			} = req.body;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!new_booking_date) {
				throw customError(400, "Please add a new booking date");
			}

			if (!new_start_time && new_end_time) {
				throw customError(400, "Please add a new time");
			}

			if (!reschedule_reason) {
				throw customError(
					400,
					"Please state the reason of rescheduling your booking"
				);
			}

			if (reschedule_reason.trim().length < 5) {
				throw customError(
					400,
					"Reschedule reason must be at least 5 characters"
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
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const bookingDate = new Date(newBookingDateTime);
			bookingDate.setHours(0, 0, 0, 0);

			if (bookingDate < today) {
				throw customError(
					400,
					"New booking date must be today or in the future"
				);
			}

			if (
				new_photographer_id &&
				!mongoose.Types.ObjectId.isValid(new_photographer_id)
			) {
				throw customError(400, "Invalid photographer ID format");
			}

			const booking = await Booking.findById(id);
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.customer_id.toString() !== customerId.toString()) {
				throw customError(
					403,
					"You can only request reschedule for your own bookings"
				);
			}

			if (!["Pending", "Confirmed", "Rescheduled"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot request reschedule for booking with status: ${booking.status}`
				);
			}

			const existingRequest = await BookingRequest.findOne({
				booking_id: booking._id,
				customer_id: new Types.ObjectId(customerId),
				request_type: "Reschedule",
				status: "Pending",
				is_active: true,
			});

			if (existingRequest) {
				throw customError(
					400,
					"You already have a pending reschedule request for this booking"
				);
			}

			const rescheduleRequest = new BookingRequest({
				booking_id: booking._id,
				customer_id: new Types.ObjectId(customerId),
				request_type: "Reschedule",
				status: "Pending",
				new_booking_date: newBookingDateTime,
				new_start_time,
				new_end_time: new_end_time || null,
				new_photographer_id: new_photographer_id
					? new Types.ObjectId(new_photographer_id)
					: null,
				reschedule_reason: reschedule_reason.trim(),
				created_by: new Types.ObjectId(customerId),
			});

			await rescheduleRequest.save();

			const populatedRequest = await BookingRequest.findById(
				rescheduleRequest._id
			)
				.populate<{ booking_id: PopulatedBookingInfo }>("booking_id")
				.populate<{ customer_id: PopulatedCustomerInfo }>("customer_id")
				.populate<{ new_photographer_id: PopulatedPhotographerInfo }>(
					"new_photographer_id"
				)
				.lean<PopulatedBookingRequest>();

			if (!populatedRequest) {
				throw customError(500, "Failed to retrieve created request");
			}

			res.status(201).json({
				status: 201,
				message:
					"Reschedule request submitted successfully! An admin will review your request.",
				data: populatedRequest,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/bookings/my-requests
 * @desc    Get all booking requests for the logged-in customer
 * @access  Customer
 */
router.get(
	"/my-requests",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<PopulatedBookingRequest[]>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			const requests = await BookingRequest.find({
				customer_id: new Types.ObjectId(customerId),
				is_active: true,
			})
				.populate<{ booking_id: PopulatedBookingInfo }>("booking_id")
				.populate<{ reviewed_by: PopulatedReviewerInfo }>("reviewed_by")
				.sort({ created_at: -1 })
				.lean<PopulatedBookingRequest[]>();

			res.status(200).json({
				status: 200,
				message: "Booking requests retrieved successfully",
				data: requests,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/bookings/requests/:requestId
 * @desc    Get a single booking request by ID
 * @access  Customer
 */
router.get(
	"/:requestId",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{ requestId: string }>,
		res: TypedResponse<PopulatedBookingRequest>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(requestId)) {
				throw customError(400, "Invalid request ID format");
			}

			const request = await BookingRequest.findById(requestId)
				.populate({
					path: "booking_id",
					populate: [
						{ path: "customer_id" },
						{ path: "photographer_id" },
						{ path: "package_id" },
						{ path: "promo_id" },
						{
							path: "services.service_id",
						},
					],
				})
				.populate({ path: "customer_id" })
				.populate({
					path: "new_photographer_id",
				})
				.populate({
					path: "reviewed_by",
				})
				.lean<PopulatedBookingRequest>();

			if (!request) {
				throw customError(404, "Booking request not found");
			}

			if (request.customer_id._id.toString() !== customerId.toString()) {
				throw customError(
					403,
					"You are not authorized to view this booking request"
				);
			}

			res.status(200).json({
				status: 200,
				message: "Booking request retrieved successfully",
				data: request,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   DELETE /api/bookings/requests/:requestId
 * @desc    Cancel a pending booking request
 * @access  Customer
 */
router.delete(
	"/requests/:requestId",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{ requestId: string }>,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(requestId)) {
				throw customError(400, "Invalid request ID format");
			}

			const request = await BookingRequest.findById(requestId);
			if (!request) {
				throw customError(404, "Request not found");
			}

			if (request.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You can only cancel your own requests");
			}

			if (request.status !== "Pending") {
				throw customError(
					400,
					`Cannot cancel request with status: ${request.status}`
				);
			}

			request.is_active = false;
			request.deleted_by = new Types.ObjectId(customerId);
			request.deleted_at = new Date();
			await request.save();

			res.status(200).json({
				status: 200,
				message: "Request cancelled successfully",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
