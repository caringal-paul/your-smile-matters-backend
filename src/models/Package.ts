import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { Service } from "./Service";
import { Photographer } from "./Photographer";
import { ServiceCategory } from "../constants/service-category.constant";

// Service reference matching Booking structure exactly
export interface IncludedService {
	service_id: Types.ObjectId;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	duration_minutes?: number | null;
}

// Type for Package instance methods
export interface PackageMethods {
	/**
	 * Compute total duration of package (sum of included services × qty)
	 * Falls back to custom_duration_minutes if set
	 * @returns Promise resolving to total duration in minutes
	 */
	getTotalDurationMinutes(): Promise<number>;

	/**
	 * Check if the entire package fits inside a photographer's availability
	 * @param photographerId - The ID of the photographer to check availability for
	 * @param targetDate - The date to check availability for
	 * @returns Promise resolving to true if package can fit in photographer's schedule
	 * @throws Error if photographer is not found
	 */
	canFitInPhotographerSchedule(
		photographerId: string,
		targetDate: Date
	): Promise<boolean>;
}

export type PackageModel = Document &
	MetaData &
	PackageMethods & {
		name: string;
		description?: string | null;
		image?: string | null;

		// Pricing
		package_price: number;
		// discount_percentage?: number | null;
		// discount_amount?: number | null;
		// final_price?: number;

		// Services matching Booking structure
		services: IncludedService[];

		// Additional fields
		looks: number;
		is_available: boolean;

		// Optional override
		custom_duration_minutes?: number | null;
	};

const packageSchema = new Schema<PackageModel>(
	{
		name: {
			type: String,
			required: [true, "Package name is required"],
			unique: true,
			trim: true,
			minlength: [2, "Package name must be at least 2 characters"],
			maxlength: [100, "Package name cannot exceed 100 characters"],
		},
		description: {
			type: String,
			maxlength: 500,
			default: null,
		},
		image: {
			type: String,
			default: null,
		},

		// Pricing
		package_price: { type: Number, required: true, min: 0 },

		// Services matching Booking structure
		services: [
			{
				service_id: {
					type: Types.ObjectId,
					ref: "Service",
					required: true,
				},
				quantity: {
					type: Number,
					required: true,
					min: 1,
					default: 1,
				},
				price_per_unit: {
					type: Number,
					required: true,
					min: 0,
				},
				total_price: {
					type: Number,
					required: true,
					min: 0,
				},
				duration_minutes: {
					type: Number,
					min: 0,
					default: 0,
				},
			},
		],

		// Additional fields
		looks: {
			type: Number,
			required: [true, "Number of looks is required"],
			min: [1, "Must have at least 1 look"],
			max: [10, "Cannot exceed 10 looks"],
			default: 1,
		},

		is_available: {
			type: Boolean,
			default: true,
		},

		// Optional override for total session duration
		custom_duration_minutes: {
			type: Number,
			min: 0,
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

// Ensure package has at least one service
packageSchema.pre("save", function (next) {
	if (!this.services || this.services.length === 0) {
		return next(new Error("Package must include at least one service"));
	}
	next();
});

/**
 * Compute total duration of package (sum of included services × qty)
 * Falls back to custom_duration_minutes if set
 */
packageSchema.methods.getTotalDurationMinutes =
	async function (): Promise<number> {
		if (this.custom_duration_minutes) return this.custom_duration_minutes;

		let total = 0;
		for (const item of this.services) {
			if (item.duration_minutes) {
				total += item.duration_minutes * item.quantity;
			} else {
				// Fetch duration from Service if not stored
				const service = await Service.findById(item.service_id).lean<{
					duration_minutes?: number;
				}>();
				if (service?.duration_minutes) {
					total += service.duration_minutes * item.quantity;
				}
			}
		}
		return total;
	};

/**
 * Check if the entire package fits inside a photographer's availability
 */
packageSchema.methods.canFitInPhotographerSchedule = async function (
	photographerId: string,
	targetDate: Date
): Promise<boolean> {
	const photographer = await Photographer.findById(photographerId);
	if (!photographer) throw new Error("Photographer not found");

	const totalDuration = await this.getTotalDurationMinutes();

	const availableSlots = await photographer.getAvailableSlots(
		targetDate,
		totalDuration
	);

	return availableSlots.length > 0;
};

// Indexes
packageSchema.index({ name: 1 });
packageSchema.index({ package_price: 1 });
packageSchema.index({ is_available: 1, is_active: 1 });
packageSchema.index({ "services.service_id": 1 });
packageSchema.index({ created_by: 1 });

export const Package = mongoose.model<PackageModel>("Package", packageSchema);
