import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";

// Enum for what can be rated
export enum RatableType {
	SERVICE = "Service",
	PACKAGE = "Package",
	PHOTOGRAPHER = "Photographer",
}

export type RatingModel = Document &
	MetaData & {
		booking_id: Types.ObjectId;
		customer_id: Types.ObjectId;

		// Polymorphic relationship
		ratable_type: RatableType;
		ratable_id: Types.ObjectId;

		// Rating data
		rating: number; // 1-5 stars
		comment?: string | null;

		// Optional: Admin/Business response
		response?: string | null;
		responded_at?: Date | null;
		responded_by?: Types.ObjectId | null;
	};

const ratingSchema = new Schema<RatingModel>(
	{
		booking_id: {
			type: Schema.Types.ObjectId,
			ref: "Booking",
			required: [true, "Booking reference is required"],
		},
		customer_id: {
			type: Schema.Types.ObjectId,
			ref: "Customer",
			required: [true, "Customer reference is required"],
		},

		// Polymorphic fields
		ratable_type: {
			type: String,
			required: [true, "Ratable type is required"],
			enum: Object.values(RatableType),
		},
		ratable_id: {
			type: Schema.Types.ObjectId,
			required: [true, "Ratable ID is required"],
			refPath: "ratable_type", // Dynamic reference based on ratable_type
		},

		// Rating fields
		rating: {
			type: Number,
			required: [true, "Rating is required"],
			min: [1, "Rating must be at least 1"],
			max: [5, "Rating cannot exceed 5"],
		},
		comment: {
			type: String,
			trim: true,
			maxlength: [1000, "Comment cannot exceed 1000 characters"],
			default: null,
		},

		// Business response
		response: {
			type: String,
			trim: true,
			maxlength: [500, "Response cannot exceed 500 characters"],
			default: null,
		},
		responded_at: {
			type: Date,
			default: null,
		},
		responded_by: {
			type: Types.ObjectId,
			ref: "User",
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

// Prevent duplicate ratings for same booking + ratable combination
ratingSchema.index(
	{ booking_id: 1, ratable_type: 1, ratable_id: 1 },
	{ unique: true }
);

// Query performance indexes
ratingSchema.index({ ratable_type: 1, ratable_id: 1 }); // Get all ratings for a service/package
ratingSchema.index({ customer_id: 1 }); // Get customer's rating history
ratingSchema.index({ booking_id: 1 }); // Get all ratings for a booking
ratingSchema.index({ rating: 1 }); // Filter by rating score

export const Rating = mongoose.model<RatingModel>("Rating", ratingSchema);
