import { Schema, model, Document } from "mongoose";
import { MetaData } from "../types/base.types";

export type RoleModel = Document &
	MetaData & {
		name: string;
		description?: string;
		permissions: string[];
	};

const roleSchema = new Schema<RoleModel>(
	{
		name: { type: String, required: true, unique: true },
		description: { type: String },
		permissions: [{ type: String, required: true }],

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
	{ timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Role = model<RoleModel>("Role", roleSchema);
