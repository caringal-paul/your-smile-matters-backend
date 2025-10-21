import { NextFunction, Router, Request } from "express";
import mongoose, { Types } from "mongoose";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authAmiMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import { Booking, BookingModel, BookingStatus } from "../../models/Booking";
import { Package, PackageModel } from "../../models/Package";
import { Promo, PromoModel } from "../../models/Promo";
import {
	PaymentMethod,
	Transaction,
	TransactionModel,
} from "../../models/Transaction";
import {
	authenticateCustomerToken,
	AuthenticatedCustomer,
	CustomerAuthenticatedRequest,
} from "../../middleware/authCustomerMiddleware";
import { renderBookingApprovalEmail } from "../../utils/generateEmailTemplate";
import { sendEmail } from "../../utils/emailSender";
import { DayOfWeek, PhotographerModel } from "../../models/Photographer";
import { ServiceModel } from "../../models/Service";
import { CustomerModel } from "../../models/Customer";

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
	customer_no: string;
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
	name: string;
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
	end_time: string;
	session_duration_minutes: number;
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
	photographer_notes?: string | null;
	client_rating?: number | null;
	photographer_rating?: number | null;
	is_active: boolean;
	created_by: Types.ObjectId;
	updated_by?: Types.ObjectId | null;
	deleted_by?: Types.ObjectId | null;
	retrieved_by?: Types.ObjectId | null;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
	created_at: Date;
	updated_at: Date;
}

export interface BookingServices {
	service_id: ServiceModel;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	duration_minutes?: number | null;
}

export interface PopulatedBooking
	extends Omit<
		BookingModel,
		"customer_id" | "package_id" | "photographer_id" | "promo_id" | "services"
	> {
	customer_id: CustomerModel;
	package_id?: PackageModel | null;
	photographer_id?: PhotographerModel | null;
	promo_id?: PromoModel | null;
	services: BookingServices[];
}

// Payment scenario type
export type PaymentScenario =
	| "fully_paid_no_refund"
	| "fully_paid_with_refund"
	| "partially_paid_no_refund"
	| "partially_paid_with_refund"
	| "refund_only"
	| "no_payment";

// Enhanced payment status interface
export interface EnhancedPaymentStatus {
	// Amounts
	total_price: number; // Final booking amount (after discount)
	total_refunded: number; // Total refunded amount
	amount_paid: number; // Actual revenue (payments - refunds)
	remaining_balance: number; // Outstanding balance to be paid

	// Status flags
	is_payment_complete: boolean; // Based on amount_paid
	is_partially_paid: boolean; // Based on amount_paid
	has_refund: boolean; // Quick check if there are any refunds

	// Payment scenario for UI logic
	payment_scenario: PaymentScenario;

	isBookingFinalized: boolean;

	// Transaction counts
	payment_count: number; // Number of completed payment transactions
	refund_count: number; // Number of completed refund transactions

	// All transactions for detailed view
	transactions: TransactionModel[];
}

// Booking with enhanced payment status
export interface GetBookingByIdResponse extends LeanPopulatedBooking {
	payment_status: EnhancedPaymentStatus;
}

const router = Router();

// POST endpoint
router.post(
	"/",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
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

			const customerId = req.customer?._id;
			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
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

			const bookingDateTime = new Date(booking_date);
			const now = new Date();

			// Normalize both to start of the day (ignore time)
			const bookingDateOnly = new Date(
				bookingDateTime.getFullYear(),
				bookingDateTime.getMonth(),
				bookingDateTime.getDate()
			);
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

			// Only reject if the booking date is before today
			if (bookingDateOnly < today) {
				throw customError(400, "Booking date cannot be in the past");
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
			let photographer = null;
			if (photographer_id) {
				const PhotographerModel = mongoose.model("Photographer");
				photographer = await PhotographerModel.findById(photographer_id);
				if (!photographer) {
					throw customError(404, "Photographer not found");
				}
				if (!photographer.is_active) {
					throw customError(400, "Photographer is not active");
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

			// ============================================================================
			// PHOTOGRAPHER AVAILABILITY VALIDATION
			// ============================================================================
			if (photographer_id && photographer) {
				// const requiredLeadTimeHours =
				// 	photographer.booking_lead_time_hours || 24;

				// // Calculate hours between now and the selected booking date/time
				// const hoursUntilBooking =
				// 	(bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

				// // Reject if the booking is made too close to the booking time
				// if (hoursUntilBooking < requiredLeadTimeHours) {
				// 	const daysRequired = Math.floor(requiredLeadTimeHours / 24);
				// 	const remainingHours = requiredLeadTimeHours % 24;

				// 	// Construct human-readable message (e.g. “1 day and 4 hours”)
				// 	const formatLeadTimeMessage = () => {
				// 		if (daysRequired > 0 && remainingHours > 0)
				// 			return `${daysRequired} day${
				// 				daysRequired > 1 ? "s" : ""
				// 			} and ${remainingHours} hour${remainingHours > 1 ? "s" : ""}`;
				// 		if (daysRequired > 0)
				// 			return `${daysRequired} day${daysRequired > 1 ? "s" : ""}`;
				// 		return `${requiredLeadTimeHours} hour${
				// 			requiredLeadTimeHours > 1 ? "s" : ""
				// 		}`;
				// 	};

				// 	const leadTimeMessage = formatLeadTimeMessage();

				// 	throw customError(
				// 		400,
				// 		`This photographer requires bookings to be made at least ${leadTimeMessage} in advance. Please select a date/time that is at least ${leadTimeMessage} from now.`
				// 	);
				// }

				// 2. GET DAY OF WEEK
				const dayOfWeek = bookingDateTime.toLocaleDateString("en-US", {
					weekday: "long",
				}) as DayOfWeek;

				// 3. CHECK DATE OVERRIDES (holidays, vacations, special events)
				let isAvailableOnDate = true;
				let workingHours = null;

				if (
					photographer.date_overrides &&
					photographer.date_overrides.length > 0
				) {
					const override = photographer.date_overrides.find((o: any) => {
						const overrideDate = new Date(o.date);
						return (
							overrideDate.getFullYear() === bookingDateTime.getFullYear() &&
							overrideDate.getMonth() === bookingDateTime.getMonth() &&
							overrideDate.getDate() === bookingDateTime.getDate()
						);
					});

					if (override) {
						if (!override.is_available) {
							const reason = override.reason || "unavailable";
							throw customError(
								400,
								`Photographer is not available on this date (${reason}). Please choose another date.`
							);
						}

						// Use custom hours if provided (e.g., overtime hours)
						if (override.custom_hours) {
							workingHours = override.custom_hours;
						}
					}
				}

				// 4. CHECK REGULAR WEEKLY SCHEDULE (if no custom hours from override)
				if (!workingHours) {
					const scheduleForDay = photographer.weekly_schedule?.find(
						(s: any) => s.day_of_week === dayOfWeek
					);

					if (!scheduleForDay || !scheduleForDay.is_available) {
						throw customError(
							400,
							`Photographer is not available on ${dayOfWeek}s. Please choose another day.`
						);
					}

					workingHours = {
						start_time: scheduleForDay.start_time,
						end_time: scheduleForDay.end_time,
					};
				}

				// 5. VALIDATE BOOKING TIME IS WITHIN WORKING HOURS
				const [startHour, startMin] = start_time.split(":").map(Number);
				const [workStartHour, workStartMin] = workingHours.start_time
					.split(":")
					.map(Number);
				const [workEndHour, workEndMin] = workingHours.end_time
					.split(":")
					.map(Number);

				const bookingStartMinutes = startHour * 60 + startMin;
				const workStartMinutes = workStartHour * 60 + workStartMin;
				const workEndMinutes = workEndHour * 60 + workEndMin;

				// Calculate session duration
				const calculatedDuration =
					session_duration_minutes ||
					services.reduce(
						(total, s) => total + (s.duration_minutes || 60) * s.quantity,
						0
					);

				const bookingEndMinutes = bookingStartMinutes + calculatedDuration;

				if (
					bookingStartMinutes < workStartMinutes ||
					bookingEndMinutes > workEndMinutes
				) {
					throw customError(
						400,
						`Booking time (${start_time} - ${Math.floor(
							bookingEndMinutes / 60
						)}:${String(bookingEndMinutes % 60).padStart(
							2,
							"0"
						)}) is outside photographer's working hours (${
							workingHours.start_time
						} - ${workingHours.end_time}).`
					);
				}

				// 6. CHECK FOR CONFLICTING BOOKINGS
				const startOfDay = new Date(bookingDateTime);
				startOfDay.setHours(0, 0, 0, 0);
				const endOfDay = new Date(bookingDateTime);
				endOfDay.setHours(23, 59, 59, 999);

				const conflictingBookings = await Booking.find({
					photographer_id: new Types.ObjectId(photographer_id),
					booking_date: {
						$gte: startOfDay,
						$lte: endOfDay,
					},
					status: { $nin: ["Cancelled", "Rejected", "Completed"] },
					is_active: true,
				}).select("start_time session_duration_minutes");

				for (const existingBooking of conflictingBookings) {
					const [existingStartHour, existingStartMin] =
						existingBooking.start_time.split(":").map(Number);
					const existingStartMinutes =
						existingStartHour * 60 + existingStartMin;
					const existingEndMinutes =
						existingStartMinutes +
						(existingBooking.session_duration_minutes || 120);

					// Check for overlap
					const hasOverlap =
						bookingStartMinutes < existingEndMinutes &&
						bookingEndMinutes > existingStartMinutes;

					if (hasOverlap) {
						const existingEndHour = Math.floor(existingEndMinutes / 60);
						const existingEndMin = existingEndMinutes % 60;
						throw customError(
							400,
							`Photographer is already booked from ${
								existingBooking.start_time
							} to ${existingEndHour}:${String(existingEndMin).padStart(
								2,
								"0"
							)}. Please choose a different time slot.`
						);
					}
				}
			}

			// Transform services array to match schema
			const transformedServices = services.map((service) => {
				console.log("SERVICE!!", service);

				return {
					service_id: new Types.ObjectId(service._id),
					quantity: service.quantity,
					price_per_unit: service.price_per_unit,
					total_price: service.total_price,
					duration_minutes: service.duration_minutes || null,
				};
			});

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
				is_active: true,
				created_by: new Types.ObjectId(customer_id),
				updated_by: new Types.ObjectId(customer_id),
			});

			await booking.save();

			const populatedBooking = await Booking.findById(booking._id)
				.populate<{ customer_id: PopulatedCustomer }>({
					path: "customer_id",
					select: "customer_no first_name last_name email phone_number",
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
					select: "name category price duration_minutes",
				})
				.lean<LeanPopulatedBooking>();

			if (!populatedBooking) {
				throw customError(500, "Failed to retrieve created booking");
			}

			const emailHtml = renderBookingApprovalEmail({
				firstName: populatedBooking.customer_id.first_name,
				lastName: populatedBooking.customer_id.last_name,
				customerNo: populatedBooking.customer_id.customer_no.toString(),
				email: populatedBooking.customer_id.email,
				bookingNo: populatedBooking.booking_reference.toString(),
				companyName: "Your Smile Matters",
				supportEmail: "ysmphotography@yopmail.com",
			});

			await sendEmail({
				to: populatedBooking.customer_id.email,
				subject: "Your Booking is Pending Approval",
				html: emailHtml,
			});

			res.status(201).json({
				status: 201,
				message: "Booking created successfully! Approval email sent.",
				data: populatedBooking,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET all bookings for authenticated customer
router.get(
	"/",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<PopulatedBooking[]>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			// Optional query parameters for filtering
			const { status, sort = "-created_at" } = req.query;

			// Build filter query
			const filter: any = {
				customer_id: new Types.ObjectId(customerId),
				is_active: true,
			};

			// Add status filter if provided
			if (status && typeof status === "string") {
				const validStatuses: BookingStatus[] = [
					"Pending",
					"Confirmed",
					"Ongoing",
					"Completed",
					"Cancelled",
					"Rescheduled",
				];
				if (validStatuses.includes(status as BookingStatus)) {
					filter.status = status;
				}
			}

			// ✅ Apply the filter and sort order here
			const bookings = await Booking.find(filter)
				.sort(sort)
				.populate({
					path: "customer_id",
					select:
						"-created_by -updated_by -deleted_by -deleted_at -retrieved_by -retrieved_at -__v",
				})
				.populate({
					path: "package_id",
					select:
						"-services -created_by -updated_by -deleted_by -deleted_at -retrieved_by -retrieved_at -__v",
				})
				.populate({
					path: "photographer_id",
					select:
						"-created_by -updated_by -deleted_by -deleted_at -retrieved_by -retrieved_at -__v",
				})
				.populate({
					path: "promo_id",
					select:
						"-created_by -updated_by -deleted_by -deleted_at -retrieved_by -retrieved_at -__v",
				})
				.populate({
					path: "services.service_id",
					select:
						"-created_by -updated_by -deleted_by -deleted_at -retrieved_by -retrieved_at -__v",
				})
				.lean<PopulatedBooking[]>();

			res.status(200).json({
				status: 200,
				message: `Retrieved ${bookings.length} booking${
					bookings.length !== 1 ? "s" : ""
				} successfully`,
				data: bookings,
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET single booking by ID for authenticated customer
router.get(
	"/:id",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<GetBookingByIdResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			// Find the booking
			const booking = await Booking.findById(id)
				.populate("customer_id")
				.populate("package_id", "-services")
				.populate("photographer_id")
				.populate("promo_id")
				.populate("services.service_id")
				.lean<LeanPopulatedBooking | null>();

			if (!booking) {
				throw customError(404, "Booking not found");
			}

			// Find all related transactions by booking_id for display
			const transactions = await Transaction.find({
				booking_id: id,
				is_active: true,
			})
				.sort({ transaction_date: 1 })
				.lean<TransactionModel[]>();

			// Separate completed transactions by type
			const completedTransactions = transactions.filter(
				(txn) => txn.status === "Completed"
			);

			// Calculate total payments (excluding refunds)
			const total_payments = completedTransactions
				.filter((txn) => txn.transaction_type !== "Refund")
				.reduce((total, txn) => total + (txn.amount || 0), 0);

			// Calculate total refunds
			const total_refunded = completedTransactions
				.filter((txn) => txn.transaction_type === "Refund")
				.reduce((total, txn) => total + (txn.amount || 0), 0);

			// Calculate amount paid (total payments received before refunds)
			const amount_paid = total_payments;

			// Calculate final amounts
			const total_price = booking.final_amount || 0; // Use final_amount (after discount)

			const isBookingFinalized = ["Completed", "Cancelled"].includes(
				booking.status
			);

			const remaining_balance = isBookingFinalized
				? 0
				: Math.max(total_price - amount_paid, 0);

			// Determine payment completion status based on net revenue
			const is_payment_complete = amount_paid >= total_price;
			const is_partially_paid = amount_paid > 0 && amount_paid < total_price;

			// Determine payment scenario for frontend logic
			let payment_scenario:
				| "fully_paid_no_refund"
				| "fully_paid_with_refund"
				| "partially_paid_no_refund"
				| "partially_paid_with_refund"
				| "refund_only"
				| "no_payment";

			if (isBookingFinalized && booking.status === "Completed") {
				payment_scenario =
					total_refunded > 0
						? "fully_paid_with_refund"
						: "fully_paid_no_refund";
			} else {
				if (total_payments === 0 && total_refunded === 0) {
					payment_scenario = "no_payment";
				} else if (total_payments === 0 && total_refunded > 0) {
					payment_scenario = "refund_only";
				} else if (is_payment_complete && total_refunded === 0) {
					payment_scenario = "fully_paid_no_refund";
				} else if (is_payment_complete && total_refunded > 0) {
					payment_scenario = "fully_paid_with_refund";
				} else if (is_partially_paid && total_refunded === 0) {
					payment_scenario = "partially_paid_no_refund";
				} else {
					payment_scenario = "partially_paid_with_refund";
				}
			}

			const payment_status = {
				// Amounts
				total_price, // Final booking amount (after discount)
				total_refunded, // Total refunded amount
				amount_paid, // Actual revenue (payments - refunds)
				remaining_balance, // Outstanding balance

				// Status flags
				is_payment_complete: is_payment_complete,
				is_partially_paid: is_partially_paid,
				has_refund: total_refunded > 0,

				// Payment scenario for UI logic
				payment_scenario,
				isBookingFinalized,

				// Transaction breakdown
				payment_count: completedTransactions.filter(
					(txn) => txn.transaction_type !== "Refund"
				).length,
				refund_count: completedTransactions.filter(
					(txn) => txn.transaction_type === "Refund"
				).length,

				// All transactions for detailed view
				transactions,
			};

			// Merge and preserve existing fields
			const result: GetBookingByIdResponse = {
				...booking,
				payment_status,
			};

			res.status(200).json({
				status: 200,
				message: "Retrieved booking with payment details successfully",
				data: result,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
