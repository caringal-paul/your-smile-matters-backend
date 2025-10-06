import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import {
	ServiceCategory,
	ServiceCategoryEnum,
} from "../constants/service-category.constant";

export type ServiceModel = Document &
	MetaData & {
		name: string;
		description?: string | null;
		category: ServiceCategory;
		price: number; // base price (used in bookings & packages)
		old_price?: number;
		duration_minutes?: number | null; // optional: default or expected duration
		is_available: boolean;
		service_gallery: string[]; // new: must contain 1–4 images
	};

const serviceSchema = new Schema<ServiceModel>(
	{
		name: {
			type: String,
			required: [true, "Service name is required"],
			unique: true,
			minlength: [2, "Service name must be at least 2 characters"],
			maxlength: [50, "Service name cannot exceed 50 characters"],
			trim: true,
		},
		description: {
			type: String,
			trim: true,
			maxlength: [1000, "Description cannot exceed 200 characters"],
			default: null,
		},
		category: {
			type: String,
			required: [true, "Category is required"],
			enum: Object.values(ServiceCategoryEnum),
		},
		price: {
			type: Number,
			required: [true, "Service price is required"],
			min: [0, "Price cannot be negative"],
		},
		old_price: {
			type: Number,
			default: 0,
		},
		duration_minutes: {
			type: Number,
			min: [30, "Duration must be at least 15 minutes"],
			max: [24 * 60, "Duration cannot exceed 24 hours"],
			default: 0,
		},
		is_available: {
			type: Boolean,
			default: true,
		},
		service_gallery: {
			type: [String],
			validate: {
				validator: function (images: string[]) {
					return images.length >= 1 && images.length <= 4;
				},
				message: "Service gallery must have between 1 and 4 images.",
			},
			required: true,
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

// Indexes for better performance
serviceSchema.index({ name: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ is_available: 1, is_active: 1 });
serviceSchema.index({ price: 1 });

export const Service = mongoose.model<ServiceModel>("Service", serviceSchema);
