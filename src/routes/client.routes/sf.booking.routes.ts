import { NextFunction, Router } from "express";
import mongoose, { Types } from "mongoose";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import { Booking, BookingStatus } from "../../models/Booking";
import { Package } from "../../models/Package";
import { Promo } from "../../models/Promo";
import { PaymentMethod } from "../../models/Transaction";

// Types for the endpoint
interface CreateBookingRequestBody {
	customer_id: string;
	package_id?: string | null;
	photographer_id?: string | null;
	promo_id?: string | null;
	services: {
		_id: string;
		quantity: number;
		price_per_unit: number;
		total_price: number;
		duration_minutes?: number | null;
	}[];
	is_customized: boolean;
	customization_notes?: string | null;
	booking_date: string;
	start_time: string;
	end_time?: string | null;
	session_duration_minutes?: number;
	location: string;
	theme?: string | null;
	special_requests?: string | null;
	total_amount: number;
	discount_amount?: number;
	final_amount: number;
	amount_paid?: number;
	method_of_payment?: PaymentMethod | null;
	payment_images?: string[];
}

interface PopulatedCustomer {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
	phone_number?: string;
}

interface PopulatedPackage {
	_id: Types.ObjectId;
	package_name: string;
	package_price: number;
	description?: string;
	is_available: boolean;
}

interface PopulatedPhotographer {
	_id: Types.ObjectId;
	first_name: string;
	last_name: string;
	email: string;
	specialization?: string;
}

interface PopulatedPromo {
	_id: Types.ObjectId;
	promo_code: string;
	discount_type: string;
	discount_value: number;
}

interface PopulatedService {
	_id: Types.ObjectId;
	service_name: string;
	category: string;
	price: number;
	duration_minutes?: number;
}

interface PopulatedBookingService {
	service_id: PopulatedService;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	duration_minutes?: number | null;
	_id: Types.ObjectId;
}

interface LeanPopulatedBooking {
	_id: Types.ObjectId;
	booking_reference: string;
	customer_id: PopulatedCustomer;
	package_id?: PopulatedPackage | null;
	photographer_id?: PopulatedPhotographer | null;
	promo_id?: PopulatedPromo | null;
	services: PopulatedBookingService[];
	is_customized: boolean;
	customization_notes?: string | null;
	booking_date: Date;
	start_time: string;
	end_time?: string | null;
	session_duration_minutes: number;
	location: string;
	theme?: string | null;
	special_requests?: string | null;
	status: BookingStatus;
	total_amount: number;
	discount_amount: number;
	final_amount: number;
	amount_paid: number;
	method_of_payment?: PaymentMethod | null;
	payment_images: string[];
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
	is_active: boolean;
	created_by: Types.ObjectId;
	updated_by: Types.ObjectId;
	deleted_by?: Types.ObjectId | null;
	retrieved_by?: Types.ObjectId | null;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
	created_at: Date;
	updated_at: Date;
}

const router = Router();

// POST endpoint
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<LeanPopulatedBooking>,
		next: NextFunction
	) => {
		try {
			const {
				customer_id,
				package_id,
				promo_id,
				booking_date,
				start_time,
				end_time,
				session_duration_minutes,
				location,
				theme,
				special_requests,
				services,
				is_customized,
				customization_notes,
				photographer_id,
				total_amount,
				discount_amount,
				final_amount,
				amount_paid,
				method_of_payment,
				payment_images,
			} = req.body as CreateBookingRequestBody;

			const userId = req.user?._id;
			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// Validate required fields
			if (!customer_id || !booking_date || !start_time || !location) {
				throw customError(
					400,
					"Customer, booking date, start time, and location are required"
				);
			}

			// Validate services array
			if (!services || !Array.isArray(services) || services.length === 0) {
				throw customError(400, "At least one service is required for booking");
			}

			// Validate ObjectIds
			if (!mongoose.Types.ObjectId.isValid(customer_id)) {
				throw customError(400, "Invalid customer ID format");
			}
			if (package_id && !mongoose.Types.ObjectId.isValid(package_id)) {
				throw customError(400, "Invalid package ID format");
			}
			if (
				photographer_id &&
				!mongoose.Types.ObjectId.isValid(photographer_id)
			) {
				throw customError(400, "Invalid photographer ID format");
			}
			if (promo_id && !mongoose.Types.ObjectId.isValid(promo_id)) {
				throw customError(400, "Invalid promo ID format");
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

			// Validate services structure
			for (const service of services) {
				if (!service._id || !mongoose.Types.ObjectId.isValid(service._id)) {
					throw customError(400, "Invalid service ID format in services array");
				}
				if (!service.quantity || service.quantity < 1) {
					throw customError(400, "Service quantity must be at least 1");
				}
				if (
					service.price_per_unit === undefined ||
					service.price_per_unit < 0
				) {
					throw customError(400, "Invalid price_per_unit in services");
				}
				if (service.total_price === undefined || service.total_price < 0) {
					throw customError(400, "Invalid total_price in services");
				}
			}

			// Check if customer exists
			const CustomerModel = mongoose.model("Customer");
			const customer = await CustomerModel.findById(customer_id);
			if (!customer) {
				throw customError(404, "Customer not found");
			}

			// Validate package if provided (optional)
			if (package_id) {
				const selectedPackage = await Package.findById(package_id);
				if (!selectedPackage) {
					throw customError(404, "Package not found");
				}
				if (!selectedPackage.is_available || !selectedPackage.is_active) {
					throw customError(400, "Selected package is not available");
				}
			}

			// Validate photographer if provided
			if (photographer_id) {
				const PhotographerModel = mongoose.model("Photographer");
				const photographer = await PhotographerModel.findById(photographer_id);
				if (!photographer) {
					throw customError(404, "Photographer not found");
				}
			}

			// Validate promo if provided
			if (promo_id) {
				const promo = await Promo.findById(promo_id);
				if (!promo) {
					throw customError(404, "Promo not found");
				}
				if (!promo.is_active) {
					throw customError(400, "Promo is not active");
				}
				const currentDate = new Date();
				if (promo.valid_from > currentDate || promo.valid_until < currentDate) {
					throw customError(400, "Promo is not valid for this date");
				}
			}

			// Check if photographer is available at the requested time
			if (photographer_id) {
				const conflictingBooking = await Booking.findOne({
					photographer_id: new Types.ObjectId(photographer_id),
					booking_date: {
						$gte: new Date(bookingDateTime.setHours(0, 0, 0, 0)),
						$lt: new Date(bookingDateTime.setHours(23, 59, 59, 999)),
					},
					start_time: start_time,
					status: { $nin: ["Cancelled", "Completed"] },
					is_active: true,
				});

				if (conflictingBooking) {
					throw customError(
						400,
						"Photographer is not available at this time slot"
					);
				}
			}

			// Transform services array to match schema
			const transformedServices = services.map((service) => ({
				service_id: new Types.ObjectId(service._id),
				quantity: service.quantity,
				price_per_unit: service.price_per_unit,
				total_price: service.total_price,
				duration_minutes: service.duration_minutes || null,
			}));

			// Create booking
			const booking = new Booking({
				customer_id: new Types.ObjectId(customer_id),
				package_id: package_id ? new Types.ObjectId(package_id) : null,
				photographer_id: photographer_id
					? new Types.ObjectId(photographer_id)
					: null,
				promo_id: promo_id ? new Types.ObjectId(promo_id) : null,
				services: transformedServices,
				is_customized: is_customized || false,
				customization_notes: customization_notes?.trim() || null,
				booking_date: bookingDateTime,
				start_time,
				end_time: end_time || null,
				session_duration_minutes:
					session_duration_minutes ||
					transformedServices.reduce(
						(total, s) => total + (s.duration_minutes || 60) * s.quantity,
						0
					),
				location: location.trim(),
				theme: theme?.trim() || null,
				special_requests: special_requests?.trim() || null,
				status: "Pending",
				total_amount: total_amount,
				discount_amount: discount_amount || 0,
				final_amount: final_amount,
				amount_paid: amount_paid || 0,
				method_of_payment: method_of_payment || null,
				payment_images: payment_images || [],
				is_active: true,
				created_by: new Types.ObjectId(userId),
				updated_by: new Types.ObjectId(userId),
			});

			await booking.save();

			// Populate for response
			const populatedBooking = await Booking.findById(booking._id)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "first_name last_name email phone_number",
				})
				.populate<{ package_id: PopulatedPackage }>({
					path: "package_id",
					select: "package_name package_price description is_available",
				})
				.populate<{ photographer_id: PopulatedPhotographer }>({
					path: "photographer_id",
					select: "first_name last_name email specialization",
				})
				.populate<{ promo_id: PopulatedPromo }>({
					path: "promo_id",
					select: "promo_code discount_type discount_value",
				})
				.populate<{ services: PopulatedBookingService[] }>({
					path: "services.service_id",
					select: "service_name category price duration_minutes",
				})
				.lean<LeanPopulatedBooking>();

			if (!populatedBooking) {
				throw customError(500, "Failed to retrieve created booking");
			}

			res.status(201).json({
				status: 201,
				message: "Booking created successfully!",
				data: populatedBooking,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
