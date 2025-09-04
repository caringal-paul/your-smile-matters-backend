import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";

export type PackageModel = Document &
	MetaData & {
		name: string;
		description?: string | null;
		price: number;
		looks: number;
		included_services: Types.ObjectId[];
		is_available: boolean;
	};

const packageSchema = new Schema<PackageModel>(
	{
		name: {
			type: String,
			required: [true, "Package name is required"],
			unique: true,
			minlength: [3, "Package name must be at least 3 characters"],
			maxlength: [100, "Package name cannot exceed 100 characters"],
			trim: true,
		},
		description: {
			type: String,
			trim: true,
			maxlength: [500, "Description cannot exceed 500 characters"],
			default: null,
		},
		price: {
			type: Number,
			required: [true, "Package price is required"],
			min: [0, "Price cannot be negative"],
			validate: {
				validator: function (value: number) {
					return value > 0;
				},
				message: "Price must be greater than 0",
			},
		},
		looks: {
			type: Number,
			required: [true, "Number of looks is required"],
			min: [1, "Must have at least 1 look"],
			max: [10, "Cannot exceed 10 looks"],
			default: 1,
		},
		included_services: [
			{
				type: Schema.Types.ObjectId,
				ref: "Service",
				required: true,
				validate: {
					validator: async function (service_id: Types.ObjectId) {
						const ServiceModel = mongoose.model("Service");
						const service = await ServiceModel.findById(service_id);
						return !!service;
					},
					message: "Referenced service does not exist",
				},
			},
		],
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

// Validation: Package must have at least one service
packageSchema.pre("save", function (next) {
	if (!this.included_services || this.included_services.length === 0) {
		next(new Error("Package must include at least one service"));
	} else {
		next();
	}
});

// Indexes for better performance
packageSchema.index({ name: 1 });
packageSchema.index({ price: 1 });
packageSchema.index({ is_available: 1, is_active: 1 });
packageSchema.index({ included_services: 1 });

export const Package = mongoose.model<PackageModel>("Package", packageSchema);
