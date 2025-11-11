import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Rating, RatableType } from "../../models/Rating";
import { Booking, BookingModel } from "../../models/Booking";
import { Service } from "../../models/Service";
import { Package } from "../../models/Package";
import {
	authenticateCustomerToken,
	CustomerAuthenticatedRequest,
} from "../../middleware/authCustomerMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import { CustomerModel } from "../../models/Customer";
import { UserModel } from "../../models/User";

const router = Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PopulatedRatable {
	_id: Types.ObjectId;
	name: string;
	description?: string;
	price?: number;
	package_price?: number;
}

type PopulatedRating = Omit<
	{
		_id: Types.ObjectId;
		booking_id: Types.ObjectId;
		customer_id: Types.ObjectId;
		ratable_type: RatableType;
		ratable_id: Types.ObjectId;
		rating: number;
		comment?: string | null;
		response?: string | null;
		responded_at?: Date | null;
		responded_by?: Types.ObjectId | null;
		created_at: Date;
		updated_at: Date;
		is_active: boolean;
	},
	"booking_id" | "customer_id" | "ratable_id" | "responded_by"
> & {
	booking_id: BookingModel;
	customer_id: CustomerModel;
	ratable_id: PopulatedRatable;
	responded_by?: UserModel | null;
};

interface CreateRatingBody {
	booking_id: string;
	ratable_type: RatableType;
	ratable_id: string;
	rating: number;
	comment?: string;
}

interface UpdateRatingBody {
	rating?: number;
	comment?: string;
}

interface RatingAnalytics {
	total_ratings: number;
	average_rating: number;
	rating_percentage: number;
	rating_distribution: {
		one_star: number;
		two_star: number;
		three_star: number;
		four_star: number;
		five_star: number;
	};
	rating_distribution_percentage: {
		one_star: number;
		two_star: number;
		three_star: number;
		four_star: number;
		five_star: number;
	};
	total_with_comments: number;
	total_with_responses: number;
}

// ============================================================================
// POPULATION CONFIG
// ============================================================================

const ratingPopulation = [
	{
		path: "booking_id",
	},
	{
		path: "customer_id",
	},
	{
		path: "ratable_id",
	},
	{
		path: "responded_by",
	},
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateRatingAnalytics(ratings: PopulatedRating[]): RatingAnalytics {
	const total_ratings = ratings.length;

	const average_rating =
		total_ratings > 0
			? ratings.reduce((sum, r) => sum + r.rating, 0) / total_ratings
			: 0;

	// Convert to percentage (0-100%)
	const rating_percentage = total_ratings > 0 ? (average_rating / 5) * 100 : 0;

	const rating_distribution = {
		one_star: ratings.filter((r) => r.rating === 1).length,
		two_star: ratings.filter((r) => r.rating === 2).length,
		three_star: ratings.filter((r) => r.rating === 3).length,
		four_star: ratings.filter((r) => r.rating === 4).length,
		five_star: ratings.filter((r) => r.rating === 5).length,
	};

	// Percentage distribution
	const rating_distribution_percentage = {
		one_star:
			total_ratings > 0
				? (rating_distribution.one_star / total_ratings) * 100
				: 0,
		two_star:
			total_ratings > 0
				? (rating_distribution.two_star / total_ratings) * 100
				: 0,
		three_star:
			total_ratings > 0
				? (rating_distribution.three_star / total_ratings) * 100
				: 0,
		four_star:
			total_ratings > 0
				? (rating_distribution.four_star / total_ratings) * 100
				: 0,
		five_star:
			total_ratings > 0
				? (rating_distribution.five_star / total_ratings) * 100
				: 0,
	};

	const total_with_comments = ratings.filter(
		(r) => r.comment && r.comment.trim().length > 0
	).length;

	const total_with_responses = ratings.filter(
		(r) => r.response && r.response.trim().length > 0
	).length;

	return {
		total_ratings,
		average_rating: Math.round(average_rating * 10) / 10,
		rating_percentage: Math.round(rating_percentage * 10) / 10,
		rating_distribution,
		rating_distribution_percentage: {
			one_star: Math.round(rating_distribution_percentage.one_star * 10) / 10,
			two_star: Math.round(rating_distribution_percentage.two_star * 10) / 10,
			three_star:
				Math.round(rating_distribution_percentage.three_star * 10) / 10,
			four_star: Math.round(rating_distribution_percentage.four_star * 10) / 10,
			five_star: Math.round(rating_distribution_percentage.five_star * 10) / 10,
		},
		total_with_comments,
		total_with_responses,
	};
}

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/ratings
 * @desc    Customer creates a rating for a completed booking
 * @access  Customer
 */
router.post(
	"/",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{}, {}, CreateRatingBody>,
		res: TypedResponse<PopulatedRating>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;
			const { booking_id, ratable_type, ratable_id, rating, comment } =
				req.body;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			// Validate required fields
			if (!booking_id || !ratable_type || !ratable_id || !rating) {
				throw customError(
					400,
					"Booking ID, ratable type, ratable ID, and rating are required"
				);
			}

			// Validate ObjectId formats
			if (!mongoose.Types.ObjectId.isValid(booking_id)) {
				throw customError(400, "Invalid booking ID format");
			}
			if (!mongoose.Types.ObjectId.isValid(ratable_id)) {
				throw customError(400, "Invalid ratable ID format");
			}

			// Validate rating value
			if (rating < 1 || rating > 5) {
				throw customError(400, "Rating must be between 1 and 5");
			}

			// Validate ratable type
			if (!Object.values(RatableType).includes(ratable_type)) {
				throw customError(400, "Invalid ratable type");
			}

			// Check if booking exists and belongs to customer
			const booking = await Booking.findById(booking_id);
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			if (booking.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You can only rate your own bookings");
			}

			// Only allow rating for completed bookings
			if (booking.status !== "Completed") {
				throw customError(
					400,
					`Cannot rate booking with status: ${booking.status}. Only completed bookings can be rated.`
				);
			}

			// Verify ratable exists
			let ratableExists = false;
			if (ratable_type === RatableType.SERVICE) {
				const service = await Service.findById(ratable_id);
				ratableExists = !!service;
			} else if (ratable_type === RatableType.PACKAGE) {
				const pkg = await Package.findById(ratable_id);
				ratableExists = !!pkg;
			}

			if (!ratableExists) {
				throw customError(404, `${ratable_type} not found`);
			}

			// Check for existing rating
			const existingRating = await Rating.findOne({
				booking_id: new Types.ObjectId(booking_id),
				ratable_type,
				ratable_id: new Types.ObjectId(ratable_id),
				is_active: true,
			});

			if (existingRating) {
				throw customError(
					400,
					"You have already rated this item for this booking"
				);
			}

			// Create rating
			const newRating = new Rating({
				booking_id: new Types.ObjectId(booking_id),
				customer_id: new Types.ObjectId(customerId),
				ratable_type,
				ratable_id: new Types.ObjectId(ratable_id),
				rating,
				comment: comment?.trim() || null,
				created_by: new Types.ObjectId(customerId),
			});

			await newRating.save();

			// Populate and return
			const populatedRating = await Rating.findById(newRating._id)
				.populate(ratingPopulation)
				.lean<PopulatedRating>();

			if (!populatedRating) {
				throw customError(500, "Failed to retrieve created rating");
			}

			res.status(201).json({
				status: 201,
				message: "Rating submitted successfully!",
				data: populatedRating,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/ratings/my-ratings
 * @desc    Get all ratings by the logged-in customer
 * @access  Customer
 */
router.get(
	"/my-ratings",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<PopulatedRating[]>,
		next: NextFunction
	) => {
		try {
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			const ratings = await Rating.find({
				customer_id: new Types.ObjectId(customerId),
				is_active: true,
			})
				.populate(ratingPopulation)
				.sort({ created_at: -1 })
				.lean<PopulatedRating[]>();

			res.status(200).json({
				status: 200,
				message: "Your ratings retrieved successfully",
				data: ratings,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   PUT /api/ratings/:id
 * @desc    Customer updates their own rating
 * @access  Customer
 */
router.put(
	"/:id",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{ id: string }, {}, UpdateRatingBody>,
		res: TypedResponse<PopulatedRating>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const customerId = req.customer?._id;
			const { rating, comment } = req.body;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID format");
			}

			// Validate rating if provided
			if (rating !== undefined && (rating < 1 || rating > 5)) {
				throw customError(400, "Rating must be between 1 and 5");
			}

			// Find existing rating
			const existingRating = await Rating.findById(id);
			if (!existingRating) {
				throw customError(404, "Rating not found");
			}

			// Check ownership
			if (existingRating.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You can only update your own ratings");
			}

			// Update rating
			const updateData: Partial<{
				rating: number;
				comment: string | null;
				updated_by: Types.ObjectId;
			}> = {
				updated_by: new Types.ObjectId(customerId),
			};

			if (rating !== undefined) updateData.rating = rating;
			if (comment !== undefined) updateData.comment = comment.trim() || null;

			const updatedRating = await Rating.findByIdAndUpdate(id, updateData, {
				new: true,
				runValidators: true,
			})
				.populate(ratingPopulation)
				.lean<PopulatedRating>();

			if (!updatedRating) {
				throw customError(500, "Failed to update rating");
			}

			res.status(200).json({
				status: 200,
				message: "Rating updated successfully!",
				data: updatedRating,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   DELETE /api/ratings/:id
 * @desc    Customer deletes their own rating (soft delete)
 * @access  Customer
 */
router.delete(
	"/:id",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest<{ id: string }>,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const customerId = req.customer?._id;

			if (!customerId) {
				throw customError(400, "No customer id found. Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID format");
			}

			const existingRating = await Rating.findById(id);
			if (!existingRating) {
				throw customError(404, "Rating not found");
			}

			if (existingRating.customer_id.toString() !== customerId.toString()) {
				throw customError(403, "You can only delete your own ratings");
			}

			await Rating.findByIdAndUpdate(id, {
				is_active: false,
				deleted_by: new Types.ObjectId(customerId),
				deleted_at: new Date(),
			});

			res.status(200).json({
				status: 200,
				message: "Rating deleted successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/ratings/service/:serviceId
 * @desc    Get all ratings for a specific service (public)
 * @access  Public
 */
router.get(
	"/service/:serviceId",
	async (
		req: CustomerAuthenticatedRequest<{ serviceId: string }>,
		res: TypedResponse<{
			ratings: PopulatedRating[];
			analytics: RatingAnalytics;
		}>,
		next: NextFunction
	) => {
		try {
			const { serviceId } = req.params;

			if (!mongoose.Types.ObjectId.isValid(serviceId)) {
				throw customError(400, "Invalid service ID format");
			}

			// Verify service exists
			const service = await Service.findById(serviceId);
			if (!service) {
				throw customError(404, "Service not found");
			}

			const ratings = await Rating.find({
				ratable_type: RatableType.SERVICE,
				ratable_id: new Types.ObjectId(serviceId),
				is_active: true,
			})
				.populate(ratingPopulation)
				.sort({ created_at: -1 })
				.lean<PopulatedRating[]>();

			// Calculate analytics
			const analytics = calculateRatingAnalytics(ratings);

			res.status(200).json({
				status: 200,
				message: "Service ratings retrieved successfully",
				data: { ratings, analytics },
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/ratings/package/:packageId
 * @desc    Get all ratings for a specific package (public)
 * @access  Public
 */
router.get(
	"/package/:packageId",
	async (
		req: CustomerAuthenticatedRequest<{ packageId: string }>,
		res: TypedResponse<{
			ratings: PopulatedRating[];
			analytics: RatingAnalytics;
		}>,
		next: NextFunction
	) => {
		try {
			const { packageId } = req.params;

			if (!mongoose.Types.ObjectId.isValid(packageId)) {
				throw customError(400, "Invalid package ID format");
			}

			// Verify package exists
			const pkg = await Package.findById(packageId);
			if (!pkg) {
				throw customError(404, "Package not found");
			}

			const ratings = await Rating.find({
				ratable_type: RatableType.PACKAGE,
				ratable_id: new Types.ObjectId(packageId),
				is_active: true,
			})
				.populate(ratingPopulation)
				.sort({ created_at: -1 })
				.lean<PopulatedRating[]>();

			// Calculate analytics
			const analytics = calculateRatingAnalytics(ratings);

			res.status(200).json({
				status: 200,
				message: "Package ratings retrieved successfully",
				data: { ratings, analytics },
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/ratings/booking/:bookingId
 * @desc    Get all ratings for a specific booking (services and packages)
 * @access  Public/Authenticated (depending on your requirements)
 */
router.get(
	"/booking/:bookingId",
	async (
		req: CustomerAuthenticatedRequest<{ bookingId: string }>,
		res: TypedResponse<{
			ratings: PopulatedRating[];
			analytics: RatingAnalytics;
		}>,
		next: NextFunction
	) => {
		try {
			const { bookingId } = req.params;

			if (!mongoose.Types.ObjectId.isValid(bookingId)) {
				throw customError(400, "Invalid booking ID format");
			}

			// Verify booking exists
			const booking = await Booking.findById(bookingId);
			if (!booking) {
				throw customError(404, "Booking not found");
			}

			// Find all ratings for this booking (both services and packages)
			const ratings = await Rating.find({
				booking_id: new Types.ObjectId(bookingId),
				is_active: true,
			})
				.populate(ratingPopulation)
				.sort({ created_at: -1 })
				.lean<PopulatedRating[]>();

			// Calculate analytics
			const analytics = calculateRatingAnalytics(ratings);

			res.status(200).json({
				status: 200,
				message: "Booking ratings retrieved successfully",
				data: { ratings, analytics },
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
