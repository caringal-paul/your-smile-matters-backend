import { Request, Response, NextFunction } from "express";
import { formatFieldName } from "../utils/formatFieldName";

// Define the ApiError interface
export interface ApiError extends Error {
	status?: number;
	message: string;
}

// Custom error creator function
export const customError = (status: number, message: string): ApiError => {
	const error = new Error(message) as ApiError;
	error.status = status;
	return error;
};

// Combined error handler middleware
export const errorHandler = (
	error: any,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	console.error("Error:", error);

	// Handle custom API errors first
	if (error.status) {
		return res.status(error.status).json({
			status: error.status,
			message: error.message,
			error: error.message,
		});
	}

	// Mongoose validation error
	if (error.name === "ValidationError") {
		const errors = Object.values(error.errors).map((err: any) => err.message);
		return res.status(400).json({
			status: 400,
			message: "Validation Error",
			error: errors.join(", "),
		});
	}

	// Mongoose duplicate key error
	if (error.code === 11000) {
		const field = Object.keys(error.keyValue)[0];
		const errorMessage = `${formatFieldName(field)} already exists`;
		return res.status(400).json({
			status: 400,
			message: errorMessage,
			error: errorMessage,
		});
	}

	// Mongoose CastError (invalid ObjectId)
	if (error.name === "CastError") {
		return res.status(400).json({
			status: 400,
			message: "Invalid Input",
			error: "Invalid ID format",
		});
	}

	// JWT errors
	if (error.name === "JsonWebTokenError") {
		return res.status(401).json({
			status: 401,
			message: "Authentication Error",
			error: "Invalid token",
		});
	}

	if (error.name === "TokenExpiredError") {
		return res.status(401).json({
			status: 401,
			message: "Authentication Error",
			error: "Token expired",
		});
	}

	// Default error for unhandled cases
	res.status(500).json({
		status: 500,
		message: "Internal Server Error",
		error: "Something went wrong",
		...(process.env.NODE_ENV === "development" && { stack: error.stack }),
	});
};
