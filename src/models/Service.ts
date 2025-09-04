import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";

export type ServiceModel = Document &
	MetaData & {
		name: string;
		description?: string | null;
		category: string;
		is_available: boolean;
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
			maxlength: [200, "Description cannot exceed 200 characters"],
			default: null,
		},
		category: {
			type: String,
			required: [true, "Category is required"],
			enum: {
				values: ["Photography", "Beauty", "Styling", "Equipment", "Other"],
				message: "{VALUE} is not a valid category",
			},
		},
		is_available: {
			type: Boolean,
			default: true,
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

export const Service = mongoose.model<ServiceModel>("Service", serviceSchema);
