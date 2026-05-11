import mongoose, { Schema, Document, Types } from "mongoose";

export const NotificationTypeEnum = {
  // Booking events
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_COMPLETED: "BOOKING_COMPLETED",
  BOOKING_RESCHEDULED: "BOOKING_RESCHEDULED",
  // Request events
  BOOKING_REQUEST_CREATED: "BOOKING_REQUEST_CREATED",
  BOOKING_REQUEST_APPROVED: "BOOKING_REQUEST_APPROVED",
  BOOKING_REQUEST_REJECTED: "BOOKING_REQUEST_REJECTED",
  // Transaction events
  TRANSACTION_CREATED: "TRANSACTION_CREATED",
  TRANSACTION_COMPLETED: "TRANSACTION_COMPLETED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  TRANSACTION_REFUND_REQUESTED: "TRANSACTION_REFUND_REQUESTED",
  TRANSACTION_REFUND_APPROVED: "TRANSACTION_REFUND_APPROVED",
  TRANSACTION_REFUND_REJECTED: "TRANSACTION_REFUND_REJECTED",
} as const;

export type NotificationType = keyof typeof NotificationTypeEnum;

export type NotificationModel = Document & {
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  // Flexible refs — only populate what's relevant
  booking_id?: Types.ObjectId | null;
  transaction_id?: Types.ObjectId | null;
  customer_id?: Types.ObjectId | null;
  request_id?: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
};

const notificationSchema = new Schema<NotificationModel>(
  {
    type: {
      type: String,
      enum: Object.values(NotificationTypeEnum),
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    is_read: { type: Boolean, default: false },
    booking_id: { type: Types.ObjectId, ref: "Booking", default: null },
    transaction_id: { type: Types.ObjectId, ref: "Transaction", default: null },
    customer_id: { type: Types.ObjectId, ref: "Customer", default: null },
    request_id: { type: Types.ObjectId, default: null }, // covers both BookingRequest & TransactionRequest
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

notificationSchema.index({ is_read: 1, created_at: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ booking_id: 1 });

export const Notification = mongoose.model<NotificationModel>(
  "Notification",
  notificationSchema,
);
