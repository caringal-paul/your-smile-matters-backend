import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { Gender } from "../types/literal.types";

// Regex patterns
const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const phoneRegex = /^[0-9]{10,15}$/;
// Customer number format: CUST-YYYYMMDD-XXXX (e.g., CUST-20250929-0001)
const customerNoRegex = /^CUST-\d{8}-\d{4}$/;

// Gender enum
export const GenderEnum: { [K in Gender]: K } = {
	Male: "Male",
	Female: "Female",
	Other: "Other",
} as const;

// Customer document type
export type CustomerModel = Document &
	MetaData & {
		customer_no: string;
		email: string;
		first_name: string;
		last_name: string;
		mobile_number: string;
		gender: Gender;
		address?: string | null;
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
		customer_no: {
			type: String,
			required: false, // 👈 Changed: Not required on creation (auto-generated)
			unique: true,
			uppercase: true,
			match: [
				customerNoRegex,
				"Invalid customer number format. Expected: CUST-YYYYMMDD-XXXX",
			],
			trim: true,
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			match: [emailRegex, "Invalid email format"],
			trim: true,
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
			trim: true,
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			select: false,
		},
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

// Indexes for performance
customerSchema.index({ customer_no: 1 }); // Unique index for customer number lookup
customerSchema.index({ email: 1 }); // Unique index for email lookup
customerSchema.index({ mobile_number: 1 }); // Index for phone number search
customerSchema.index({ is_active: 1 }); // Index for filtering active customers
customerSchema.index({ created_at: -1 }); // Index for sorting by creation date

// Static method to generate next customer number
customerSchema.statics.generateCustomerNumber =
	async function (): Promise<string> {
		const today = new Date();
		const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

		// Find the last customer created today
		const lastCustomer = await this.findOne({
			customer_no: new RegExp(`^CUST-${dateStr}-`),
		})
			.sort({ customer_no: -1 })
			.select("customer_no")
			.lean();

		let sequence = 1;

		if (lastCustomer && lastCustomer.customer_no) {
			// Extract sequence number from last customer_no
			const lastSequence = parseInt(lastCustomer.customer_no.slice(-4), 10);
			sequence = lastSequence + 1;
		}

		// Format: CUST-YYYYMMDD-XXXX
		const sequenceStr = sequence.toString().padStart(4, "0");
		return `CUST-${dateStr}-${sequenceStr}`;
	};

// Pre-save hook to auto-generate customer_no if not provided
customerSchema.pre("save", async function (next) {
	if (this.isNew && !this.customer_no) {
		try {
			this.customer_no = await (
				this.constructor as any
			).generateCustomerNumber();
			next();
		} catch (error) {
			next(error as Error);
		}
	} else {
		next();
	}
});

// 👇 NEW: Pre-update hook to ensure customer_no exists on updates
customerSchema.pre(
	["findOneAndUpdate", "updateOne", "updateMany"],
	function (next) {
		const update = this.getUpdate() as any;

		// Check if trying to update customer_no
		if (update.$set && update.$set.customer_no === undefined) {
			// Prevent removal of customer_no
			next();
		} else if (update.customer_no === null || update.customer_no === "") {
			next(new Error("Customer number cannot be removed or set to empty"));
		} else {
			next();
		}
	}
);

export const Customer = mongoose.model<CustomerModel>(
	"Customer",
	customerSchema
);
