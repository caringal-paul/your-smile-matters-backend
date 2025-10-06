import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { WeeklyScheduleItem } from "./Photographer";
import { Package } from "./Package";
import { customError } from "../middleware/errorHandler";
import { parse } from "date-fns";

// Updated Booking status enum with "Assigned" status
export const BookingStatusEnum = {
	Pending: "Pending",
	Confirmed: "Confirmed",
	Assigned: "Assigned", // New status when photographer is assigned
	Ongoing: "Ongoing",
	Completed: "Completed",
	Cancelled: "Cancelled",
	Rescheduled: "Rescheduled",
} as const;

export type BookingStatus = keyof typeof BookingStatusEnum;

// Payment method enum
export const PaymentMethodEnum = {
	Cash: "Cash",
	GCash: "GCash",
	BankTransfer: "BankTransfer",
	Card: "Card",
} as const;

export type PaymentMethod = keyof typeof PaymentMethodEnum;

// Enhanced BookingModel with services tracking
export type BookingModel = Document &
	MetaData & {
		booking_reference: string;
		customer_id: Types.ObjectId;
		package_id?: Types.ObjectId | null;
		photographer_id?: Types.ObjectId | null;
		promo_id?: Types.ObjectId | null;

		services: {
			service_id: Types.ObjectId;
			quantity: number;
			price_per_unit: number;
			total_price: number;
			duration_minutes?: number | null;
		}[];

		is_customized: boolean;
		customization_notes?: string | null;

		booking_date: Date;
		start_time: string;
		end_time: string;
		session_duration_minutes: number;
		location: string;
		theme?: string | null;
		special_requests?: string | null;
		status: BookingStatus;

		// Payment fields
		total_amount: number;
		discount_amount: number;
		final_amount: number;
		amount_paid: number; // Track how much has been paid
		method_of_payment?: PaymentMethod | null;
		payment_images: string[]; // URLs/paths to payment proof images
		is_partially_paid: boolean;
		is_payment_complete: boolean;

		booking_confirmed_at?: Date | null;
		photographer_assigned_at?: Date | null;
		booking_completed_at?: Date | null;
		cancelled_reason?: string | null;
		rescheduled_from?: Date | null;
		photographer_notes?: string | null;
		client_rating?: number | null;
		photographer_rating?: number | null;
	};

// Enhanced booking schema
const enhancedBookingSchema = new Schema<BookingModel>(
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
		},
		package_id: {
			type: Schema.Types.ObjectId,
			ref: "Package",
			default: null,
		},
		photographer_id: {
			type: Schema.Types.ObjectId,
			ref: "Photographer",
			default: null,
		},
		promo_id: {
			type: Schema.Types.ObjectId,
			ref: "Promo",
			default: null,
		},

		services: [
			{
				service_id: {
					type: Schema.Types.ObjectId,
					ref: "Service",
					required: true,
				},
				quantity: {
					type: Number,
					required: true,
					min: [1, "Quantity must be at least 1"],
					default: 1,
				},
				price_per_unit: {
					type: Number,
					required: true,
					min: [0, "Price cannot be negative"],
				},
				total_price: {
					type: Number,
					required: true,
					min: [0, "Total price cannot be negative"],
				},
				duration_minutes: {
					type: Number,
					min: [15, "Duration must be at least 15 minutes"],
					default: null,
				},
			},
		],

		is_customized: {
			type: Boolean,
			default: false,
		},
		customization_notes: {
			type: String,
			maxlength: [500, "Customization notes cannot exceed 500 characters"],
			default: null,
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
			required: [true, "End time is required"],
			match: [
				/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
				"Invalid time format (HH:MM)",
			],
		},
		session_duration_minutes: {
			type: Number,
			required: [true, "Session duration is required"],
			min: [15, "Session must be at least 15 minutes"],
			max: [8 * 60, "Session cannot exceed 8 hours"],
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

		// Payment fields
		total_amount: {
			type: Number,
			required: [true, "Total amount is required"],
			min: [0, "Total amount cannot be negative"],
		},
		discount_amount: {
			type: Number,
			min: [0, "Discount amount cannot be negative"],
			default: 0,
		},
		final_amount: {
			type: Number,
			required: [true, "Final amount is required"],
			min: [0, "Final amount cannot be negative"],
		},
		amount_paid: {
			type: Number,
			min: [0, "Amount paid cannot be negative"],
			default: 0,
		},
		method_of_payment: {
			type: String,
			enum: {
				values: Object.values(PaymentMethodEnum),
				message: "{VALUE} is not a valid payment method",
			},
			default: null,
		},
		payment_images: {
			type: [String],
			default: [],
			validate: {
				validator: function (images: string[]) {
					return images.length <= 10; // Max 10 payment proof images
				},
				message: "Cannot upload more than 10 payment images",
			},
		},
		is_partially_paid: {
			type: Boolean,
			default: false,
		},
		is_payment_complete: {
			type: Boolean,
			default: false,
		},

		booking_confirmed_at: { type: Date, default: null },
		photographer_assigned_at: { type: Date, default: null },
		booking_completed_at: { type: Date, default: null },
		cancelled_reason: {
			type: String,
			trim: true,
			maxlength: [200, "Cancellation reason cannot exceed 200 characters"],
			default: null,
		},
		rescheduled_from: { type: Date, default: null },
		photographer_notes: {
			type: String,
			trim: true,
			maxlength: [1000, "Photographer notes cannot exceed 1000 characters"],
			default: null,
		},
		client_rating: {
			type: Number,
			min: [1, "Rating must be between 1 and 5"],
			max: [5, "Rating must be between 1 and 5"],
			default: null,
		},
		photographer_rating: {
			type: Number,
			min: [1, "Rating must be between 1 and 5"],
			max: [5, "Rating must be between 1 and 5"],
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

enhancedBookingSchema.pre("validate", function (next) {
	if (this.isNew && !this.booking_reference) {
		const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
		this.booking_reference = `BK-${randomStr}`;
	}
	next();
});

// Enhanced pre-save validation
enhancedBookingSchema.pre("save", async function (next) {
	try {
		// Validate package or services
		if (!this.package_id && (!this.services || this.services.length === 0)) {
			return next(
				customError(
					400,
					"Booking must have either a package or at least one service"
				)
			);
		}

		// Auto-populate services from package
		if (this.isNew && this.package_id) {
			const PackageModel = mongoose.model("Package");
			const selectedPackage = await PackageModel.findById(
				this.package_id
			).populate("services.service_id");

			if (!selectedPackage) {
				return next(customError(404, "Package not found"));
			}

			if (!this.services || this.services.length === 0) {
				this.services = selectedPackage.services.map((item: any) => ({
					service_id: item.service._id,
					quantity: item.quantity || 1,
					price_per_unit: item.service.price,
					total_price: item.service.price * (item.quantity || 1),
					duration_minutes: item.service.duration_minutes,
				}));
			} else {
				this.services = this.services.map((item: any) => ({
					service_id: item._id || item.service_id,
					quantity: item.quantity || 1,
					price_per_unit: item.price_per_unit,
					total_price: item.total_price,
					duration_minutes: item.duration_minutes,
				}));
			}
		}

		// Calculate session duration
		if (!this.session_duration_minutes && this.services?.length) {
			this.session_duration_minutes = this.services.reduce((total, service) => {
				return total + (service.duration_minutes || 60) * service.quantity;
			}, 0);
		}

		// Calculate end_time
		if (!this.end_time && this.start_time && this.session_duration_minutes) {
			const [startHours, startMinutes] = this.start_time.split(":").map(Number);
			const startInMinutes = startHours * 60 + startMinutes;
			const endInMinutes = startInMinutes + this.session_duration_minutes;
			const endHours = Math.floor(endInMinutes / 60);
			const endMins = endInMinutes % 60;
			this.end_time = `${endHours.toString().padStart(2, "0")}:${endMins
				.toString()
				.padStart(2, "0")}`;
		}

		// Payment status
		if (this.amount_paid > 0 && this.amount_paid < this.final_amount) {
			this.is_partially_paid = true;
			this.is_payment_complete = false;
		} else if (this.amount_paid >= this.final_amount) {
			this.is_partially_paid = false;
			this.is_payment_complete = true;
		} else {
			this.is_partially_paid = false;
			this.is_payment_complete = false;
		}

		// Validate amount_paid
		if (this.amount_paid > this.final_amount) {
			return next(customError(400, "Amount paid cannot exceed final amount"));
		}

		// Photographer availability
		if (
			this.photographer_id &&
			(this.isNew ||
				this.isModified("photographer_id") ||
				this.isModified("booking_date") ||
				this.isModified("start_time"))
		) {
			const PhotographerModel = mongoose.model("Photographer");
			const photographer = await PhotographerModel.findById(
				this.photographer_id
			);

			if (!photographer) {
				return next(customError(404, "Photographer not found"));
			}

			const normalizedDate = new Date(
				this.booking_date.toISOString().split("T")[0]
			);

			const availableSlots = await photographer.getAvailableSlots(
				normalizedDate,
				this.session_duration_minutes
			);

			const requestedStart = parse(this.start_time, "HH:mm", normalizedDate);
			const requestedEnd = parse(this.end_time, "HH:mm", normalizedDate);

			const isAvailable = availableSlots.some((slot: string) => {
				const [slotStartStr, slotEndStr] = slot.split(" - ");

				const slotStart = parse(slotStartStr, "h:mm a", normalizedDate);
				const slotEnd = parse(slotEndStr, "h:mm a", normalizedDate);

				return (
					requestedStart.getTime() === slotStart.getTime() &&
					requestedEnd.getTime() === slotEnd.getTime()
				);
			});

			if (!isAvailable) {
				throw new Error(
					`Photographer is not available at ${this.start_time} on ${normalizedDate}`
				);
			}
		}

		// Final amount calculation
		this.final_amount = this.total_amount - (this.discount_amount || 0);

		next();
	} catch (error) {
		next(customError(500, "Failed to save booking"));
	}
});

// Helper function
function timeToMinutes(timeString: string): number {
	const [hours, minutes] = timeString.split(":").map(Number);
	return hours * 60 + minutes;
}

// Export enhanced models
export const Booking = mongoose.model<BookingModel>(
	"Booking",
	enhancedBookingSchema
);
