import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { customError } from "../middleware/errorHandler";

// Transaction status enum
export const TransactionStatusEnum = {
	Pending: "Pending",
	Completed: "Completed",
	Failed: "Failed",
	Refunded: "Refunded",
	Cancelled: "Cancelled",
} as const;

export type TransactionStatus = keyof typeof TransactionStatusEnum;

// Payment method enum
export const PaymentMethodEnum = {
	Cash: "Cash",
	GCash: "GCash",
} as const;

export type PaymentMethod = keyof typeof PaymentMethodEnum;


// Transaction type enum
export const TransactionTypeEnum = {
	Payment: "Payment",
	Refund: "Refund",
	Partial: "Partial",
	Balance: "Balance",
} as const;

export type TransactionType = keyof typeof TransactionTypeEnum;

export type TransactionMethods = {
	markAsCompleted(processedBy: Types.ObjectId): Promise<TransactionModel>;
	markAsFailed(
		reason: string,
		processedBy: Types.ObjectId
	): Promise<TransactionModel>;
	createRefund(
		refundAmount: number,
		refundReason: string,
		processedBy: string,
		payment_proof_images: string[]
	): Promise<TransactionModel>;
};

// Transaction model type
export type TransactionModel = Document &
	MetaData &
	TransactionMethods & {
		transaction_reference: string;
		booking_id: Types.ObjectId;
		customer_id: Types.ObjectId;

		amount: number;
		transaction_type: TransactionType;
		payment_method: PaymentMethod;
		status: TransactionStatus;

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
	};

// Transaction schema
const transactionSchema = new Schema<TransactionModel>(
	{
		transaction_reference: {
			type: String,
			required: [true, "Transaction reference is required"],
			unique: true,
			uppercase: true,
			match: [/^TXN-[A-Z0-9]{8}$/, "Invalid transaction reference format"],
		},
		booking_id: {
			type: Schema.Types.ObjectId,
			ref: "Booking",
			required: [true, "Booking ID is required"],
			index: true,
		},
		customer_id: {
			type: Schema.Types.ObjectId,
			ref: "Customer",
			required: [true, "Customer ID is required"],
			index: true,
		},

		amount: {
			type: Number,
			required: [true, "Transaction amount is required"],
			min: [0.01, "Amount must be greater than 0"],
		},
		transaction_type: {
			type: String,
			enum: {
				values: Object.values(TransactionTypeEnum),
				message: "{VALUE} is not a valid transaction type",
			},
			required: [true, "Transaction type is required"],
		},
		payment_method: {
			type: String,
			enum: {
				values: Object.values(PaymentMethodEnum),
				message: "{VALUE} is not a valid payment method",
			},
			required: [true, "Payment method is required"],
		},
		status: {
			type: String,
			enum: {
				values: Object.values(TransactionStatusEnum),
				message: "{VALUE} is not a valid transaction status",
			},
			default: "Pending",
		},

		payment_proof_images: {
			type: [String],
			default: [],
			validate: {
				validator: function (images: string[]) {
					return images.length <= 5;
				},
				message:
					"Cannot upload more than 5 payment proof images per transaction",
			},
		},

		external_reference: {
			type: String,
			trim: true,
			maxlength: [100, "External reference cannot exceed 100 characters"],
			default: null,
		},

		transaction_date: {
			type: Date,
			required: [true, "Transaction date is required"],
			default: Date.now,
		},

		
		processed_at: {
			type: Date,
			default: null,
		},
		failed_at: {
			type: Date,
			default: null,
		},
		refunded_at: {
			type: Date,
			default: null,
		},

		notes: {
			type: String,
			trim: true,
			maxlength: [500, "Notes cannot exceed 500 characters"],
			default: null,
		},
		failure_reason: {
			type: String,
			trim: true,
			maxlength: [200, "Failure reason cannot exceed 200 characters"],
			default: null,
		},
		refund_reason: {
			type: String,
			trim: true,
			maxlength: [200, "Refund reason cannot exceed 200 characters"],
			default: null,
		},

		refund_transaction_id: {
			type: Schema.Types.ObjectId,
			ref: "Transaction",
			default: null,
		},
		original_transaction_id: {
			type: Schema.Types.ObjectId,
			ref: "Transaction",
			default: null,
		},

		// Metadata
		is_active: { type: Boolean, default: true },
		created_by: { type: Types.ObjectId, ref: "User", required: true },
		updated_by: { type: Types.ObjectId, ref: "User", default: null },
		deleted_by: { type: Types.ObjectId, ref: "User", default: null },
		retrieved_by: { type: Types.ObjectId, ref: "User", default: null },
		deleted_at: { type: Date, default: null },
		retrieved_at: { type: Date, default: null },
	},
	{
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	}
);

// Auto-generate transaction reference
transactionSchema.pre("validate", function (next) {
	if (this.isNew && !this.transaction_reference) {
		const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
		this.transaction_reference = `TXN-${randomStr}`;
	}
	next();
});

// Pre-save validation and business logic
transactionSchema.pre("save", async function (next) {
	try {
		// Verify booking exists
		if (this.isNew) {
			const BookingModel = mongoose.model("Booking");
			const booking = await BookingModel.findById(this.booking_id);

			if (!booking) {
				return next(customError(404, "Booking not found"));
			}

			// Verify customer matches booking
			if (booking.customer_id.toString() !== this.customer_id.toString()) {
				return next(
					customError(400, "Customer ID does not match booking customer")
				);
			}

			// Check if payment exceeds remaining balance (only for Payment types)
			if (
				this.transaction_type === "Payment" ||
				this.transaction_type === "Partial" ||
				this.transaction_type === "Balance"
			) {
				const completedTransactions = await Transaction.find({
					booking_id: this.booking_id,
					status: "Completed",
					transaction_type: {
						$in: ["Payment", "Partial", "Balance"],
					},
				});

				const totalPaid = completedTransactions.reduce(
					(sum, txn) => sum + txn.amount,
					0
				);

				const remainingBalance = booking.final_amount - totalPaid;

				if (this.amount > remainingBalance) {
					return next(
						customError(
							400,
							`Payment amount (${this.amount}) exceeds remaining balance (${remainingBalance})`
						)
					);
				}
			}
		}

		// Validate refund logic
		if (this.transaction_type === "Refund") {
			if (!this.original_transaction_id) {
				return next(
					customError(400, "Refund must reference an original transaction")
				);
			}

			const originalTransaction = await Transaction.findById(
				this.original_transaction_id
			);

			if (!originalTransaction) {
				return next(customError(404, "Original transaction not found"));
			}

			if (originalTransaction.status !== "Completed") {
				return next(customError(400, "Can only refund completed transactions"));
			}

			if (this.amount > originalTransaction.amount) {
				return next(
					customError(
						400,
						"Refund amount cannot exceed original transaction amount"
					)
				);
			}
		}

		// Auto-set timestamps based on status changes
		if (this.isModified("status")) {
			const now = new Date();

			switch (this.status) {
				case "Completed":
					if (!this.processed_at) this.processed_at = now;
					break;
				case "Failed":
					if (!this.failed_at) this.failed_at = now;
					break;
				case "Refunded":
					if (!this.refunded_at) this.refunded_at = now;
					break;
			}
		}

		// Validate payment proof for digital payments
		if (this.isNew && this.payment_proof_images.length === 0) {
			return next(customError(400, `Please upload proof of payment`));
		}

		next();
	} catch (error) {
		next(customError(500, "Failed to save transaction"));
	}
});

// Post-save hook to update original transaction if this is a refund
transactionSchema.post("save", async function (doc) {
	if (
		doc.transaction_type === "Refund" &&
		doc.status === "Completed" &&
		doc.original_transaction_id
	) {
		await Transaction.findByIdAndUpdate(doc.original_transaction_id, {
			refund_transaction_id: doc._id,
			status: "Refunded",
			refunded_at: new Date(),
		});
	}
});

// Instance method: Mark transaction as completed
transactionSchema.methods.markAsCompleted = async function (
	processedBy: Types.ObjectId
) {
	this.status = "Completed";
	this.processed_at = new Date();
	this.updated_by = processedBy;
	return await this.save();
};

// Instance method: Mark transaction as failed
transactionSchema.methods.markAsFailed = async function (
	reason: string,
	processedBy: Types.ObjectId
) {
	this.status = "Failed";
	this.failed_at = new Date();
	this.failure_reason = reason;
	this.updated_by = processedBy;
	return await this.save();
};

// Instance method: Create refund transaction
transactionSchema.methods.createRefund = async function (
	refundAmount: number,
	refundReason: string,
	processedBy: string,
	paymentProofImages: string[] = []
) {
	if (this.status !== "Completed") {
		throw customError(400, "Can only refund completed transactions");
	}

	if (refundAmount > this.amount) {
		throw customError(
			400,
			"Refund amount cannot exceed original transaction amount"
		);
	}

	// Require payment proof images for refund
	if (!paymentProofImages || paymentProofImages.length === 0) {
		throw customError(
			400,
			"Payment proof image is required for refund transactions"
		);
	}

	if (paymentProofImages.length > 3) {
		throw customError(
			400,
			"Cannot upload more than 3 payment proof images per transaction"
		);
	}

	const refundTransaction = new Transaction({
		booking_id: this.booking_id,
		customer_id: this.customer_id,
		amount: refundAmount,
		transaction_type: "Refund",
		payment_method: this.payment_method,
		status: "Completed",
		original_transaction_id: this._id,
		payment_proof_images: paymentProofImages, // ← Use provided images, not original
		refund_reason: refundReason,
		transaction_date: new Date(),
		processed_at: new Date(),
		created_by: processedBy,
	});

	await refundTransaction.save();
	return refundTransaction;
};

// Indexes for performance
transactionSchema.index({ booking_id: 1, status: 1 });
transactionSchema.index({ customer_id: 1, transaction_date: -1 });
transactionSchema.index({ transaction_reference: 1 });
transactionSchema.index({ status: 1, transaction_date: -1 });

// Export model
export const Transaction = mongoose.model<TransactionModel>(
	"Transaction",
	transactionSchema
);
