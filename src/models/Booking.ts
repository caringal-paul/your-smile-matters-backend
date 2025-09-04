import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";

// Booking status enum
export const BookingStatusEnum = {
	Pending: "Pending",
	Confirmed: "Confirmed",
	Ongoing: "Ongoing",
	Completed: "Completed",
	Cancelled: "Cancelled",
	Rescheduled: "Rescheduled",
} as const;

export type BookingStatus = keyof typeof BookingStatusEnum;

export type BookingModel = Document &
	MetaData & {
		booking_reference: string;
		customer_id: Types.ObjectId;
		package_id: Types.ObjectId;
		promo_id?: Types.ObjectId | null;
		booking_date: Date;
		start_time: string;
		end_time?: string | null;
		location: string;
		theme?: string | null;
		special_requests?: string | null;
		status: BookingStatus;
		total_amount: number;
		discount_amount: number;
		final_amount: number;
		booking_confirmed_at?: Date | null;
		booking_completed_at?: Date | null;
		cancelled_reason?: string | null;
		rescheduled_from?: Date | null;
	};

const bookingSchema = new Schema<BookingModel>(
	{
		booking_reference: {
			type: String,
			required: [true, "Booking reference is required"],
			unique: true,
			uppercase: true,
			match: [/^BK-[A-Z0-9]{8}$/, "Invalid booking reference format"],
		},
		customer_id: {
			type: Schema.Types.ObjectId,
			ref: "Customer",
			required: [true, "Customer ID is required"],
			validate: {
				validator: async function (customer_id: Types.ObjectId) {
					const CustomerModel = mongoose.model("Customer");
					const customer = await CustomerModel.findById(customer_id);
					return !!customer;
				},
				message: "Customer does not exist",
			},
		},
		package_id: {
			type: Schema.Types.ObjectId,
			ref: "Package",
			required: [true, "Package ID is required"],
			validate: {
				validator: async function (package_id: Types.ObjectId) {
					const PackageModel = mongoose.model("Package");
					const selectedPackage = await PackageModel.findById(package_id);
					return !!selectedPackage;
				},
				message: "Package does not exist",
			},
		},
		promo_id: {
			type: Schema.Types.ObjectId,
			ref: "Promo",
			default: null,
			validate: {
				validator: async function (promo_id: Types.ObjectId) {
					if (!promo_id) return true; // null/undefined is valid
					const PromoModel = mongoose.model("Promo");
					const promo = await PromoModel.findById(promo_id);
					if (!promo) return false;

					const now = new Date();
					return (
						promo.is_active &&
						promo.valid_from <= now &&
						promo.valid_until >= now
					);
				},
				message: "Promo does not exist or is not currently active",
			},
		},
		booking_date: {
			type: Date,
			required: [true, "Booking date is required"],
			validate: {
				validator: function (date: Date) {
					return date > new Date();
				},
				message: "Booking date must be in the future",
			},
		},
		start_time: {
			type: String,
			required: [true, "Start time is required"],
			match: [
				/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
				"Invalid time format (HH:MM)",
			],
		},
		end_time: {
			type: String,
			default: null,
			match: [
				/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
				"Invalid time format (HH:MM)",
			],
		},
		location: {
			type: String,
			required: [true, "Location is required"],
			trim: true,
			minlength: [5, "Location must be at least 5 characters"],
			maxlength: [200, "Location cannot exceed 200 characters"],
		},
		theme: {
			type: String,
			trim: true,
			maxlength: [50, "Theme cannot exceed 50 characters"],
			default: null,
		},
		special_requests: {
			type: String,
			trim: true,
			maxlength: [500, "Special requests cannot exceed 500 characters"],
			default: null,
		},
		status: {
			type: String,
			enum: {
				values: Object.values(BookingStatusEnum),
				message: "{VALUE} is not a valid booking status",
			},
			default: "Pending",
		},
		total_amount: {
			type: Number,
			required: [true, "Total amount is required"],
			min: [0, "Total amount cannot be negative"],
		},
		discount_amount: {
			type: Number,
			min: [0, "Discount amount cannot be negative"],
			default: 0, // ✅ always default to 0
			required: true, // ✅ enforce it’s always a number
		},
		final_amount: {
			type: Number,
			required: [true, "Final amount is required"],
			min: [0, "Final amount cannot be negative"],
		},
		booking_confirmed_at: {
			type: Date,
			default: null,
		},
		booking_completed_at: {
			type: Date,
			default: null,
		},
		cancelled_reason: {
			type: String,
			trim: true,
			maxlength: [200, "Cancellation reason cannot exceed 200 characters"],
			default: null,
		},
		rescheduled_from: {
			type: Date,
			default: null,
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

// Pre-save middleware
bookingSchema.pre("save", async function (next) {
	// Generate booking reference
	if (this.isNew && !this.booking_reference) {
		const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
		this.booking_reference = `BK-${randomStr}`;
	}

	// Calculate discount from promo if applied
	if (this.promo_id && this.isModified("promo_id")) {
		try {
			const PromoModel = mongoose.model("Promo");
			const promo = await PromoModel.findById(this.promo_id);

			if (promo && promo.is_active) {
				// Validate promo conditions
				let isValid = true;

				// Check advance booking requirement for Early Bird
				if (promo.promo_type === "Early_Bird" && promo.min_advance_days) {
					const daysDiff = Math.floor(
						(this.booking_date.getTime() - new Date().getTime()) /
							(1000 * 60 * 60 * 24)
					);
					if (daysDiff < promo.min_advance_days) {
						isValid = false;
					}
				}

				// Check minimum booking amount
				if (
					promo.min_booking_amount &&
					this.total_amount < promo.min_booking_amount
				) {
					isValid = false;
				}

				// Check usage limit
				if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
					isValid = false;
				}

				if (isValid) {
					// Calculate discount
					if (promo.discount_type === "Percentage") {
						this.discount_amount = Math.round(
							(this.total_amount * promo.discount_value) / 100
						);
					} else if (promo.discount_type === "Fixed_Amount") {
						this.discount_amount = promo.discount_value;
					}

					// Apply max discount limit if set
					if (
						promo.max_discount_amount &&
						this.discount_amount > promo.max_discount_amount
					) {
						this.discount_amount = promo.max_discount_amount;
					}

					// Increment promo usage count
					await PromoModel.findByIdAndUpdate(this.promo_id, {
						$inc: { usage_count: 1 },
					});
				} else {
					// Invalid promo conditions, remove promo
					this.promo_id = null;
					this.discount_amount = 0;
				}
			} else {
				// Invalid/inactive promo, remove it
				this.promo_id = null;
				this.discount_amount = 0;
			}
		} catch (error) {
			// Error fetching promo, remove it
			this.promo_id = null;
			this.discount_amount = 0;
		}
	}

	// Auto-calculate final amount
	this.final_amount = this.total_amount - (this.discount_amount || 0);

	// Set timestamp based on status
	if (this.status === "Confirmed" && !this.booking_confirmed_at) {
		this.booking_confirmed_at = new Date();
	}
	if (this.status === "Completed" && !this.booking_completed_at) {
		this.booking_completed_at = new Date();
	}

	next();
});

// Indexes for better performance
bookingSchema.index({ booking_reference: 1 });
bookingSchema.index({ customer_id: 1 });
bookingSchema.index({ package_id: 1 });
bookingSchema.index({ promo_id: 1 });
bookingSchema.index({ booking_date: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ booking_date: 1, start_time: 1 });

export const Booking = mongoose.model<BookingModel>("Booking", bookingSchema);
