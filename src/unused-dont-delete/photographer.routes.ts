// import { Router, Request, NextFunction } from "express";
// import mongoose, { Types } from "mongoose";
// import { Photographer, PhotographerModel } from "./Photographer";
// import { MetaData, TypedResponse } from "../src/types/base.types";
// import {
// 	AuthenticatedRequest,
// 	authenticateAmiUserToken,
// } from "../src/middleware/authMiddleware";
// import { customError } from "../src/middleware/errorHandler";

// const router = Router();

// // Utility function to transform photographer document to response format
// const transformPhotographerResponse = (
// 	photographer: any
// ): PhotographerResponse => ({
// 	id: photographer._id?.toString() || photographer.id,
// 	full_name: `${photographer.first_name} ${photographer.last_name}`,
// 	email: photographer.email,
// 	first_name: photographer.first_name,
// 	last_name: photographer.last_name,
// 	mobile_number: photographer.mobile_number,
// 	gender: photographer.gender,
// 	bio: photographer.bio,
// 	specialties: photographer.specialties || [],
// 	years_experience: photographer.years_experience,
// 	profile_image: photographer.profile_image,
// 	portfolio_images: photographer.portfolio_images || [],
// 	portfolio_website: photographer.portfolio_website,
// 	social_media: photographer.social_media,
// 	base_hourly_rate: photographer.base_hourly_rate,
// 	weekend_premium_rate: photographer.weekend_premium_rate,
// 	holiday_premium_rate: photographer.holiday_premium_rate,
// 	address: photographer.address,
// 	barangay: photographer.barangay,
// 	city: photographer.city,
// 	province: photographer.province,
// 	postal_code: photographer.postal_code,
// 	country: photographer.country,
// 	service_radius_km: photographer.service_radius_km,
// 	weekly_schedule: photographer.weekly_schedule,
// 	auto_approval: photographer.auto_approval || false,
// 	response_time_hours: photographer.response_time_hours || 24,
// 	minimum_booking_duration: photographer.minimum_booking_duration || 60,
// 	advance_booking_days: photographer.advance_booking_days || 1,
// 	buffer_time_minutes: photographer.buffer_time_minutes || 30,
// 	business_license: photographer.business_license,
// 	tax_id: photographer.tax_id,
// 	insurance: photographer.insurance || false,
// 	email_verified: photographer.email_verified || false,
// 	phone_verified: photographer.phone_verified || false,
// 	profile_completed: photographer.profile_completed || false,
// 	rating_average: photographer.rating_average,
// 	total_bookings: photographer.total_bookings || 0,
// 	last_active: photographer.last_active,
// 	is_active: photographer.is_active,
// 	created_at: photographer.created_at,
// 	updated_at: photographer.updated_at,
// 	created_by: photographer.created_by,
// 	updated_by: photographer.updated_by,
// 	deleted_by: photographer.deleted_by,
// 	retrieved_by: photographer.retrieved_by,
// 	deleted_at: photographer.deleted_at,
// 	retrieved_at: photographer.retrieved_at,
// });

// type PhotographerResponse = MetaData & {
// 	id: string;
// 	email: string;
// 	first_name: string;
// 	last_name: string;
// 	full_name: string;
// 	mobile_number: string;
// 	gender: string;
// 	bio?: string | null;
// 	specialties: string[];
// 	years_experience?: number | null;
// 	profile_image?: string | null;
// 	portfolio_images?: string[];
// 	portfolio_website?: string | null;
// 	social_media?: {
// 		instagram?: string;
// 		facebook?: string;
// 		website?: string;
// 	};
// 	base_hourly_rate?: number | null;
// 	weekend_premium_rate?: number | null;
// 	holiday_premium_rate?: number | null;
// 	address?: string | null;
// 	barangay?: string | null;
// 	city?: string | null;
// 	province?: string | null;
// 	postal_code?: string | null;
// 	country?: string | null;
// 	service_radius_km?: number | null;
// 	weekly_schedule: any;
// 	auto_approval: boolean;
// 	response_time_hours: number;
// 	minimum_booking_duration: number;
// 	advance_booking_days: number;
// 	buffer_time_minutes: number;
// 	business_license?: string | null;
// 	tax_id?: string | null;
// 	insurance: boolean;
// 	email_verified: boolean;
// 	phone_verified: boolean;
// 	profile_completed: boolean;
// 	rating_average?: number | null;
// 	total_bookings: number;
// 	last_active?: Date | null;
// };

// type PhotographerCreateResponse = PhotographerResponse & {
// 	temporary_password: string;
// };

// // ---------------- GET ALL PHOTOGRAPHERS ----------------
// router.get(
// 	"/",
// 	authenticateAmiUserToken,
// 	async (
// 		req: Request,
// 		res: TypedResponse<PhotographerResponse[]>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const photographers = await Photographer.find().lean();
// 			const photographerResponse = photographers.map(
// 				transformPhotographerResponse
// 			);

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographers fetched successfully!",
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- GET PHOTOGRAPHER BY ID ----------------
// router.get(
// 	"/:id",
// 	authenticateAmiUserToken,
// 	async (
// 		req: Request,
// 		res: TypedResponse<PhotographerResponse>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { id } = req.params;
// 			if (!mongoose.Types.ObjectId.isValid(id))
// 				throw customError(400, "Invalid photographer ID format");

// 			const photographer = await Photographer.findById(id).lean();
// 			if (!photographer) throw customError(404, "Photographer not found");

// 			const photographerResponse = transformPhotographerResponse(photographer);

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographer fetched successfully!",
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- CREATE PHOTOGRAPHER ----------------
// router.post(
// 	"/",
// 	authenticateAmiUserToken,
// 	async (
// 		req: AuthenticatedRequest,
// 		res: TypedResponse<PhotographerCreateResponse>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const {
// 				email,
// 				first_name,
// 				last_name,
// 				mobile_number,
// 				gender,
// 				bio,
// 				specialties,
// 				years_experience,
// 				profile_image,
// 				portfolio_images,
// 				portfolio_website,
// 				social_media,
// 				base_hourly_rate,
// 				weekend_premium_rate,
// 				holiday_premium_rate,
// 				address,
// 				barangay,
// 				city,
// 				province,
// 				postal_code,
// 				country,
// 				service_radius_km,
// 				weekly_schedule,
// 				auto_approval,
// 				response_time_hours,
// 				minimum_booking_duration,
// 				advance_booking_days,
// 				buffer_time_minutes,
// 				business_license,
// 				tax_id,
// 				insurance,
// 			} = req.body;

// 			const userId = req.user?._id;
// 			if (!userId)
// 				throw customError(400, "No user id found. Please login again.");

// 			const tempPassword = Math.random().toString(36).slice(-8); // simple temp password
// 			const hashedPassword = tempPassword; // replace with proper hashing if needed

// 			const photographer = new Photographer({
// 				email,
// 				first_name,
// 				last_name,
// 				mobile_number,
// 				gender,
// 				password: hashedPassword,
// 				bio: bio || null,
// 				specialties,
// 				years_experience: years_experience || null,
// 				profile_image: profile_image || null,
// 				portfolio_images: portfolio_images || [],
// 				portfolio_website: portfolio_website || null,
// 				social_media: social_media || {},
// 				base_hourly_rate: base_hourly_rate || null,
// 				weekend_premium_rate: weekend_premium_rate || null,
// 				holiday_premium_rate: holiday_premium_rate || null,
// 				address: address || null,
// 				barangay: barangay || null,
// 				city: city || null,
// 				province: province || null,
// 				postal_code: postal_code || null,
// 				country: country || "Philippines",
// 				service_radius_km: service_radius_km || null,
// 				weekly_schedule: weekly_schedule || {
// 					monday: { accepts_bookings: false, preferred_hours: [] },
// 					tuesday: { accepts_bookings: false, preferred_hours: [] },
// 					wednesday: { accepts_bookings: false, preferred_hours: [] },
// 					thursday: { accepts_bookings: false, preferred_hours: [] },
// 					friday: { accepts_bookings: false, preferred_hours: [] },
// 					saturday: { accepts_bookings: false, preferred_hours: [] },
// 					sunday: { accepts_bookings: false, preferred_hours: [] },
// 				},
// 				auto_approval: auto_approval || false,
// 				response_time_hours: response_time_hours || 24,
// 				minimum_booking_duration: minimum_booking_duration || 60,
// 				advance_booking_days: advance_booking_days || 1,
// 				buffer_time_minutes: buffer_time_minutes || 30,
// 				business_license: business_license || null,
// 				tax_id: tax_id || null,
// 				insurance: insurance || false,
// 				email_verified: false,
// 				phone_verified: false,
// 				total_bookings: 0,
// 				is_active: true,
// 				created_by: new Types.ObjectId(userId),
// 				updated_by: new Types.ObjectId(userId),
// 			});

// 			await photographer.save();

// 			const photographerResponse: PhotographerCreateResponse = {
// 				...transformPhotographerResponse(photographer.toObject()),
// 				temporary_password: tempPassword,
// 			};

// 			res.status(201).json({
// 				status: 201,
// 				message: "Photographer created successfully!",
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- UPDATE PHOTOGRAPHER ----------------
// router.patch(
// 	"/:id",
// 	authenticateAmiUserToken,
// 	async (
// 		req: AuthenticatedRequest,
// 		res: TypedResponse<PhotographerResponse>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { id } = req.params;
// 			const {
// 				email,
// 				first_name,
// 				last_name,
// 				mobile_number,
// 				gender,
// 				bio,
// 				specialties,
// 				years_experience,
// 				profile_image,
// 				portfolio_images,
// 				portfolio_website,
// 				social_media,
// 				base_hourly_rate,
// 				weekend_premium_rate,
// 				holiday_premium_rate,
// 				address,
// 				barangay,
// 				city,
// 				province,
// 				postal_code,
// 				country,
// 				service_radius_km,
// 				weekly_schedule,
// 				auto_approval,
// 				response_time_hours,
// 				minimum_booking_duration,
// 				advance_booking_days,
// 				buffer_time_minutes,
// 				business_license,
// 				tax_id,
// 				insurance,
// 				email_verified,
// 				phone_verified,
// 				is_active,
// 			} = req.body;

// 			const userId = req.user?._id;
// 			if (!userId)
// 				throw customError(400, "No user id found. Please login again.");
// 			if (!mongoose.Types.ObjectId.isValid(id))
// 				throw customError(400, "Invalid photographer ID format");

// 			const photographer = await Photographer.findById(id);
// 			if (!photographer) throw customError(404, "Photographer not found");

// 			if (email !== undefined) photographer.email = email;
// 			if (first_name !== undefined) photographer.first_name = first_name;
// 			if (last_name !== undefined) photographer.last_name = last_name;
// 			if (mobile_number !== undefined)
// 				photographer.mobile_number = mobile_number;
// 			if (gender !== undefined) photographer.gender = gender;
// 			if (bio !== undefined) photographer.bio = bio;
// 			if (specialties !== undefined) photographer.specialties = specialties;
// 			if (years_experience !== undefined)
// 				photographer.years_experience = years_experience;
// 			if (profile_image !== undefined)
// 				photographer.profile_image = profile_image;
// 			if (portfolio_images !== undefined)
// 				photographer.portfolio_images = portfolio_images;
// 			if (portfolio_website !== undefined)
// 				photographer.portfolio_website = portfolio_website;
// 			if (social_media !== undefined) photographer.social_media = social_media;
// 			if (base_hourly_rate !== undefined)
// 				photographer.base_hourly_rate = base_hourly_rate;
// 			if (weekend_premium_rate !== undefined)
// 				photographer.weekend_premium_rate = weekend_premium_rate;
// 			if (holiday_premium_rate !== undefined)
// 				photographer.holiday_premium_rate = holiday_premium_rate;
// 			if (address !== undefined) photographer.address = address;
// 			if (barangay !== undefined) photographer.barangay = barangay;
// 			if (city !== undefined) photographer.city = city;
// 			if (province !== undefined) photographer.province = province;
// 			if (postal_code !== undefined) photographer.postal_code = postal_code;
// 			if (country !== undefined) photographer.country = country;
// 			if (service_radius_km !== undefined)
// 				photographer.service_radius_km = service_radius_km;
// 			if (weekly_schedule !== undefined)
// 				photographer.weekly_schedule = weekly_schedule;
// 			if (auto_approval !== undefined)
// 				photographer.auto_approval = auto_approval;
// 			if (response_time_hours !== undefined)
// 				photographer.response_time_hours = response_time_hours;
// 			if (minimum_booking_duration !== undefined)
// 				photographer.minimum_booking_duration = minimum_booking_duration;
// 			if (advance_booking_days !== undefined)
// 				photographer.advance_booking_days = advance_booking_days;
// 			if (buffer_time_minutes !== undefined)
// 				photographer.buffer_time_minutes = buffer_time_minutes;
// 			if (business_license !== undefined)
// 				photographer.business_license = business_license;
// 			if (tax_id !== undefined) photographer.tax_id = tax_id;
// 			if (insurance !== undefined) photographer.insurance = insurance;
// 			if (email_verified !== undefined)
// 				photographer.email_verified = email_verified;
// 			if (phone_verified !== undefined)
// 				photographer.phone_verified = phone_verified;
// 			if (is_active !== undefined) photographer.is_active = is_active;

// 			photographer.updated_by = new Types.ObjectId(userId);
// 			photographer.updated_at = new Date();

// 			await photographer.save();

// 			const photographerResponse = transformPhotographerResponse(
// 				photographer.toObject()
// 			);

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographer updated successfully!",
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- DEACTIVATE PHOTOGRAPHER ----------------
// router.patch(
// 	"/deactivate/:id",
// 	authenticateAmiUserToken,
// 	async (
// 		req: AuthenticatedRequest,
// 		res: TypedResponse<null>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { id } = req.params;
// 			const userId = req.user?._id;
// 			if (!userId)
// 				throw customError(400, "No user id found. Please login again.");
// 			if (!mongoose.Types.ObjectId.isValid(id))
// 				throw customError(400, "Invalid photographer ID format");

// 			const photographer = await Photographer.findById(id);
// 			if (!photographer) throw customError(404, "Photographer not found");

// 			photographer.is_active = false;
// 			photographer.deleted_by = new Types.ObjectId(userId);
// 			photographer.updated_by = new Types.ObjectId(userId);
// 			photographer.deleted_at = new Date();
// 			photographer.updated_at = new Date();

// 			await photographer.save();

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographer deactivated successfully!",
// 				data: null,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- REACTIVATE PHOTOGRAPHER ----------------
// router.patch(
// 	"/reactivate/:id",
// 	authenticateAmiUserToken,
// 	async (
// 		req: AuthenticatedRequest,
// 		res: TypedResponse<null>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { id } = req.params;
// 			const userId = req.user?._id;
// 			if (!userId)
// 				throw customError(400, "No user id found. Please login again.");
// 			if (!mongoose.Types.ObjectId.isValid(id))
// 				throw customError(400, "Invalid photographer ID format");

// 			const photographer = await Photographer.findById(id);
// 			if (!photographer) throw customError(404, "Photographer not found");

// 			photographer.is_active = true;
// 			photographer.retrieved_by = new Types.ObjectId(userId);
// 			photographer.updated_by = new Types.ObjectId(userId);
// 			photographer.retrieved_at = new Date();
// 			photographer.updated_at = new Date();

// 			await photographer.save();

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographer reactivated successfully!",
// 				data: null,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- UPDATE PHOTOGRAPHER SCHEDULE ----------------
// router.patch(
// 	"/schedule/:id",
// 	authenticateAmiUserToken,
// 	async (
// 		req: AuthenticatedRequest,
// 		res: TypedResponse<PhotographerResponse>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { id } = req.params;
// 			const { weekly_schedule } = req.body;

// 			const userId = req.user?._id;
// 			if (!userId)
// 				throw customError(400, "No user id found. Please login again.");
// 			if (!mongoose.Types.ObjectId.isValid(id))
// 				throw customError(400, "Invalid photographer ID format");

// 			const photographer = await Photographer.findById(id);
// 			if (!photographer) throw customError(404, "Photographer not found");

// 			if (weekly_schedule !== undefined) {
// 				photographer.weekly_schedule = weekly_schedule;
// 			}

// 			photographer.updated_by = new Types.ObjectId(userId);
// 			photographer.updated_at = new Date();

// 			await photographer.save();

// 			const photographerResponse = transformPhotographerResponse(
// 				photographer.toObject()
// 			);

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographer schedule updated successfully!",
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- UPDATE PHOTOGRAPHER PORTFOLIO ----------------
// router.patch(
// 	"/portfolio/:id",
// 	authenticateAmiUserToken,
// 	async (
// 		req: AuthenticatedRequest,
// 		res: TypedResponse<PhotographerResponse>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { id } = req.params;
// 			const { portfolio_images, portfolio_website } = req.body;

// 			const userId = req.user?._id;
// 			if (!userId)
// 				throw customError(400, "No user id found. Please login again.");
// 			if (!mongoose.Types.ObjectId.isValid(id))
// 				throw customError(400, "Invalid photographer ID format");

// 			const photographer = await Photographer.findById(id);
// 			if (!photographer) throw customError(404, "Photographer not found");

// 			if (portfolio_images !== undefined) {
// 				photographer.portfolio_images = portfolio_images;
// 			}
// 			if (portfolio_website !== undefined) {
// 				photographer.portfolio_website = portfolio_website;
// 			}

// 			photographer.updated_by = new Types.ObjectId(userId);
// 			photographer.updated_at = new Date();

// 			await photographer.save();

// 			const photographerResponse: PhotographerResponse = {
// 				id: String(photographer._id),
// 				full_name: `${photographer.first_name} ${photographer.last_name}`,
// 				...photographer.toObject(),
// 				insurance: photographer.insurance || false,
// 				total_bookings: photographer.total_bookings || 0,
// 				auto_approval: photographer.auto_approval || false,
// 				response_time_hours: photographer.response_time_hours || 24,
// 				minimum_booking_duration: photographer.minimum_booking_duration || 60,
// 				advance_booking_days: photographer.advance_booking_days || 1,
// 				buffer_time_minutes: photographer.buffer_time_minutes || 30,
// 				email_verified: photographer.email_verified || false,
// 				phone_verified: photographer.phone_verified || false,
// 				profile_completed: photographer.profile_completed || false,
// 				portfolio_images: photographer.portfolio_images || [],
// 			};

// 			res.status(200).json({
// 				status: 200,
// 				message: "Photographer portfolio updated successfully!",
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- GET PHOTOGRAPHERS BY SPECIALTY ----------------
// router.get(
// 	"/specialty/:specialty",
// 	authenticateAmiUserToken,
// 	async (
// 		req: Request,
// 		res: TypedResponse<PhotographerResponse[]>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { specialty } = req.params;

// 			const photographers = await Photographer.find({
// 				specialties: { $in: [specialty] },
// 				is_active: true,
// 				profile_completed: true,
// 			}).lean();

// 			const photographerResponse: PhotographerResponse[] = photographers.map(
// 				({ _id: id, ...photographer }) => ({
// 					id: id.toString(),
// 					full_name: `${photographer.first_name} ${photographer.last_name}`,
// 					...photographer,
// 					insurance: photographer.insurance || false,
// 					total_bookings: photographer.total_bookings || 0,
// 					auto_approval: photographer.auto_approval || false,
// 					response_time_hours: photographer.response_time_hours || 24,
// 					minimum_booking_duration: photographer.minimum_booking_duration || 60,
// 					advance_booking_days: photographer.advance_booking_days || 1,
// 					buffer_time_minutes: photographer.buffer_time_minutes || 30,
// 					email_verified: photographer.email_verified || false,
// 					phone_verified: photographer.phone_verified || false,
// 					profile_completed: photographer.profile_completed || false,
// 					portfolio_images: photographer.portfolio_images || [],
// 				})
// 			);

// 			res.status(200).json({
// 				status: 200,
// 				message: `Photographers with specialty '${specialty}' fetched successfully!`,
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// // ---------------- GET PHOTOGRAPHERS BY LOCATION ----------------
// router.get(
// 	"/location/:city/:province?",
// 	authenticateAmiUserToken,
// 	async (
// 		req: Request,
// 		res: TypedResponse<PhotographerResponse[]>,
// 		next: NextFunction
// 	) => {
// 		try {
// 			const { city, province } = req.params;

// 			const query: any = {
// 				city: { $regex: new RegExp(city, "i") },
// 				is_active: true,
// 				profile_completed: true,
// 			};

// 			if (province) {
// 				query.province = { $regex: new RegExp(province, "i") };
// 			}

// 			const photographers = await Photographer.find(query).lean();

// 			const photographerResponse: PhotographerResponse[] = photographers.map(
// 				({ _id: id, ...photographer }) => ({
// 					id: id.toString(),
// 					full_name: `${photographer.first_name} ${photographer.last_name}`,
// 					...photographer,
// 					insurance: photographer.insurance || false,
// 					total_bookings: photographer.total_bookings || 0,
// 					auto_approval: photographer.auto_approval || false,
// 					response_time_hours: photographer.response_time_hours || 24,
// 					minimum_booking_duration: photographer.minimum_booking_duration || 60,
// 					advance_booking_days: photographer.advance_booking_days || 1,
// 					buffer_time_minutes: photographer.buffer_time_minutes || 30,
// 					email_verified: photographer.email_verified || false,
// 					phone_verified: photographer.phone_verified || false,
// 					profile_completed: photographer.profile_completed || false,
// 					portfolio_images: photographer.portfolio_images || [],
// 				})
// 			);

// 			res.status(200).json({
// 				status: 200,
// 				message: `Photographers in ${city}${
// 					province ? `, ${province}` : ""
// 				} fetched successfully!`,
// 				data: photographerResponse,
// 			});
// 		} catch (error) {
// 			next(error);
// 		}
// 	}
// );

// export default router;
