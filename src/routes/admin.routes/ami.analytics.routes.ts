import express, { NextFunction } from "express";
import {
	startOfDay,
	endOfDay,
	startOfMonth,
	endOfMonth,
	subMonths,
	addDays,
	subDays,
} from "date-fns";
import mongoose from "mongoose";
import {
	authenticateAmiUserToken,
	AuthenticatedRequest,
} from "../../middleware/authAmiMiddleware";
import { TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import { Booking } from "../../models/Booking";
import { Transaction } from "../../models/Transaction";

const router = express.Router();

// ============================================
// ANALYTICS RESPONSE TYPES
// ============================================

interface OverviewMetrics {
	bookings: {
		total: number;
		thisMonth: number;
		today: number;
		pending: number;
		confirmed: number;
		ongoing: number;
		growth: number;
	};
	revenue: {
		total: number;
		thisMonth: number;
		average: number;
		growth: number;
		totalDiscounts: number;
		totalRefunds: number;
		netRevenue: number;
	};
}

interface BookingTrend {
	_id: {
		year: number;
		month: number;
		day?: number;
	};
	totalBookings: number;
	revenue: number;
	refundedAmount: number;
	netRevenue: number;
	confirmedBookings: number;
	completedBookings: number;
	cancelledBookings: number;
}

interface StatusDistribution {
	status: string;
	count: number;
	revenue: number;
	refundedAmount: number;
	netRevenue: number;
	percentage: number;
}

interface TopService {
	_id: mongoose.Types.ObjectId;
	serviceName: string;
	category: string;
	totalBookings: number;
	totalQuantity: number;
	totalRevenue: number;
	averagePrice: number;
}

interface PhotographerPerformance {
	_id: mongoose.Types.ObjectId;
	photographerName: string;
	email: string;
	totalBookings: number;
	completedBookings: number;
	completionRate: number;
	totalRevenue: number;
	refundedAmount: number;
	netRevenue: number;
	profileImage?: string;
	averageRating: number;
	totalRatings: number;
}

interface TopCustomer {
	_id: mongoose.Types.ObjectId;
	customerName: string;
	email: string;
	totalBookings: number;
	totalSpent: number;
	refundedAmount: number;
	netSpent: number;
	profileImage?: string;
	averageBookingValue: number;
	lastBookingDate: Date;
}

interface CustomerSegment {
	_id: number | string;
	customers: number;
	totalRevenue: number;
	refundedAmount: number;
	netRevenue: number;
}

interface CustomerInsights {
	topCustomers: TopCustomer[];
	customerSegments: CustomerSegment[];
}

interface PackageStats {
	_id: mongoose.Types.ObjectId;
	packageName: string;
	packagePrice: number;
	totalBookings: number;
	totalRevenue: number;
	refundedAmount: number;
	netRevenue: number;
	averageRating: number;
}

interface BookingType {
	_id: string;
	count: number;
	revenue: number;
	refundedAmount: number;
	netRevenue: number;
}

interface PackagePerformance {
	packageStats: PackageStats[];
	bookingTypes: BookingType[];
}

interface HeatmapData {
	_id: {
		date: string;
	};
	bookingCount: number;
	totalRevenue: number;
	refundedAmount: number;
	netRevenue: number;
}

interface PeakHour {
	_id: {
		hour: number;
		dayOfWeek: number;
	};
	bookingCount: number;
	totalRevenue: number;
	refundedAmount: number;
	netRevenue: number;
}

interface CancellationAnalytics {
	cancellationRate: number;
	totalCancellations: number;
	cancellationReasons: {
		_id: string;
		count: number;
	}[];
}

interface PromoEffectiveness {
	_id: mongoose.Types.ObjectId;
	promoCode: string;
	promoName: string;
	totalUsage: number;
	totalDiscount: number;
	totalRevenue: number;
	refundedAmount: number;
	netRevenue: number;
	averageDiscount: number;
	roi: number;
}

interface RevenueForecast {
	historical: {
		_id: {
			year: number;
			month: number;
		};
		revenue: number;
		refundedAmount: number;
		netRevenue: number;
		bookings: number;
	}[];
	forecast: {
		nextMonthRevenue: number;
		expectedBookings: number;
		confidence: string;
	};
}

// ============================================
// HELPER FUNCTION - Get Refunds for Bookings
// ============================================

/**
 * Get total refunded amount for given booking IDs within a date range
 */
async function getRefundedAmount(
	bookingIds?: mongoose.Types.ObjectId[],
	startDate?: Date,
	endDate?: Date
): Promise<number> {
	const matchStage: any = {
		transaction_type: "Refund",
		status: "Completed",
	};

	if (bookingIds && bookingIds.length > 0) {
		matchStage.booking_id = { $in: bookingIds };
	}

	if (startDate || endDate) {
		matchStage.transaction_date = {};
		if (startDate) matchStage.transaction_date.$gte = startDate;
		if (endDate) matchStage.transaction_date.$lte = endDate;
	}

	const result = await Transaction.aggregate([
		{ $match: matchStage },
		{
			$group: {
				_id: null,
				totalRefunded: { $sum: "$amount" },
			},
		},
	]);

	return result.length > 0 ? result[0].totalRefunded : 0;
}

function buildDateFilter(query: any): { created_at?: any } | {} {
	const { year, month, startDate, endDate } = query;

	// If specific date range is provided
	if (startDate || endDate) {
		const filter: any = {};
		if (startDate) filter.$gte = startOfDay(new Date(startDate as string));
		if (endDate) filter.$lte = endOfDay(new Date(endDate as string));
		return { created_at: filter };
	}

	// If year/month is provided
	if (year || month) {
		const currentYear = new Date().getFullYear();
		const selectedYear = Number(year) || currentYear;

		const start = startOfDay(
			new Date(selectedYear, month ? Number(month) - 1 : 0, 1)
		);

		const end = month
			? endOfDay(new Date(selectedYear, Number(month), 0))
			: endOfDay(new Date(selectedYear, 11, 31));

		return { created_at: { $gte: start, $lte: end } };
	}

	return {};
}

/**
 * Helper for booking_date filter (used in some endpoints)
 */
function buildBookingDateFilter(query: any): { booking_date?: any } | {} {
	const { year, month, startDate, endDate } = query;

	if (startDate || endDate) {
		const filter: any = {};
		if (startDate) filter.$gte = startOfDay(new Date(startDate as string));
		if (endDate) filter.$lte = endOfDay(new Date(endDate as string));
		return { booking_date: filter };
	}

	if (year || month) {
		const currentYear = new Date().getFullYear();
		const selectedYear = Number(year) || currentYear;

		const start = startOfDay(
			new Date(selectedYear, month ? Number(month) - 1 : 0, 1)
		);

		const end = month
			? endOfDay(new Date(selectedYear, Number(month), 0))
			: endOfDay(new Date(selectedYear, 11, 31));

		return { booking_date: { $gte: start, $lte: end } };
	}

	return {};
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * @route   GET /api/analytics/overview
 * @desc    Get dashboard overview metrics (bookings, revenue, growth)
 * @access  Private (Admin/Manager)
 */
router.get("/overview", authenticateAmiUserToken, async (req, res, next) => {
	try {
		const dateFilter = buildDateFilter(req.query);

		const today = new Date();
		const startToday = startOfDay(today);
		const endToday = endOfDay(today);

		// OPTION 1: Compare last 30 days vs previous 30 days (Rolling periods)
		const last30DaysStart = startOfDay(subDays(today, 29)); // Last 30 days including today
		const previous30DaysStart = startOfDay(subDays(today, 59));
		const previous30DaysEnd = endOfDay(subDays(today, 30));

		// OPTION 2: Also get current month data for display
		const startThisMonth = startOfMonth(today);

		// Total bookings with rolling comparison
		const [
			totalBookings,
			last30DaysBookings,
			previous30DaysBookings,
			thisMonthBookings,
			todayBookings,
			pendingBookings,
			confirmedBookings,
			ongoingBookings,
		] = await Promise.all([
			Booking.countDocuments({ is_active: true }),
			Booking.countDocuments({
				is_active: true,
				created_at: { $gte: last30DaysStart, $lte: endToday },
			}),
			Booking.countDocuments({
				is_active: true,
				created_at: { $gte: previous30DaysStart, $lte: previous30DaysEnd },
			}),
			Booking.countDocuments({
				is_active: true,
				created_at: { $gte: startThisMonth, $lte: endToday },
			}),
			Booking.countDocuments({
				is_active: true,
				booking_date: { $gte: startToday, $lte: endToday },
			}),
			Booking.countDocuments({ is_active: true, status: "Pending" }),
			Booking.countDocuments({ is_active: true, status: "Confirmed" }),
			Booking.countDocuments({ is_active: true, status: "Ongoing" }),
		]);

		// Revenue metrics with rolling comparison
		const revenueData = await Booking.aggregate([
			{
				$match: {
					is_active: true,
					...dateFilter,
					status: { $in: ["Completed", "Confirmed", "Ongoing"] },
				},
			},
			{
				$group: {
					_id: null,
					totalRevenue: { $sum: "$final_amount" },
					last30DaysRevenue: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $gte: ["$created_at", last30DaysStart] },
										{ $lte: ["$created_at", endToday] },
									],
								},
								"$final_amount",
								0,
							],
						},
					},
					previous30DaysRevenue: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $gte: ["$created_at", previous30DaysStart] },
										{ $lte: ["$created_at", previous30DaysEnd] },
									],
								},
								"$final_amount",
								0,
							],
						},
					},
					thisMonthRevenue: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $gte: ["$created_at", startThisMonth] },
										{ $lte: ["$created_at", endToday] },
									],
								},
								"$final_amount",
								0,
							],
						},
					},
					averageBookingValue: { $avg: "$final_amount" },
					totalDiscount: { $sum: "$discount_amount" },
				},
			},
		]);

		const revenue = revenueData[0] || {
			totalRevenue: 0,
			last30DaysRevenue: 0,
			previous30DaysRevenue: 0,
			thisMonthRevenue: 0,
			averageBookingValue: 0,
			totalDiscount: 0,
		};

		const [
			totalRefunds,
			last30DaysRefunds,
			previous30DaysRefunds,
			thisMonthRefunds,
		] = await Promise.all([
			getRefundedAmount(),
			getRefundedAmount(undefined, last30DaysStart, endToday),
			getRefundedAmount(undefined, previous30DaysStart, previous30DaysEnd),
			getRefundedAmount(undefined, startThisMonth, endToday),
		]);

		const netTotalRevenue = revenue.totalRevenue - totalRefunds;
		const netLast30DaysRevenue = revenue.last30DaysRevenue - last30DaysRefunds;
		const netPrevious30DaysRevenue =
			revenue.previous30DaysRevenue - previous30DaysRefunds;
		const netThisMonthRevenue = revenue.thisMonthRevenue - thisMonthRefunds;

		// Growth calculations using equal 30-day periods
		const bookingGrowth =
			previous30DaysBookings > 0
				? ((last30DaysBookings - previous30DaysBookings) /
						previous30DaysBookings) *
				  100
				: last30DaysBookings > 0
				? 100
				: 0;

		const revenueGrowth =
			netPrevious30DaysRevenue > 0
				? ((netLast30DaysRevenue - netPrevious30DaysRevenue) /
						netPrevious30DaysRevenue) *
				  100
				: netLast30DaysRevenue > 0
				? 100
				: 0;

		res.status(200).json({
			status: 200,
			message: "Overview metrics fetched successfully!",
			data: {
				bookings: {
					total: totalBookings,
					last30Days: last30DaysBookings,
					thisMonth: thisMonthBookings,
					today: todayBookings,
					pending: pendingBookings,
					confirmed: confirmedBookings,
					ongoing: ongoingBookings,
					growth: parseFloat(bookingGrowth.toFixed(2)), // Now compares equal periods
				},
				revenue: {
					total: revenue.totalRevenue,
					last30Days: netLast30DaysRevenue,
					thisMonth: netThisMonthRevenue,
					average: revenue.averageBookingValue,
					growth: parseFloat(revenueGrowth.toFixed(2)), // Now compares equal periods
					totalDiscounts: revenue.totalDiscount,
					totalRefunds: totalRefunds,
					netRevenue: netTotalRevenue,
				},
			},
		});
	} catch (error) {
		next(error);
	}
});

/**
 * @route   GET /api/analytics/trends
 * @desc    Get booking trends over time (time series)
 * @query   period: 'day' | 'month' (default: 'month')
 * @query   months: number (default: 6)
 * @access  Private (Admin/Manager)
 */
router.get(
	"/trends",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<BookingTrend[]>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const { period = "month", months = 6 } = req.query;

			if (
				period &&
				typeof period === "string" &&
				!["day", "month"].includes(period)
			) {
				throw customError(400, "Period must be 'day' or 'month'");
			}

			const today = new Date();
			// const startDate = subMonths(today, Number(months));

			const trendData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						dateFilter,
						// created_at: { $gte: startDate },
					},
				},
				{
					$group: {
						_id: {
							year: { $year: "$created_at" },
							month: { $month: "$created_at" },
							...(period === "day" && { day: { $dayOfMonth: "$created_at" } }),
						},
						totalBookings: { $sum: 1 },
						revenue: { $sum: "$final_amount" },
						confirmedBookings: {
							$sum: { $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0] },
						},
						completedBookings: {
							$sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
						},
						cancelledBookings: {
							$sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] },
						},
						bookingIds: { $push: "$_id" },
					},
				},
				{ $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
			]);

			// Get refunds for each period
			const enrichedTrends = await Promise.all(
				trendData.map(async (trend) => {
					const refundedAmount = await getRefundedAmount(trend.bookingIds);
					return {
						_id: trend._id,
						totalBookings: trend.totalBookings,
						revenue: trend.revenue,
						refundedAmount,
						netRevenue: trend.revenue - refundedAmount,
						confirmedBookings: trend.confirmedBookings,
						completedBookings: trend.completedBookings,
						cancelledBookings: trend.cancelledBookings,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: "Booking trends fetched successfully!",
				data: enrichedTrends as BookingTrend[],
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/status-distribution
 * @desc    Get distribution of bookings by status (optionally filtered by month/year)
 * @query   year?: number
 * @query   month?: number (1–12)
 * @access  Private (Admin/Manager)
 */
router.get(
	"/status-distribution",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<StatusDistribution[]>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				...dateFilter,
			};

			const distribution = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: "$status",
						count: { $sum: 1 },
						revenue: { $sum: "$final_amount" },
						bookingIds: { $push: "$_id" },
					},
				},
				{ $sort: { count: -1 } },
			]);

			// Get refunds for each status
			const enrichedDistribution = await Promise.all(
				distribution.map(async (item) => {
					const refundedAmount = await getRefundedAmount(item.bookingIds);
					return {
						status: item._id,
						count: item.count,
						revenue: item.revenue,
						refundedAmount,
						netRevenue: item.revenue - refundedAmount,
					};
				})
			);

			const total = enrichedDistribution.reduce(
				(sum, item) => sum + item.count,
				0
			);
			const withPercentage: StatusDistribution[] = enrichedDistribution.map(
				(item) => ({
					...item,
					percentage: total
						? parseFloat(((item.count / total) * 100).toFixed(2))
						: 0,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Status distribution fetched successfully!",
				data: withPercentage,
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/top-services
 * @desc    Get top performing services by revenue
 * @query   limit: number (default: 10)
 * @access  Private (Admin/Manager)
 */
router.get(
	"/top-services",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<TopService[]>,
		next: NextFunction
	) => {
		try {
			const { limit = 10 } = req.query;
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				...dateFilter,
			};

			const topServices = await Booking.aggregate([
				{ $match: matchStage },
				{ $unwind: "$services" },
				{
					$group: {
						_id: "$services.service_id",
						totalBookings: { $sum: 1 },
						totalQuantity: { $sum: "$services.quantity" },
						totalRevenue: { $sum: "$services.total_price" },
						averagePrice: { $avg: "$services.price_per_unit" },
					},
				},
				{ $sort: { totalRevenue: -1 } },
				{ $limit: Number(limit) },
				{
					$lookup: {
						from: "services",
						localField: "_id",
						foreignField: "_id",
						as: "serviceDetails",
					},
				},
				{ $unwind: "$serviceDetails" },
				{
					$project: {
						serviceName: "$serviceDetails.name",
						category: "$serviceDetails.category",
						serviceGallery: "$serviceDetails.service_gallery",
						totalBookings: 1,
						totalQuantity: 1,
						totalRevenue: 1,
						averagePrice: 1,
					},
				},
			]);

			res.status(200).json({
				status: 200,
				message: "Top services fetched successfully!",
				data: topServices as TopService[],
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/photographer-performance
 * @desc    Get photographer performance metrics
 * @access  Private (Admin/Manager)
 */
router.get(
	"/photographer-performance",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PhotographerPerformance[]>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				photographer_id: { $ne: null },
				...dateFilter,
			};

			const performance = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: "$photographer_id",
						totalBookings: { $sum: 1 },
						completedBookings: {
							$sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
						},
						totalRevenue: { $sum: "$final_amount" },
						averageRating: { $avg: "$photographer_rating" },
						totalRatings: {
							$sum: { $cond: [{ $ne: ["$photographer_rating", null] }, 1, 0] },
						},
						bookingIds: { $push: "$_id" },
					},
				},
				{
					$lookup: {
						from: "photographers",
						localField: "_id",
						foreignField: "_id",
						as: "photographerDetails",
					},
				},
				{ $unwind: "$photographerDetails" },
				{
					$project: {
						photographerName: "$photographerDetails.name",
						email: "$photographerDetails.email",
						profileImage: "$photographerDetails.profile_image",
						totalBookings: 1,
						completedBookings: 1,
						completionRate: {
							$multiply: [
								{ $divide: ["$completedBookings", "$totalBookings"] },
								100,
							],
						},
						totalRevenue: 1,
						averageRating: { $round: ["$averageRating", 2] },
						totalRatings: 1,
						bookingIds: 1,
					},
				},
				{ $sort: { totalRevenue: -1 } },
			]);

			const enrichedPerformance = await Promise.all(
				performance.map(async (photographer) => {
					const refundedAmount = await getRefundedAmount(
						photographer.bookingIds
					);
					const netRevenue = photographer.totalRevenue - refundedAmount;

					return {
						_id: photographer._id,
						photographerName: photographer.photographerName,
						email: photographer.email,
						totalBookings: photographer.totalBookings,
						completedBookings: photographer.completedBookings,
						completionRate: photographer.completionRate,
						totalRevenue: photographer.totalRevenue,
						refundedAmount,
						netRevenue,
						averageRating: photographer.averageRating,
						totalRatings: photographer.totalRatings,
					};
				})
			);

			enrichedPerformance.sort((a, b) => b.netRevenue - a.netRevenue);

			res.status(200).json({
				status: 200,
				message: "Photographer performance fetched successfully!",
				data: enrichedPerformance as PhotographerPerformance[],
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/customer-insights
 * @desc    Get customer insights (top customers, segments)
 * @access  Private (Admin/Manager)
 */
router.get(
	"/customer-insights",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<CustomerInsights>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				...dateFilter,
			};

			const topCustomersData = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: "$customer_id",
						totalBookings: { $sum: 1 },
						totalSpent: { $sum: "$final_amount" },
						averageBookingValue: { $avg: "$final_amount" },
						lastBookingDate: { $max: "$booking_date" },
						bookingIds: { $push: "$_id" },
					},
				},
				{
					$lookup: {
						from: "customers",
						localField: "_id",
						foreignField: "_id",
						as: "customerDetails",
					},
				},
				{ $unwind: "$customerDetails" },
				{
					$project: {
						customerName: {
							$concat: [
								"$customerDetails.first_name",
								" ",
								"$customerDetails.last_name",
							],
						},
						email: "$customerDetails.email",
						profileImage: "$customerDetails.profile_image",
						totalBookings: 1,
						totalSpent: 1,
						averageBookingValue: 1,
						lastBookingDate: 1,
						bookingIds: 1,
					},
				},
			]);

			const topCustomers = await Promise.all(
				topCustomersData.map(async (customer) => {
					const refundedAmount = await getRefundedAmount(customer.bookingIds);
					return {
						_id: customer._id,
						customerName: customer.customerName,
						email: customer.email,
						totalBookings: customer.totalBookings,
						totalSpent: customer.totalSpent,
						refundedAmount,
						netSpent: customer.totalSpent - refundedAmount,
						averageBookingValue: customer.averageBookingValue,
						profileImage: customer.profileImage,
						lastBookingDate: customer.lastBookingDate,
					};
				})
			);

			topCustomers.sort((a, b) => (b.netSpent ?? 0) - (a.netSpent ?? 0));

			const segmentData = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: "$customer_id",
						bookingCount: { $sum: 1 },
						totalSpent: { $sum: "$final_amount" },
						bookingIds: { $push: "$_id" },
					},
				},
				{
					$bucket: {
						groupBy: "$bookingCount",
						boundaries: [1, 2, 5, 10, 20],
						default: "20+",
						output: {
							customers: { $sum: 1 },
							totalRevenue: { $sum: "$totalSpent" },
							allBookingIds: { $push: "$bookingIds" },
						},
					},
				},
			]);

			const customerSegments = await Promise.all(
				segmentData.map(async (segment) => {
					const flatBookingIds = segment.allBookingIds.flat();
					const refundedAmount = await getRefundedAmount(flatBookingIds);
					return {
						_id: segment._id,
						customers: segment.customers,
						totalRevenue: segment.totalRevenue,
						refundedAmount,
						netRevenue: segment.totalRevenue - refundedAmount,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: "Customer insights fetched successfully!",
				data: {
					topCustomers: topCustomers as TopCustomer[],
					customerSegments: customerSegments as CustomerSegment[],
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/package-performance
 * @desc    Get package performance vs custom bookings
 * @access  Private (Admin/Manager)
 */
router.get(
	"/package-performance",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PackagePerformance>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const packageMatchStage: any = {
				is_active: true,
				package_id: { $ne: null },
				...dateFilter,
			};

			const packageStatsData = await Booking.aggregate([
				{ $match: packageMatchStage },
				{
					$group: {
						_id: "$package_id",
						totalBookings: { $sum: 1 },
						totalRevenue: { $sum: "$final_amount" },
						averageRating: { $avg: "$client_rating" },
						bookingIds: { $push: "$_id" },
					},
				},
				{
					$lookup: {
						from: "packages",
						localField: "_id",
						foreignField: "_id",
						as: "packageDetails",
					},
				},
				{ $unwind: "$packageDetails" },
				{
					$project: {
						packageName: "$packageDetails.name",
						packagePrice: "$packageDetails.price",
						totalBookings: 1,
						totalRevenue: 1,
						averageRating: { $round: ["$averageRating", 2] },
						bookingIds: 1,
					},
				},
				{ $sort: { totalRevenue: -1 } },
			]);

			const packageStats = await Promise.all(
				packageStatsData.map(async (pkg) => {
					const refundedAmount = await getRefundedAmount(pkg.bookingIds);
					return {
						_id: pkg._id,
						packageName: pkg.packageName,
						packagePrice: pkg.packagePrice,
						totalBookings: pkg.totalBookings,
						totalRevenue: pkg.totalRevenue,
						refundedAmount,
						netRevenue: pkg.totalRevenue - refundedAmount,
						averageRating: pkg.averageRating,
					};
				})
			);

			const bookingTypeMatchStage: any = {
				is_active: true,
				...dateFilter,
			};

			const bookingTypesData = await Booking.aggregate([
				{ $match: bookingTypeMatchStage },
				{
					$group: {
						_id: {
							$cond: [{ $ne: ["$package_id", null] }, "Package", "Custom"],
						},
						count: { $sum: 1 },
						revenue: { $sum: "$final_amount" },
						bookingIds: { $push: "$_id" },
					},
				},
			]);

			const bookingTypes = await Promise.all(
				bookingTypesData.map(async (type) => {
					const refundedAmount = await getRefundedAmount(type.bookingIds);
					return {
						_id: type._id,
						count: type.count,
						revenue: type.revenue,
						refundedAmount,
						netRevenue: type.revenue - refundedAmount,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: "Package performance fetched successfully!",
				data: {
					packageStats: packageStats as PackageStats[],
					bookingTypes: bookingTypes as BookingType[],
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/booking-heatmap
 * @desc    Get booking calendar heatmap data
 * @query   months: number (default: 3)
 * @access  Private (Admin/Manager)
 */
router.get(
	"/booking-heatmap",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<HeatmapData[]>,
		next: NextFunction
	) => {
		try {
			const { months = 3 } = req.query;
			const bookingDateFilter = buildBookingDateFilter(req.query);

			// If no custom date filter, use months parameter
			const matchStage: any = {
				is_active: true,
				...(Object.keys(bookingDateFilter).length > 0
					? bookingDateFilter
					: { booking_date: { $gte: subMonths(new Date(), Number(months)) } }),
			};

			const heatmapData = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: {
							date: {
								$dateToString: { format: "%Y-%m-%d", date: "$booking_date" },
							},
						},
						bookingCount: { $sum: 1 },
						totalRevenue: { $sum: "$final_amount" },
						bookingIds: { $push: "$_id" },
					},
				},
				{ $sort: { "_id.date": 1 } },
			]);

			const enrichedHeatmap = await Promise.all(
				heatmapData.map(async (day) => {
					const refundedAmount = await getRefundedAmount(day.bookingIds);
					return {
						_id: day._id,
						bookingCount: day.bookingCount,
						totalRevenue: day.totalRevenue,
						refundedAmount,
						netRevenue: day.totalRevenue - refundedAmount,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: "Booking heatmap fetched successfully!",
				data: enrichedHeatmap as HeatmapData[],
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/peak-hours
 * @desc    Get peak booking hours by day of week
 * @access  Private (Admin/Manager)
 */
router.get(
	"/peak-hours",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PeakHour[]>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				...dateFilter,
			};

			const peakHours = await Booking.aggregate([
				{ $match: matchStage },
				{
					$project: {
						hour: {
							$toInt: { $substr: ["$start_time", 0, 2] },
						},
						dayOfWeek: { $dayOfWeek: "$booking_date" },
						revenue: "$final_amount",
						bookingId: "$_id",
					},
				},
				{
					$group: {
						_id: {
							hour: "$hour",
							dayOfWeek: "$dayOfWeek",
						},
						bookingCount: { $sum: 1 },
						totalRevenue: { $sum: "$revenue" },
						bookingIds: { $push: "$bookingId" },
					},
				},
				{ $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
			]);

			const enrichedPeakHours = await Promise.all(
				peakHours.map(async (slot) => {
					const refundedAmount = await getRefundedAmount(slot.bookingIds);
					return {
						_id: slot._id,
						bookingCount: slot.bookingCount,
						totalRevenue: slot.totalRevenue,
						refundedAmount,
						netRevenue: slot.totalRevenue - refundedAmount,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: "Peak hours analysis fetched successfully!",
				data: enrichedPeakHours as PeakHour[],
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/cancellations
 * @desc    Get cancellation analytics and reasons
 * @access  Private (Admin/Manager)
 */
router.get(
	"/cancellations",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<CancellationAnalytics>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				...dateFilter,
			};

			const cancellationStats = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: "$status",
						count: { $sum: 1 },
					},
				},
			]);

			const cancellationReasons = await Booking.aggregate([
				{
					$match: {
						status: "Cancelled",
						cancelled_reason: { $ne: null },
						...dateFilter,
					},
				},
				{
					$group: {
						_id: "$cancelled_reason",
						count: { $sum: 1 },
					},
				},
				{ $sort: { count: -1 } },
				{ $limit: 10 },
			]);

			const totalBookings = cancellationStats.reduce(
				(sum, s) => sum + s.count,
				0
			);
			const cancelledCount =
				cancellationStats.find((s) => s._id === "Cancelled")?.count || 0;
			const cancellationRate =
				totalBookings > 0 ? (cancelledCount / totalBookings) * 100 : 0;

			res.status(200).json({
				status: 200,
				message: "Cancellation analytics fetched successfully!",
				data: {
					cancellationRate: parseFloat(cancellationRate.toFixed(2)),
					totalCancellations: cancelledCount,
					cancellationReasons: cancellationReasons as {
						_id: string;
						count: number;
					}[],
				},
			});
		} catch (error) {
			next(error);
		}
	}
);
/**
 * @route   GET /api/analytics/promo-effectiveness
 * @desc    Get promo code effectiveness and ROI
 * @access  Private (Admin/Manager)
 */
router.get(
	"/promo-effectiveness",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<PromoEffectiveness[]>,
		next: NextFunction
	) => {
		try {
			const dateFilter = buildDateFilter(req.query);

			const matchStage: any = {
				is_active: true,
				promo_id: { $ne: null },
				...dateFilter,
			};

			const promoStatsData = await Booking.aggregate([
				{ $match: matchStage },
				{
					$group: {
						_id: "$promo_id",
						totalUsage: { $sum: 1 },
						totalDiscount: { $sum: "$discount_amount" },
						totalRevenue: { $sum: "$final_amount" },
						averageDiscount: { $avg: "$discount_amount" },
						bookingIds: { $push: "$_id" },
					},
				},
				{
					$lookup: {
						from: "promos",
						localField: "_id",
						foreignField: "_id",
						as: "promoDetails",
					},
				},
				{ $unwind: "$promoDetails" },
				{
					$project: {
						promoCode: "$promoDetails.code",
						promoName: "$promoDetails.name",
						totalUsage: 1,
						totalDiscount: 1,
						totalRevenue: 1,
						averageDiscount: 1,
						bookingIds: 1,
					},
				},
				{ $sort: { totalUsage: -1 } },
			]);

			const promoStats = await Promise.all(
				promoStatsData.map(async (promo) => {
					const refundedAmount = await getRefundedAmount(promo.bookingIds);
					const netRevenue = promo.totalRevenue - refundedAmount;
					return {
						_id: promo._id,
						promoCode: promo.promoCode,
						promoName: promo.promoName,
						totalUsage: promo.totalUsage,
						totalDiscount: promo.totalDiscount,
						totalRevenue: promo.totalRevenue,
						refundedAmount,
						netRevenue,
						averageDiscount: promo.averageDiscount,
						roi: promo.totalDiscount > 0 ? netRevenue / promo.totalDiscount : 0,
					};
				})
			);

			res.status(200).json({
				status: 200,
				message: "Promo effectiveness fetched successfully!",
				data: promoStats as PromoEffectiveness[],
			});
		} catch (error) {
			next(error);
		}
	}
);

/**
 * @route   GET /api/analytics/revenue-forecast
 * @desc    Get revenue forecast based on historical data
 * @access  Private (Admin/Manager)
 */
router.get(
	"/revenue-forecast",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<RevenueForecast>,
		next: NextFunction
	) => {
		try {
			const { historicalMonths = 6 } = req.query;
			const startDate = subMonths(new Date(), Number(historicalMonths));

			const last6MonthsData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						created_at: { $gte: startDate },
						status: { $in: ["Completed", "Confirmed"] },
					},
				},
				{
					$group: {
						_id: {
							year: { $year: "$created_at" },
							month: { $month: "$created_at" },
						},
						revenue: { $sum: "$final_amount" },
						bookings: { $sum: 1 },
						bookingIds: { $push: "$_id" },
					},
				},
				{ $sort: { "_id.year": 1, "_id.month": 1 } },
			]);

			const last6Months = await Promise.all(
				last6MonthsData.map(async (month) => {
					const refundedAmount = await getRefundedAmount(month.bookingIds);
					return {
						_id: month._id,
						revenue: month.revenue,
						refundedAmount,
						netRevenue: month.revenue - refundedAmount,
						bookings: month.bookings,
					};
				})
			);

			const avgNetRevenue =
				last6Months.length > 0
					? last6Months.reduce((sum, m) => sum + m.netRevenue, 0) /
					  last6Months.length
					: 0;

			const avgBookings =
				last6Months.length > 0
					? last6Months.reduce((sum, m) => sum + m.bookings, 0) /
					  last6Months.length
					: 0;

			res.status(200).json({
				status: 200,
				message: "Revenue forecast fetched successfully!",
				data: {
					historical: last6Months as {
						_id: { year: number; month: number };
						revenue: number;
						refundedAmount: number;
						netRevenue: number;
						bookings: number;
					}[],
					forecast: {
						nextMonthRevenue: Math.round(avgNetRevenue),
						expectedBookings: Math.round(avgBookings),
						confidence: "medium",
					},
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
