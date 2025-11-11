import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import { Customer } from "../models/Customer";
import { Photographer } from "../models/Photographer";
import { Service, ServiceModel } from "../models/Service";
import { Package } from "../models/Package";
import { Booking } from "../models/Booking";
import { Transaction } from "../models/Transaction";
import { logInfo, logSuccess, logError } from "./utils/seed.logger";
import { Types } from "mongoose";
import { addDays, subDays, format, parse, subMonths } from "date-fns";

const MONGO_URI = "mongodb://localhost:27017/capstone-dev";
const TOTAL_TO_CREATE = 30;

const formatTimeHHMM = (date: Date) => {
	const h = String(date.getHours()).padStart(2, "0");
	const m = String(date.getMinutes()).padStart(2, "0");
	return `${h}:${m}`;
};

export const seedBookingsAndTransactions = async () => {
	if (!mongoose.connection.readyState) {
		await mongoose.connect(MONGO_URI);
		logInfo("🟢 Connected to DB");
	} else {
		logInfo("🔄 Using existing DB connection");
	}

	try {
		const customers = await Customer.find();
		const photographers = await Photographer.find();
		const services = await Service.find();
		const packages = await Package.find();

		if (!customers.length || !photographers.length || !services.length) {
			throw new Error("Not enough data to seed");
		}

		let successCount = 0;

		for (let i = 0; i < TOTAL_TO_CREATE; i++) {
			try {
				const customer = faker.helpers.arrayElement(customers);
				const photographer = faker.helpers.arrayElement(photographers);

				// Decide if this booking uses a package or custom services
				const usePackage = faker.datatype.boolean();
				let bookingServices: any[] = [];
				let totalAmount = 0;
				let sessionDuration = 0;
				let selectedPackage = null;

				if (usePackage && packages.length > 0) {
					// Use a package
					selectedPackage = faker.helpers.arrayElement(packages);

					// Copy services from package
					bookingServices = selectedPackage.services.map((s: any) => ({
						service_id: s.service_id,
						quantity: s.quantity,
						price_per_unit: s.price_per_unit,
						total_price: s.total_price,
						duration_minutes: s.duration_minutes,
					}));

					totalAmount = selectedPackage.package_price;
					sessionDuration = Math.min(
						bookingServices.reduce(
							(sum, s) => sum + (s.duration_minutes || 60) * s.quantity,
							0
						),
						120 // Cap at 120 minutes
					);
				} else {
					// Custom services (1-2 random services)
					const numServices = faker.number.int({ min: 1, max: 2 });
					const selectedServices = faker.helpers.arrayElements(
						services,
						numServices
					);

					bookingServices = selectedServices.map((service: ServiceModel) => {
						const quantity = 1; // Always 1 to keep duration short
						const pricePerUnit = service.price;
						const totalPrice = pricePerUnit * quantity;
						const duration = Math.min(service.duration_minutes || 60, 60); // Cap at 60 min

						totalAmount += totalPrice;
						sessionDuration += duration * quantity;

						return {
							service_id: service._id,
							quantity,
							price_per_unit: pricePerUnit,
							total_price: totalPrice,
							duration_minutes: duration,
						};
					});

					sessionDuration = Math.min(sessionDuration, 120); // Final cap at 120 minutes
				}

				// Generate random booking date from past year to future 30 days
				const now = new Date();
				const oneYearAgo = subMonths(now, 12);
				const thirtyDaysFromNow = addDays(now, 30);

				// Random date between one year ago and 30 days from now
				const bookingDate = faker.date.between({
					from: oneYearAgo,
					to: thirtyDaysFromNow,
				});
				bookingDate.setHours(0, 0, 0, 0); // Normalize to start of day

				// Get available slots for this photographer
				const availableSlots = await photographer.getAvailableSlots(
					bookingDate,
					sessionDuration
				);

				if (availableSlots.length === 0) {
					logInfo(
						`⚠️ Skipping booking ${
							i + 1
						}: No available slots for photographer on ${format(
							bookingDate,
							"yyyy-MM-dd"
						)}`
					);
					continue;
				}

				// Pick a random available slot
				const selectedSlot = faker.helpers.arrayElement(availableSlots);
				const [startTimeStr, endTimeStr] = selectedSlot.split(" - ");

				// Convert "h:mm a" to "HH:mm" format
				const startTime = parse(startTimeStr, "h:mm a", bookingDate);
				const endTime = parse(endTimeStr, "h:mm a", bookingDate);

				const start_time_str = format(startTime, "HH:mm");
				const end_time_str = format(endTime, "HH:mm");

				const finalAmount = totalAmount;

				// Determine booking status based on date
				let bookingStatus: string;
				if (bookingDate < now) {
					// Past bookings are more likely to be Completed
					bookingStatus = faker.helpers.weightedArrayElement([
						{ value: "Completed", weight: 7 },
						{ value: "Cancelled", weight: 2 },
						{ value: "Confirmed", weight: 1 },
					]);
				} else {
					// Future bookings are Pending or Confirmed
					bookingStatus = faker.helpers.weightedArrayElement([
						{ value: "Pending", weight: 5 },
						{ value: "Confirmed", weight: 5 },
					]);
				}

				// Create booking with realistic timestamps
				const createdAt = faker.date.between({
					from: subDays(bookingDate, 30), // Created up to 30 days before booking
					to: bookingDate, // But not after the booking date
				});

				const booking = await Booking.create({
					created_by: photographer.created_by,
					customer_id: customer._id,
					photographer_id: photographer._id,
					package_id: selectedPackage?._id || null,
					services: bookingServices,
					is_customized: !usePackage,
					customization_notes: !usePackage ? faker.lorem.sentence() : null,
					booking_date: bookingDate,
					start_time: start_time_str,
					end_time: end_time_str,
					session_duration_minutes: sessionDuration,
					location: faker.location.streetAddress(),
					theme: faker.helpers.arrayElement([
						"Wedding",
						"Birthday",
						"Corporate",
						"Portrait",
						null,
					]),
					special_requests: faker.datatype.boolean()
						? faker.lorem.sentence()
						: null,
					status: bookingStatus,
					total_amount: totalAmount,
					discount_amount: 0,
					final_amount: finalAmount,
					created_at: createdAt,
					updated_at: createdAt,
					// Add status timestamps based on booking status
					booking_confirmed_at:
						bookingStatus === "Confirmed" || bookingStatus === "Completed"
							? faker.date.between({ from: createdAt, to: bookingDate })
							: null,
					booking_completed_at:
						bookingStatus === "Completed"
							? faker.date.between({
									from: bookingDate,
									to: addDays(bookingDate, 7),
							  })
							: null,
					cancelled_reason:
						bookingStatus === "Cancelled"
							? faker.helpers.arrayElement([
									"Customer request",
									"Weather conditions",
									"Photographer unavailable",
									"Venue conflict",
							  ])
							: null,
				});

				// Create transaction(s) for this booking
				const createPartialPayments = faker.datatype.boolean();

				if (createPartialPayments && finalAmount > 100) {
					// Create 2-3 partial payments
					const numPayments = faker.number.int({ min: 2, max: 3 });
					const paymentAmounts: number[] = [];
					let remaining = finalAmount;

					for (let j = 0; j < numPayments - 1; j++) {
						const partialAmount = faker.number.float({
							min: remaining * 0.2,
							max: remaining * 0.5,
						});
						paymentAmounts.push(partialAmount);
						remaining -= partialAmount;
					}
					paymentAmounts.push(remaining); // Last payment covers remaining

					// Create transactions with dates spread out
					let transactionDate = createdAt;

					for (let j = 0; j < paymentAmounts.length; j++) {
						const amount = paymentAmounts[j];

						// Each payment happens after the previous one
						if (j > 0) {
							transactionDate = faker.date.between({
								from: transactionDate,
								to: bookingDate,
							});
						}

						// Determine transaction status based on booking date
						let transactionStatus: string;
						if (bookingDate < now) {
							// Past bookings: most transactions are completed
							transactionStatus = faker.helpers.weightedArrayElement([
								{ value: "Completed", weight: 8 },
								{ value: "Failed", weight: 1 },
								{ value: "Pending", weight: 1 },
							]);
						} else {
							// Future bookings: mix of statuses
							transactionStatus = faker.helpers.weightedArrayElement([
								{ value: "Completed", weight: 5 },
								{ value: "Pending", weight: 4 },
								{ value: "Failed", weight: 1 },
							]);
						}

						await Transaction.create({
							booking_id: booking._id,
							customer_id: customer._id,
							amount,
							transaction_type:
								j === paymentAmounts.length - 1 ? "Balance" : "Partial",
							payment_method: faker.helpers.arrayElement(["Cash", "GCash"]),
							status: transactionStatus,
							payment_proof_images: [
								faker.image.urlLoremFlickr({
									category: "business",
									width: 800,
									height: 600,
								}),
							],
							notes: faker.lorem.sentence(),
							transaction_date: transactionDate,
							processed_at:
								transactionStatus === "Completed"
									? faker.date.between({
											from: transactionDate,
											to: addDays(transactionDate, 2),
									  })
									: null,
							failed_at:
								transactionStatus === "Failed"
									? faker.date.between({
											from: transactionDate,
											to: addDays(transactionDate, 1),
									  })
									: null,
							failure_reason:
								transactionStatus === "Failed"
									? faker.helpers.arrayElement([
											"Payment verification failed",
											"Insufficient funds",
											"Invalid payment proof",
									  ])
									: null,
							created_by: customer._id,
							created_at: transactionDate,
							updated_at: transactionDate,
						});
					}
				} else {
					// Single full payment
					const transactionDate = faker.date.between({
						from: createdAt,
						to: bookingDate,
					});

					// Determine transaction status based on booking date
					let transactionStatus: string;
					if (bookingDate < now) {
						transactionStatus = faker.helpers.weightedArrayElement([
							{ value: "Completed", weight: 8 },
							{ value: "Failed", weight: 1 },
							{ value: "Pending", weight: 1 },
						]);
					} else {
						transactionStatus = faker.helpers.weightedArrayElement([
							{ value: "Completed", weight: 5 },
							{ value: "Pending", weight: 4 },
							{ value: "Failed", weight: 1 },
						]);
					}

					await Transaction.create({
						booking_id: booking._id,
						customer_id: customer._id,
						amount: finalAmount,
						transaction_type: "Payment",
						payment_method: faker.helpers.arrayElement(["Cash", "GCash"]),
						status: transactionStatus,
						payment_proof_images: [
							faker.image.urlLoremFlickr({
								category: "business",
								width: 800,
								height: 600,
							}),
						],
						notes: faker.lorem.sentence(),
						transaction_date: transactionDate,
						processed_at:
							transactionStatus === "Completed"
								? faker.date.between({
										from: transactionDate,
										to: addDays(transactionDate, 2),
								  })
								: null,
						failed_at:
							transactionStatus === "Failed"
								? faker.date.between({
										from: transactionDate,
										to: addDays(transactionDate, 1),
								  })
								: null,
						failure_reason:
							transactionStatus === "Failed"
								? faker.helpers.arrayElement([
										"Payment verification failed",
										"Insufficient funds",
										"Invalid payment proof",
								  ])
								: null,
						created_by: customer._id,
						created_at: transactionDate,
						updated_at: transactionDate,
					});
				}

				successCount++;
				logInfo(
					`✅ Created booking ${successCount}/${TOTAL_TO_CREATE} for ${
						customer.first_name
					} on ${format(
						bookingDate,
						"yyyy-MM-dd"
					)} at ${start_time_str} (Status: ${bookingStatus})`
				);
			} catch (error: any) {
				logError(`⚠️ Failed to create booking ${i + 1}: ${error.message}`);
			}
		}

		logSuccess(
			`✅ Seeder completed! Created ${successCount} bookings + transactions.`
		);
	} catch (err: any) {
		logError(`❌ Seeder failed: ${err.message}`);
		console.error(err);
	} finally {
		mongoose.disconnect();
	}
};
