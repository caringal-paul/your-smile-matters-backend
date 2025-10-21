import mongoose, { Schema, Document, Types, Model } from "mongoose";
import { MetaData } from "../types/base.types";
import {
	ServiceCategory,
	ServiceCategoryEnum,
} from "../constants/service-category.constant";
import { Service } from "./Service";
import { Booking } from "./Booking";
import {
	addMinutes,
	format,
	isAfter,
	isBefore,
	isSameDay,
	parse,
} from "date-fns";

// Day of week enum using text for easier frontend handling
export const DayOfWeekEnum = {
	Sunday: "Sunday",
	Monday: "Monday",
	Tuesday: "Tuesday",
	Wednesday: "Wednesday",
	Thursday: "Thursday",
	Friday: "Friday",
	Saturday: "Saturday",
} as const;

export type DayOfWeek = (typeof DayOfWeekEnum)[keyof typeof DayOfWeekEnum];

// Simplified schedule item
export type WeeklyScheduleItem = {
	day_of_week: DayOfWeek;
	start_time: string; // Format: "HH:MM" (24-hour format)
	end_time: string; // Format: "HH:MM" (24-hour format)
	is_available: boolean;
	notes?: string | null;
};

export type WeeklySchedule = WeeklyScheduleItem[];

// Date-specific overrides for holidays, vacations, etc.
export type DateOverride = {
	date: Date;
	is_available: boolean;
	custom_hours?: {
		start_time: string;
		end_time: string;
	} | null;
	reason?: string; // "Holiday", "Vacation", "Sick Leave", "Special Event"
	notes?: string;
};

// ============================================================================
// DEFAULT DATA
// ============================================================================

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = [
	{
		day_of_week: "Monday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
	{
		day_of_week: "Tuesday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
	{
		day_of_week: "Wednesday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
	{
		day_of_week: "Thursday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
	{
		day_of_week: "Friday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
	{
		day_of_week: "Saturday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
	{
		day_of_week: "Sunday",
		start_time: "00:00",
		end_time: "12:00",
		is_available: false,
		notes: "",
	},
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const mergeWeeklySchedule = (
	schedule: WeeklySchedule | undefined
): WeeklySchedule => {
	if (!schedule || schedule.length === 0) return [...DEFAULT_WEEKLY_SCHEDULE];

	const seenDays = new Set<string>();
	const merged: WeeklySchedule = [];

	for (const item of schedule) {
		const day = item.day_of_week.toLowerCase();
		if (!seenDays.has(day)) {
			seenDays.add(day);
			merged.push(item);
		}
	}

	// Add missing days
	for (const defaultDay of DEFAULT_WEEKLY_SCHEDULE) {
		if (!seenDays.has(defaultDay.day_of_week.toLowerCase())) {
			merged.push(defaultDay);
		}
	}

	return merged;
};

export interface PhotographerMethods {
	/**
	 * Get available time slots for a specific service on a target date
	 * @param targetDate - The date to check availability for
	 * @param serviceId - The ID of the service to check duration for
	 * @returns Promise resolving to array of available time slots in "HH:MM" format
	 * @throws Error if service is not found
	 */
	getAvailableSlotsForService(
		targetDate: Date,
		serviceId: string
	): Promise<string[]>;

	/**
	 * Get available time slots for a specific date and duration (now async to check bookings)
	 * @param targetDate - The date to check availability for
	 * @param sessionDurationMinutes - Duration of the session in minutes (default: 120)
	 * @returns Promise resolving to array of available time slots in "HH:MM" format
	 */
	getAvailableSlots(
		targetDate: Date,
		sessionDurationMinutes?: number
	): Promise<string[]>;

	/**
	 * Check if photographer can handle specific service categories
	 * @param requiredCategories - Array of service categories to check
	 * @returns True if photographer specializes in all required categories
	 */
	canHandleServiceCategories(requiredCategories: ServiceCategory[]): boolean;
}

export type PhotographerModel = Document &
	MetaData &
	PhotographerMethods & {
		name: string;
		email: string;
		mobile_number?: string | null;
		bio?: string | null;
		profile_image?: string | null;

		// Simplified specialties based on service categories
		specialties: ServiceCategory[]; // Must have at least 1 category from the 5 options

		// Portfolio/Gallery
		photo_gallery?: string[] | null; // Array of image URLs, max 9 photos

		// Scheduling
		weekly_schedule?: WeeklySchedule | null;
		date_overrides?: DateOverride[] | null;

		booking_lead_time_hours?: number | null; // Minimum advance notice needed
	};

const photographerSchema = new Schema<PhotographerModel>(
	{
		name: {
			type: String,
			required: [true, "Photographer name is required"],
			trim: true,
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
		},
		mobile_number: {
			type: String,
			trim: true,
			default: null,
		},
		bio: {
			type: String,
			maxlength: 1000,
			default: null,
		},
		profile_image: {
			type: String,
			default: null,
		},

		// Service categories - at least 1 required, max all 5
		specialties: [
			{
				type: String,
				enum: Object.values(ServiceCategoryEnum),
			},
		],

		// Portfolio gallery - max 9 photos
		photo_gallery: [
			{
				type: String, // Image URLs
				validate: {
					validator: function (url: string) {
						// Basic URL validation
						return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
						// return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
					},
					message: "Invalid image URL format",
				},
			},
		],

		// Scheduling
		weekly_schedule: [
			{
				day_of_week: {
					type: String,
					enum: Object.values(DayOfWeekEnum),
					required: true,
				},
				start_time: {
					type: String,
					required: true,
					match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
				},
				end_time: {
					type: String,
					required: true,
					match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
					validate: {
						validator: function (this: any, value: string) {
							if (!this.start_time) return true; // skip if no start_time
							const [sh, sm] = this.start_time.split(":").map(Number);
							const [eh, em] = value.split(":").map(Number);
							return eh * 60 + em > sh * 60 + sm; // must end later
						},
						message: "End time must be later than start time",
					},
				},
				is_available: {
					type: Boolean,
					default: true,
				},
				notes: String,
			},
		],

		// Date-specific overrides
		date_overrides: [
			{
				date: {
					type: Date,
					required: true,
				},
				is_available: {
					type: Boolean,
					required: true,
				},
				custom_hours: {
					start_time: {
						type: String,
						match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
					},
					end_time: {
						type: String,
						match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
					},
				},
				reason: String,
				notes: String,
			},
		],

		booking_lead_time_hours: {
			type: Number,
			min: 1,
			default: 24, // 24 hours minimum notice
		},

		// Standard metadata fields
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

// Custom validation to ensure at least 1 specialty
photographerSchema.pre("save", function (next) {
	if (!this.weekly_schedule || this.weekly_schedule.length === 0) {
		this.weekly_schedule = mergeWeeklySchedule([]);
	} else {
		this.weekly_schedule = mergeWeeklySchedule(this.weekly_schedule);
	}

	if (!this.specialties || this.specialties.length === 0) {
		next(new Error("Photographer must have at least one specialty"));
	} else if (this.photo_gallery && this.photo_gallery.length > 9) {
		next(new Error("Photo gallery cannot have more than 9 images"));
	} else {
		next();
	}
});

photographerSchema.pre("findOneAndUpdate", function (next) {
	const update = this.getUpdate() as any;
	if (update?.weekly_schedule) {
		update.weekly_schedule = mergeWeeklySchedule(update.weekly_schedule);
		this.setUpdate(update);
	}
	next();
});

photographerSchema.methods.getAvailableSlotsForService = async function (
	targetDate: Date,
	serviceId: string
): Promise<string[]> {
	const service = await Service.findById(serviceId).lean();
	if (!service) throw new Error("Service not found");

	const duration = service.duration_minutes ?? 120; // fallback to 2h if undefined
	return this.getAvailableSlots(targetDate, duration);
};

photographerSchema.methods.getAvailableSlots = async function (
	targetDate: Date,
	sessionDurationMinutes: number = 120
): Promise<string[]> {
	const availableSlots: string[] = [];

	// Helper: convert JS Date.getDay() to DayOfWeek string
	const getDayName = (dayNum: number): DayOfWeek => {
		const days: DayOfWeek[] = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];
		return days[dayNum];
	};

	const dayOfWeek = getDayName(targetDate.getDay());
	const duration = sessionDurationMinutes;

	// Pick schedule (considering overrides)
	let schedule;
	if (this.date_overrides) {
		const override = this.date_overrides.find(
			(o: any) => o.date.toDateString() === targetDate.toDateString()
		);
		if (override) {
			if (!override.is_available) return [];
			schedule =
				override.custom_hours ||
				this.weekly_schedule?.find((s: any) => s.day_of_week === dayOfWeek);
		} else {
			schedule = this.weekly_schedule?.find(
				(s: any) => s.day_of_week === dayOfWeek
			);
		}
	} else {
		schedule = this.weekly_schedule?.find(
			(s: any) => s.day_of_week === dayOfWeek
		);
	}

	if (!schedule || !schedule.is_available) return [];

	// Query existing bookings for this day
	const startOfDay = new Date(targetDate);
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(targetDate);
	endOfDay.setHours(23, 59, 59, 999);

	const existingBookings = await Booking.find({
		photographer_id: this._id,
		booking_date: { $gte: startOfDay, $lte: endOfDay },
		status: { $nin: ["Cancelled", "Rejected"] },
	})
		.select("start_time end_time session_duration_minutes")
		.lean();

	// Build booked ranges in minutes
	const bookedTimeRanges = existingBookings.map((booking) => {
		const startDate = parse(booking.start_time, "HH:mm", targetDate);
		const endDate = addMinutes(
			startDate,
			booking.session_duration_minutes || 120
		);
		return { start: startDate, end: endDate };
	});

	// Define working hours
	const workStart = parse(schedule.start_time, "HH:mm", targetDate);
	const workEnd = parse(schedule.end_time, "HH:mm", targetDate);

	const leadTimeHours = this.booking_lead_time_hours || 0;
	const now = new Date();

	// Compute the earliest allowed start datetime based on lead time
	const earliestAllowedStart = new Date(
		now.getTime() + leadTimeHours * 60 * 60 * 1000
	);

	// Step through schedule in 30-min increments
	let current = workStart;
	while (!isAfter(addMinutes(current, duration), workEnd)) {
		const potentialEnd = addMinutes(current, duration);

		let hasConflict = false;

		// Skip if slot starts before allowed lead time
		if (current < earliestAllowedStart) {
			current = addMinutes(current, 30);
			continue;
		}

		// Check existing bookings
		for (const booked of bookedTimeRanges) {
			if (current < booked.end && potentialEnd > booked.start) {
				hasConflict = true;
				break;
			}
		}

		if (!hasConflict) {
			availableSlots.push(
				`${format(current, "h:mm a")} - ${format(potentialEnd, "h:mm a")}`
			);
		}

		current = addMinutes(current, 30);
	}

	return availableSlots;
};

// FOR GETTING AVAILABLE SLOTS
// photographerSchema.statics.getAvailablePhotographers = async function (
// 	targetDate: Date,
// 	startTime: string,
// 	endTime: string,
// 	sessionDurationMinutes: number = 120
// ) {
// 	const photographers = await this.find();

// 	const parseTimeToMinutes = (timeStr: string) => {
// 		timeStr = timeStr.trim();

// 		// If it contains AM or PM → parse as 12h format
// 		if (/am|pm/i.test(timeStr)) {
// 			const [time, period] = timeStr.split(" ");
// 			const [hours, minutes] = time.split(":").map(Number);

// 			let hour24 = hours;
// 			if (period.toLowerCase() === "pm" && hours !== 12) hour24 += 12;
// 			if (period.toLowerCase() === "am" && hours === 12) hour24 = 0;

// 			return hour24 * 60 + minutes;
// 		}

// 		// Otherwise assume 24h format
// 		const [hours, minutes] = timeStr.split(":").map(Number);
// 		return hours * 60 + minutes;
// 	};

// 	const startMinutes = parseTimeToMinutes(startTime);
// 	const endMinutes = parseTimeToMinutes(endTime);

// 	const availablePhotographers: PhotographerModel[] = [];

// 	for (const photographer of photographers) {
// 		const slots: string[] = await photographer.getAvailableSlots(
// 			targetDate,
// 			sessionDurationMinutes
// 		);

// 		// Filter slots by requested time range
// 		const hasMatchingSlot = slots.some((slot) => {
// 			const [slotStartStr, slotEndStr] = slot.split(" - ").map((t) => t.trim());

// 			const slotStartMinutes = parseTimeToMinutes(slotStartStr);
// 			const slotEndMinutes = parseTimeToMinutes(slotEndStr);
// 			console.log("slotStartMinutes", slotStartMinutes);

// 			if (isNaN(slotStartMinutes) || isNaN(slotEndMinutes)) return false;
// 			console.log("startMinutes", startTime);

// 			return slotStartMinutes >= startMinutes && slotEndMinutes <= endMinutes;
// 		});

// 		if (hasMatchingSlot) {
// 			availablePhotographers.push(photographer);
// 		}
// 	}

// 	return availablePhotographers;
// };
photographerSchema.statics.getAvailablePhotographers = async function (
	targetDate: Date,
	startTime: string,
	endTime: string,
	sessionDurationMinutes: number = 120
) {
	const photographers = await this.find();

	const parseTimeToMinutes = (timeStr: string) => {
		timeStr = timeStr.trim();

		if (/am|pm/i.test(timeStr)) {
			const [time, period] = timeStr.split(" ");
			const [hours, minutes] = time.split(":").map(Number);

			let hour24 = hours;
			if (period.toLowerCase() === "pm" && hours !== 12) hour24 += 12;
			if (period.toLowerCase() === "am" && hours === 12) hour24 = 0;

			return hour24 * 60 + (minutes || 0);
		}

		const [hours, minutes] = timeStr.split(":").map(Number);
		return hours * 60 + (minutes || 0);
	};

	const startMinutes = parseTimeToMinutes(startTime);
	const endMinutes = parseTimeToMinutes(endTime);

	const now = new Date();

	const availablePhotographers: PhotographerModel[] = [];

	for (const photographer of photographers) {
		const slots: string[] = await photographer.getAvailableSlots(
			targetDate,
			sessionDurationMinutes
		);

		const leadTimeHours = photographer.booking_lead_time_hours || 0;

		// Calculate the actual start datetime of the requested session
		const bookingStart = new Date(targetDate);
		bookingStart.setHours(
			Math.floor(startMinutes / 60),
			startMinutes % 60,
			0,
			0
		);

		// Calculate the minimum allowed booking datetime based on lead time
		const earliestAllowedBooking = new Date(
			now.getTime() + leadTimeHours * 60 * 60 * 1000
		);

		// If the booking start is earlier than the lead time requirement → skip photographer
		if (bookingStart < earliestAllowedBooking) {
			continue;
		}

		// Filter slots by requested time range
		const hasMatchingSlot = slots.some((slot) => {
			const [slotStartStr, slotEndStr] = slot.split(" - ").map((t) => t.trim());

			const slotStartMinutes = parseTimeToMinutes(slotStartStr);
			const slotEndMinutes = parseTimeToMinutes(slotEndStr);

			if (isNaN(slotStartMinutes) || isNaN(slotEndMinutes)) return false;

			return slotStartMinutes >= startMinutes && slotEndMinutes <= endMinutes;
		});

		if (hasMatchingSlot) {
			availablePhotographers.push(photographer);
		}
	}

	return availablePhotographers;
};

photographerSchema.statics.getPhotographersByTimeRange = async function (
	targetDate: Date,
	startTime: string,
	endTime: string
) {
	const photographers = await this.find();

	const results: { photographer: PhotographerModel }[] = [];

	const startDateTime = parse(startTime, "HH:mm", targetDate);
	const endDateTime = parse(endTime, "HH:mm", targetDate);

	for (const photographer of photographers) {
		const dayOfWeek = targetDate.toLocaleDateString("en-US", {
			weekday: "long",
		}) as DayOfWeek;

		let schedule;

		// ✅ Check for date overrides (OT or Leave)
		if (photographer.date_overrides && photographer.date_overrides.length > 0) {
			const override = photographer.date_overrides.find((o: any) =>
				isSameDay(new Date(o.date), targetDate)
			);

			if (override) {
				// Photographer on leave
				if (!override.is_available) continue;

				// Use OT hours or fallback to regular schedule
				schedule =
					override.custom_hours ||
					photographer.weekly_schedule?.find(
						(s: any) => s.day_of_week === dayOfWeek
					);
			} else {
				// No override → regular schedule
				schedule = photographer.weekly_schedule?.find(
					(s: any) => s.day_of_week === dayOfWeek
				);
			}
		} else {
			// No overrides at all → regular schedule
			schedule = photographer.weekly_schedule?.find(
				(s: any) => s.day_of_week === dayOfWeek
			);
		}

		if (!schedule || !schedule.is_available) continue;

		// ✅ Check working hours
		const workStart = parse(schedule.start_time, "HH:mm", targetDate);
		const workEnd = parse(schedule.end_time, "HH:mm", targetDate);
		if (startDateTime < workStart || endDateTime > workEnd) continue;

		// ✅ Check for booking conflicts
		const startOfDay = new Date(targetDate);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(targetDate);
		endOfDay.setHours(23, 59, 59, 999);

		const existingBookings = await Booking.find({
			photographer_id: photographer._id,
			booking_date: { $gte: startOfDay, $lte: endOfDay },
			status: { $nin: ["Cancelled", "Rejected"] },
		}).select("start_time session_duration_minutes");

		const hasConflict = existingBookings.some((booking) => {
			const bookedStart = parse(booking.start_time, "HH:mm", targetDate);
			const bookedEnd = addMinutes(
				bookedStart,
				booking.session_duration_minutes || 120
			);
			return startDateTime < bookedEnd && endDateTime > bookedStart;
		});

		if (hasConflict) continue;

		results.push({ photographer });
	}

	return results;
};

// Method to check if photographer can handle specific service categories
photographerSchema.methods.canHandleServiceCategories = function (
	requiredCategories: ServiceCategory[]
): boolean {
	return requiredCategories.every((category) =>
		this.specialties.includes(category)
	);
};

// Static method to find photographers by service categories
photographerSchema.statics.findByServiceCategories = function (
	requiredCategories: ServiceCategory[]
) {
	return this.find({
		specialties: { $all: requiredCategories },
		is_active: true,
	});
};

// Indexes for performance
photographerSchema.index({ specialties: 1 });
photographerSchema.index({ "date_overrides.date": 1 });
photographerSchema.index({ is_active: 1 });

export const Photographer = mongoose.model<PhotographerModel>(
	"Photographer",
	photographerSchema
);
