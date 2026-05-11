import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { createNotification } from "../utils/createNotification";

// Request types
export const BookingRequestTypeEnum = {
  Cancellation: "Cancellation",
  Reschedule: "Reschedule",
} as const;

export type BookingRequestType = keyof typeof BookingRequestTypeEnum;

// Request status
export const BookingRequestStatusEnum = {
  Pending: "Pending",
  Approved: "Approved",
  Rejected: "Rejected",
} as const;

export type BookingRequestStatus = keyof typeof BookingRequestStatusEnum;

// Model type
export type BookingRequestModel = Document &
  MetaData & {
    request_reference: string;
    booking_id: Types.ObjectId;
    customer_id: Types.ObjectId;
    request_type: BookingRequestType;
    status: BookingRequestStatus;

    // For cancellation requests
    cancellation_reason: string;

    // For reschedule requests
    new_booking_date?: Date | null;
    new_start_time?: string | null;
    new_end_time?: string | null;
    new_photographer_id?: Types.ObjectId | null;
    reschedule_reason: string;

    // Admin response
    reviewed_by?: Types.ObjectId | null;
    reviewed_at?: Date | null;
    admin_notes?: string | null;
    rejection_reason?: string | null;
  };

// Schema
const bookingRequestSchema = new Schema<BookingRequestModel>(
  {
    request_reference: {
      type: String,
      required: [true, "Request reference is required"],
      unique: true,
      uppercase: true,
      match: [/^REQ-[A-Z0-9]{8}$/, "Invalid request reference format"],
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
      enum: {
        values: Object.values(BookingRequestTypeEnum),
        message: "{VALUE} is not a valid request type",
      },
      required: [true, "Request type is required"],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(BookingRequestStatusEnum),
        message: "{VALUE} is not a valid request status",
      },
      default: "Pending",
    },

    // Cancellation fields
    cancellation_reason: {
      type: String,
      trim: true,
      minlength: [5, "Cancellation reason must be at least 5 characters"],
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
      default: null,
    },

    // Reschedule fields
    new_booking_date: {
      type: Date,
      default: null,
    },
    new_start_time: {
      type: String,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)",
      ],
      default: null,
    },
    new_end_time: {
      type: String,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)",
      ],
      default: null,
    },
    new_photographer_id: {
      type: Schema.Types.ObjectId,
      ref: "Photographer",
      default: null,
    },
    reschedule_reason: {
      type: String,
      trim: true,
      minlength: [5, "Reschedule reason must be at least 5 characters"],
      maxlength: [500, "Reschedule reason cannot exceed 500 characters"],
      default: null,
    },

    // Admin response
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
bookingRequestSchema.pre("validate", function (next) {
  if (this.isNew && !this.request_reference) {
    const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
    this.request_reference = `REQ-${randomStr}`;
  }
  next();
});

// Validation: Ensure correct fields based on request type
bookingRequestSchema.pre("save", function (next) {
  if (this.request_type === "Cancellation") {
    if (!this.cancellation_reason) {
      return next(new Error("Cancellation reason is required"));
    }
  }

  if (this.request_type === "Reschedule") {
    if (!this.new_booking_date || !this.new_start_time) {
      return next(
        new Error(
          "New booking date and start time are required for reschedule",
        ),
      );
    }
    if (!this.reschedule_reason) {
      return next(new Error("Reschedule reason is required"));
    }
  }

  next();
});

// For notif
bookingRequestSchema.post("save", async function (doc) {
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

  const typeLabel =
    doc.request_type === "Cancellation" ? "cancellation" : "reschedule";

  switch (doc.status) {
    case "Pending":
      await createNotification({
        ...base,
        type: "BOOKING_REQUEST_CREATED",
        title: `${doc.request_type} Request Received`,
        message: `${customerNo} requested a ${typeLabel} for appointment ${bookingRef}. Request Ref: ${doc.request_reference}.`,
      });
      break;
    case "Approved":
      await createNotification({
        ...base,
        type: "BOOKING_REQUEST_APPROVED",
        title: `${doc.request_type} Request Approved`,
        message: `${customerNo}'s ${typeLabel} request for appointment ${bookingRef} is now approved. Request Ref: ${doc.request_reference}.`,
      });
      break;
    case "Rejected":
      await createNotification({
        ...base,
        type: "BOOKING_REQUEST_REJECTED",
        title: `${doc.request_type} Request Rejected`,
        message: `${customerNo}'s ${typeLabel} request for appointment ${bookingRef} was rejected. Request Ref: ${doc.request_reference}. Reason: ${doc.rejection_reason ?? "N/A"}.`,
      });
      break;
  }
});

// Export model
export const BookingRequest = mongoose.model<BookingRequestModel>(
  "BookingRequest",
  bookingRequestSchema,
  "booking_requests",
);
