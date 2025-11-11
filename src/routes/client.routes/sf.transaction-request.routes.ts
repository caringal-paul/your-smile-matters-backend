import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import {
	authenticateCustomerToken,
	CustomerAuthenticatedRequest,
} from "../../middleware/authCustomerMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import {
	TransactionRequest,
	TransactionRequestModel,
} from "../../models/TransactionRequest";
import { Transaction } from "../../models/Transaction";
import { Booking } from "../../models/Booking";

const router = Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type PopulatedTransactionInfo = {
	_id: Types.ObjectId;
	transaction_reference: string;
	amount: number;
	payment_method: string;
	status: string;
};

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

type PopulatedReviewerInfo = {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
};

type PopulatedTransactionRequest = Omit<
	TransactionRequestModel,
	"transaction_id" | "booking_id" | "customer_id" | "reviewed_by"
> & {
	transaction_id: PopulatedTransactionInfo;
	booking_id: PopulatedBookingInfo;
	customer_id: PopulatedCustomerInfo;
	reviewed_by?: PopulatedReviewerInfo | null;
};

type RequestRefundBody = {
	transaction_id: string;
	booking_id: string;
	refund_amount: number;
	refund_reason: string;
};

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/transactions/request-refund
 * @desc    Customer requests a refund for a transaction
 * @access  Customer
 */
router.post(
	"/request-refund",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{}, {}, RequestRefundBody>,
		res: TypedResponse<PopulatedTransactionRequest>,
		next: NextFunction
	) => {
		try {
			const { transaction_id, booking_id, refund_amount, refund_reason } =
				req.body;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			// Validate required fields
			if (!transaction_id || !booking_id || !refund_amount || !refund_reason) {
				throw customError(
					400,
					"Transaction ID, booking ID, refund amount, and refund reason are required"
				);
			}

			// Validate ObjectId formats
			if (!mongoose.Types.ObjectId.isValid(transaction_id)) {
				throw customError(400, "Invalid transaction ID format");
			}
			if (!mongoose.Types.ObjectId.isValid(booking_id)) {
				throw customError(400, "Invalid booking ID format");
			}

			// Validate refund reason length
			if (refund_reason.trim().length < 5) {
				throw customError(400, "Refund reason must be at least 5 characters");
			}

			// Validate refund amount
			if (refund_amount <= 0) {
				throw customError(400, "Refund amount must be greater than 0");
			}

			// Check if transaction exists and belongs to customer
			const transaction = await Transaction.findById(transaction_id);
			if (!transaction) {
				throw customError(404, "Transaction not found");
			}

			if (transaction.customer_id.toString() !== customerId.toString()) {
				throw customError(
					403,
					"You can only request refunds for your own transactions"
				);
			}

			if (transaction.status !== "Completed") {
				throw customError(
					400,
					`Cannot request refund for transaction with status: ${transaction.status}`
				);
			}

			// Validate refund amount doesn't exceed transaction amount
			if (refund_amount > transaction.amount) {
				throw customError(
					400,
					`Refund amount (${refund_amount}) exceeds transaction amount (${transaction.amount})`
				);
			}

			// Check if booking exists and belongs to customer
			const booking = await Booking.findById(booking_id);
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "Booking does not belong to you");
			}

			// Check for existing pending refund request for this transaction
			const existingRequest = await TransactionRequest.findOne({
				transaction_id: new Types.ObjectId(transaction_id),
				customer_id: new Types.ObjectId(customerId),
				request_type: "Refund",
				status: "Pending",
				is_active: true,
			});

			if (existingRequest) {
				throw customError(
					400,
					"You already have a pending refund request for this transaction"
				);
			}

			// Create refund request
			const refundRequest = new TransactionRequest({
				transaction_id: new Types.ObjectId(transaction_id),
				booking_id: new Types.ObjectId(booking_id),
				customer_id: new Types.ObjectId(customerId),
				request_type: "Refund",
				status: "Pending",
				refund_amount,
				refund_reason: refund_reason.trim(),
				created_by: new Types.ObjectId(customerId),
			});

			await refundRequest.save();

			// Populate and return
			const populatedRequest = await TransactionRequest.findById(
				refundRequest._id
			)
				.populate<{ transaction_id: PopulatedTransactionInfo }>(
					"transaction_id"
				)
				.populate<{ booking_id: PopulatedBookingInfo }>("booking_id")
				.populate<{ customer_id: PopulatedCustomerInfo }>("customer_id")
				.lean<PopulatedTransactionRequest>();

			if (!populatedRequest) {
				throw customError(500, "Failed to retrieve created request");
			}

			res.status(201).json({
				status: 201,
				message:
					"Refund request submitted successfully! An admin will review your request.",
				data: populatedRequest,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/transactions/my-requests
 * @desc    Get all transaction requests for the logged-in customer
 * @access  Customer
 */
router.get(
	"/my-requests",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionRequest[]>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			const requests = await TransactionRequest.find({
				customer_id: new Types.ObjectId(customerId),
				is_active: true,
			})
				.populate<{ transaction_id: PopulatedTransactionInfo }>(
					"transaction_id"
				)
				.populate<{ booking_id: PopulatedBookingInfo }>("booking_id")
				.populate<{ reviewed_by: PopulatedReviewerInfo }>("reviewed_by")
				.sort({ created_at: -1 })
				.lean<PopulatedTransactionRequest[]>();

			res.status(200).json({
				status: 200,
				message: "Transaction requests retrieved successfully",
				data: requests,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/transactions/requests/:requestId
 * @desc    Get a single transaction request by ID
 * @access  Customer
 */
router.get(
	"/:requestId",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{ requestId: string }>,
		res: TypedResponse<PopulatedTransactionRequest>,
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

			// ===============================================================
			// 🧠 FULLY POPULATED TRANSACTION REQUEST
			// ===============================================================
			const request = await TransactionRequest.findById(requestId)
				.populate({
					path: "transaction_id",
					populate: [
						{
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
						},
						{ path: "customer_id" },
					],
				})
				.populate({
					path: "booking_id",
					populate: [
						{ path: "customer_id" },
						{ path: "photographer_id" },
						{ path: "package_id" },
						{ path: "promo_id" },
						{ path: "services.service_id" },
					],
				})
				.populate({ path: "customer_id" })
				.populate({ path: "reviewed_by" })
				.lean<PopulatedTransactionRequest>();

			// ===============================================================
			// 🛑 VALIDATION
			// ===============================================================
			if (!request) {
				throw customError(404, "Transaction request not found");
			}

			if (request.customer_id._id.toString() !== customerId.toString()) {
				throw customError(
					403,
					"You are not authorized to view this transaction request"
				);
			}

			// ===============================================================
			// ✅ RESPONSE
			// ===============================================================
			res.status(200).json({
				status: 200,
				message: "Transaction request retrieved successfully",
				data: request,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   DELETE /api/transactions/requests/:requestId
 * @desc    Cancel a pending refund request
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

			const request = await TransactionRequest.findById(requestId);
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
				message: "Refund request cancelled successfully",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
