import express, { NextFunction } from "express";
import {
	startOfDay,
	endOfDay,
	startOfMonth,
	endOfMonth,
	subMonths,
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

/**
 * Get refunded amounts grouped by booking ID
 */
async function getRefundsByBooking(
	bookingIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
	const refunds = await Transaction.aggregate([
		{
			$match: {
				booking_id: { $in: bookingIds },
				transaction_type: "Refund",
				status: "Completed",
			},
		},
		{
			$group: {
				_id: "$booking_id",
				totalRefunded: { $sum: "$amount" },
			},
		},
	]);

	const refundMap = new Map<string, number>();
	refunds.forEach((r) => {
		refundMap.set(r._id.toString(), r.totalRefunded);
	});

	return refundMap;
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * @route   GET /api/analytics/overview
 * @desc    Get dashboard overview metrics (bookings, revenue, growth)
 * @access  Private (Admin/Manager)
 */
router.get(
	"/overview",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<OverviewMetrics>,
		next: NextFunction
	) => {
		try {
			const today = new Date();
			const startToday = startOfDay(today);
			const endToday = endOfDay(today);
			const startThisMonth = startOfMonth(today);
			const endThisMonth = endOfMonth(today);
			const startLastMonth = startOfMonth(subMonths(today, 1));
			const endLastMonth = endOfMonth(subMonths(today, 1));

			// Total bookings comparison
			const [
				totalBookings,
				thisMonthBookings,
				lastMonthBookings,
				todayBookings,
				pendingBookings,
				confirmedBookings,
				ongoingBookings,
			] = await Promise.all([
				Booking.countDocuments({ is_active: true }),
				Booking.countDocuments({
					is_active: true,
					created_at: { $gte: startThisMonth },
				}),
				Booking.countDocuments({
					is_active: true,
					created_at: { $gte: startLastMonth, $lte: endLastMonth },
				}),
				Booking.countDocuments({
					is_active: true,
					booking_date: { $gte: startToday, $lte: endToday },
				}),
				Booking.countDocuments({ is_active: true, status: "Pending" }),
				Booking.countDocuments({ is_active: true, status: "Confirmed" }),
				Booking.countDocuments({ is_active: true, status: "Ongoing" }),
			]);

			// Revenue metrics
			const revenueData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						status: { $in: ["Completed", "Confirmed", "Ongoing"] },
					},
				},
				{
					$group: {
						_id: null,
						totalRevenue: { $sum: "$final_amount" },
						thisMonthRevenue: {
							$sum: {
								$cond: [
									{ $gte: ["$created_at", startThisMonth] },
									"$final_amount",
									0,
								],
							},
						},
						lastMonthRevenue: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $gte: ["$created_at", startLastMonth] },
											{ $lte: ["$created_at", endLastMonth] },
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
				thisMonthRevenue: 0,
				lastMonthRevenue: 0,
				averageBookingValue: 0,
				totalDiscount: 0,
			};

			// Get refund amounts
			const [totalRefunds, thisMonthRefunds, lastMonthRefunds] =
				await Promise.all([
					getRefundedAmount(),
					getRefundedAmount(undefined, startThisMonth, endThisMonth),
					getRefundedAmount(undefined, startLastMonth, endLastMonth),
				]);

			// Calculate net revenue
			const netTotalRevenue = revenue.totalRevenue - totalRefunds;
			const netThisMonthRevenue = revenue.thisMonthRevenue - thisMonthRefunds;
			const netLastMonthRevenue = revenue.lastMonthRevenue - lastMonthRefunds;

			// Calculate growth percentages
			const bookingGrowth =
				lastMonthBookings > 0
					? ((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100
					: 0;

			const revenueGrowth =
				netLastMonthRevenue > 0
					? ((netThisMonthRevenue - netLastMonthRevenue) /
							netLastMonthRevenue) *
					  100
					: 0;

			res.status(200).json({
				status: 200,
				message: "Overview metrics fetched successfully!",
				data: {
					bookings: {
						total: totalBookings,
						thisMonth: thisMonthBookings,
						today: todayBookings,
						pending: pendingBookings,
						confirmed: confirmedBookings,
						ongoing: ongoingBookings,
						growth: parseFloat(bookingGrowth.toFixed(2)),
					},
					revenue: {
						total: revenue.totalRevenue,
						thisMonth: revenue.thisMonthRevenue,
						average: revenue.averageBookingValue,
						growth: parseFloat(revenueGrowth.toFixed(2)),
						totalDiscounts: revenue.totalDiscount,
						totalRefunds: totalRefunds,
						netRevenue: netTotalRevenue,
					},
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

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
			const { period = "month", months = 6 } = req.query;

			if (
				period &&
				typeof period === "string" &&
				!["day", "month"].includes(period)
			) {
				throw customError(400, "Period must be 'day' or 'month'");
			}

			const today = new Date();
			const startDate = subMonths(today, Number(months));

			const trendData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						created_at: { $gte: startDate },
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
			const { year, month } = req.query;

			// base filter
			const matchStage: any = { is_active: true };

			// optional date filtering
			if (year || month) {
				const currentYear = new Date().getFullYear();
				const selectedYear = Number(year) || currentYear;

				const startDate = new Date(
					selectedYear,
					month ? Number(month) - 1 : 0,
					1
				);

				const endDate = month
					? new Date(selectedYear, Number(month), 1)
					: new Date(selectedYear + 1, 0, 1);

				matchStage.created_at = { $gte: startDate, $lt: endDate };
			}

			// aggregation
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

			// total count for percentage calculation
			const total = enrichedDistribution.reduce(
				(sum, item) => sum + item.count,
				0
			);

			// add percentage
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

			const topServices = await Booking.aggregate([
				{ $match: { is_active: true } },
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
			const performance = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						photographer_id: { $ne: null },
					},
				},
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

			// Get refunds for each photographer
			const enrichedPerformance = await Promise.all(
				performance.map(async (photographer) => {
					const refundedAmount = await getRefundedAmount(
						photographer.bookingIds
					);
					return {
						_id: photographer._id,
						photographerName: photographer.photographerName,
						email: photographer.email,
						totalBookings: photographer.totalBookings,
						completedBookings: photographer.completedBookings,
						completionRate: photographer.completionRate,
						totalRevenue: photographer.totalRevenue,
						refundedAmount,
						netRevenue: photographer.totalRevenue - refundedAmount,
						averageRating: photographer.averageRating,
						totalRatings: photographer.totalRatings,
					};
				})
			);

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
			// Top customers by spending
			const topCustomersData = await Booking.aggregate([
				{ $match: { is_active: true } },
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
				{ $sort: { totalSpent: -1 } },
				{ $limit: 20 },
			]);

			// Get refunds for each customer
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
						lastBookingDate: customer.lastBookingDate,
					};
				})
			);

			// Customer segmentation
			const segmentData = await Booking.aggregate([
				{ $match: { is_active: true } },
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

			// Get refunds for each segment
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
			const packageStatsData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						package_id: { $ne: null },
					},
				},
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

			// Get refunds for each package
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

			// Custom vs Package bookings
			const bookingTypesData = await Booking.aggregate([
				{ $match: { is_active: true } },
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

			// Get refunds for each booking type
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
			const startDate = subMonths(new Date(), Number(months));

			const heatmapData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						booking_date: { $gte: startDate },
					},
				},
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

			// Get refunds for each date
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
			const peakHours = await Booking.aggregate([
				{ $match: { is_active: true } },
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

			// Get refunds for each hour/day combination
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
			const cancellationStats = await Booking.aggregate([
				{
					$match: {
						is_active: true,
					},
				},
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
			const promoStatsData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						promo_id: { $ne: null },
					},
				},
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

			// Get refunds for each promo
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
			const last6MonthsData = await Booking.aggregate([
				{
					$match: {
						is_active: true,
						created_at: { $gte: subMonths(new Date(), 6) },
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

			// Get refunds for each month
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

			// Simple average for next month forecast (using net revenue)
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
