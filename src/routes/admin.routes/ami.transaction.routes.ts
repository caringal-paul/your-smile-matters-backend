import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Transaction } from "../../models/Transaction";
import { Booking } from "../../models/Booking";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface PopulatedCustomer {
	_id: Types.ObjectId;
	customer_no: string;
	first_name: string;
	last_name: string;
	email: string;
	mobile_number: string;
	profile_image?: string;
}

interface PopulatedService {
	_id: Types.ObjectId;
	name: string;
	description: string;
	category: string;
	price: number;
	old_price?: number;
	duration_minutes: number;
	is_available: boolean;
}

interface PopulatedPackage {
	_id: Types.ObjectId;
	name: string;
	description: string;
	image?: string;
	package_price: number;
}

interface PopulatedPhotographer {
	_id: Types.ObjectId;
	name: string;
	email: string;
	mobile_number: string;
	bio?: string;
	profile_image?: string;
	specialties?: string[];
}

interface PopulatedBooking {
	_id: Types.ObjectId;
	booking_reference: string;
	final_amount?: number;
	customer_id: PopulatedCustomer;
	package_id?: PopulatedPackage;
	photographer_id?: PopulatedPhotographer;
	promo_id?: unknown;
	services?: { service_id: PopulatedService }[];
}

interface PopulatedTransactionLean {
	_id: Types.ObjectId;
	transaction_reference: string;
	booking_id: PopulatedBooking;
	customer_id: PopulatedCustomer;
	refund_transaction_id?: PopulatedTransactionLean | null;
	original_transaction_id?: PopulatedTransactionLean | null;
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
	created_by: Types.ObjectId;
	updated_by?: Types.ObjectId | null;
}

export interface CreateRefundRequest {
	refund_amount: number;
	refund_reason: string;
	notes?: string;
}

export interface BookingSummaryResponse {
	all_transactions: PopulatedTransactionLean[];
	completed_transactions: PopulatedTransactionLean[];
	pending_transactions: PopulatedTransactionLean[];
	failed_transactions: PopulatedTransactionLean[];
	total_paid: number;
	total_refunded: number;
	net_amount: number;
}

// ============================================================================
// POPULATION CONFIG
// ============================================================================

const transactionPopulation = [
	{
		path: "booking_id",
		populate: [
			{
				path: "package_id",
				select: "_id name description image package_price",
			},
			{
				path: "photographer_id",
				select: "_id name email mobile_number bio profile_image specialties",
			},
			{ path: "promo_id" },
			{
				path: "services.service_id",
				select:
					"_id name description category price old_price duration_minutes is_available",
			},
		],
	},
	{
		path: "customer_id",
		select:
			"_id customer_no first_name last_name email mobile_number profile_image",
	},
	{ path: "refund_transaction_id" },
	{ path: "original_transaction_id" },
];

export async function getBookingSummary(
	bookingId: Types.ObjectId
): Promise<BookingSummaryResponse> {
	const all_transactions = await Transaction.find({ booking_id: bookingId })
		.populate({
			path: "booking_id",
			populate: [
				{
					path: "package_id",
					select: "_id name description image package_price",
				},
				{
					path: "photographer_id",
					select: "_id name email mobile_number bio profile_image specialties",
				},
				{ path: "promo_id" },
				{
					path: "services.service_id",
					select:
						"_id name description category price old_price duration_minutes is_available",
				},
				{ path: "customer_id" },
			],
		})
		.populate({
			path: "customer_id",
			select:
				"_id customer_no first_name last_name email mobile_number profile_image",
		})
		.populate("refund_transaction_id")
		.populate("original_transaction_id")
		.lean<PopulatedTransactionLean[]>();

	const completed_transactions = all_transactions.filter(
		(t) => t.status === "Completed"
	);
	const pending_transactions = all_transactions.filter(
		(t) => t.status === "Pending"
	);
	const failed_transactions = all_transactions.filter(
		(t) => t.status === "Failed"
	);

	const total_paid = completed_transactions.reduce(
		(sum, t) => sum + (t.amount || 0),
		0
	);

	const total_refunded = all_transactions
		.filter(
			(t) =>
				t.transaction_type === "Refund" || t.transaction_type === "Refunded"
		)
		.reduce((sum, t) => sum + (t.amount || 0), 0);

	const net_amount = total_paid - total_refunded;

	return {
		all_transactions,
		completed_transactions,
		pending_transactions,
		failed_transactions,
		total_paid,
		total_refunded,
		net_amount,
	};
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /admin/transactions
 */
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean[]>,
		next: NextFunction
	) => {
		try {
			const {
				status,
				payment_method,
				transaction_type,
				booking_id,
				customer_id,
				start_date,
				end_date,
				is_active,
			} = req.query;

			const filter: Record<string, unknown> = {};

			if (status) filter.status = status;
			if (payment_method) filter.payment_method = payment_method;
			if (transaction_type) filter.transaction_type = transaction_type;

			if (booking_id && Types.ObjectId.isValid(booking_id as string))
				filter.booking_id = new Types.ObjectId(booking_id as string);
			if (customer_id && Types.ObjectId.isValid(customer_id as string))
				filter.customer_id = new Types.ObjectId(customer_id as string);

			if (start_date || end_date) {
				filter.transaction_date = {};
				if (start_date)
					(filter.transaction_date as Record<string, unknown>).$gte = new Date(
						start_date as string
					);
				if (end_date)
					(filter.transaction_date as Record<string, unknown>).$lte = new Date(
						end_date as string
					);
			}

			if (is_active !== undefined) filter.is_active = is_active === "true";

			const transactions = await Transaction.find(filter)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.populate(transactionPopulation)
				.sort({ transaction_date: -1 })
				.lean<PopulatedTransactionLean[]>();

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

/**
 * GET /admin/transactions/:id
 */
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!Types.ObjectId.isValid(id)) throw customError(400, "Invalid ID");

			const transaction = await Transaction.findById(id)
				.select("-deleted_by -retrieved_by -deleted_at -retrieved_at")
				.populate(transactionPopulation)
				.lean<PopulatedTransactionLean>();

			if (!transaction) throw customError(404, "Transaction not found");

			res.status(200).json({
				status: 200,
				message: "Transaction fetched successfully!",
				data: transaction,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * POST /admin/transactions
 */
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean>,
		next: NextFunction
	) => {
		try {
			const userId = req.user?._id;
			const {
				booking_id,
				amount,
				transaction_type,
				payment_method,
				payment_proof_images,
				external_reference,
				notes,
			} = req.body;

			if (!userId) throw customError(400, "Please login again.");
			if (!booking_id || !Types.ObjectId.isValid(booking_id))
				throw customError(400, "Valid booking ID required.");

			const booking = await Booking.findById(booking_id);
			if (!booking) throw customError(404, "Booking not found.");
			if (!amount || amount <= 0) throw customError(400, "Invalid amount.");
			if (!transaction_type)
				throw customError(400, "Transaction type required.");
			if (!payment_method) throw customError(400, "Payment method required.");

			const newTransaction = await Transaction.create({
				booking_id: booking._id,
				customer_id: booking.customer_id,
				amount,
				transaction_type,
				payment_method,
				payment_proof_images: payment_proof_images || [],
				external_reference,
				notes,
				transaction_date: new Date(),
				created_by: userId,
			});

			const transaction = await Transaction.findById(newTransaction._id)
				.populate(transactionPopulation)
				.lean<PopulatedTransactionLean>();

			if (!transaction) throw customError(500, "Transaction creation failed.");

			res.status(201).json({
				status: 201,
				message: "Transaction created successfully!",
				data: transaction,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ============================================================================
// CRUD & PROCESSING ROUTES
// ============================================================================

router.put(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) throw customError(400, "Please login again.");

			const allowedUpdates = [
				"notes",
				"external_reference",
				"payment_proof_images",
			];

			const updateData = Object.keys(req.body)
				.filter((key) => allowedUpdates.includes(key))
				.reduce<Record<string, unknown>>(
					(acc, key) => ({ ...acc, [key]: req.body[key] }),
					{ updated_by: userId }
				);

			const updatedTransaction = await Transaction.findByIdAndUpdate(
				id,
				updateData,
				{ new: true, runValidators: true }
			)
				.populate({ path: "booking_id", populate: [{ path: "customer_id" }] })
				.populate("customer_id")
				.lean<PopulatedTransactionLean>();

			if (!updatedTransaction) throw customError(404, "Transaction not found");

			res.status(200).json({
				status: 200,
				message: "Transaction updated successfully!",
				data: updatedTransaction,
			});
		} catch (error) {
			next(error);
		}
	}
);

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

			if (!userId) throw customError(400, "Please login again.");
			if (!Types.ObjectId.isValid(id))
				throw customError(400, "Invalid transaction ID.");

			const transaction = await Transaction.findByIdAndUpdate(
				id,
				{
					is_active: false,
					deleted_by: userId,
					deleted_at: new Date(),
				},
				{ new: true }
			);

			if (!transaction) throw customError(404, "Transaction not found.");

			res.status(200).json({
				status: 200,
				message: "Transaction deleted successfully!",
				data: { id },
			});
		} catch (error) {
			next(error);
		}
	}
);

router.patch(
	"/:transactionId/approve",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean>,
		next: NextFunction
	) => {
		try {
			const { transactionId } = req.params;
			const userId = req.user?._id;

			if (!userId) throw customError(400, "Please login again.");
			if (!mongoose.Types.ObjectId.isValid(transactionId))
				throw customError(400, "Invalid transaction ID");

			const transaction = await Transaction.findById(transactionId);
			if (!transaction) throw customError(404, "Transaction not found");
			if (transaction.status !== "Pending")
				throw customError(
					400,
					`Cannot approve transaction with status: ${transaction.status}`
				);

			await transaction.markAsCompleted(new Types.ObjectId(userId));

			const updatedTransaction = await Transaction.findById(transaction._id)
				.populate({ path: "booking_id", populate: [{ path: "customer_id" }] })
				.populate("customer_id")
				.lean<PopulatedTransactionLean>();

			if (!updatedTransaction)
				throw customError(500, "Failed to retrieve updated transaction");

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

router.patch(
	"/:transactionId/reject",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean>,
		next: NextFunction
	) => {
		try {
			const { transactionId } = req.params;
			const { reason } = req.body;
			const userId = req.user?._id;

			if (!userId) throw customError(400, "Please login again.");
			if (!mongoose.Types.ObjectId.isValid(transactionId))
				throw customError(400, "Invalid transaction ID");
			if (!reason?.trim() || reason.trim().length < 5)
				throw customError(
					400,
					"Rejection reason must be at least 5 characters long"
				);

			const transaction = await Transaction.findById(transactionId);
			if (!transaction) throw customError(404, "Transaction not found");
			if (transaction.status !== "Pending")
				throw customError(
					400,
					`Cannot reject transaction with status: ${transaction.status}`
				);

			await transaction.markAsFailed(reason, new Types.ObjectId(userId));

			const updatedTransaction = await Transaction.findById(transaction._id)
				.populate({ path: "booking_id", populate: [{ path: "customer_id" }] })
				.populate("customer_id")
				.lean<PopulatedTransactionLean>();

			if (!updatedTransaction)
				throw customError(500, "Failed to retrieve updated transaction");

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

router.post(
	"/:id/refund",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { refund_amount, refund_reason, notes } =
				req.body as CreateRefundRequest;
			const userId = req.user?._id;

			if (!userId) throw customError(400, "Please login again.");
			if (!refund_amount || !refund_reason)
				throw customError(400, "Refund amount and reason are required");

			const transaction = await Transaction.findById(id);
			if (!transaction) throw customError(404, "Transaction not found");

			const refundTransaction = await transaction.createRefund(
				refund_amount,
				refund_reason,
				userId
			);

			if (notes) {
				refundTransaction.notes = notes;
				await refundTransaction.save();
			}

			const refundTransactionData = await Transaction.findById(
				refundTransaction._id
			)
				.populate({
					path: "booking_id",
					populate: [{ path: "customer_id" }],
				})
				.populate("customer_id")
				.populate("original_transaction_id")
				.lean<PopulatedTransactionLean>();

			if (!refundTransactionData)
				throw customError(500, "Failed to fetch refund transaction");

			res.status(201).json({
				status: 201,
				message: "Refund transaction created successfully!",
				data: refundTransactionData,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ============================================================================
// SUMMARY ROUTES
// ============================================================================
router.get(
	"/booking/:bookingId/summary",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BookingSummaryResponse>,
		next: NextFunction
	) => {
		try {
			const { bookingId } = req.params;

			if (!Types.ObjectId.isValid(bookingId)) {
				throw customError(400, "Invalid booking ID");
			}

			const bookingObjectId = new Types.ObjectId(bookingId);

			const transactionInstance = await Transaction.exists({
				booking_id: bookingObjectId,
				is_active: true,
			});

			if (!transactionInstance) {
				throw customError(404, "No transactions found for this booking");
			}

			const summary = await getBookingSummary(bookingObjectId);

			res.status(200).json({
				status: 200,
				message: "Booking transaction summary fetched successfully!",
				data: {
					...summary,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

router.get(
	"/customer/:customerId",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedTransactionLean[]>,
		next: NextFunction
	) => {
		try {
			const { customerId } = req.params;

			if (!Types.ObjectId.isValid(customerId))
				throw customError(400, "Invalid customer ID");

			const transactions = await Transaction.find({
				customer_id: new Types.ObjectId(customerId),
				is_active: true,
			})
				.populate({ path: "booking_id", populate: [{ path: "customer_id" }] })
				.sort({ transaction_date: -1 })
				.lean<PopulatedTransactionLean[]>();

			res.status(200).json({
				status: 200,
				message: "Customer transactions fetched successfully!",
				data: transactions,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
