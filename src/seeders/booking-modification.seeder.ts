import mongoose, { Types } from "mongoose";
import { faker } from "@faker-js/faker";
import { Customer } from "../models/Customer";
import { Photographer } from "../models/Photographer";
import { Booking } from "../models/Booking";
import { Transaction } from "../models/Transaction";
import { BookingRequest } from "../models/BookingRequest";
import { TransactionRequest } from "../models/TransactionRequest";
import { User } from "../models/User";
import { logInfo, logSuccess, logError } from "./utils/seed.logger";
import { addDays, subDays, format, parse } from "date-fns";

const MONGO_URI = "mongodb://localhost:27017/capstone-dev";

// Configuration: How many of each type to create
const CONFIG = {
	CANCELLATIONS_WITH_REFUND: 3, // Cancelled bookings that also request refund
	CANCELLATIONS_ONLY: 2, // Just cancel, no refund
	RESCHEDULES: 5,
	REFUNDS_ONLY: 3, // Refund without cancelling booking
};

export const seedBookingModifications = async () => {
	if (!mongoose.connection.readyState) {
		await mongoose.connect(MONGO_URI);
		logInfo("🟢 Connected to DB");
	} else {
		logInfo("🔄 Using existing DB connection");
	}

	try {
		// Get an admin user to approve/reject requests
		const adminUser = await User.findOne().populate("role_id");
		if (!adminUser) {
			throw new Error("No admin user found. Please seed users first.");
		}

		logInfo("🎯 Starting booking modifications seeder...");

		// ============================================================================
		// 1. CANCELLATIONS WITH REFUNDS (Connected Flow)
		// ============================================================================
		logInfo("\n📋 Processing CANCELLATIONS WITH REFUNDS (Connected)...");
		const cancelWithRefundCount = await processCancellationsWithRefunds(
			adminUser._id as Types.ObjectId
		);

		// ============================================================================
		// 2. CANCELLATIONS ONLY (No Refund)
		// ============================================================================
		logInfo("\n📋 Processing CANCELLATIONS ONLY...");
		const cancelOnlyCount = await processCancellationsOnly(
			adminUser._id as Types.ObjectId
		);

		// ============================================================================
		// 3. RESCHEDULES
		// ============================================================================
		logInfo("\n📋 Processing RESCHEDULES...");
		const rescheduleCount = await processReschedules(
			adminUser._id as Types.ObjectId
		);

		// ============================================================================
		// 4. REFUNDS ONLY (No Cancellation)
		// ============================================================================
		logInfo("\n📋 Processing REFUNDS ONLY...");
		const refundOnlyCount = await processRefundsOnly(
			adminUser._id as Types.ObjectId
		);

		logSuccess(
			`\n✅ Modifications seeder completed!\n` +
				`   - Cancellations with Refunds: ${cancelWithRefundCount}\n` +
				`   - Cancellations Only: ${cancelOnlyCount}\n` +
				`   - Reschedules: ${rescheduleCount}\n` +
				`   - Refunds Only: ${refundOnlyCount}`
		);
	} catch (err: any) {
		logError(`❌ Seeder failed: ${err.message}`);
		console.error(err);
	} finally {
		mongoose.disconnect();
	}
};

// ============================================================================
// CANCELLATION WITH REFUND LOGIC (Connected Flow)
// ============================================================================
async function processCancellationsWithRefunds(
	adminId: mongoose.Types.ObjectId
) {
	let successCount = 0;

	// Find bookings that have completed transactions and can be cancelled
	const now = new Date();
	const bookings = await Booking.find({
		status: { $in: ["Pending", "Confirmed"] },
		booking_date: { $gte: now },
		deleted_at: null,
	})
		.limit(CONFIG.CANCELLATIONS_WITH_REFUND * 2) // Get more to filter
		.populate("customer_id");

	// Filter bookings that have at least one completed transaction
	const eligibleBookings = [];
	for (const booking of bookings) {
		const completedTxns = await Transaction.find({
			booking_id: booking._id,
			status: "Completed",
			transaction_type: { $in: ["Payment", "Partial", "Balance"] },
		});

		if (completedTxns.length > 0) {
			eligibleBookings.push({ booking, transactions: completedTxns });
		}

		if (eligibleBookings.length >= CONFIG.CANCELLATIONS_WITH_REFUND) break;
	}

	if (eligibleBookings.length === 0) {
		logInfo("⚠️ No eligible bookings with transactions found");
		return 0;
	}

	for (const { booking, transactions } of eligibleBookings) {
		try {
			const customer = booking.customer_id as any;
			const bookingCustomerId = booking.customer_id; // Store as ObjectId

			// ========================================================================
			// STEP 1: Customer creates BOOKING cancellation request
			// ========================================================================
			const cancellationReason = faker.helpers.arrayElement([
				"Event cancelled due to unforeseen circumstances",
				"Change of plans - need to cancel booking",
				"Found alternative photographer",
				"Venue cancelled, event not happening",
				"Personal emergency, cannot proceed",
			]);

			const bookingRequest = await BookingRequest.create({
				booking_id: booking._id,
				customer_id: bookingCustomerId,
				request_type: "Cancellation",
				status: "Pending",
				cancellation_reason: cancellationReason,
				created_by: bookingCustomerId,
			});

			logInfo(
				`   📝 Customer created cancellation request ${bookingRequest.request_reference}`
			);

			// ========================================================================
			// STEP 2: Customer creates TRANSACTION refund request(s)
			// ========================================================================
			const transactionRequests = [];
			for (const txn of transactions) {
				// Refund 80-100% of each transaction
				const refundPercentage = faker.number.float({ min: 0.8, max: 1.0 });
				const refundAmount = Math.round(txn.amount * refundPercentage);

				const txnRequest = await TransactionRequest.create({
					transaction_id: txn._id,
					booking_id: booking._id,
					customer_id: bookingCustomerId, // Use booking's customer_id
					request_type: "Refund",
					status: "Pending",
					refund_amount: refundAmount,
					refund_reason: `Refund due to booking cancellation - ${cancellationReason}`,
					created_by: bookingCustomerId, // Use booking's customer_id
				});

				transactionRequests.push({ request: txnRequest, original: txn });
				logInfo(
					`   💰 Customer created refund request ${txnRequest.request_reference} for ₱${refundAmount}`
				);
			}

			// ========================================================================
			// STEP 3: Admin reviews BOOKING request (80% approval)
			// ========================================================================
			const isBookingApproved = faker.datatype.boolean({ probability: 0.8 });
			const bookingReviewDate = faker.date.between({
				from: bookingRequest.created_at as Date,
				to: addDays(bookingRequest.created_at as Date, 3),
			});

			if (isBookingApproved) {
				// Approve booking cancellation
				await BookingRequest.findByIdAndUpdate(bookingRequest._id, {
					status: "Approved",
					reviewed_by: adminId,
					reviewed_at: bookingReviewDate,
					admin_notes: "Valid reason. Cancellation approved.",
					updated_by: adminId,
				});

				// Update booking status
				await Booking.findByIdAndUpdate(booking._id, {
					status: "Cancelled",
					cancelled_reason: cancellationReason,
					updated_by: adminId,
					updated_at: bookingReviewDate,
				});

				logInfo(
					`   ✅ Admin APPROVED cancellation for ${booking.booking_reference}`
				);

				// ======================================================================
				// STEP 4: Admin reviews TRANSACTION refund requests (85% approval)
				// ======================================================================
				for (const { request, original } of transactionRequests) {
					const isRefundApproved = faker.datatype.boolean({
						probability: 0.85,
					});
					const refundReviewDate = faker.date.between({
						from: bookingReviewDate,
						to: addDays(bookingReviewDate, 2),
					});

					if (isRefundApproved) {
						// Approve refund request (but don't create transaction yet)
						await TransactionRequest.findByIdAndUpdate(request._id, {
							status: "Approved",
							reviewed_by: adminId,
							reviewed_at: refundReviewDate,
							admin_notes:
								"Refund approved due to booking cancellation. Admin must process refund manually.",
							updated_by: adminId,
						});

						logInfo(
							`   ✅ Admin APPROVED refund request ${request.request_reference} (₱${request.refund_amount})`
						);

						// ====================================================================
						// STEP 5: Admin MANUALLY creates refund transaction (1-3 days later)
						// ====================================================================
						const refundProcessDate = faker.date.between({
							from: refundReviewDate,
							to: addDays(refundReviewDate, 3),
						});

						const refundTransaction = await original.createRefund(
							request.refund_amount,
							request.refund_reason,
							adminId.toString(),
							[
								faker.image.urlLoremFlickr({
									category: "business",
									width: 800,
									height: 600,
								}),
							]
						);

						// Update timestamps to match manual processing
						await Transaction.findByIdAndUpdate(refundTransaction._id, {
							transaction_date: refundProcessDate,
							processed_at: refundProcessDate,
							created_at: refundProcessDate,
							updated_at: refundProcessDate,
							notes: `Manual refund processed by admin for approved request ${request.request_reference}`,
						});

						logInfo(
							`   💸 Admin MANUALLY processed refund ${refundTransaction.transaction_reference} (₱${request.refund_amount})`
						);
					} else {
						// Reject refund
						await TransactionRequest.findByIdAndUpdate(request._id, {
							status: "Rejected",
							reviewed_by: adminId,
							reviewed_at: refundReviewDate,
							rejection_reason: faker.helpers.arrayElement([
								"Refund period has expired",
								"Does not meet refund policy requirements",
								"Partial refund only - please contact support",
							]),
							updated_by: adminId,
						});

						logInfo(
							`   ❌ Admin REJECTED refund request ${request.request_reference}`
						);
					}
				}

				successCount++;
			} else {
				// Reject booking cancellation
				await BookingRequest.findByIdAndUpdate(bookingRequest._id, {
					status: "Rejected",
					reviewed_by: adminId,
					reviewed_at: bookingReviewDate,
					rejection_reason: faker.helpers.arrayElement([
						"Cancellation requested too close to booking date",
						"Does not meet cancellation policy requirements",
						"Please contact support for special consideration",
					]),
					updated_by: adminId,
				});

				logInfo(
					`   ❌ Admin REJECTED cancellation for ${booking.booking_reference}`
				);

				// Auto-reject associated refund requests
				for (const { request } of transactionRequests) {
					await TransactionRequest.findByIdAndUpdate(request._id, {
						status: "Rejected",
						reviewed_by: adminId,
						reviewed_at: bookingReviewDate,
						rejection_reason:
							"Refund rejected because booking cancellation was not approved",
						updated_by: adminId,
					});

					logInfo(
						`   ❌ Auto-rejected refund request ${request.request_reference}`
					);
				}
			}
		} catch (error: any) {
			logError(
				`   ⚠️ Failed to process cancellation with refund: ${error.message}`
			);
		}
	}

	return successCount;
}

// ============================================================================
// CANCELLATION ONLY LOGIC (No Refund)
// ============================================================================
async function processCancellationsOnly(adminId: mongoose.Types.ObjectId) {
	let successCount = 0;

	const now = new Date();
	const bookings = await Booking.find({
		status: { $in: ["Pending", "Confirmed"] },
		booking_date: { $gte: now },
		deleted_at: null,
	})
		.limit(CONFIG.CANCELLATIONS_ONLY)
		.populate("customer_id");

	if (bookings.length === 0) {
		logInfo("⚠️ No eligible bookings found for cancellation");
		return 0;
	}

	for (const booking of bookings) {
		try {
			const bookingCustomerId = booking.customer_id;

			// Customer creates cancellation request
			const bookingRequest = await BookingRequest.create({
				booking_id: booking._id,
				customer_id: bookingCustomerId,
				request_type: "Cancellation",
				status: "Pending",
				cancellation_reason: faker.helpers.arrayElement([
					"Change of plans - no longer need photographer",
					"Decided to cancel event",
					"Booking by mistake",
				]),
				created_by: bookingCustomerId,
			});

			logInfo(
				`   📝 Customer created cancellation request ${bookingRequest.request_reference}`
			);

			// Admin reviews (80% approval)
			const isApproved = faker.datatype.boolean({ probability: 0.8 });
			const reviewDate = faker.date.between({
				from: bookingRequest.created_at as Date,
				to: addDays(bookingRequest.created_at as Date, 3),
			});

			if (isApproved) {
				await BookingRequest.findByIdAndUpdate(bookingRequest._id, {
					status: "Approved",
					reviewed_by: adminId,
					reviewed_at: reviewDate,
					admin_notes: "Cancellation approved.",
					updated_by: adminId,
				});

				await Booking.findByIdAndUpdate(booking._id, {
					status: "Cancelled",
					cancelled_reason: bookingRequest.cancellation_reason,
					updated_by: adminId,
					updated_at: reviewDate,
				});

				logInfo(
					`   ✅ Admin APPROVED cancellation for ${booking.booking_reference}`
				);
				successCount++;
			} else {
				await BookingRequest.findByIdAndUpdate(bookingRequest._id, {
					status: "Rejected",
					reviewed_by: adminId,
					reviewed_at: reviewDate,
					rejection_reason: "Does not meet cancellation requirements",
					updated_by: adminId,
				});

				logInfo(
					`   ❌ Admin REJECTED cancellation for ${booking.booking_reference}`
				);
			}
		} catch (error: any) {
			logError(`   ⚠️ Failed to process cancellation: ${error.message}`);
		}
	}

	return successCount;
}

// ============================================================================
// RESCHEDULE LOGIC
// ============================================================================
async function processReschedules(adminId: mongoose.Types.ObjectId) {
	let successCount = 0;

	const now = new Date();
	const bookings = await Booking.find({
		status: { $in: ["Pending", "Confirmed"] },
		booking_date: { $gte: now },
		deleted_at: null,
	})
		.limit(CONFIG.RESCHEDULES)
		.populate("customer_id photographer_id");

	if (bookings.length === 0) {
		logInfo("⚠️ No eligible bookings found for rescheduling");
		return 0;
	}

	for (const booking of bookings) {
		try {
			const bookingCustomerId = booking.customer_id;
			const originalPhotographer = booking.photographer_id as any;

			// Generate new booking date (7-30 days from original)
			const newBookingDate = faker.date.between({
				from: addDays(booking.booking_date, 7),
				to: addDays(booking.booking_date, 30),
			});
			newBookingDate.setHours(0, 0, 0, 0);

			// Get available slots
			const availableSlots = await originalPhotographer.getAvailableSlots(
				newBookingDate,
				booking.session_duration_minutes
			);

			if (availableSlots.length === 0) {
				logInfo(`   ⚠️ No available slots, skipping...`);
				continue;
			}

			const selectedSlot: string = faker.helpers.arrayElement(availableSlots);
			const [startTimeStr, endTimeStr] = selectedSlot.split(" - ");

			const startTime = parse(startTimeStr, "h:mm a", newBookingDate);
			const endTime = parse(endTimeStr, "h:mm a", newBookingDate);

			const newStartTime = format(startTime, "HH:mm");
			const newEndTime = format(endTime, "HH:mm");

			// Customer creates reschedule request
			const rescheduleRequest = await BookingRequest.create({
				booking_id: booking._id,
				customer_id: bookingCustomerId,
				request_type: "Reschedule",
				status: "Pending",
				new_booking_date: newBookingDate,
				new_start_time: newStartTime,
				new_end_time: newEndTime,
				new_photographer_id: originalPhotographer._id,
				reschedule_reason: faker.helpers.arrayElement([
					"Venue availability changed",
					"Key participants not available",
					"Weather forecast looks unfavorable",
					"Want to combine with another event",
				]),
				created_by: bookingCustomerId,
			});

			logInfo(
				`   📝 Customer created reschedule request ${rescheduleRequest.request_reference}`
			);

			// Admin reviews (75% approval)
			const isApproved = faker.datatype.boolean({ probability: 0.75 });
			const reviewDate = faker.date.between({
				from: rescheduleRequest.created_at as Date,
				to: addDays(rescheduleRequest.created_at as Date, 3),
			});

			if (isApproved) {
				await BookingRequest.findByIdAndUpdate(rescheduleRequest._id, {
					status: "Approved",
					reviewed_by: adminId,
					reviewed_at: reviewDate,
					admin_notes: "Photographer available on new date. Approved.",
					updated_by: adminId,
				});

				await Booking.findByIdAndUpdate(booking._id, {
					status: "Rescheduled",
					booking_date: newBookingDate,
					start_time: newStartTime,
					end_time: newEndTime,
					rescheduled_from: booking.booking_date,
					updated_by: adminId,
					updated_at: reviewDate,
				});

				logInfo(
					`   ✅ Admin APPROVED reschedule for ${
						booking.booking_reference
					} to ${format(newBookingDate, "yyyy-MM-dd")}`
				);
				successCount++;
			} else {
				await BookingRequest.findByIdAndUpdate(rescheduleRequest._id, {
					status: "Rejected",
					reviewed_by: adminId,
					reviewed_at: reviewDate,
					rejection_reason: "Photographer not available on requested date",
					updated_by: adminId,
				});

				logInfo(
					`   ❌ Admin REJECTED reschedule for ${booking.booking_reference}`
				);
			}
		} catch (error: any) {
			logError(`   ⚠️ Failed to process reschedule: ${error.message}`);
		}
	}

	return successCount;
}

// ============================================================================
// REFUND ONLY LOGIC (No Cancellation)
// ============================================================================
async function processRefundsOnly(adminId: mongoose.Types.ObjectId) {
	let successCount = 0;

	const transactions = await Transaction.find({
		status: "Completed",
		transaction_type: { $in: ["Payment", "Partial", "Balance"] },
		deleted_at: null,
	})
		.limit(CONFIG.REFUNDS_ONLY * 2) // Get more to filter
		.populate("customer_id booking_id");

	if (transactions.length === 0) {
		logInfo("⚠️ No eligible transactions found for refund");
		return 0;
	}

	let processedCount = 0;

	for (const transaction of transactions) {
		// Skip if we've already processed enough
		if (processedCount >= CONFIG.REFUNDS_ONLY) break;

		try {
			const customer = transaction.customer_id as any;
			const booking = transaction.booking_id as any;

			// Verify customer matches booking customer
			if (
				!booking ||
				!customer ||
				customer._id.toString() !== booking.customer_id.toString()
			) {
				logInfo(
					`   ⚠️ Skipping transaction ${transaction.transaction_reference} - customer mismatch`
				);
				continue;
			}

			// Use booking's customer_id to ensure consistency
			const bookingCustomerId = booking.customer_id;

			// Refund 50-80% (partial refund, booking continues)
			const refundPercentage = faker.number.float({ min: 0.5, max: 0.8 });
			const refundAmount = Math.round(transaction.amount * refundPercentage);

			// Customer creates refund request
			const refundRequest = await TransactionRequest.create({
				transaction_id: transaction._id,
				booking_id: booking._id,
				customer_id: bookingCustomerId, // Use booking's customer_id
				request_type: "Refund",
				status: "Pending",
				refund_amount: refundAmount,
				refund_reason: faker.helpers.arrayElement([
					"Partial refund due to reduced service scope",
					"Refund for cancelled add-ons",
					"Discount not applied, requesting adjustment",
					"Overcharged, requesting partial refund",
				]),
				created_by: bookingCustomerId, // Use booking's customer_id
			});

			logInfo(
				`   📝 Customer created refund request ${refundRequest.request_reference} for ₱${refundAmount}`
			);

			// Admin reviews (70% approval)
			const isApproved = faker.datatype.boolean({ probability: 0.7 });
			const reviewDate = faker.date.between({
				from: refundRequest.created_at as Date,
				to: addDays(refundRequest.created_at as Date, 5),
			});

			if (isApproved) {
				await TransactionRequest.findByIdAndUpdate(refundRequest._id, {
					status: "Approved",
					reviewed_by: adminId,
					reviewed_at: reviewDate,
					admin_notes:
						"Valid refund request. Admin must process refund manually.",
					updated_by: adminId,
				});

				logInfo(
					`   ✅ Admin APPROVED refund request ${refundRequest.request_reference} (₱${refundAmount})`
				);

				// Admin manually processes refund (1-3 days after approval)
				const refundProcessDate = faker.date.between({
					from: reviewDate,
					to: addDays(reviewDate, 3),
				});

				const refundTransaction = await transaction.createRefund(
					refundAmount,
					refundRequest.refund_reason,
					adminId.toString(),
					[
						faker.image.urlLoremFlickr({
							category: "business",
							width: 800,
							height: 600,
						}),
					]
				);

				// Update timestamps to match manual processing
				await Transaction.findByIdAndUpdate(refundTransaction._id, {
					transaction_date: refundProcessDate,
					processed_at: refundProcessDate,
					created_at: refundProcessDate,
					updated_at: refundProcessDate,
					notes: `Manual refund processed by admin for approved request ${refundRequest.request_reference}`,
				});

				logInfo(
					`   💸 Admin MANUALLY processed refund ${refundTransaction.transaction_reference} (₱${refundAmount})`
				);
				successCount++;
			} else {
				await TransactionRequest.findByIdAndUpdate(refundRequest._id, {
					status: "Rejected",
					reviewed_by: adminId,
					reviewed_at: reviewDate,
					rejection_reason: "Does not meet refund policy requirements",
					updated_by: adminId,
				});

				logInfo(
					`   ❌ Admin REJECTED refund request ${refundRequest.request_reference}`
				);
			}

			processedCount++;
		} catch (error: any) {
			logError(`   ⚠️ Failed to process refund: ${error.message}`);
		}
	}

	return successCount;
}
