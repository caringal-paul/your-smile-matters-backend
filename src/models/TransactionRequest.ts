import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { createNotification } from "../utils/createNotification";

export const TransactionRequestTypeEnum = {
  Refund: "Refund",
} as const;

export type TransactionRequestType = keyof typeof TransactionRequestTypeEnum;

export const TransactionRequestStatusEnum = {
  Pending: "Pending",
  Approved: "Approved",
  Rejected: "Rejected",
} as const;

export type TransactionRequestStatus =
  keyof typeof TransactionRequestStatusEnum;

export type TransactionRequestModel = Document &
  MetaData & {
    request_reference: string;
    transaction_id: Types.ObjectId;
    booking_id: Types.ObjectId;
    customer_id: Types.ObjectId;

    request_type: TransactionRequestType;
    status: TransactionRequestStatus;

    refund_amount: number;
    refund_reason: string;

    // Optional admin response fields
    reviewed_by?: Types.ObjectId | null;
    reviewed_at?: Date | null;
    admin_notes?: string | null;
    rejection_reason?: string | null;
  };

const transactionRequestSchema = new Schema<TransactionRequestModel>(
  {
    request_reference: {
      type: String,
      required: [true, "Request reference is required"],
      unique: true,
      uppercase: true,
      match: [/^TRQ-[A-Z0-9]{8}$/, "Invalid request reference format"],
    },

    transaction_id: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: [true, "Transaction ID is required"],
    },

    booking_id: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking ID is required"],
    },

    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer ID is required"],
    },

    request_type: {
      type: String,
      enum: Object.values(TransactionRequestTypeEnum),
      required: [true, "Request type is required"],
      default: "Refund",
    },

    status: {
      type: String,
      enum: Object.values(TransactionRequestStatusEnum),
      default: "Pending",
    },

    refund_amount: {
      type: Number,
      required: [true, "Refund amount is required"],
      min: [0.01, "Refund amount must be greater than 0"],
    },

    refund_reason: {
      type: String,
      required: [true, "Refund reason is required"],
      trim: true,
      minlength: [5, "Refund reason must be at least 5 characters"],
      maxlength: [500, "Refund reason cannot exceed 500 characters"],
    },

    reviewed_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    admin_notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Admin notes cannot exceed 1000 characters"],
      default: null,
    },
    rejection_reason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
      default: null,
    },

    // Metadata
    is_active: { type: Boolean, default: true },
    created_by: { type: Types.ObjectId, ref: "Customer", required: true },
    updated_by: { type: Types.ObjectId, ref: "User", default: null },
    deleted_by: { type: Types.ObjectId, ref: "User", default: null },
    retrieved_by: { type: Types.ObjectId, ref: "User", default: null },
    deleted_at: { type: Date, default: null },
    retrieved_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Auto-generate request reference
transactionRequestSchema.pre("validate", function (next) {
  if (this.isNew && !this.request_reference) {
    const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
    this.request_reference = `TRQ-${randomStr}`;
  }
  next();
});

// Validation: Ensure refund amount does not exceed original transaction
transactionRequestSchema.pre("save", async function (next) {
  try {
    const Transaction = mongoose.model("Transaction");
    const txn = await Transaction.findById(this.transaction_id);

    if (!txn) {
      return next(new Error("Original transaction not found"));
    }

    if (this.refund_amount > txn.amount) {
      return next(
        new Error(
          `Refund amount (${this.refund_amount}) exceeds original transaction amount (${txn.amount})`,
        ),
      );
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Fort notif
transactionRequestSchema.post("save", async function (doc) {
  const Customer = mongoose.model("Customer");
  const customer = await Customer.findById(doc.customer_id)
    .select("customer_no")
    .lean<{ customer_no: string }>();
  const customerNo = customer?.customer_no ?? "Unknown Customer";

  const BookingModel = mongoose.model("Booking");
  const booking = await BookingModel.findById(doc.booking_id)
    .select("booking_reference")
    .lean<{ booking_reference: string }>();
  const bookingRef = booking?.booking_reference ?? "N/A";

  const base = {
    booking_id: doc.booking_id,
    customer_id: doc.customer_id,
    request_id: doc._id as Types.ObjectId,
  };

  switch (doc.status) {
    case "Pending":
      await createNotification({
        ...base,
        type: "TRANSACTION_REFUND_REQUESTED",
        title: "Refund Request Received",
        message: `${customerNo} requested a refund of ₱${doc.refund_amount.toLocaleString()} for appointment ${bookingRef}. Request Ref: ${doc.request_reference}.`,
      });
      break;
    case "Approved":
      await createNotification({
        ...base,
        type: "TRANSACTION_REFUND_APPROVED",
        title: "Refund Request Approved",
        message: `${customerNo}'s refund of ₱${doc.refund_amount.toLocaleString()} for appointment ${bookingRef} is now approved. Request Ref: ${doc.request_reference}.`,
      });
      break;
    case "Rejected":
      await createNotification({
        ...base,
        type: "TRANSACTION_REFUND_REJECTED",
        title: "Refund Request Rejected",
        message: `${customerNo}'s refund request for appointment ${bookingRef} was rejected. Request Ref: ${doc.request_reference}. Reason: ${doc.rejection_reason ?? "N/A"}.`,
      });
      break;
  }
});

// Export model
export const TransactionRequest = mongoose.model<TransactionRequestModel>(
  "TransactionRequest",
  transactionRequestSchema,
  "transaction_requests",
);
