import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { HydratedDocument } from "mongoose";

// ===========================================
// PROMO MODEL
// ===========================================

// Promo type enum
export const PromoTypeEnum = {
	Early_Bird: "Early_Bird",
	Loyalty: "Loyalty",
	Seasonal: "Seasonal",
	Special: "Special",
} as const;

// Discount type enum
export const DiscountTypeEnum = {
	Percentage: "Percentage",
	Fixed_Amount: "Fixed_Amount",
} as const;

export type PromoType = keyof typeof PromoTypeEnum;
export type DiscountType = keyof typeof DiscountTypeEnum;

// Document &
export type PromoModel = MetaData & {
	promo_code: string;
	name: string;
	description?: string | null;
	promo_type: PromoType;
	discount_type: DiscountType;
	discount_value: number;
	min_advance_days?: number | null;
	min_booking_amount?: number | null;
	max_discount_amount?: number | null;
	valid_from: Date;
	valid_until: Date;
	usage_limit?: number | null;
	usage_count: number;
	is_active: boolean;
	conditions?: string | null;
};

const promoSchema = new Schema<PromoModel>(
	{
		promo_code: {
			type: String,
			required: [true, "Promo code is required"],
			unique: true,
			uppercase: true,
			minlength: [3, "Promo code must be at least 3 characters"],
			maxlength: [20, "Promo code cannot exceed 20 characters"],
			match: [
				/^[A-Z0-9_]+$/,
				"Promo code can only contain letters, numbers, and underscores",
			],
		},
		name: {
			type: String,
			required: [true, "Promo name is required"],
			minlength: [3, "Promo name must be at least 3 characters"],
			maxlength: [100, "Promo name cannot exceed 100 characters"],
			trim: true,
		},
		description: {
			type: String,
			trim: true,
			maxlength: [500, "Description cannot exceed 500 characters"],
			default: null,
		},
		promo_type: {
			type: String,
			enum: {
				values: Object.values(PromoTypeEnum),
				message: "{VALUE} is not a valid promo type",
			},
			required: [true, "Promo type is required"],
		},
		discount_type: {
			type: String,
			enum: {
				values: Object.values(DiscountTypeEnum),
				message: "{VALUE} is not a valid discount type",
			},
			required: [true, "Discount type is required"],
		},
		discount_value: {
			type: Number,
			required: [true, "Discount value is required"],
			min: [0, "Discount value cannot be negative"],
			validate: [
				{
					validator: function (value: number) {
						if (this.discount_type === "Percentage") {
							return value > 0 && value <= 100;
						}
						return value > 0;
					},
					message: "Invalid discount value for the discount type",
				},
			],
		},
		min_advance_days: {
			type: Number,
			min: [0, "Minimum advance days cannot be negative"],
			default: null,
		},
		min_booking_amount: {
			type: Number,
			min: [0, "Minimum booking amount cannot be negative"],
			default: null,
		},
		max_discount_amount: {
			type: Number,
			min: [0, "Maximum discount amount cannot be negative"],
			default: null,
		},
		valid_from: {
			type: Date,
			required: [true, "Valid from date is required"],
		},
		valid_until: {
			type: Date,
			required: [true, "Valid until date is required"],
			validate: {
				validator: function (date: Date) {
					return date > this.valid_from;
				},
				message: "Valid until date must be after valid from date",
			},
		},
		usage_limit: {
			type: Number,
			min: [1, "Usage limit must be at least 1"],
			default: null,
		},
		usage_count: {
			type: Number,
			default: 0,
			min: [0, "Usage count cannot be negative"],
		},
		is_active: {
			type: Boolean,
			default: true,
		},
		conditions: {
			type: String,
			trim: true,
			maxlength: [1000, "Conditions cannot exceed 1000 characters"],
			default: null,
		},

		// Metadata / audit fields (using standard is_active for both business and metadata)
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

// Validate promo usage before save
promoSchema.pre("save", function (next) {
	if (this.usage_limit && this.usage_count > this.usage_limit) {
		next(new Error("Usage count cannot exceed usage limit"));
	} else {
		next();
	}
});

promoSchema.index({ promo_code: 1 });
promoSchema.index({ promo_type: 1 });
promoSchema.index({ valid_from: 1, valid_until: 1 });
promoSchema.index({ is_active: 1 });

export const Promo = mongoose.model<PromoModel>("Promo", promoSchema);

export type PromoDocument = HydratedDocument<PromoModel>;
