import { Router, Request, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Customer, CustomerModel } from "../../models/Customer";
import { MetaData, TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authAmiMiddleware";
import { customError } from "../../middleware/errorHandler";
import { renderCustomerWelcomeEmail } from "../../utils/generateEmailTemplate";
import { sendEmail } from "../../utils/emailSender";

const router = Router();

type CustomerResponse = MetaData & {
	_id: string;
	customer_no: string;
	email: string;
	first_name: string;
	last_name: string;
	mobile_number: string;
	gender: string;
	address?: string | null;
	barangay?: string | null;
	city?: string | null;
	province?: string | null;
	postal_code?: string | null;
	country?: string | null;
	birth_date?: Date | null;
	profile_image?: string | null;
};

type CustomerCreateResponse = CustomerResponse & {
	temporary_password: string;
};

// ---------------- GET ALL CUSTOMERS ----------------
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<CustomerResponse[]>,
		next: NextFunction
	) => {
		try {
			const customers = await Customer.find().lean();

			const customerResponse: CustomerResponse[] = customers.map(
				({ _id: id, ...customer }) => ({
					_id: id.toString(),
					...customer,
				})
			);

			res.status(200).json({
				status: 200,
				message: "Customers fetched successfully!",
				data: customerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------- GET CUSTOMER BY ID ----------------
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<CustomerResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			if (!mongoose.Types.ObjectId.isValid(id))
				throw customError(400, "Invalid customer ID format");

			const customer = await Customer.findById(id).lean();
			if (!customer) throw customError(404, "Customer not found");

			const { _id, ...customerWithoutObjectId } = customer;

			const customerResponse: CustomerResponse = {
				_id: _id.toString(),
				...customerWithoutObjectId,
			};

			res.status(200).json({
				status: 200,
				message: "Customer fetched successfully!",
				data: customerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------- CREATE CUSTOMER ----------------
router.post(
	"/",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<CustomerCreateResponse>,
		next: NextFunction
	) => {
		try {
			const {
				email,
				first_name,
				last_name,
				mobile_number,
				gender,
				address,
				barangay,
				city,
				province,
				postal_code,
				country,
				birth_date,
				profile_image,
			} = req.body;

			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");

			const tempPassword = Math.random().toString(36).slice(-8); // simple temp password
			const hashedPassword = tempPassword; // replace with proper hashing if needed

			const customer = new Customer({
				email,
				first_name,
				last_name,
				mobile_number,
				gender,
				address: address || null,
				barangay: barangay || null,
				city: city || null,
				province: province || null,
				postal_code: postal_code || null,
				country: country || "Philippines",
				birth_date: birth_date || null,
				profile_image: profile_image || null,
				password: hashedPassword,
				is_active: true,
				created_by: new Types.ObjectId(userId),
				updated_by: new Types.ObjectId(userId),
			});

			await customer.save(); // customer_no is auto-generated in pre-save hook

			const customerResponse: CustomerCreateResponse = {
				_id: String(customer._id),
				customer_no: customer.customer_no,
				email: customer.email,
				first_name: customer.first_name,
				last_name: customer.last_name,
				mobile_number: customer.mobile_number,
				gender: customer.gender,
				address: customer.address,
				barangay: customer.barangay,
				city: customer.city,
				province: customer.province,
				postal_code: customer.postal_code,
				country: customer.country,
				birth_date: customer.birth_date,
				profile_image: customer.profile_image,
				is_active: customer.is_active,
				created_at: customer.created_at,
				updated_at: customer.updated_at,
				temporary_password: tempPassword,
			};

			// After saving customer
			const emailHtml = renderCustomerWelcomeEmail({
				firstName: customer.first_name,
				lastName: customer.last_name,
				customerNo: customer.customer_no,
				email: customer.email,
				password: tempPassword,
				loginUrl: "https://localhost.com/auth/login",
				companyName: "Your Smile Matters",
				supportEmail: "ysmphotographysupport@gmail.com",
			});

			// Send email with your email service
			await sendEmail({
				to: customer.email,
				subject: "Welcome to Your Smile Matters! 🎉",
				html: emailHtml,
			});

			res.status(201).json({
				status: 201,
				message: "Customer created successfully!",
				data: customerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------- UPDATE CUSTOMER ----------------
router.patch(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<CustomerResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const {
				customer_no,
				email,
				first_name,
				last_name,
				mobile_number,
				gender,
				address,
				barangay,
				city,
				province,
				postal_code,
				country,
				birth_date,
				profile_image,
				is_active,
			} = req.body;

			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");
			if (!mongoose.Types.ObjectId.isValid(id))
				throw customError(400, "Invalid customer ID format");

			const customer = await Customer.findById(id);
			if (!customer) throw customError(404, "Customer not found");

			if (email !== undefined) customer.email = email;
			if (first_name !== undefined) customer.first_name = first_name;
			if (last_name !== undefined) customer.last_name = last_name;
			if (mobile_number !== undefined) customer.mobile_number = mobile_number;
			if (gender !== undefined) customer.gender = gender;
			if (address !== undefined) customer.address = address;
			if (barangay !== undefined) customer.barangay = barangay;
			if (city !== undefined) customer.city = city;
			if (province !== undefined) customer.province = province;
			if (postal_code !== undefined) customer.postal_code = postal_code;
			if (country !== undefined) customer.country = country;
			if (birth_date !== undefined) customer.birth_date = birth_date;
			if (profile_image !== undefined) customer.profile_image = profile_image;
			if (is_active !== undefined) customer.is_active = is_active;

			customer.updated_by = new Types.ObjectId(userId);
			customer.updated_at = new Date();

			await customer.save();

			const customerObject = customer.toObject();
			const customerResponse: CustomerResponse = {
				_id: String(customerObject._id),
				customer_no: customerObject.customer_no,
				email: customerObject.email,
				first_name: customerObject.first_name,
				last_name: customerObject.last_name,
				mobile_number: customerObject.mobile_number,
				gender: customerObject.gender,
				address: customerObject.address,
				barangay: customerObject.barangay,
				city: customerObject.city,
				province: customerObject.province,
				postal_code: customerObject.postal_code,
				country: customerObject.country,
				birth_date: customerObject.birth_date,
				profile_image: customerObject.profile_image,
				is_active: customerObject.is_active,
				created_at: customerObject.created_at,
				updated_at: customerObject.updated_at,
				created_by: customerObject.created_by,
				updated_by: customerObject.updated_by,
			};

			res.status(200).json({
				status: 200,
				message: "Customer updated successfully!",
				data: customerResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------- DEACTIVATE CUSTOMER ----------------
router.patch(
	"/deactivate/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");
			if (!mongoose.Types.ObjectId.isValid(id))
				throw customError(400, "Invalid customer ID format");

			const customer = await Customer.findById(id);
			if (!customer) throw customError(404, "Customer not found");

			customer.is_active = false;
			customer.deleted_by = new Types.ObjectId(userId);
			customer.updated_by = new Types.ObjectId(userId);
			customer.deleted_at = new Date();
			customer.updated_at = new Date();

			await customer.save();

			res.status(200).json({
				status: 200,
				message: "Customer deactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------- REACTIVATE CUSTOMER ----------------
router.patch(
	"/reactivate/:id",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const userId = req.user?._id;
			if (!userId)
				throw customError(400, "No user id found. Please login again.");
			if (!mongoose.Types.ObjectId.isValid(id))
				throw customError(400, "Invalid customer ID format");

			const customer = await Customer.findById(id);
			if (!customer) throw customError(404, "Customer not found");

			customer.is_active = true;
			customer.retrieved_by = new Types.ObjectId(userId);
			customer.updated_by = new Types.ObjectId(userId);
			customer.retrieved_at = new Date();
			customer.updated_at = new Date();

			await customer.save();

			res.status(200).json({
				status: 200,
				message: "Customer reactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
