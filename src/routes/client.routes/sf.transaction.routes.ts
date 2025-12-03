import { Router, NextFunction } from "express";
import { Types } from "mongoose";
import { Transaction } from "../../models/Transaction";
import { Booking, BookingModel } from "../../models/Booking";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import {
	authenticateCustomerToken,
	CustomerAuthenticatedRequest,
} from "../../middleware/authCustomerMiddleware";
import { CustomerModel } from "../../models/Customer";
import { formatToPeso } from "../../utils/formatMoney";

const router = Router();

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface TransactionLean {
	_id: Types.ObjectId;
	transaction_reference: string;
	booking_id: BookingModel;
	customer_id: CustomerModel;
	amount: number;
	transaction_type: string;
	payment_method: string;
	status: string;
	payment_proof_images: string[];
	external_reference?: string | null;
	transaction_date: Date;
	processed_at?: Date | null;
	failed_at?: Date | null;
	refunded_at?: Date | null;
	notes?: string | null;
	failure_reason?: string | null;
	refund_reason?: string | null;
	refund_transaction_id?: Types.ObjectId | null;
	original_transaction_id?: Types.ObjectId | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

interface TransactionResponse {
	_id: string;
	transaction_reference: string;
	booking_id: BookingModel;
	customer_id: CustomerModel;
	amount: number;
	transaction_type: string;
	payment_method: string;
	status: string;
	payment_proof_images: string[];
	external_reference?: string | null;
	transaction_date: Date;
	processed_at?: Date | null;
	failed_at?: Date | null;
	refunded_at?: Date | null;
	notes?: string | null;
	failure_reason?: string | null;
	refund_reason?: string | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

interface BookingPaymentSummary {
	booking_id: string;
	booking_reference: string;
	final_amount: number;
	total_paid: number;
	total_refunded: number;
	net_paid: number;
	remaining_balance: number;
	payment_status: "unpaid" | "partial" | "paid" | "overpaid";
	transactions: TransactionResponse[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToResponse(transaction: TransactionLean): TransactionResponse {
	const {
		_id,
		booking_id,
		customer_id,
		created_at,
		updated_at,
		refund_transaction_id,
		original_transaction_id,
		...transactionData
	} = transaction;

	return {
		_id: _id.toString(),
		booking_id: booking_id,
		customer_id: customer_id,
		created_at,
		updated_at,
		...transactionData,
	};
}

function calculatePaymentStatus(
	remaining: number
): "unpaid" | "partial" | "paid" | "overpaid" {
	if (remaining === 0) return "paid";
	if (remaining < 0) return "overpaid";
	if (remaining > 0) return "partial";
	return "unpaid";
}

// ============================================================================
// CLIENT TRANSACTION ROUTES
// ============================================================================

/**
 * GET /client/transactions/my-transactions
 * Get all transactions for the authenticated customer
 */
router.get(
	"/my-transactions",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<TransactionResponse[]>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			const { status, payment_method, start_date, end_date } = req.query;

			const filter: Record<string, unknown> = {
				customer_id: customerId,
				is_active: true,
			};

			if (status) {
				filter.status = status;
			}

			if (payment_method) {
				filter.payment_method = payment_method;
			}

			if (start_date || end_date) {
				filter.transaction_date = {};
				if (start_date) {
					(filter.transaction_date as Record<string, unknown>).$gte = new Date(
						start_date as string
					);
				}
				if (end_date) {
					(filter.transaction_date as Record<string, unknown>).$lte = new Date(
						end_date as string
					);
				}
			}

			const transactions = await Transaction.find(filter)
				.populate({
					path: "booking_id",
					select:
						"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by -__v",
				})
				.populate({
					path: "customer_id",
					select:
						"-password -deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by -__v",
				})
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by -__v"
				)
				.sort({ transaction_date: -1 })
				.lean<TransactionLean[]>();

			const transactionResponse: TransactionResponse[] =
				transactions.map(convertToResponse);

			res.status(200).json({
				status: 200,
				message: "Transactions fetched successfully!",
				data: transactionResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /client/transactions/booking/:bookingId
 * Get all transactions for a specific booking (with payment summary)
 */
router.get(
	"/booking/:bookingId",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<BookingPaymentSummary>,
		next: NextFunction
	) => {
		try {
			const { bookingId } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!Types.ObjectId.isValid(bookingId)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(bookingId);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			// Verify customer owns this booking
			if (booking.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You don't have access to this booking");
			}

			const transactions = await Transaction.find({
				booking_id: bookingId,
				is_active: true,
			})
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by"
				)
				.sort({ transaction_date: -1 })
				.lean<TransactionLean[]>();

			// Calculate payment summary
			const completedTransactions = transactions.filter(
				(t) => t.status === "Completed"
			);

			const totalPaid = completedTransactions
				.filter(
					(t) =>
						t.transaction_type === "Payment" ||
						t.transaction_type === "Partial" ||
						t.transaction_type === "Balance"
				)
				.reduce((sum, t) => sum + t.amount, 0);

			const totalRefunded = completedTransactions
				.filter((t) => t.transaction_type === "Refund")
				.reduce((sum, t) => sum + t.amount, 0);

			const netPaid = totalPaid - totalRefunded;
			const remainingBalance = booking.final_amount - netPaid;
			const paymentStatus = calculatePaymentStatus(remainingBalance);

			const summary: BookingPaymentSummary = {
				booking_id: bookingId,
				booking_reference: booking.booking_reference,
				final_amount: booking.final_amount,
				total_paid: totalPaid,
				total_refunded: totalRefunded,
				net_paid: netPaid,
				remaining_balance: Math.max(0, remainingBalance),
				payment_status: paymentStatus,
				transactions: transactions.map(convertToResponse),
			};

			res.status(200).json({
				status: 200,
				message: "Booking payment summary fetched successfully!",
				data: summary,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * POST /client/transactions/booking/:bookingId/pay
 * Create a payment transaction for a booking (supports partial payments)
 */
router.post(
	"/booking/:bookingId/pay",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<TransactionResponse>,
		next: NextFunction
	) => {
		try {
			const { bookingId } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!Types.ObjectId.isValid(bookingId)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(bookingId);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			// Verify customer owns this booking
			if (booking.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You don't have access to this booking");
			}

			const {
				amount,
				payment_method,
				payment_proof_images,
				external_reference,
				notes,
			} = req.body;

			if (!amount || amount <= 0) {
				throw customError(400, "Valid payment amount is required");
			}

			if (!payment_method) {
				throw customError(400, "Payment method is required");
			}

			const allTransactions = await Transaction.find({
				booking_id: bookingId,
				status: { $nin: ["Failed", "Refunded"] }, // EXCLUDE refunded
				transaction_type: { $in: ["Payment", "Partial", "Balance"] },
			});

			const totalCommitted = allTransactions.reduce(
				(sum, txn) => sum + txn.amount,
				0
			);

			const remainingBalance = booking.final_amount - totalCommitted;

			// Validate new payment doesn't exceed remaining balance
			if (amount > remainingBalance) {
				throw customError(
					400,
					`${formatToPeso(amount)} exceeds remaining balance ${formatToPeso(
						String(remainingBalance)
					)}`
				);
			}

			// Determine transaction type based on amount
			let transactionType: string;
			if (amount >= remainingBalance) {
				transactionType = "Balance"; // Full payment or final payment
			} else {
				transactionType = "Partial"; // Partial payment
			}

			// Create transaction
			const newTransaction = new Transaction({
				booking_id: booking._id,
				customer_id: customerId,
				amount,
				transaction_type: transactionType,
				payment_method,
				status: "Pending",
				payment_proof_images: payment_proof_images || [],
				external_reference,
				notes,
				transaction_date: new Date(),
				created_by: customerId,
			});

			await newTransaction.save();

			const transaction = await Transaction.findById(newTransaction._id)
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by"
				)
				.lean<TransactionLean>();

			if (!transaction) {
				throw customError(500, "Failed to retrieve created transaction");
			}

			const transactionResponse = convertToResponse(transaction);

			res.status(201).json({
				status: 201,
				message: "Payment submitted successfully! Waiting for approval.",
				data: transactionResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /client/transactions/:transactionId
 * Get single transaction details
 */
router.get(
	"/:transactionId",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<TransactionResponse>,
		next: NextFunction
	) => {
		try {
			const { transactionId } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!Types.ObjectId.isValid(transactionId)) {
				throw customError(400, "Invalid transaction ID format");
			}

			const transaction = await Transaction.findById(transactionId)
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by"
				)
				.populate("booking_id")
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by -__v"
				)
				.populate("customer_id")
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by -__v"
				)
				.populate("updated_by")
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by -__v"
				)
				.lean<TransactionLean>();

			if (!transaction) {
				throw customError(404, "Transaction not found");
			}

			const transactionCustomer = transaction.customer_id as CustomerModel;

			// Verify customer owns this transaction
			if (String(transactionCustomer._id) != customerId.toString()) {
				throw customError(403, "You don't have access to this transaction");
			}

			const transactionResponse = convertToResponse(transaction);

			res.status(200).json({
				status: 200,
				message: "Transaction fetched successfully!",
				data: transactionResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * PATCH /client/transactions/:transactionId/cancel
 * Cancel a pending transaction (client can only cancel their own pending transactions)
 */
router.patch(
	"/:transactionId/cancel",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<TransactionResponse>,
		next: NextFunction
	) => {
		try {
			const { transactionId } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!Types.ObjectId.isValid(transactionId)) {
				throw customError(400, "Invalid transaction ID format");
			}

			const transaction = await Transaction.findById(transactionId);

			if (!transaction) {
				throw customError(404, "Transaction not found");
			}

			// Verify customer owns this transaction
			if (transaction.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You don't have access to this transaction");
			}

			if (transaction.status !== "Pending") {
				throw customError(
					400,
					`Cannot cancel transaction with status: ${transaction.status}`
				);
			}

			// Update transaction to cancelled
			transaction.status = "Cancelled";
			transaction.updated_by = new Types.ObjectId(customerId);
			await transaction.save();

			const updatedTransaction = await Transaction.findById(transaction._id)
				.select(
					"-deleted_by -retrieved_by -deleted_at -retrieved_at -created_by -updated_by"
				)
				.lean<TransactionLean>();

			if (!updatedTransaction) {
				throw customError(500, "Failed to retrieve updated transaction");
			}

			const transactionResponse = convertToResponse(updatedTransaction);

			res.status(200).json({
				status: 200,
				message: "Transaction cancelled successfully!",
				data: transactionResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * GET /client/transactions/payment-summary
 * Get overall payment summary for all customer's bookings
 */
router.get(
	"/payment-summary",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<{
			total_bookings: number;
			total_spent: number;
			total_refunded: number;
			net_spent: number;
			pending_payments: number;
			completed_payments: number;
			failed_payments: number;
		}>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			const allTransactions = await Transaction.find({
				customer_id: customerId,
				is_active: true,
			}).lean<TransactionLean[]>();

			const completedTransactions = allTransactions.filter(
				(t) => t.status === "Completed"
			);

			const totalSpent = completedTransactions
				.filter(
					(t) =>
						t.transaction_type === "Payment" ||
						t.transaction_type === "Partial" ||
						t.transaction_type === "Balance"
				)
				.reduce((sum, t) => sum + t.amount, 0);

			const totalRefunded = completedTransactions
				.filter((t) => t.transaction_type === "Refund")
				.reduce((sum, t) => sum + t.amount, 0);

			const uniqueBookings = new Set(
				allTransactions.map((t) => t.booking_id.toString())
			);

			const summary = {
				total_bookings: uniqueBookings.size,
				total_spent: totalSpent,
				total_refunded: totalRefunded,
				net_spent: totalSpent - totalRefunded,
				pending_payments: allTransactions.filter((t) => t.status === "Pending")
					.length,
				completed_payments: allTransactions.filter(
					(t) => t.status === "Completed"
				).length,
				failed_payments: allTransactions.filter((t) => t.status === "Failed")
					.length,
			};

			res.status(200).json({
				status: 200,
				message: "Payment summary fetched successfully!",
				data: summary,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
