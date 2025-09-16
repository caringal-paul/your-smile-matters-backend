import { Router, Request, NextFunction } from "express";
import { Booking, BookingModel, BookingStatusEnum } from "../../models/Booking";
import { Package, PackageModel } from "../../models/Package";
import { Service } from "../../models/Service";
import mongoose, { Types } from "mongoose";
import { MetaData, TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authMiddleware";
import { customError } from "../../middleware/errorHandler";
import { CustomerModel } from "../../models/Customer";
import { Promo, PromoModel } from "../../models/Promo";
import { generateBookingReference } from "../../utils/generateRandomValues";

const router = Router();

type BookingResponse = MetaData & {
	id: string;
	booking_reference: string;
	customer_id: string;
	package: {
		id: string;
		name: string;
		price: number;
		looks: number;
		included_services: {
			id: string;
			name: string;
			category: string;
			is_available: boolean;
			is_active: boolean;
		}[];
	};
	promo?: {
		id: string;
		promo_code: string;
		discount_type: string;
		discount_value: number;
	} | null;
	booking_date: Date;
	start_time: string;
	end_time?: string | null;
	location: string;
	theme?: string | null;
	special_requests?: string | null;
	status: string;
	total_amount: number;
	discount_amount: number;
	final_amount: number;
	booking_confirmed_at?: Date | null;
	booking_completed_at?: Date | null;
	cancelled_reason?: string | null;
	rescheduled_from?: Date | null;
};

type BookingListResponse = {
	id: string;
	booking_reference: string;
	customer_name: string;
	package_name: string;
	booking_date: Date;
	start_time: string;
	location: string;
	status: string;
	final_amount: number;
};

type AvailabilityResponse = {
	date: string;
	available_slots: string[];
	booked_slots: string[];
	total_bookings: number;
};

// TODO: ADD THE REMAINING ROUTE TO POSTMAN
// GET /api/bookings/availability/:date (Check availability for a specific date)
router.get(
	"/availability/:date",
	async (
		req: Request,
		res: TypedResponse<AvailabilityResponse>,
		next: NextFunction
	) => {
		try {
			const { date } = req.params;

			// Validate date format
			const bookingDate = new Date(date);
			if (isNaN(bookingDate.getTime())) {
				throw customError(400, "Invalid date format");
			}

			// Check if date is in the future
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (bookingDate < today) {
				throw customError(400, "Cannot check availability for past dates");
			}

			// Get all bookings for this date
			const existingBookings = await Booking.find({
				booking_date: {
					$gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
					$lt: new Date(bookingDate.setHours(23, 59, 59, 999)),
				},
				status: { $nin: ["Cancelled"] }, // Exclude cancelled bookings
				is_active: true,
			}).select("start_time end_time");

			// Define available time slots (business hours: 8 AM - 8 PM)
			const businessSlots = [
				"08:00",
				"09:00",
				"10:00",
				"11:00",
				"12:00",
				"13:00",
				"14:00",
				"15:00",
				"16:00",
				"17:00",
				"18:00",
				"19:00",
				"20:00",
			];

			const bookedSlots = existingBookings.map((booking) => booking.start_time);
			const availableSlots = businessSlots.filter(
				(slot) => !bookedSlots.includes(slot)
			);

			res.status(200).json({
				status: 200,
				message: "Availability checked successfully!",
				data: {
					date: date,
					available_slots: availableSlots,
					booked_slots: bookedSlots,
					total_bookings: existingBookings.length,
				},
			});
		} catch (error) {
			console.error("Error checking availability:", error);
			next(error);
		}
	}
);

// TODO: ADD THE REMAINING ROUTE TO POSTMAN
// RECHECK: WORK ON PROMO THEN TEST AGAIN
// POST /api/bookings/calculate-price (Calculate booking price with promo)
router.post(
	"/calculate-price",
	async (
		req: Request,
		res: TypedResponse<{
			package_price: number;
			discount_amount: number;
			final_amount: number;
			promo_applied?: boolean;
		}>,
		next: NextFunction
	) => {
		try {
			const { package_id, promo_code, booking_date } = req.body;

			// Validate package
			if (!mongoose.Types.ObjectId.isValid(package_id)) {
				throw customError(400, "Invalid package ID format");
			}

			const selectedPackage = await Package.findById(package_id).populate(
				"included_services"
			);

			if (!selectedPackage) {
				throw customError(404, "Package not found");
			}

			if (!selectedPackage.is_available || !selectedPackage.is_active) {
				throw customError(400, "Selected package is not available");
			}

			let totalAmount = selectedPackage.price;
			let discountAmount = 0;
			let promoApplied = false;

			// Check promo if provided
			if (promo_code) {
				const promo = await Promo.findOne({
					promo_code: promo_code.toUpperCase(),
					is_active: true,
				});

				if (promo) {
					const now = new Date();
					const bookingDateTime = new Date(booking_date);

					// Check if promo is currently valid
					if (promo.valid_from <= now && promo.valid_until >= now) {
						let isValidForBooking = true;

						// Check Early Bird promo conditions
						if (promo.promo_type === "Early_Bird" && promo.min_advance_days) {
							const daysDiff = Math.floor(
								(bookingDateTime.getTime() - now.getTime()) /
									(1000 * 60 * 60 * 24)
							);
							if (daysDiff < promo.min_advance_days) {
								isValidForBooking = false;
							}
						}

						// Check minimum booking amount
						if (
							promo.min_booking_amount &&
							totalAmount < promo.min_booking_amount
						) {
							isValidForBooking = false;
						}

						// Check usage limit
						if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
							isValidForBooking = false;
						}

						if (isValidForBooking) {
							// Calculate discount
							if (promo.discount_type === "Percentage") {
								discountAmount = Math.round(
									(totalAmount * promo.discount_value) / 100
								);
							} else if (promo.discount_type === "Fixed_Amount") {
								discountAmount = promo.discount_value;
							}

							// Apply max discount limit
							if (
								promo.max_discount_amount &&
								discountAmount > promo.max_discount_amount
							) {
								discountAmount = promo.max_discount_amount;
							}

							promoApplied = true;
						}
					}
				}
			}

			const finalAmount = totalAmount - discountAmount;

			res.status(200).json({
				status: 200,
				message: "Price calculated successfully!",
				data: {
					package_price: totalAmount,
					discount_amount: discountAmount,
					final_amount: finalAmount,
					promo_applied: promoApplied,
				},
			});
		} catch (error) {
			console.error("Error calculating price:", error);
			next(error);
		}
	}
);

// POST /api/bookings (Create new booking)
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BookingResponse>,
		next: NextFunction
	) => {
		try {
			const {
				customer_id,
				package_id,
				promo_code,
				booking_date,
				start_time,
				end_time,
				location,
				theme,
				special_requests,
			} = req.body;

			const userId = req.user?._id;
			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate required fields
			if (
				!customer_id ||
				!package_id ||
				!booking_date ||
				!start_time ||
				!location
			) {
				throw customError(
					400,
					"Customer, package, booking date, start time, and location are required"
				);
			}

			// Validate ObjectIds
			if (!mongoose.Types.ObjectId.isValid(customer_id)) {
				throw customError(400, "Invalid customer ID format");
			}
			if (!mongoose.Types.ObjectId.isValid(package_id)) {
				throw customError(400, "Invalid package ID format");
			}

			// Validate time format
			const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
			if (!timeRegex.test(start_time)) {
				throw customError(400, "Invalid start time format (HH:MM)");
			}
			if (end_time && !timeRegex.test(end_time)) {
				throw customError(400, "Invalid end time format (HH:MM)");
			}

			// Validate booking date is in the future
			const bookingDateTime = new Date(booking_date);
			const now = new Date();
			if (bookingDateTime <= now) {
				throw customError(400, "Booking date must be in the future");
			}

			// Check if slot is available
			const existingBooking = await Booking.findOne({
				booking_date: {
					$gte: new Date(bookingDateTime.setHours(0, 0, 0, 0)),
					$lt: new Date(bookingDateTime.setHours(23, 59, 59, 999)),
				},
				start_time: start_time,
				status: { $nin: ["Cancelled"] },
				is_active: true,
			});

			if (existingBooking) {
				throw customError(400, "This time slot is already booked");
			}

			// Validate customer exists
			const CustomerModel = mongoose.model("Customer");
			const customer = await CustomerModel.findById(customer_id);
			if (!customer) {
				throw customError(404, "Customer not found");
			}

			// Validate package and get price
			const selectedPackage = await Package.findById(package_id).populate<{
				included_service: {
					id: string;
					name: string;
					category: string;
					is_active: boolean;
					is_available: boolean;
				};
			}>({
				path: "included_services",
				select: "name category is_available is_active",
			});

			if (!selectedPackage) {
				throw customError(404, "Package not found");
			}

			if (!selectedPackage.is_available || !selectedPackage.is_active) {
				throw customError(400, "Selected package is not available");
			}

			// Check if all services in package are available
			const unavailableServices = (
				selectedPackage.included_services as unknown as {
					id: string;
					name: string;
					category: string;
					is_active: boolean;
					is_available: boolean;
				}[]
			).filter((service) => !service.is_available || !service.is_active);

			if (unavailableServices.length > 0) {
				throw customError(
					400,
					"Some services in this package are currently unavailable"
				);
			}

			let promoId = null;
			if (promo_code) {
				const promo = await Promo.findOne({
					promo_code: promo_code.toUpperCase(),
					is_active: true,
				});

				if (promo) {
					const currentDate = new Date();
					if (
						promo.valid_from <= currentDate &&
						promo.valid_until >= currentDate
					) {
						// Additional validation will be done in the pre-save middleware
						promoId = promo._id;
					}
				}
			}

			// Create booking
			const booking = new Booking({
				booking_reference: generateBookingReference(),
				customer_id: new Types.ObjectId(customer_id),
				package_id: new Types.ObjectId(package_id),
				promo_id: promoId,
				booking_date: bookingDateTime,
				start_time,
				end_time: end_time || null,
				location: location.trim(),
				theme: theme?.trim() || null,
				special_requests: special_requests?.trim() || null,
				status: "Pending",
				total_amount: selectedPackage.price,
				discount_amount: 0, // Will be calculated in pre-save middleware
				final_amount: selectedPackage.price, // Will be calculated in pre-save middleware
				is_active: true,
				created_by: new Types.ObjectId(userId),
				updated_by: new Types.ObjectId(userId),
			});

			await booking.save();

			// Populate for response
			const populatedBooking = await Booking.findById(booking._id)
				.populate<{ package_id: PackageModel }>({
					path: "package_id",
					select: "name price looks",
					populate: {
						path: "included_services",
						select: "name category is_available is_active",
					},
				})
				.populate<{ promo_id: PromoModel }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				})
				.lean();

			const bookingResponse: BookingResponse = {
				id: String(populatedBooking!._id),
				booking_reference: populatedBooking!.booking_reference,
				customer_id: String(populatedBooking!.customer_id),
				package: {
					id: String(populatedBooking!.package_id._id),
					name: populatedBooking!.package_id.name,
					price: populatedBooking!.package_id.price,
					looks: populatedBooking!.package_id.looks,
					included_services: populatedBooking!.package_id.included_services.map(
						(service: any) => ({
							id: String(service._id),
							name: service.name,
							category: service.category,
							is_active: service.is_active,
							is_available: service.is_available,
						})
					),
				},
				promo: populatedBooking!.promo_id
					? {
							id: String(populatedBooking!.promo_id._id),
							promo_code: populatedBooking!.promo_id.promo_code,
							discount_type: populatedBooking!.promo_id.discount_type,
							discount_value: populatedBooking!.promo_id.discount_value,
					  }
					: null,
				booking_date: populatedBooking!.booking_date,
				start_time: populatedBooking!.start_time,
				end_time: populatedBooking!.end_time,
				location: populatedBooking!.location,
				theme: populatedBooking!.theme,
				special_requests: populatedBooking!.special_requests,
				status: populatedBooking!.status,
				total_amount: populatedBooking!.total_amount,
				discount_amount: populatedBooking!.discount_amount,
				final_amount: populatedBooking!.final_amount,
				booking_confirmed_at: populatedBooking!.booking_confirmed_at,
				booking_completed_at: populatedBooking!.booking_completed_at,
				cancelled_reason: populatedBooking!.cancelled_reason,
				rescheduled_from: populatedBooking!.rescheduled_from,
				created_at: populatedBooking!.created_at,
				updated_at: populatedBooking!.updated_at,
				is_active: populatedBooking!.is_active,
				created_by: populatedBooking!.created_by,
				updated_by: populatedBooking!.updated_by,
			};

			res.status(201).json({
				status: 201,
				message: "Booking created successfully!",
				data: bookingResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings (Admin view - all bookings)
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<BookingListResponse[]>,
		next: NextFunction
	) => {
		try {
			const {
				status,
				customer_id,
				package_id,
				date_from,
				date_to,
				search,
				sort_by = "booking_date",
				sort_order = "desc",
				page = 1,
				limit = 20,
			} = req.query;

			// Build filter
			const filter: any = { is_active: true };

			if (status && status !== "all") {
				filter.status = status;
			}

			if (customer_id) {
				filter.customer_id = customer_id;
			}

			if (package_id) {
				filter.package_id = package_id;
			}

			if (date_from || date_to) {
				filter.booking_date = {};
				if (date_from) filter.booking_date.$gte = new Date(date_from as string);
				if (date_to) filter.booking_date.$lte = new Date(date_to as string);
			}

			if (search) {
				filter.$or = [
					{ booking_reference: { $regex: search, $options: "i" } },
					{ location: { $regex: search, $options: "i" } },
				];
			}

			// Build sort
			const sortObj: any = {};
			sortObj[sort_by as string] = sort_order === "desc" ? -1 : 1;

			// Pagination
			const skip = (Number(page) - 1) * Number(limit);

			const bookings = await Booking.find(filter)
				.populate<{ customer_id: CustomerModel }>({
					path: "customer_id",
					select: "first_name last_name",
				})
				.populate<{ package_id: PackageModel }>({
					path: "package_id",
					select: "name",
				})
				.sort(sortObj)
				.skip(skip)
				.limit(Number(limit))
				.lean();

			const bookingsResponse: BookingListResponse[] = bookings.map(
				(booking) => ({
					id: String(booking._id),
					booking_reference: booking.booking_reference,
					customer_name: `${booking.customer_id.first_name} ${booking.customer_id.last_name}`,
					package_name: booking.package_id.name,
					booking_date: booking.booking_date,
					start_time: booking.start_time,
					location: booking.location,
					status: booking.status,
					final_amount: booking.final_amount,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Bookings fetched successfully!",
				data: bookingsResponse,
			});
		} catch (error) {
			console.error("Error fetching bookings:", error);
			next(error);
		}
	}
);

// GET /api/bookings/:id (Get booking details)
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<BookingResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id)
				.populate<any>({
					path: "package_id",
					select: "name price looks",
					populate: {
						path: "included_services",
						select: "name category is_available is_active",
					},
				})
				.populate<{ promo_id: PromoModel }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				});

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			const bookingResponse: BookingResponse = {
				id: String(booking._id),
				booking_reference: booking.booking_reference,
				customer_id: String(booking.customer_id),
				package: {
					id: String(booking.package_id._id),
					name: booking.package_id.name,
					price: booking.package_id.price,
					looks: booking.package_id.looks,
					included_services: booking.package_id.included_services.map(
						(service: any) => ({
							id: String(service._id),
							name: service.name,
							category: service.category,
							is_available: service.is_available,
							is_active: service.is_active,
						})
					),
				},

				promo: booking.promo_id
					? {
							id: String(booking.promo_id._id),
							promo_code: booking.promo_id.promo_code,
							discount_type: booking.promo_id.discount_type,
							discount_value: booking.promo_id.discount_value,
					  }
					: null,
				booking_date: booking.booking_date,
				start_time: booking.start_time,
				end_time: booking.end_time,
				location: booking.location,
				theme: booking.theme,
				special_requests: booking.special_requests,
				status: booking.status,
				total_amount: booking.total_amount,
				discount_amount: booking.discount_amount,
				final_amount: booking.final_amount,
				booking_confirmed_at: booking.booking_confirmed_at,
				booking_completed_at: booking.booking_completed_at,
				cancelled_reason: booking.cancelled_reason,
				rescheduled_from: booking.rescheduled_from,
				created_at: booking.created_at,
				updated_at: booking.updated_at,
				is_active: booking.is_active,
				created_by: booking.created_by,
				updated_by: booking.updated_by,
			};

			res.status(200).json({
				status: 200,
				message: "Booking fetched successfully!",
				data: bookingResponse,
			});
		} catch (error) {
			console.error("Error fetching booking:", error);
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/confirm (Confirm booking)
router.patch(
	"/:id/confirm",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BookingResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.status !== "Pending") {
				throw customError(
					400,
					`Cannot confirm booking with status: ${booking.status}`
				);
			}

			// Check if booking date is still in the future
			if (booking.booking_date <= new Date()) {
				throw customError(400, "Cannot confirm booking for past dates");
			}

			booking.status = "Confirmed";
			booking.booking_confirmed_at = new Date();
			booking.updated_by = new Types.ObjectId(userId);
			booking.updated_at = new Date();

			await booking.save();

			// Return populated response
			const populatedBooking = await Booking.findById(booking._id)
				.populate<any>({
					path: "package_id",
					select: "name price looks",
					populate: {
						path: "included_services",
						select: "name category is_available is_active",
					},
				})
				.populate<{ promo_id: PromoModel }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				});

			const bookingResponse: BookingResponse = {
				id: String(populatedBooking!._id),
				booking_reference: populatedBooking!.booking_reference,
				customer_id: String(populatedBooking!.customer_id),
				package: {
					id: String(populatedBooking!.package_id._id),
					name: populatedBooking!.package_id.name,
					price: populatedBooking!.package_id.price,
					looks: populatedBooking!.package_id.looks,
					included_services: populatedBooking!.package_id.included_services.map(
						(service: any) => ({
							id: String(service._id),
							name: service.name,
							category: service.category,
						})
					),
				},
				promo: populatedBooking!.promo_id
					? {
							id: String(populatedBooking!.promo_id._id),
							promo_code: populatedBooking!.promo_id.promo_code,
							discount_type: populatedBooking!.promo_id.discount_type,
							discount_value: populatedBooking!.promo_id.discount_value,
					  }
					: null,
				booking_date: populatedBooking!.booking_date,
				start_time: populatedBooking!.start_time,
				end_time: populatedBooking!.end_time,
				location: populatedBooking!.location,
				theme: populatedBooking!.theme,
				special_requests: populatedBooking!.special_requests,
				status: populatedBooking!.status,
				total_amount: populatedBooking!.total_amount,
				discount_amount: populatedBooking!.discount_amount,
				final_amount: populatedBooking!.final_amount,
				booking_confirmed_at: populatedBooking!.booking_confirmed_at,
				booking_completed_at: populatedBooking!.booking_completed_at,
				cancelled_reason: populatedBooking!.cancelled_reason,
				rescheduled_from: populatedBooking!.rescheduled_from,
				created_at: populatedBooking!.created_at,
				updated_at: populatedBooking!.updated_at,
				is_active: populatedBooking!.is_active,
				created_by: populatedBooking!.created_by,
				updated_by: populatedBooking!.updated_by,
			};

			res.status(200).json({
				status: 200,
				message: "Booking confirmed successfully!",
				data: bookingResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/cancel (Cancel booking)
router.patch(
	"/:id/cancel",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { cancelled_reason } = req.body;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!cancelled_reason || cancelled_reason.trim().length < 5) {
				throw customError(
					400,
					"Cancellation reason is required and must be at least 5 characters"
				);
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (["Cancelled", "Completed"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot cancel booking with status: ${booking.status}`
				);
			}

			booking.status = "Cancelled";
			booking.cancelled_reason = cancelled_reason.trim();
			booking.updated_by = new Types.ObjectId(userId);
			booking.updated_at = new Date();

			await booking.save();

			res.status(200).json({
				status: 200,
				message: "Booking cancelled successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/reschedule (Reschedule booking)
router.patch(
	"/:id/reschedule",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BookingResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const { new_booking_date, new_start_time, new_end_time } = req.body;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			if (!new_booking_date || !new_start_time) {
				throw customError(400, "New booking date and start time are required");
			}

			// Validate time format
			const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
			if (!timeRegex.test(new_start_time)) {
				throw customError(400, "Invalid start time format (HH:MM)");
			}
			if (new_end_time && !timeRegex.test(new_end_time)) {
				throw customError(400, "Invalid end time format (HH:MM)");
			}

			// Validate new date is in the future
			const newBookingDateTime = new Date(new_booking_date);
			if (newBookingDateTime <= new Date()) {
				throw customError(400, "New booking date must be in the future");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (!["Pending", "Confirmed"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot reschedule booking with status: ${booking.status}`
				);
			}

			// Check if new slot is available
			const conflictingBooking = await Booking.findOne({
				_id: { $ne: id }, // Exclude current booking
				booking_date: {
					$gte: new Date(newBookingDateTime.setHours(0, 0, 0, 0)),
					$lt: new Date(newBookingDateTime.setHours(23, 59, 59, 999)),
				},
				start_time: new_start_time,
				status: { $nin: ["Cancelled"] },
				is_active: true,
			});

			if (conflictingBooking) {
				throw customError(400, "The new time slot is already booked");
			}

			// Store original booking date for audit trail
			const originalDate = booking.booking_date;

			// Update booking
			booking.booking_date = newBookingDateTime;
			booking.start_time = new_start_time;
			booking.end_time = new_end_time || null;
			booking.status = "Rescheduled";
			booking.rescheduled_from = originalDate;
			booking.updated_by = new Types.ObjectId(userId);
			booking.updated_at = new Date();

			await booking.save();

			// Return populated response
			const populatedBooking = await Booking.findById(booking._id)
				.populate<any>({
					path: "package_id",
					select: "name price looks",
					populate: {
						path: "included_services",
						select: "name category is_available is_active",
					},
				})
				.populate<{ promo_id: PromoModel }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				});

			const bookingResponse: BookingResponse = {
				id: String(populatedBooking!._id),
				booking_reference: populatedBooking!.booking_reference,
				customer_id: String(populatedBooking!.customer_id),
				package: {
					id: String(populatedBooking!.package_id._id),
					name: populatedBooking!.package_id.name,
					price: populatedBooking!.package_id.price,
					looks: populatedBooking!.package_id.looks,
					included_services: populatedBooking!.package_id.included_services.map(
						(service: any) => ({
							id: String(service._id),
							name: service.name,
							category: service.category,
						})
					),
				},
				promo: populatedBooking!.promo_id
					? {
							id: String(populatedBooking!.promo_id._id),
							promo_code: populatedBooking!.promo_id.promo_code,
							discount_type: populatedBooking!.promo_id.discount_type,
							discount_value: populatedBooking!.promo_id.discount_value,
					  }
					: null,
				booking_date: populatedBooking!.booking_date,
				start_time: populatedBooking!.start_time,
				end_time: populatedBooking!.end_time,
				location: populatedBooking!.location,
				theme: populatedBooking!.theme,
				special_requests: populatedBooking!.special_requests,
				status: populatedBooking!.status,
				total_amount: populatedBooking!.total_amount,
				discount_amount: populatedBooking!.discount_amount,
				final_amount: populatedBooking!.final_amount,
				booking_confirmed_at: populatedBooking!.booking_confirmed_at,
				booking_completed_at: populatedBooking!.booking_completed_at,
				cancelled_reason: populatedBooking!.cancelled_reason,
				rescheduled_from: populatedBooking!.rescheduled_from,
				created_at: populatedBooking!.created_at,
				updated_at: populatedBooking!.updated_at,
				is_active: populatedBooking!.is_active,
				created_by: populatedBooking!.created_by,
				updated_by: populatedBooking!.updated_by,
			};

			res.status(200).json({
				status: 200,
				message: "Booking rescheduled successfully!",
				data: bookingResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/start (Mark booking as ongoing)
router.patch(
	"/:id/start",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.status !== "Confirmed") {
				throw customError(
					400,
					`Cannot start booking with status: ${booking.status}`
				);
			}

			// Check if it's the booking date
			const today = new Date();
			const bookingDate = new Date(booking.booking_date);
			today.setHours(0, 0, 0, 0);
			bookingDate.setHours(0, 0, 0, 0);

			if (bookingDate.getTime() !== today.getTime()) {
				throw customError(400, "Can only start bookings on the scheduled date");
			}

			booking.status = "Ongoing";
			booking.updated_by = new Types.ObjectId(userId);
			booking.updated_at = new Date();

			await booking.save();

			res.status(200).json({
				status: 200,
				message: "Booking started successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/bookings/:id/complete (Mark booking as completed)
router.patch(
	"/:id/complete",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid booking ID format");
			}

			const booking = await Booking.findById(id);

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (!["Confirmed", "Ongoing"].includes(booking.status)) {
				throw customError(
					400,
					`Cannot complete booking with status: ${booking.status}`
				);
			}

			booking.status = "Completed";
			booking.booking_completed_at = new Date();
			booking.updated_by = new Types.ObjectId(userId);
			booking.updated_at = new Date();

			await booking.save();

			res.status(200).json({
				status: 200,
				message: "Booking completed successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/bookings/customer/:customerId (Get bookings for specific customer)
router.get(
	"/customer/:customerId",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<BookingListResponse[]>,
		next: NextFunction
	) => {
		try {
			const { customerId } = req.params;
			const { status, upcoming_only = "false" } = req.query;

			if (!mongoose.Types.ObjectId.isValid(customerId)) {
				throw customError(400, "Invalid customer ID format");
			}

			const filter: any = {
				customer_id: customerId,
				is_active: true,
			};

			if (status && status !== "all") {
				filter.status = status;
			}

			if (upcoming_only === "true") {
				filter.booking_date = { $gte: new Date() };
				filter.status = { $nin: ["Cancelled", "Completed"] };
			}

			const bookings = await Booking.find(filter)
				.populate<{ customer_id: CustomerModel }>({
					path: "customer_id",
					select: "first_name last_name",
				})
				.populate<{ package_id: PackageModel }>({
					path: "package_id",
					select: "name",
				})
				.sort({ booking_date: -1 })
				.lean();

			const bookingsResponse: BookingListResponse[] = bookings.map(
				(booking) => ({
					id: String(booking._id),
					booking_reference: booking.booking_reference,
					customer_name: `${booking.customer_id.first_name} ${booking.customer_id.last_name}`,
					package_name: booking.package_id.name,
					booking_date: booking.booking_date,
					start_time: booking.start_time,
					location: booking.location,
					status: booking.status,
					final_amount: booking.final_amount,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Customer bookings fetched successfully!",
				data: bookingsResponse,
			});
		} catch (error) {
			console.error("Error fetching customer bookings:", error);
			next(error);
		}
	}
);

// GET /api/bookings/analytics/summary (Booking analytics)
router.get(
	"/analytics/summary",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<{
			total_bookings: number;
			pending_bookings: number;
			confirmed_bookings: number;
			ongoing_bookings: number;
			completed_bookings: number;
			cancelled_bookings: number;
			total_revenue: number;
			today_bookings: number;
			upcoming_bookings: number;
		}>,
		next: NextFunction
	) => {
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(today.getDate() + 1);

			// Get all bookings counts
			const [
				totalBookings,
				pendingBookings,
				confirmedBookings,
				ongoingBookings,
				completedBookings,
				cancelledBookings,
				todayBookings,
				upcomingBookings,
			] = await Promise.all([
				Booking.countDocuments({ is_active: true }),
				Booking.countDocuments({ status: "Pending", is_active: true }),
				Booking.countDocuments({ status: "Confirmed", is_active: true }),
				Booking.countDocuments({ status: "Ongoing", is_active: true }),
				Booking.countDocuments({ status: "Completed", is_active: true }),
				Booking.countDocuments({ status: "Cancelled", is_active: true }),
				Booking.countDocuments({
					booking_date: { $gte: today, $lt: tomorrow },
					status: { $nin: ["Cancelled"] },
					is_active: true,
				}),
				Booking.countDocuments({
					booking_date: { $gte: new Date() },
					status: { $nin: ["Cancelled", "Completed"] },
					is_active: true,
				}),
			]);

			// Calculate total revenue from completed bookings
			const revenueResult = await Booking.aggregate([
				{
					$match: {
						status: "Completed",
						is_active: true,
					},
				},
				{
					$group: {
						_id: null,
						total_revenue: { $sum: "$final_amount" },
					},
				},
			]);

			const totalRevenue =
				revenueResult.length > 0 ? revenueResult[0].total_revenue : 0;

			res.status(200).json({
				status: 200,
				message: "Booking analytics fetched successfully!",
				data: {
					total_bookings: totalBookings,
					pending_bookings: pendingBookings,
					confirmed_bookings: confirmedBookings,
					ongoing_bookings: ongoingBookings,
					completed_bookings: completedBookings,
					cancelled_bookings: cancelledBookings,
					total_revenue: totalRevenue,
					today_bookings: todayBookings,
					upcoming_bookings: upcomingBookings,
				},
			});
		} catch (error) {
			console.error("Error fetching booking analytics:", error);
			next(error);
		}
	}
);

// GET /api/bookings/reference/:reference (Get booking by reference number)
router.get(
	"/reference/:reference",
	async (
		req: Request,
		res: TypedResponse<BookingResponse>,
		next: NextFunction
	) => {
		try {
			const { reference } = req.params;

			if (!reference.match(/^BK-[A-Z0-9]{8}$/)) {
				throw customError(400, "Invalid booking reference format");
			}

			const booking = await Booking.findOne({
				booking_reference: reference.toUpperCase(),
				is_active: true,
			})
				.populate<any>({
					path: "package_id",
					select: "name price looks",
					populate: {
						path: "included_services",
						select: "name category is_available is_active",
					},
				})
				.populate<{ promo_id: PromoModel }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				});

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			const bookingResponse: BookingResponse = {
				id: String(booking._id),
				booking_reference: booking.booking_reference,
				customer_id: String(booking.customer_id),
				package: {
					id: String(booking.package_id._id),
					name: booking.package_id.name,
					price: booking.package_id.price,
					looks: booking.package_id.looks,
					included_services: booking.package_id.included_services.map(
						(service: any) => ({
							id: String(service._id),
							name: service.name,
							category: service.category,
						})
					),
				},
				promo: booking.promo_id
					? {
							id: String(booking.promo_id._id),
							promo_code: booking.promo_id.promo_code,
							discount_type: booking.promo_id.discount_type,
							discount_value: booking.promo_id.discount_value,
					  }
					: null,
				booking_date: booking.booking_date,
				start_time: booking.start_time,
				end_time: booking.end_time,
				location: booking.location,
				theme: booking.theme,
				special_requests: booking.special_requests,
				status: booking.status,
				total_amount: booking.total_amount,
				discount_amount: booking.discount_amount,
				final_amount: booking.final_amount,
				booking_confirmed_at: booking.booking_confirmed_at,
				booking_completed_at: booking.booking_completed_at,
				cancelled_reason: booking.cancelled_reason,
				rescheduled_from: booking.rescheduled_from,
				created_at: booking.created_at,
				updated_at: booking.updated_at,
				is_active: booking.is_active,
				created_by: booking.created_by,
				updated_by: booking.updated_by,
			};

			res.status(200).json({
				status: 200,
				message: "Booking fetched successfully!",
				data: bookingResponse,
			});
		} catch (error) {
			console.error("Error fetching booking by reference:", error);
			next(error);
		}
	}
);

export default router;
