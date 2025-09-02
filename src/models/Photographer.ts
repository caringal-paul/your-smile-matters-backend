import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { Gender } from "../types/literal.types";

// Regex for email & phone
const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const phoneRegex = /^[0-9]{10,15}$/;

// Gender enum
export const GenderEnum: { [K in Gender]: K } = {
	Male: "Male",
	Female: "Female",
	Other: "Other",
} as const;

// Photography specialties enum
export const PhotographySpecialtyEnum = {
	Wedding: "Wedding",
	Portrait: "Portrait",
	Event: "Event",
	Corporate: "Corporate",
	Fashion: "Fashion",
	Product: "Product",
	Real_Estate: "Real Estate",
	Sports: "Sports",
	Nature: "Nature",
	Street: "Street",
	Documentary: "Documentary",
	Newborn: "Newborn",
	Maternity: "Maternity",
	Family: "Family",
} as const;

export type PhotographySpecialty = keyof typeof PhotographySpecialtyEnum;

// Weekly schedule type
export type WeeklySchedule = {
	monday: DaySchedule;
	tuesday: DaySchedule;
	wednesday: DaySchedule;
	thursday: DaySchedule;
	friday: DaySchedule;
	saturday: DaySchedule;
	sunday: DaySchedule;
};

// TODO PROCEED WITH PACKAGES/PRODUCTS
export type DaySchedule = {
	accepts_bookings: boolean;
	preferred_hours: TimeSlot[];
	notes?: string;
};

export type TimeSlot = {
	start: string; // "09:00"
	end: string; // "17:00"
};

// Photographer methods interface
export interface IPhotographerMethods {
	checkProfileComplete(): boolean;
}

// Photographer document type
export type PhotographerModel = Document &
	MetaData &
	IPhotographerMethods & {
		email: string;
		first_name: string;
		last_name: string;
		mobile_number: string;
		gender: Gender;

		bio?: string | null;
		specialties: PhotographySpecialty[];
		years_experience?: number | null;

		// Portfolio & media
		profile_image?: string | null;
		portfolio_images?: string[];
		portfolio_website?: string | null;
		social_media?: {
			instagram?: string;
			facebook?: string;
			website?: string;
		};

		// Pricing
		base_hourly_rate?: number | null;
		weekend_premium_rate?: number | null;
		holiday_premium_rate?: number | null;

		// Location & service area
		address?: string | null;
		barangay?: string | null;
		city?: string | null;
		province?: string | null;
		postal_code?: string | null;
		country?: string | null;
		service_radius_km?: number | null; // how far they'll travel

		// Booking preferences
		weekly_schedule: WeeklySchedule;
		auto_approval: boolean;
		response_time_hours: number; // expected response time in hours
		minimum_booking_duration: number; // minimum session length in minutes
		advance_booking_days: number; // how many days in advance bookings required
		buffer_time_minutes: number; // buffer between bookings

		// Business details
		business_license?: string | null;
		tax_id?: string | null;
		insurance?: boolean;

		// System fields
		password: string;
		email_verified: boolean;
		phone_verified: boolean;
		profile_completed: boolean;
		rating_average?: number | null;
		total_bookings?: number;
		last_active?: Date | null;
	};

const photographerSchema = new Schema<
	PhotographerModel,
	mongoose.Model<PhotographerModel, {}, IPhotographerMethods>
>(
	{
		// Basic info
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			match: [emailRegex, "Invalid email format"],
		},
		first_name: {
			type: String,
			required: [true, "First name is required"],
			minlength: [1, "First name must have at least 1 character"],
			maxlength: [25, "First name cannot exceed 25 characters"],
			trim: true,
		},
		last_name: {
			type: String,
			required: [true, "Last name is required"],
			minlength: [1, "Last name must have at least 1 character"],
			maxlength: [25, "Last name cannot exceed 25 characters"],
			trim: true,
		},
		mobile_number: {
			type: String,
			required: [true, "Mobile number is required"],
			match: [phoneRegex, "Invalid mobile number format"],
		},
		password: { type: String, required: true, select: false },
		gender: {
			type: String,
			enum: {
				values: Object.values(GenderEnum),
				message: "{VALUE} is not a valid gender. Must be: Male, Female, Other",
			},
			required: [true, "Gender is required"],
		},

		bio: {
			type: String,
			trim: true,
			maxlength: [1000, "Bio cannot exceed 1000 characters"],
			default: null,
		},
		specialties: {
			type: [String],
			enum: {
				values: Object.values(PhotographySpecialtyEnum),
				message: "{VALUE} is not a valid specialty",
			},
			validate: {
				validator: function (v: string[]) {
					return v && v.length > 0;
				},
				message: "At least one specialty is required",
			},
		},
		years_experience: {
			type: Number,
			min: [0, "Years of experience cannot be negative"],
			max: [50, "Years of experience cannot exceed 50"],
			default: null,
		},

		// Portfolio & media
		profile_image: { type: String, default: null },
		portfolio_images: {
			type: [String],
			default: [],
			validate: {
				validator: function (v: string[]) {
					return v.length <= 50;
				},
				message: "Cannot have more than 50 portfolio images",
			},
		},
		portfolio_website: { type: String, default: null },
		social_media: {
			instagram: { type: String, default: null },
			facebook: { type: String, default: null },
			website: { type: String, default: null },
		},

		// Pricing
		base_hourly_rate: {
			type: Number,
			min: [0, "Hourly rate cannot be negative"],
			default: null,
		},
		weekend_premium_rate: {
			type: Number,
			min: [0, "Weekend premium rate cannot be negative"],
			max: [500, "Weekend premium rate cannot exceed 500%"],
			default: null,
		},
		holiday_premium_rate: {
			type: Number,
			min: [0, "Holiday premium rate cannot be negative"],
			max: [500, "Holiday premium rate cannot exceed 500%"],
			default: null,
		},

		// Location & service area
		address: {
			type: String,
			trim: true,
			default: null,
			minlength: [5, "Address must be at least 5 characters"],
			maxlength: [100, "Address cannot exceed 100 characters"],
		},
		barangay: { type: String, trim: true, maxlength: 50, default: null },
		city: { type: String, trim: true, maxlength: 50, default: null },
		province: { type: String, trim: true, maxlength: 50, default: null },
		postal_code: { type: String, trim: true, maxlength: 10, default: null },
		country: {
			type: String,
			trim: true,
			maxlength: 50,
			default: "Philippines",
		},
		service_radius_km: {
			type: Number,
			min: [0, "Service radius cannot be negative"],
			max: [500, "Service radius cannot exceed 500km"],
			default: null,
		},

		// Booking preferences & schedule
		weekly_schedule: {
			monday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
			tuesday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
			wednesday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
			thursday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
			friday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
			saturday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
			sunday: {
				accepts_bookings: { type: Boolean, default: false },
				preferred_hours: [
					{
						start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
						end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
					},
				],
				notes: { type: String, maxlength: 200, default: null },
			},
		},
		auto_approval: { type: Boolean, default: false },
		response_time_hours: {
			type: Number,
			min: [1, "Response time must be at least 1 hour"],
			max: [168, "Response time cannot exceed 168 hours (1 week)"],
			default: 24,
		},
		minimum_booking_duration: {
			type: Number,
			min: [30, "Minimum booking duration must be at least 30 minutes"],
			max: [480, "Minimum booking duration cannot exceed 8 hours"],
			default: 60, // 1 hour default
		},
		advance_booking_days: {
			type: Number,
			min: [0, "Advance booking days cannot be negative"],
			max: [365, "Advance booking days cannot exceed 365 days"],
			default: 1,
		},
		buffer_time_minutes: {
			type: Number,
			min: [0, "Buffer time cannot be negative"],
			max: [120, "Buffer time cannot exceed 2 hours"],
			default: 30,
		},

		// Business details
		business_license: { type: String, default: null },
		tax_id: { type: String, default: null },
		insurance: { type: Boolean, default: false },

		// System fields
		email_verified: { type: Boolean, default: false },
		phone_verified: { type: Boolean, default: false },
		profile_completed: { type: Boolean, default: false },
		rating_average: {
			type: Number,
			min: [0, "Rating cannot be less than 0"],
			max: [5, "Rating cannot exceed 5"],
			default: null,
		},
		total_bookings: {
			type: Number,
			min: [0, "Total bookings cannot be negative"],
			default: 0,
		},
		last_active: { type: Date, default: null },

		// Metadata / audit fields
		is_active: { type: Boolean, default: true },
		created_by: { type: Types.ObjectId, ref: "User" },
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

// Indexes for performance
photographerSchema.index({ email: 1 });
photographerSchema.index({ specialties: 1 });
photographerSchema.index({ city: 1, province: 1 });
photographerSchema.index({ is_active: 1, profile_completed: 1 });
photographerSchema.index({ rating_average: -1 });

// Virtual for full name
photographerSchema.virtual("full_name").get(function () {
	return `${this.first_name} ${this.last_name}`;
});

// Method to check if profile is complete
photographerSchema.methods.checkProfileComplete = function () {
	const requiredFields = [
		"bio",
		"specialties",
		"base_hourly_rate",
		"city",
		"province",
	];

	const hasWeeklySchedule = Object.values(this.weekly_schedule).some(
		(day: any) => day.accepts_bookings && day.preferred_hours.length > 0
	);

	const allFieldsComplete = requiredFields.every(
		(field) =>
			this[field] !== null && this[field] !== undefined && this[field] !== ""
	);

	return (
		allFieldsComplete && hasWeeklySchedule && this.portfolio_images.length > 0
	);
};

// Pre-save hook to update profile_completed status
photographerSchema.pre("save", function () {
	this.profile_completed = this.checkProfileComplete();
});

export const Photographer = mongoose.model<
	PhotographerModel,
	mongoose.Model<PhotographerModel, {}, IPhotographerMethods>
>("Photographer", photographerSchema);
