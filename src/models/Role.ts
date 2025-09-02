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
	},
	{ timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Role = model<RoleModel>("Role", roleSchema);
