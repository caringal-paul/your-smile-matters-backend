import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { Gender } from "../types/literal.types";

// Regex for email & phone
const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const phoneRegex = /^[0-9]{10,15}$/;

// Gender enum
export const GenderEnum: { [K in Gender]: K } = {
	Male: "Male",
	Female: "Female",
	Other: "Other",
} as const;

// Customer document type
export type CustomerModel = Document &
	MetaData & {
		email: string;
		first_name: string;
		last_name: string;
		mobile_number: string;
		gender: Gender;
		address?: string | null; // e.g., "Blk 12, Lot 3, Phase 2, Main St."
		barangay?: string | null;
		city?: string | null;
		province?: string | null;
		postal_code?: string | null;
		country?: string | null;
		birth_date?: Date | null;
		password: string;
		profile_image?: string | null;
	};

// Customer schema
const customerSchema = new Schema<CustomerModel>(
	{
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			match: [emailRegex, "Invalid email format"],
		},
		first_name: {
			type: String,
			required: [true, "First name is required"],
			minlength: [1, "First name must have at least 1 character"],
			maxlength: [25, "First name cannot exceed 25 characters"],
			trim: true,
		},
		last_name: {
			type: String,
			required: [true, "Last name is required"],
			minlength: [1, "Last name must have at least 1 character"],
			maxlength: [25, "Last name cannot exceed 25 characters"],
			trim: true,
		},
		mobile_number: {
			type: String,
			required: [true, "Mobile number is required"],
			match: [phoneRegex, "Invalid mobile number format"],
		},
		password: { type: String, required: true, select: false },
		gender: {
			type: String,
			enum: {
				values: Object.values(GenderEnum),
				message: "{VALUE} is not a valid gender. Must be: Male, Female, Other",
			},
			required: [true, "Gender is required"],
		},
		// Hybrid address fields
		address: {
			type: String,
			trim: true,
			default: null,
			minlength: [5, "Address must be at least 5 characters"],
			maxlength: [100, "Address cannot exceed 100 characters"],
		},
		barangay: { type: String, trim: true, maxlength: 50, default: null },
		city: { type: String, trim: true, maxlength: 50, default: null },
		province: { type: String, trim: true, maxlength: 50, default: null },
		postal_code: { type: String, trim: true, maxlength: 10, default: null },
		country: {
			type: String,
			trim: true,
			maxlength: 50,
			default: "Philippines",
		},

		birth_date: { type: Date, default: null },
		profile_image: { type: String, default: null },

		// Metadata / audit fields
		is_active: { type: Boolean, default: true },
		created_by: { type: Types.ObjectId, ref: "User" },
		updated_by: { type: Types.ObjectId, ref: "User", default: null },
		deleted_by: { type: Types.ObjectId, ref: "User", default: null },
		retrieved_by: { type: Types.ObjectId, ref: "User", default: null },
		deleted_at: { type: Date, default: null },
		retrieved_at: { type: Date, default: null },
	},
	{
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	}
);

export const Customer = mongoose.model<CustomerModel>(
	"Customer",
	customerSchema
);
