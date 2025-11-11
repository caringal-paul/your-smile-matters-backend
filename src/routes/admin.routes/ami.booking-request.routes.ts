import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Booking, BookingModel } from "../../models/Booking";
import { customError } from "../../middleware/errorHandler";
import {
	BookingRequest,
	BookingRequestModel,
} from "../../models/BookingRequest";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authAmiMiddleware";
import { TypedResponse } from "../../types/base.types";

// ============================================================================
// POPULATED TYPES
// ============================================================================

export type PopulatedBookingInfo = {
	_id: Types.ObjectId;
	booking_reference: string;
	booking_date: Date;
	start_time: string;
	status: string;
};

export type PopulatedCustomerInfo = {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
	mobile_number?: string;
};

export type PopulatedPhotographerInfo = {
	_id: Types.ObjectId;
	name: string;
	email: string;
};

export type PopulatedReviewerInfo = {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
};

export type PopulatedBookingRequest = Omit<
	BookingModel,
	"booking_id" | "customer_id" | "new_photographer_id" | "reviewed_by"
> & {
	booking_id: PopulatedBookingInfo;
	customer_id: PopulatedCustomerInfo;
	new_photographer_id?: PopulatedPhotographerInfo;
	reviewed_by?: PopulatedReviewerInfo;
};

export type PopulatedBookingRequestFull = Omit<
	BookingRequestModel,
	"booking_id" | "customer_id" | "new_photographer_id" | "reviewed_by"
> & {
	booking_id: BookingModel;
	customer_id: PopulatedCustomerInfo;
	new_photographer_id?: PopulatedPhotographerInfo;
	reviewed_by?: PopulatedReviewerInfo;
};

// ============================================================================
// REQUEST BODY TYPES
// ============================================================================

export type RequestCancellationBody = {
	cancellation_reason: string;
};

export type RequestRescheduleBody = {
	new_booking_date: string;
	new_start_time: string;
	new_end_time?: string;
	new_photographer_id?: string;
	reschedule_reason: string;
};

export type ApproveRequestBody = {
	admin_notes?: string;
};

export type RejectRequestBody = {
	rejection_reason: string;
	admin_notes?: string;
};

// ============================================================================
// QUERY TYPES
// ============================================================================

export type GetRequestsQuery = {
	status?: "Pending" | "Approved" | "Rejected";
	request_type?: "Cancellation" | "Reschedule";
	customer_id?: string;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAllBookingRequests(query: GetRequestsQuery) {
	const filter: Record<string, any> = {};
	if (query.status) filter.status = query.status;
	if (query.request_type) filter.request_type = query.request_type;
	if (query.customer_id)
		filter.customer_id = new Types.ObjectId(query.customer_id);

	return BookingRequest.find(filter)
		.populate("booking_id")
		.populate("customer_id")
		.populate("new_photographer_id")
		.populate("reviewed_by")
		.lean<PopulatedBookingRequestFull[]>();
}

async function approveCancellationRequest(
	requestId: string,
	reviewerId: string,
	body: ApproveRequestBody
): Promise<PopulatedBookingRequestFull | null> {
	const request = await BookingRequest.findById(requestId);
	if (!request) throw customError(404, "Booking request not found");

	const booking = await Booking.findById(request.booking_id);
	if (!booking) throw customError(404, "Linked booking not found");

	// Update booking status to cancelled
	booking.status = "Cancelled";
	booking.updated_by = new Types.ObjectId(reviewerId);
	await booking.save();

	request.status = "Approved";
	request.reviewed_by = new Types.ObjectId(reviewerId);
	request.admin_notes = body.admin_notes || "";
	request.reviewed_at = new Date();
	await request.save();

	return await populateBookingRequest(request._id as Types.ObjectId);
}

async function approveRescheduleRequest(
	requestId: string,
	reviewerId: string,
	body: ApproveRequestBody
): Promise<PopulatedBookingRequestFull | null> {
	const request = await BookingRequest.findById(requestId);
	if (!request) throw customError(404, "Booking request not found");

	const booking = await Booking.findById(request.booking_id);
	if (!booking) throw customError(404, "Linked booking not found");

	if (!request.new_booking_date || !request.new_start_time) {
		throw customError(400, "Missing new schedule details in request");
	}

	console.log("UMABOT AKO DITO");

	// Apply reschedule
	booking.booking_date = new Date(request.new_booking_date);
	booking.start_time = request.new_start_time;
	if (request.new_end_time) booking.end_time = request.new_end_time;
	if (request.new_photographer_id)
		booking.photographer_id = new Types.ObjectId(request.new_photographer_id);
	booking.updated_by = new Types.ObjectId(reviewerId);

	await booking.save();

	request.status = "Approved";
	request.reviewed_by = new Types.ObjectId(reviewerId);
	request.admin_notes = body.admin_notes || "";
	request.reviewed_at = new Date();
	await request.save();

	return await populateBookingRequest(request._id as Types.ObjectId);
}

async function rejectBookingRequest(
	requestId: string,
	reviewerId: string,
	body: RejectRequestBody
): Promise<PopulatedBookingRequestFull | null> {
	const request = await BookingRequest.findById(requestId);
	if (!request) throw customError(404, "Booking request not found");

	request.status = "Rejected";
	request.reviewed_by = new Types.ObjectId(reviewerId);
	request.rejection_reason = body.rejection_reason;
	request.admin_notes = body.admin_notes || "";
	request.reviewed_at = new Date();

	await request.save();

	return await populateBookingRequest(request._id as Types.ObjectId);
}

async function populateBookingRequest(requestId: Types.ObjectId | string) {
	return BookingRequest.findById(requestId)
		.populate("booking_id")
		.populate("customer_id", "first_name last_name email mobile_number")
		.populate("new_photographer_id", "name email")
		.populate("reviewed_by", "first_name last_name email")
		.lean<PopulatedBookingRequestFull>();
}

// ============================================================================
// ROUTES
// ============================================================================

const router = Router();

/**
 * @route   GET /api/admin/bookings/requests
 * @desc    Get all booking requests with optional filters
 * @access  Admin
 */
router.get(
	"/requests",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{}, GetRequestsQuery>,
		res: TypedResponse<PopulatedBookingRequestFull[]>,
		next: NextFunction
	) => {
		try {
			const requests = await getAllBookingRequests(req.query);
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
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ requestId: string }>,
		res: TypedResponse<PopulatedBookingRequest>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const userId = req.user?._id;

			if (!userId) {
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
 * @route   PATCH /api/admin/bookings/requests/:requestId/approve-cancellation
 * @desc    Approve a cancellation request and cancel the booking
 * @access  Admin
 */
router.patch(
	"/requests/:requestId/approve-cancellation",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ requestId: string }, {}, ApproveRequestBody>,
		res: TypedResponse<PopulatedBookingRequestFull>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const userId = req.user?._id?.toString();
			if (!userId) throw customError(401, "Unauthorized");

			const populatedRequest = await approveCancellationRequest(
				requestId,
				userId,
				req.body
			);

			if (!populatedRequest) {
				throw customError(404, "Booking request not found");
			}
			res.status(200).json({
				status: 200,
				message:
					"Cancellation request approved and booking cancelled successfully",
				data: populatedRequest,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   PATCH /api/admin/bookings/requests/:requestId/approve-reschedule
 * @desc    Approve a reschedule request and update the booking
 * @access  Admin
 */
router.patch(
	"/requests/:requestId/approve-reschedule",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ requestId: string }, {}, ApproveRequestBody>,
		res: TypedResponse<PopulatedBookingRequestFull>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const userId = req.user?._id?.toString();
			if (!userId) throw customError(401, "Unauthorized");

			const populatedRequest = await approveRescheduleRequest(
				requestId,
				userId,
				req.body
			);

			if (!populatedRequest) {
				throw customError(404, "Booking request not found");
			}

			res.status(200).json({
				status: 200,
				message: "Reschedule request approved and booking updated successfully",
				data: populatedRequest,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   PATCH /api/admin/bookings/requests/:requestId/reject
 * @desc    Reject a booking request (cancellation or reschedule)
 * @access  Admin
 */
router.patch(
	"/requests/:requestId/reject",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ requestId: string }, {}, RejectRequestBody>,
		res: TypedResponse<PopulatedBookingRequestFull>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const userId = req.user?._id?.toString();
			if (!userId) throw customError(401, "Unauthorized");

			const populatedRequest = await rejectBookingRequest(
				requestId,
				userId,
				req.body
			);

			if (!populatedRequest) {
				throw customError(404, "Booking request not found");
			}

			res.status(200).json({
				status: 200,
				message: `${populatedRequest.request_type} request rejected successfully`,
				data: populatedRequest,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
