import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";

// Transaction status enum
export const TransactionStatusEnum = {
	Pending: "Pending",
	Completed: "Completed",
	Failed: "Failed",
	Refunded: "Refunded",
	Cancelled: "Cancelled",
} as const;

// Payment method enum
export const PaymentMethodEnum = {
	Cash: "Cash",
	GCash: "GCash",
} as const;

// Transaction type enum
export const TransactionTypeEnum = {
	Down_Payment: "Down_Payment",
	Full_Payment: "Full_Payment",
	Balance_Payment: "Balance_Payment",
	Refund: "Refund",
} as const;

// Verification status enum
export const VerificationStatusEnum = {
	Pending: "Pending",
	Verified: "Verified",
	Rejected: "Rejected",
} as const;

export type TransactionStatus = keyof typeof TransactionStatusEnum;
export type PaymentMethod = keyof typeof PaymentMethodEnum;
export type TransactionType = keyof typeof TransactionTypeEnum;
export type VerificationStatus = keyof typeof VerificationStatusEnum;

export type TransactionModel = Document &
	MetaData & {
		transaction_reference: string;
		booking_id: Types.ObjectId;
		amount: number;
		transaction_type: TransactionType;
		payment_method: PaymentMethod;
		status: TransactionStatus;
		payment_date?: Date | null;
		reference_number?: string | null;
		receipt_image?: string | null;
		verification_status?: VerificationStatus | null;
		verified_by?: Types.ObjectId | null;
		verification_date?: Date | null;
		rejection_reason?: string | null;
		notes?: string | null;
		processed_by: Types.ObjectId;
	};

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
			validate: {
				validator: async function (booking_id: Types.ObjectId) {
					const BookingModel = mongoose.model("Booking");
					const booking = await BookingModel.findById(booking_id);
					return !!booking;
				},
				message: "Booking does not exist",
			},
		},
		amount: {
			type: Number,
			required: [true, "Transaction amount is required"],
			min: [0, "Amount cannot be negative"],
			validate: {
				validator: function (value: number) {
					return value > 0;
				},
				message: "Amount must be greater than 0",
			},
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
		payment_date: {
			type: Date,
			default: null,
		},
		reference_number: {
			type: String,
			trim: true,
			maxlength: [50, "Reference number cannot exceed 50 characters"],
			default: null,
			validate: {
				validator: function (value: string) {
					// Require reference number for GCash payments
					if (this.payment_method === "GCash" && !value) {
						return false;
					}
					return true;
				},
				message: "Reference number is required for GCash payments",
			},
		},
		receipt_image: {
			type: String,
			trim: true,
			default: null,
			validate: {
				validator: function (value: string) {
					// Require receipt image for GCash payments
					if (this.payment_method === "GCash" && !value) {
						return false;
					}
					return true;
				},
				message: "Receipt image is required for GCash payments",
			},
		},
		verification_status: {
			type: String,
			enum: {
				values: Object.values(VerificationStatusEnum),
				message: "{VALUE} is not a valid verification status",
			},
			default: function (this: { payment_method?: string }) {
				return this.payment_method === "GCash" ? "Pending" : null;
			},
		},
		verified_by: {
			type: Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		verification_date: {
			type: Date,
			default: null,
		},
		rejection_reason: {
			type: String,
			trim: true,
			maxlength: [200, "Rejection reason cannot exceed 200 characters"],
			default: null,
		},
		notes: {
			type: String,
			trim: true,
			maxlength: [500, "Notes cannot exceed 500 characters"],
			default: null,
		},
		processed_by: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "Processed by user is required"],
		},

		// Metadata / audit fields
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

// Pre-save middleware
transactionSchema.pre("save", function (next) {
	// Generate transaction reference
	if (this.isNew && !this.transaction_reference) {
		const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
		this.transaction_reference = `TXN-${randomStr}`;
	}

	// Auto-complete Cash payments
	if (this.payment_method === "Cash" && this.status === "Pending") {
		this.status = "Completed";
		this.payment_date = new Date();
		this.verification_status = null; // Cash doesn't need verification
	}

	// Handle GCash verification workflow
	if (this.payment_method === "GCash") {
		// Set verification status to Pending if not set
		if (!this.verification_status) {
			this.verification_status = "Pending";
		}

		// Auto-complete when verified
		if (this.verification_status === "Verified" && this.status === "Pending") {
			this.status = "Completed";
			if (!this.payment_date) {
				this.payment_date = new Date();
			}
		}

		// Auto-fail when rejected
		if (this.verification_status === "Rejected") {
			this.status = "Failed";
		}
	}

	// Set verification date when status changes
	if (this.verification_status === "Verified" && !this.verification_date) {
		this.verification_date = new Date();
	}

	next();
});

// Indexes for better performance
transactionSchema.index({ transaction_reference: 1 });
transactionSchema.index({ booking_id: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ payment_date: 1 });
transactionSchema.index({ transaction_type: 1 });
transactionSchema.index({ payment_method: 1 });
transactionSchema.index({ verification_status: 1 });
transactionSchema.index({ reference_number: 1 });

export const Transaction = mongoose.model<TransactionModel>(
	"Transaction",
	transactionSchema
);
