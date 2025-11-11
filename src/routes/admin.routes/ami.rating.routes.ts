import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Rating, RatableType } from "../../models/Rating";
import { Service, ServiceModel } from "../../models/Service";
import { Package, PackageModel } from "../../models/Package";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authAmiMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import { UserModel } from "../../models/User";
import { CustomerModel } from "../../models/Customer";
import { BookingModel } from "../../models/Booking";

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

interface RespondToRatingBody {
	response: string;
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

interface ServiceRatingAnalytics extends RatingAnalytics {
	service_id: string;
	service_name: string;
	recent_ratings: PopulatedRating[];
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
// ADMIN ENDPOINTS
// ============================================================================

/**
 * @route   GET /admin/ratings
 * @desc    Get all ratings with filters
 * @access  Admin
 */
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedRating[]>,
		next: NextFunction
	) => {
		try {
			const {
				ratable_type,
				ratable_id,
				customer_id,
				booking_id,
				min_rating,
				max_rating,
				has_comment,
				has_response,
				is_active,
			} = req.query;

			const filter: Record<string, unknown> = {};

			if (ratable_type) filter.ratable_type = ratable_type;
			if (ratable_id && mongoose.Types.ObjectId.isValid(ratable_id as string))
				filter.ratable_id = new Types.ObjectId(ratable_id as string);
			if (customer_id && mongoose.Types.ObjectId.isValid(customer_id as string))
				filter.customer_id = new Types.ObjectId(customer_id as string);
			if (booking_id && mongoose.Types.ObjectId.isValid(booking_id as string))
				filter.booking_id = new Types.ObjectId(booking_id as string);

			if (min_rating || max_rating) {
				filter.rating = {};
				if (min_rating)
					(filter.rating as Record<string, unknown>).$gte = Number(min_rating);
				if (max_rating)
					(filter.rating as Record<string, unknown>).$lte = Number(max_rating);
			}

			if (has_comment === "true") {
				filter.comment = { $nin: [null, ""] };
			}

			if (has_response === "true") {
				filter.response = { $nin: [null, ""] };
			}

			if (is_active !== undefined) filter.is_active = is_active === "true";

			const ratings = await Rating.find(filter)
				.populate(ratingPopulation)
				.sort({ created_at: -1 })
				.lean<PopulatedRating[]>();

			res.status(200).json({
				status: 200,
				message: "Ratings fetched successfully!",
				data: ratings,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /admin/ratings/:id
 * @desc    Get single rating by ID
 * @access  Admin
 */
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedRating>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID");
			}

			const rating = await Rating.findById(id)
				.populate(ratingPopulation)
				.lean<PopulatedRating>();

			if (!rating) {
				throw customError(404, "Rating not found");
			}

			res.status(200).json({
				status: 200,
				message: "Rating fetched successfully!",
				data: rating,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   POST /admin/ratings/:id/respond
 * @desc    Admin responds to a rating
 * @access  Admin
 */
router.post(
	"/:id/respond",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ id: string }, {}, RespondToRatingBody>,
		res: TypedResponse<PopulatedRating>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			const { response } = req.body;

			if (!userId) {
				throw customError(400, "Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID");
			}

			if (!response || response.trim().length === 0) {
				throw customError(400, "Response is required");
			}

			if (response.trim().length < 5) {
				throw customError(400, "Response must be at least 5 characters");
			}

			const rating = await Rating.findById(id);
			if (!rating) {
				throw customError(404, "Rating not found");
			}

			// Update with response
			const updatedRating = await Rating.findByIdAndUpdate(
				id,
				{
					response: response.trim(),
					responded_at: new Date(),
					responded_by: new Types.ObjectId(userId),
					updated_by: new Types.ObjectId(userId),
				},
				{ new: true, runValidators: true }
			)
				.populate(ratingPopulation)
				.lean<PopulatedRating>();

			if (!updatedRating) {
				throw customError(500, "Failed to add response");
			}

			res.status(200).json({
				status: 200,
				message: "Response added successfully!",
				data: updatedRating,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   PUT /admin/ratings/:id/respond
 * @desc    Admin updates their response to a rating
 * @access  Admin
 */
router.put(
	"/:id/respond",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ id: string }, {}, RespondToRatingBody>,
		res: TypedResponse<PopulatedRating>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			const { response } = req.body;

			if (!userId) {
				throw customError(400, "Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID");
			}

			if (!response || response.trim().length === 0) {
				throw customError(400, "Response is required");
			}

			if (response.trim().length < 5) {
				throw customError(400, "Response must be at least 5 characters");
			}

			const rating = await Rating.findById(id);
			if (!rating) {
				throw customError(404, "Rating not found");
			}

			if (!rating.response) {
				throw customError(
					400,
					"No existing response to update. Use POST to create a new response."
				);
			}

			// Update response
			const updatedRating = await Rating.findByIdAndUpdate(
				id,
				{
					response: response.trim(),
					responded_at: new Date(),
					updated_by: new Types.ObjectId(userId),
				},
				{ new: true, runValidators: true }
			)
				.populate(ratingPopulation)
				.lean<PopulatedRating>();

			if (!updatedRating) {
				throw customError(500, "Failed to update response");
			}

			res.status(200).json({
				status: 200,
				message: "Response updated successfully!",
				data: updatedRating,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   DELETE /admin/ratings/:id/respond
 * @desc    Admin deletes their response to a rating
 * @access  Admin
 */
router.delete(
	"/:id/respond",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ id: string }>,
		res: TypedResponse<PopulatedRating>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID");
			}

			const rating = await Rating.findById(id);
			if (!rating) {
				throw customError(404, "Rating not found");
			}

			if (!rating.response) {
				throw customError(400, "No response to delete");
			}

			// Remove response
			const updatedRating = await Rating.findByIdAndUpdate(
				id,
				{
					response: null,
					responded_at: null,
					responded_by: null,
					updated_by: new Types.ObjectId(userId),
				},
				{ new: true, runValidators: true }
			)
				.populate(ratingPopulation)
				.lean<PopulatedRating>();

			if (!updatedRating) {
				throw customError(500, "Failed to delete response");
			}

			res.status(200).json({
				status: 200,
				message: "Response deleted successfully!",
				data: updatedRating,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   DELETE /admin/ratings/:id
 * @desc    Admin deletes a rating (soft delete)
 * @access  Admin
 */
router.delete(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ id: string }>,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "Please login again.");
			}

			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid rating ID");
			}

			const rating = await Rating.findById(id);
			if (!rating) {
				throw customError(404, "Rating not found");
			}

			await Rating.findByIdAndUpdate(id, {
				is_active: false,
				deleted_by: new Types.ObjectId(userId),
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
 * @route   GET /admin/ratings/analytics/overview
 * @desc    Get overall rating analytics for admin dashboard
 * @access  Admin
 */
router.get(
	"/analytics/overview",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<{
			overall: RatingAnalytics;
			by_service: ServiceRatingAnalytics[];
			by_package: ServiceRatingAnalytics[];
		}>,
		next: NextFunction
	) => {
		try {
			// Get all active ratings
			const allRatings = await Rating.find({ is_active: true })
				.populate(ratingPopulation)
				.lean<PopulatedRating[]>();

			// Overall analytics
			const overall = calculateRatingAnalytics(allRatings);

			// Analytics by service
			const serviceRatings = allRatings.filter(
				(r) => r.ratable_type === RatableType.SERVICE
			);
			const serviceIds = [
				...new Set(serviceRatings.map((r) => r.ratable_id._id.toString())),
			];

			const by_service: ServiceRatingAnalytics[] = [];
			for (const serviceId of serviceIds) {
				const ratings = serviceRatings.filter(
					(r) => r.ratable_id._id.toString() === serviceId
				);
				const analytics = calculateRatingAnalytics(ratings);
				const service = ratings[0].ratable_id;

				by_service.push({
					service_id: serviceId,
					service_name: service.name,
					...analytics,
					recent_ratings: ratings.slice(0, 5),
				});
			}

			// Analytics by package
			const packageRatings = allRatings.filter(
				(r) => r.ratable_type === RatableType.PACKAGE
			);
			const packageIds = [
				...new Set(packageRatings.map((r) => r.ratable_id._id.toString())),
			];

			const by_package: ServiceRatingAnalytics[] = [];
			for (const packageId of packageIds) {
				const ratings = packageRatings.filter(
					(r) => r.ratable_id._id.toString() === packageId
				);
				const analytics = calculateRatingAnalytics(ratings);
				const pkg = ratings[0].ratable_id;

				by_package.push({
					service_id: packageId,
					service_name: pkg.name,
					...analytics,
					recent_ratings: ratings.slice(0, 5),
				});
			}

			// Sort by average rating
			by_service.sort((a, b) => b.average_rating - a.average_rating);
			by_package.sort((a, b) => b.average_rating - a.average_rating);

			res.status(200).json({
				status: 200,
				message: "Analytics retrieved successfully",
				data: {
					overall,
					by_service,
					by_package,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /admin/ratings/analytics/service/:serviceId
 * @desc    Get detailed analytics for a specific service
 * @access  Admin
 */
router.get(
	"/analytics/service/:serviceId",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ serviceId: string }>,
		res: TypedResponse<{
			service: ServiceModel;
			analytics: RatingAnalytics;
			ratings: PopulatedRating[];
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
				message: "Service analytics retrieved successfully",
				data: {
					service,
					analytics,
					ratings,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /admin/ratings/analytics/package/:packageId
 * @desc    Get detailed analytics for a specific package
 * @access  Admin
 */
router.get(
	"/analytics/package/:packageId",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest<{ packageId: string }>,
		res: TypedResponse<{
			package: PackageModel;
			analytics: RatingAnalytics;
			ratings: PopulatedRating[];
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
				message: "Package analytics retrieved successfully",
				data: {
					package: pkg,
					analytics,
					ratings,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /admin/ratings/needs-response
 * @desc    Get all ratings that haven't been responded to
 * @access  Admin
 */
router.get(
	"/needs-response",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PopulatedRating[]>,
		next: NextFunction
	) => {
		try {
			const ratings = await Rating.find({
				is_active: true,
				response: null,
			})
				.populate(ratingPopulation)
				.sort({ created_at: -1 })
				.lean<PopulatedRating[]>();

			res.status(200).json({
				status: 200,
				message: "Ratings needing response retrieved successfully",
				data: ratings,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
