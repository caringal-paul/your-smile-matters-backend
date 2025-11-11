import { Router, NextFunction } from "express";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { Transaction, TransactionModel } from "../../models/Transaction";
import { customError } from "../../middleware/errorHandler";
import {
	TransactionRequest,
	TransactionRequestModel,
} from "../../models/TransactionRequest";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authAmiMiddleware";
import { TypedResponse } from "../../types/base.types";

// ============================================================================
// POPULATED TYPES
// ============================================================================

export type PopulatedTransactionInfo = {
	_id: Types.ObjectId;
	transaction_reference: string;
	amount: number;
	payment_method: string;
	status: string;
};

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

export type PopulatedReviewerInfo = {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
};

export type PopulatedTransactionRequest = Omit<
	TransactionRequestModel,
	"transaction_id" | "booking_id" | "customer_id" | "reviewed_by"
> & {
	transaction_id: PopulatedTransactionInfo;
	booking_id: PopulatedBookingInfo;
	customer_id: PopulatedCustomerInfo;
	reviewed_by?: PopulatedReviewerInfo;
};

export type PopulatedTransactionRequestFull = Omit<
	TransactionRequestModel,
	"transaction_id" | "booking_id" | "customer_id" | "reviewed_by"
> & {
	transaction_id: TransactionModel;
	booking_id: PopulatedBookingInfo;
	customer_id: PopulatedCustomerInfo;
	reviewed_by?: PopulatedReviewerInfo;
};

// ============================================================================
// REQUEST BODY TYPES
// ============================================================================

export type ApproveRefundRequestBody = {
	admin_notes?: string;
};

export type RejectRefundRequestBody = {
	rejection_reason: string;
	admin_notes?: string;
};

// ============================================================================
// QUERY TYPES
// ============================================================================

export type GetTransactionRequestsQuery = {
	status?: "Pending" | "Approved" | "Rejected";
	request_type?: "Refund";
	customer_id?: string;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAllTransactionRequests(query: GetTransactionRequestsQuery) {
	const filter: Record<string, any> = { is_active: true };
	if (query.status) filter.status = query.status;
	if (query.request_type) filter.request_type = query.request_type;
	if (query.customer_id)
		filter.customer_id = new Types.ObjectId(query.customer_id);

	return TransactionRequest.find(filter)
		.populate(
			"transaction_id",
			"transaction_reference amount payment_method status"
		)
		.populate("booking_id", "booking_reference booking_date start_time status")
		.populate("customer_id", "first_name last_name email mobile_number")
		.populate("reviewed_by", "first_name last_name email")
		.sort({ created_at: -1 })
		.lean<PopulatedTransactionRequestFull[]>();
}

async function getTransactionRequestById(requestId: string) {
	if (!mongoose.Types.ObjectId.isValid(requestId)) {
		throw customError(400, "Invalid request ID format");
	}

	// ===============================================================
	// 🧠 FULLY POPULATED TRANSACTION REQUEST (Admin version)
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

	if (!request) {
		throw customError(404, "Transaction request not found");
	}

	return request;
}

export async function approveRefundRequest(
	requestId: string,
	userId: string,
	body: ApproveRefundRequestBody
) {
	// ✅ Ensure proper population
	const request = await TransactionRequest.findById(requestId).populate<{
		transaction_id: TransactionModel;
	}>("transaction_id");

	if (!request) throw customError(404, "Transaction request not found");

	const transaction = request.transaction_id as unknown as TransactionModel;
	if (!transaction || typeof transaction !== "object" || !transaction.status) {
		throw customError(400, "Transaction data not found or not populated");
	}

	// ✅ Validate transaction state (only completed transactions can be refunded)
	if (transaction.status !== "Completed") {
		throw customError(
			400,
			"Only completed transactions are eligible for refund requests"
		);
	}

	// ✅ Approve the refund request — but DO NOT update transaction yet
	request.status = "Approved";
	request.reviewed_by = new Types.ObjectId(userId);
	request.reviewed_at = new Date();
	request.admin_notes = body.admin_notes || null;
	request.updated_by = new Types.ObjectId(userId);

	await request.save();

	// ✅ Return a fully populated version for frontend display
	return await populateTransactionRequest(request._id as Types.ObjectId);
}

async function rejectRefundRequest(
	requestId: string,
	reviewerId: string,
	body: RejectRefundRequestBody
): Promise<PopulatedTransactionRequestFull | null> {
	// ✅ Ensure request is populated properly
	const request = await TransactionRequest.findById(requestId).populate<{
		transaction_id: TransactionModel;
	}>("transaction_id");

	if (!request) throw customError(404, "Transaction request not found");

	// ✅ Verify populated transaction exists
	const transaction = request.transaction_id as unknown as TransactionModel;
	if (!transaction || typeof transaction !== "object" || !transaction._id) {
		throw customError(400, "Linked transaction not found or not populated");
	}

	// ✅ Prevent invalid state transitions
	if (request.status !== "Pending") {
		throw customError(
			400,
			`Cannot reject request with status: ${request.status}`
		);
	}

	// ✅ Validate input
	if (!body.rejection_reason || body.rejection_reason.trim().length < 5) {
		throw customError(
			400,
			"Rejection reason must be at least 5 characters long"
		);
	}

	// ✅ Update request fields
	request.status = "Rejected";
	request.reviewed_by = new Types.ObjectId(reviewerId);
	request.rejection_reason = body.rejection_reason.trim();
	request.admin_notes = body.admin_notes || null;
	request.reviewed_at = new Date();
	request.updated_by = new Types.ObjectId(reviewerId);

	await request.save();

	// ✅ Return a fully populated version for frontend display
	return await populateTransactionRequest(request._id as Types.ObjectId);
}

async function populateTransactionRequest(requestId: Types.ObjectId | string) {
	return TransactionRequest.findById(requestId)
		.populate("transaction_id")
		.populate("booking_id")
		.populate("customer_id")
		.populate("reviewed_by")
		.lean<PopulatedTransactionRequestFull>();
}

// ============================================================================
// ROUTES
// ============================================================================

const router = Router();

/**
 * @route   GET /api/admin/transactions/requests
 * @desc    Get all transaction requests with optional filters
 * @access  Admin
 */
router.get(
	"/requests",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{}, GetTransactionRequestsQuery>,
		res: TypedResponse<PopulatedTransactionRequestFull[]>,
		next: NextFunction
	) => {
		try {
			const requests = await getAllTransactionRequests(req.query);
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
 * @route   GET /api/admin/transactions/requests/:requestId
 * @desc    Get a single transaction request by ID with full details
 * @access  Admin
 */
router.get(
	"/:requestId",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ requestId: string }>,
		res: TypedResponse<PopulatedTransactionRequest>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;

			// ===============================================================
			// 🧠 GET FULLY POPULATED REQUEST
			// ===============================================================
			const request = await getTransactionRequestById(requestId);

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
 * @route   PATCH /api/admin/transactions/requests/:requestId/approve-refund
 * @desc    Approve a refund request and update the transaction status
 * @access  Admin
 */
router.patch(
	"/requests/:requestId/approve-refund",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<
			{ requestId: string },
			{},
			ApproveRefundRequestBody
		>,
		res: TypedResponse<PopulatedTransactionRequestFull>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const userId = req.user?._id?.toString();

			if (!userId) throw customError(401, "Unauthorized");

			// ✅ Run core approval logic
			const populatedRequest = await approveRefundRequest(
				requestId,
				userId,
				req.body
			);

			if (!populatedRequest) {
				throw customError(
					404,
					"Transaction request not found or could not be processed"
				);
			}

			// ✅ Return populated, up-to-date response
			return res.status(200).json({
				status: 200,
				message: "Refund request approved and transaction updated successfully",
				data: populatedRequest,
			});
		} catch (error) {
			// ✅ Add context to debugging logs (optional)
			console.error("❌ Error approving refund:", error);

			// ✅ Let Express handle error middleware properly
			return next(error);
		}
	}
);

/**
 * @route   PATCH /api/admin/transactions/requests/:requestId/reject
 * @desc    Reject a refund request
 * @access  Admin
 */
router.patch(
	"/requests/:requestId/reject",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<
			{ requestId: string },
			{},
			RejectRefundRequestBody
		>,
		res: TypedResponse<PopulatedTransactionRequestFull>,
		next: NextFunction
	) => {
		try {
			const { requestId } = req.params;
			const userId = req.user?._id?.toString();

			if (!userId) throw customError(401, "Unauthorized");

			// ✅ Execute main rejection logic
			const populatedRequest = await rejectRefundRequest(
				requestId,
				userId,
				req.body
			);

			if (!populatedRequest) {
				throw customError(
					404,
					"Transaction request not found or could not be processed"
				);
			}

			// ✅ Return populated data
			return res.status(200).json({
				status: 200,
				message: "Refund request rejected successfully",
				data: populatedRequest,
			});
		} catch (error) {
			console.error("❌ Error rejecting refund:", error);
			return next(error);
		}
	}
);

export default router;
