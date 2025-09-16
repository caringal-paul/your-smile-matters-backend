import { Router, Request, NextFunction } from "express";
import { Promo, PromoModel } from "../../models/Promo";
import { Booking } from "../../models/Booking";
import mongoose from "mongoose";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";

const router = Router();

type ClientPromoResponse = {
	promo_code: string;
	name: string;
	description?: string | null;
	promo_type: string;
	discount_type: string;
	discount_value: number;
	min_advance_days?: number | null;
	min_booking_amount?: number | null;
	max_discount_amount?: number | null;
	valid_until: Date;
	conditions?: string | null;
	is_applicable: boolean;
	estimated_discount?: number | null;
	message?: string;
};

type AvailablePromoResponse = {
	promo_code: string;
	name: string;
	description?: string | null;
	promo_type: string;
	discount_type: string;
	discount_value: number;
	valid_until: Date;
	conditions?: string | null;
	badge?: string; // "LIMITED TIME", "EARLY BIRD", "SEASONAL", etc.
};

type PromoValidationResponse = {
	is_valid: boolean;
	message: string;
	discount_amount?: number;
	final_amount?: number;
	promo_details?: {
		promo_code: string;
		name: string;
		discount_type: string;
		discount_value: number;
	} | null;
};

// Helper function to get promo badge
const getPromoBadge = (promo: PromoModel): string => {
	const now = new Date();
	const timeLeft = promo.valid_until.getTime() - now.getTime();
	const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

	if (daysLeft <= 3) return "ENDING SOON";
	if (promo.promo_type === "Early_Bird") return "EARLY BIRD";
	if (promo.promo_type === "Seasonal") return "SEASONAL";
	if (promo.promo_type === "Special") return "LIMITED TIME";
	if (promo.usage_limit && promo.usage_limit - promo.usage_count <= 5)
		return "FEW LEFT";
	return "AVAILABLE";
};

// Helper function to calculate discount amount
const calculateDiscount = (
	promo: PromoModel,
	bookingAmount: number
): number => {
	let discount = 0;

	if (promo.discount_type === "Percentage") {
		discount = Math.round((bookingAmount * promo.discount_value) / 100);
	} else if (promo.discount_type === "Fixed_Amount") {
		discount = promo.discount_value;
	}

	// Apply max discount limit if set
	if (promo.max_discount_amount && discount > promo.max_discount_amount) {
		discount = promo.max_discount_amount;
	}

	return discount;
};

// Helper function to validate promo conditions
const validatePromoConditions = (
	promo: PromoModel,
	bookingAmount: number,
	bookingDate?: Date
): { isValid: boolean; message: string } => {
	const now = new Date();

	// Check if promo is active
	if (!promo.is_active) {
		return { isValid: false, message: "This promo code is no longer active" };
	}

	// Check validity period
	if (now < promo.valid_from || now > promo.valid_until) {
		return {
			isValid: false,
			message: "This promo code has expired or is not yet active",
		};
	}

	// Check usage limit
	if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
		return {
			isValid: false,
			message: "This promo code has reached its usage limit",
		};
	}

	// Check minimum booking amount
	if (promo.min_booking_amount && bookingAmount < promo.min_booking_amount) {
		return {
			isValid: false,
			message: `Minimum booking amount of ₱${promo.min_booking_amount.toLocaleString()} required for this promo`,
		};
	}

	// Check early bird conditions
	if (
		promo.promo_type === "Early_Bird" &&
		promo.min_advance_days &&
		bookingDate
	) {
		const daysDiff = Math.floor(
			(bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);
		if (daysDiff < promo.min_advance_days) {
			return {
				isValid: false,
				message: `This early bird promo requires booking at least ${promo.min_advance_days} days in advance`,
			};
		}
	}

	return { isValid: true, message: "Promo code is valid!" };
};

// GET /api/public/promos/available (Get all available promos)
router.get(
	"/available",
	async (
		req: Request,
		res: TypedResponse<AvailablePromoResponse[]>,
		next: NextFunction
	) => {
		try {
			const { promo_type } = req.query;
			const now = new Date();

			// Build filter for currently available promos
			const filter: any = {
				is_active: true,
				valid_from: { $lte: now },
				valid_until: { $gte: now },
				$expr: {
					$or: [
						{ $eq: ["$usage_limit", null] },
						{ $lt: ["$usage_count", "$usage_limit"] },
					],
				},
			};

			if (promo_type && promo_type !== "all") {
				filter.promo_type = promo_type;
			}

			const promos = await Promo.find(filter)
				.select(
					"promo_code name description promo_type discount_type discount_value valid_until conditions usage_count usage_limit"
				)
				.sort({ valid_until: 1, discount_value: -1 })
				.lean();

			const availablePromos: AvailablePromoResponse[] = promos.map((promo) => ({
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				valid_until: promo.valid_until,
				conditions: promo.conditions,
				badge: getPromoBadge(promo),
			}));

			res.status(200).json({
				status: 200,
				message: "Available promos fetched successfully!",
				data: availablePromos,
			});
		} catch (error) {
			console.error("Error fetching available promos:", error);
			next(error);
		}
	}
);

// POST /api/public/promos/validate (Validate promo code)
router.post(
	"/validate",
	async (
		req: Request,
		res: TypedResponse<PromoValidationResponse>,
		next: NextFunction
	) => {
		try {
			const { promo_code, booking_amount, booking_date } = req.body;

			if (!promo_code) {
				throw customError(400, "Promo code is required");
			}

			if (!booking_amount || booking_amount <= 0) {
				throw customError(400, "Valid booking amount is required");
			}

			// Find the promo
			const promo = await Promo.findOne({
				promo_code: promo_code.toUpperCase(),
			}).lean();

			if (!promo) {
				return res.status(200).json({
					status: 200,
					message: "Promo validation completed",
					data: {
						is_valid: false,
						message: "Invalid promo code",
						promo_details: null,
					},
				});
			}

			// Validate promo conditions
			const validation = validatePromoConditions(
				promo,
				booking_amount,
				booking_date ? new Date(booking_date) : undefined
			);

			if (!validation.isValid) {
				return res.status(200).json({
					status: 200,
					message: "Promo validation completed",
					data: {
						is_valid: false,
						message: validation.message,
						promo_details: null,
					},
				});
			}

			// Calculate discount
			const discountAmount = calculateDiscount(promo, booking_amount);
			const finalAmount = booking_amount - discountAmount;

			res.status(200).json({
				status: 200,
				message: "Promo validation completed",
				data: {
					is_valid: true,
					message: validation.message,
					discount_amount: discountAmount,
					final_amount: finalAmount,
					promo_details: {
						promo_code: promo.promo_code,
						name: promo.name,
						discount_type: promo.discount_type,
						discount_value: promo.discount_value,
					},
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// GET /api/public/promos/check/:promo_code (Quick promo code check)
router.get(
	"/check/:promo_code",
	async (
		req: Request,
		res: TypedResponse<ClientPromoResponse>,
		next: NextFunction
	) => {
		try {
			const { promo_code } = req.params;
			const { booking_amount, booking_date } = req.query;

			const promo = await Promo.findOne({
				promo_code: promo_code.toUpperCase(),
			})
				.select(
					"-created_by -updated_by -deleted_by -retrieved_by -deleted_at -retrieved_at -created_at -updated_at"
				)
				.lean();

			if (!promo) {
				throw customError(404, "Promo code not found");
			}

			// Basic validation
			const bookingAmountNum = booking_amount ? Number(booking_amount) : 0;
			const validation = validatePromoConditions(
				promo,
				bookingAmountNum,
				booking_date ? new Date(booking_date as string) : undefined
			);

			let estimatedDiscount = null;
			if (validation.isValid && bookingAmountNum > 0) {
				estimatedDiscount = calculateDiscount(promo, bookingAmountNum);
			}

			const clientPromoResponse: ClientPromoResponse = {
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				min_advance_days: promo.min_advance_days,
				min_booking_amount: promo.min_booking_amount,
				max_discount_amount: promo.max_discount_amount,
				valid_until: promo.valid_until,
				conditions: promo.conditions,
				is_applicable: validation.isValid,
				estimated_discount: estimatedDiscount,
				message: validation.message,
			};

			res.status(200).json({
				status: 200,
				message: "Promo details fetched successfully!",
				data: clientPromoResponse,
			});
		} catch (error) {
			console.error("Error checking promo code:", error);
			next(error);
		}
	}
);

// GET /api/public/promos/seasonal (Get current seasonal promos)
router.get(
	"/seasonal",
	async (
		req: Request,
		res: TypedResponse<AvailablePromoResponse[]>,
		next: NextFunction
	) => {
		try {
			const now = new Date();
			const currentMonth = now.getMonth() + 1; // 1-12

			// Define seasonal periods
			let seasonalFilter = {};
			if (currentMonth >= 12 || currentMonth <= 2) {
				// Christmas/New Year season
				seasonalFilter = {
					$or: [
						{ name: { $regex: /christmas|holiday|year|festive/i } },
						{ description: { $regex: /christmas|holiday|year|festive/i } },
					],
				};
			} else if (currentMonth >= 3 && currentMonth <= 5) {
				// Spring/Summer prep
				seasonalFilter = {
					$or: [
						{ name: { $regex: /spring|summer|graduation|wedding/i } },
						{ description: { $regex: /spring|summer|graduation|wedding/i } },
					],
				};
			} else if (currentMonth >= 6 && currentMonth <= 8) {
				// Summer season
				seasonalFilter = {
					$or: [
						{ name: { $regex: /summer|vacation|outdoor|beach/i } },
						{ description: { $regex: /summer|vacation|outdoor|beach/i } },
					],
				};
			} else {
				// Fall/Back to school
				seasonalFilter = {
					$or: [
						{ name: { $regex: /fall|autumn|back.to.school|halloween/i } },
						{
							description: { $regex: /fall|autumn|back.to.school|halloween/i },
						},
					],
				};
			}

			const filter = {
				is_active: true,
				valid_from: { $lte: now },
				valid_until: { $gte: now },
				$expr: {
					$or: [
						{ $eq: ["$usage_limit", null] },
						{ $lt: ["$usage_count", "$usage_limit"] },
					],
				},
				$or: [{ promo_type: "Seasonal" }, seasonalFilter],
			};

			const promos = await Promo.find(filter)
				.select(
					"promo_code name description promo_type discount_type discount_value valid_until conditions usage_count usage_limit"
				)
				.sort({ discount_value: -1 })
				.limit(5)
				.lean();

			const seasonalPromos: AvailablePromoResponse[] = promos.map((promo) => ({
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				valid_until: promo.valid_until,
				conditions: promo.conditions,
				badge: getPromoBadge(promo),
			}));

			res.status(200).json({
				status: 200,
				message: "Seasonal promos fetched successfully!",
				data: seasonalPromos,
			});
		} catch (error) {
			console.error("Error fetching seasonal promos:", error);
			next(error);
		}
	}
);

// GET /api/public/promos/early-bird (Get early bird promos)
router.get(
	"/early-bird",
	async (
		req: Request,
		res: TypedResponse<AvailablePromoResponse[]>,
		next: NextFunction
	) => {
		try {
			const now = new Date();

			const filter = {
				is_active: true,
				promo_type: "Early_Bird",
				valid_from: { $lte: now },
				valid_until: { $gte: now },
				$expr: {
					$or: [
						{ $eq: ["$usage_limit", null] },
						{ $lt: ["$usage_count", "$usage_limit"] },
					],
				},
			};

			const promos = await Promo.find(filter)
				.select(
					"promo_code name description promo_type discount_type discount_value valid_until conditions min_advance_days usage_count usage_limit"
				)
				.sort({ min_advance_days: -1, discount_value: -1 })
				.lean();

			const earlyBirdPromos: AvailablePromoResponse[] = promos.map((promo) => ({
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				valid_until: promo.valid_until,
				conditions: promo.conditions,
				badge: getPromoBadge(promo),
			}));

			res.status(200).json({
				status: 200,
				message: "Early bird promos fetched successfully!",
				data: earlyBirdPromos,
			});
		} catch (error) {
			console.error("Error fetching early bird promos:", error);
			next(error);
		}
	}
);

// GET /api/public/promos/special (Get special promos - limited time offers)
router.get(
	"/special",
	async (
		req: Request,
		res: TypedResponse<AvailablePromoResponse[]>,
		next: NextFunction
	) => {
		try {
			const now = new Date();

			const filter = {
				is_active: true,
				promo_type: "Special",
				valid_from: { $lte: now },
				valid_until: { $gte: now },
				$expr: {
					$or: [
						{ $eq: ["$usage_limit", null] },
						{ $lt: ["$usage_count", "$usage_limit"] },
					],
				},
			};

			const promos = await Promo.find(filter)
				.select(
					"promo_code name description promo_type discount_type discount_value valid_until conditions usage_count usage_limit"
				)
				.sort({
					// Prioritize: ending soon, then highest discount, then newest
					valid_until: 1,
					discount_value: -1,
					created_at: -1,
				})
				.lean();

			const specialPromos: AvailablePromoResponse[] = promos.map((promo) => ({
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				valid_until: promo.valid_until,
				conditions: promo.conditions,
				badge: getPromoBadge(promo),
			}));

			res.status(200).json({
				status: 200,
				message: "Special promos fetched successfully!",
				data: specialPromos,
			});
		} catch (error) {
			console.error("Error fetching special promos:", error);
			next(error);
		}
	}
);

// POST /api/public/promos/customer-eligible (Check customer eligibility for loyalty promos)
router.post(
	"/customer-eligible",
	async (
		req: Request,
		res: TypedResponse<AvailablePromoResponse[]>,
		next: NextFunction
	) => {
		try {
			const { customer_email, customer_phone } = req.body;

			if (!customer_email && !customer_phone) {
				throw customError(400, "Customer email or phone number is required");
			}

			// Find customer by email or phone
			const CustomerModel = mongoose.model("Customer");
			const customer = await CustomerModel.findOne({
				$or: [
					...(customer_email ? [{ email: customer_email }] : []),
					...(customer_phone ? [{ phone_number: customer_phone }] : []),
				],
			});

			if (!customer) {
				// Return empty array for new customers (no loyalty promos)
				return res.status(200).json({
					status: 200,
					message: "No customer found - showing general promos only",
					data: [],
				});
			}

			// Count customer's completed bookings for loyalty eligibility
			const completedBookings = await Booking.countDocuments({
				customer_id: customer._id,
				status: "Completed",
				is_active: true,
			});

			const now = new Date();

			// Get loyalty promos based on booking history
			let loyaltyFilter = {};
			if (completedBookings >= 10) {
				// VIP customer (10+ bookings)
				loyaltyFilter = { name: { $regex: /vip|platinum|premium/i } };
			} else if (completedBookings >= 5) {
				// Gold customer (5-9 bookings)
				loyaltyFilter = { name: { $regex: /gold|loyal|return/i } };
			} else if (completedBookings >= 2) {
				// Silver customer (2-4 bookings)
				loyaltyFilter = { name: { $regex: /silver|repeat|welcome.back/i } };
			} else {
				// New customer (1 booking)
				loyaltyFilter = {
					name: { $regex: /welcome|first.time|new.customer/i },
				};
			}

			const filter = {
				is_active: true,
				promo_type: "Loyalty",
				valid_from: { $lte: now },
				valid_until: { $gte: now },
				$expr: {
					$or: [
						{ $eq: ["$usage_limit", null] },
						{ $lt: ["$usage_count", "$usage_limit"] },
					],
				},
				...loyaltyFilter,
			};

			const promos = await Promo.find(filter)
				.select(
					"promo_code name description promo_type discount_type discount_value valid_until conditions usage_count usage_limit"
				)
				.sort({ discount_value: -1 })
				.lean();

			const eligiblePromos: AvailablePromoResponse[] = promos.map((promo) => ({
				promo_code: promo.promo_code,
				name: promo.name,
				description: promo.description,
				promo_type: promo.promo_type,
				discount_type: promo.discount_type,
				discount_value: promo.discount_value,
				valid_until: promo.valid_until,
				conditions: promo.conditions,
				badge: getPromoBadge(promo),
			}));

			res.status(200).json({
				status: 200,
				message: `Customer eligibility checked - ${completedBookings} completed bookings found`,
				data: eligiblePromos,
			});
		} catch (error) {
			console.error("Error checking customer eligibility:", error);
			next(error);
		}
	}
);

export default router;
