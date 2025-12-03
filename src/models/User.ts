import mongoose, { Schema, Document, Types } from "mongoose";
import { MetaData } from "../types/base.types";
import { Role } from "./Role";

// For email regex, you can reuse your zod regex pattern
const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

export type UserModel = Document &
	MetaData & {
		username: string;
		email: string;
		first_name: string;
		last_name: string;
		mobile_number: string;
		password: string;
		profile_image?: string | null;
		role_id: Types.ObjectId;
	};

const userSchema = new Schema<UserModel>(
	{
		username: {
			type: String,
			required: [true, "Username is required"],
			minlength: [3, "Username must be at least 3 characters"],
			maxlength: [30, "Username cannot exceed 30 characters"],
			trim: true,
		},
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
		},
		password: { type: String, required: true, select: false },
		role_id: {
			type: Schema.Types.ObjectId,
			ref: "Role",
			required: [true, "Role ID is required"],
			validate: {
				validator: async function (role_id: Types.ObjectId) {
					const RoleModel = mongoose.model("Role");
					const role = await RoleModel.findById(role_id);
					return !!role;
				},
				message: "Role does not exist",
			},
		},

		profile_image: { type: String, default: null },

		// Metadata
		is_active: { type: Boolean, default: true },
		created_by: { type: Schema.Types.ObjectId, ref: "User" },
		updated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
		deleted_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
		retrieved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
		deleted_at: {
			type: Date,
			default: null,
		},
		retrieved_at: { type: Date, default: null },
	},
	{
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	}
);

export const User = mongoose.model<UserModel>("User", userSchema);
