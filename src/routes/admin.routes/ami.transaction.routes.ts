import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Transaction } from "../../models/Transaction";
import { Booking } from "../../models/Booking";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";
import { customError } from "../../middleware/errorHandler";
import { TypedResponse } from "../../types/base.types";

const router = Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

// ============================================================================
// ROUTES
// ============================================================================

// POST /api/transactions/:id - Add payment transaction
router.post(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransaction>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			const {
				amount,
				transaction_type,
				payment_method,
				payment_proof_images,
				external_reference,
				notes,
			} = req.body;

			if (!amount || amount <= 0) {
				throw customError(400, "Valid amount is required");
			}

			if (!transaction_type) {
				throw customError(400, "Transaction type is required");
			}

			if (!payment_method) {
				throw customError(400, "Payment method is required");
			}

			// Create transaction
			const newTransaction = new Transaction({
				booking_id: booking._id,
				customer_id: booking.customer_id,
				amount,
				transaction_type,
				payment_method,
				status: "Pending",
				payment_proof_images: payment_proof_images || [],
				external_reference,
				notes,
				transaction_date: new Date(),
				created_by: new Types.ObjectId(userId),
			});

			await newTransaction.save();

			const populatedTransaction = await Transaction.findById(
				newTransaction._id
			).lean<PopulatedTransaction>();

			if (!populatedTransaction) {
				throw customError(500, "Failed to retrieve created transaction");
			}

			res.status(201).json({
				status: 201,
				message: "Transaction created successfully!",
				data: populatedTransaction,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/transactions/:id - Get all transactions for a booking
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransaction[]>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const transactions = await Transaction.find({
				booking_id: id,
				is_active: true,
			})
				.sort({ transaction_date: -1 })
				.lean<PopulatedTransaction[]>();

			res.status(200).json({
				status: 200,
				message: "Transactions fetched successfully!",
				data: transactions,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:bookingId/transactions/:transactionId/approve
router.patch(
	"/:bookingId/transactions/:transactionId/approve",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransaction>,
		next: NextFunction
	) => {
		try {
			const { bookingId, transactionId } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(transactionId)) {
				throw customError(400, "Invalid transaction ID format");
			}

			const transaction = await Transaction.findOne({
				_id: transactionId,
				booking_id: bookingId,
			});

			if (!transaction) {
				throw customError(404, "Transaction not found");
			}

			if (transaction.status !== "Pending") {
				throw customError(
					400,
					`Cannot approve transaction with status: ${transaction.status}`
				);
			}

			await transaction.markAsCompleted(new Types.ObjectId(userId));

			const updatedTransaction = await Transaction.findById(
				transaction._id
			).lean<PopulatedTransaction>();

			if (!updatedTransaction) {
				throw customError(500, "Failed to retrieve updated transaction");
			}

			res.status(200).json({
				status: 200,
				message: "Transaction approved successfully!",
				data: updatedTransaction,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:bookingId/transactions/:transactionId/reject
router.patch(
	"/:bookingId/transactions/:transactionId/reject",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransaction>,
		next: NextFunction
	) => {
		try {
			const { bookingId, transactionId } = req.params;
			const { reason } = req.body;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(transactionId)) {
				throw customError(400, "Invalid transaction ID format");
			}

			if (!reason || reason.trim().length < 5) {
				throw customError(
					400,
					"Rejection reason is required (min 5 characters)"
				);
			}

			const transaction = await Transaction.findOne({
				_id: transactionId,
				booking_id: bookingId,
			});

			if (!transaction) {
				throw customError(404, "Transaction not found");
			}

			if (transaction.status !== "Pending") {
				throw customError(
					400,
					`Cannot reject transaction with status: ${transaction.status}`
				);
			}

			await transaction.markAsFailed(reason, new Types.ObjectId(userId));

			const updatedTransaction = await Transaction.findById(
				transaction._id
			).lean<PopulatedTransaction>();

			if (!updatedTransaction) {
				throw customError(500, "Failed to retrieve updated transaction");
			}

			res.status(200).json({
				status: 200,
				message: "Transaction rejected successfully!",
				data: updatedTransaction,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
