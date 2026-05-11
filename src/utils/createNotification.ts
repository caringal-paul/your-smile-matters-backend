import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification";

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  booking_id?: Types.ObjectId | null;
  transaction_id?: Types.ObjectId | null;
  customer_id?: Types.ObjectId | null;
  request_id?: Types.ObjectId | null;
}

export const createNotification = async (
  params: CreateNotificationParams,
): Promise<void> => {
  try {
    await Notification.create(params);
  } catch (err) {
    // Never let a notification failure crash the main operation
    console.error("[Notification] Failed to create notification:", err);
  }
};
