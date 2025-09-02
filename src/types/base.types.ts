import { Types } from "mongoose";
import { Response } from "express";

type ApiResponse<T = any> = {
	status: number;
	message: string;
	data?: T;
	errors?: string[];
};

export type TypedResponse<T> = Response<ApiResponse<T>>;

export type PaginationQuery = {
	page?: number;
	limit?: number;
	sort?: string;
	order?: "asc" | "desc";
};

export type MetaData = {
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date | null;
	retrieved_at?: Date | null;
	is_active?: boolean;
	created_by?: Types.ObjectId;
	updated_by?: Types.ObjectId;
	deleted_by?: Types.ObjectId;
	retrieved_by?: Types.ObjectId;
	version?: number;
};
