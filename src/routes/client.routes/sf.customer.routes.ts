import { Router, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Customer } from "../../models/Customer";
import { MetaData, TypedResponse } from "../../types/base.types";
import { customError } from "../../middleware/errorHandler";
import {
	authenticateCustomerToken,
	CustomerAuthenticatedRequest,
} from "../../middleware/authCustomerMiddleware";

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

// ---------------- UPDATE CUSTOMER ----------------
router.put(
	"/:id",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
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

			const customerId = req.customer?._id;
			if (!customerId)
				throw customError(400, "No customer id found. Please login again.");
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

			customer.updated_by = new Types.ObjectId(customerId);
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
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const customerId = req.customer?._id;
			if (!customerId)
				throw customError(400, "No customer id found. Please login again.");
			if (!mongoose.Types.ObjectId.isValid(id))
				throw customError(400, "Invalid customer ID format");

			const customer = await Customer.findById(id);
			if (!customer) throw customError(404, "Customer not found");

			customer.is_active = false;
			customer.deleted_by = new Types.ObjectId(customerId);
			customer.updated_by = new Types.ObjectId(customerId);
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
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const customerId = req.customer?._id;
			if (!customerId)
				throw customError(400, "No customer id found. Please login again.");
			if (!mongoose.Types.ObjectId.isValid(id))
				throw customError(400, "Invalid customer ID format");

			const customer = await Customer.findById(id);
			if (!customer) throw customError(404, "Customer not found");

			customer.is_active = true;
			customer.retrieved_by = new Types.ObjectId(customerId);
			customer.updated_by = new Types.ObjectId(customerId);
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
