import { Schema, model, Document } from "mongoose";
import { MetaData } from "../types/base.types";

export type PermissionModel = Document &
	MetaData & {
		module: string;
		action: string;
		key: string;
	};

const permissionSchema = new Schema<PermissionModel>(
	{
		module: { type: String, required: true },
		action: { type: String, required: true },
		key: { type: String, required: true, unique: true },
	},
	{ timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Permission = model<PermissionModel>(
	"Permission",
	permissionSchema
);
