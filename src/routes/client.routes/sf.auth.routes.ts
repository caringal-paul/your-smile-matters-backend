import { Router, Request, NextFunction } from "express";
import {
	comparePassword,
	generateCustomerAccessToken,
	generateCustomerRefreshToken,
	hashPassword,
} from "../../utils/tokenHandler";
import { Customer, CustomerModel } from "../../models/Customer";
import jwt from "jsonwebtoken";

import { customError } from "../../middleware/errorHandler";
import { TypedResponse } from "../../types/base.types";
import config from "../../config/token";
import {
	authenticateCustomerToken,
	CustomerAuthenticatedRequest,
	invalidatedCustomerTokens,
} from "../../middleware/authCustomerMiddleware";
import {
	renderCustomerWelcomeEmail,
	renderNewAccountEmail,
} from "../../utils/generateEmailTemplate";
import { sendEmail } from "../../utils/emailSender";

const router = Router();

// ---------------------------
// TYPES
// ---------------------------
export type CustomerAuthResponse = {
	_id: string;
	customer_no?: string;
	profile_image?: string | null;
	email: string;
	first_name: string;
	last_name: string;
	mobile_number: string;
	gender: string;
	is_active?: boolean;
	created_at?: Date;
	updated_at?: Date;
};

export type CustomerLoginResponse = {
	customer: CustomerAuthResponse;
	access_token: string;
	refresh_token: string;
	expires_in: string;
};

// ---------------------------
// CUSTOMER LOGIN
// ---------------------------
router.post(
	"/login",
	async (
		req: Request,
		res: TypedResponse<CustomerLoginResponse>,
		next: NextFunction
	) => {
		try {
			const { email, password } = req.body;

			// Validate input
			if (!email || !password) {
				throw customError(400, "Email and password are required");
			}

			// Find customer
			const foundCustomer = await Customer.findOne({ email })
				.select("+password")
				.lean();

			if (!foundCustomer) {
				throw customError(401, "Invalid email or password");
			}

			// Check if customer is active
			if (foundCustomer.is_active === false) {
				throw customError(401, "Account is deactivated");
			}

			// Verify password
			const isPasswordValid = await comparePassword(
				password,
				foundCustomer.password
			);
			if (!isPasswordValid) {
				throw customError(401, "Invalid email or password");
			}

			// Generate tokens for customer
			const access_token = generateCustomerAccessToken(
				foundCustomer._id.toString(),
				foundCustomer.email
			);
			const refresh_token = generateCustomerRefreshToken(
				foundCustomer._id.toString(),
				foundCustomer.email
			);

			// Prepare customer response
			const customerResponse: CustomerAuthResponse = {
				_id: foundCustomer._id.toString(),
				customer_no: foundCustomer.customer_no,
				profile_image: foundCustomer.profile_image,
				email: foundCustomer.email,
				first_name: foundCustomer.first_name,
				last_name: foundCustomer.last_name,
				mobile_number: foundCustomer.mobile_number,
				gender: foundCustomer.gender,
				is_active: foundCustomer.is_active,
			};

			res.status(200).json({
				status: 200,
				message: "Login successful",
				data: {
					customer: customerResponse,
					access_token,
					refresh_token,
					expires_in: config.accessTokenExpiresIn,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------------------
// CUSTOMER REGISTRATION
// ---------------------------
router.post(
	"/register",
	async (req: Request, res: TypedResponse<string>, next: NextFunction) => {
		try {
			const { email, password, first_name, last_name, mobile_number, gender } =
				req.body;

			// Validate required input (gender is required in schema)
			if (
				!email ||
				!password ||
				!first_name ||
				!last_name ||
				!mobile_number ||
				!gender
			) {
				throw customError(
					400,
					"Email, password, first name, last name, mobile number, and gender are required"
				);
			}

			// Validate gender enum
			const validGenders = ["Male", "Female", "Other"];
			if (!validGenders.includes(gender)) {
				throw customError(400, "Gender must be Male, Female, or Other");
			}

			// Check if customer already exists
			const existingCustomer = await Customer.findOne({ email });
			if (existingCustomer) {
				throw customError(409, "Email already registered");
			}

			// Hash the password before saving
			const hashedPassword = await hashPassword(password);

			// Create new customer (customer_no auto-generated)
			const newCustomer = await Customer.create({
				email,
				password: hashedPassword,
				first_name,
				last_name,
				mobile_number,
				gender,
				is_active: true,
			});

			// Send welcome email
			try {
				const htmlContent = renderNewAccountEmail({
					role: "Customer",
					firstName: first_name,
					email,
					password: password, // Send the original password (not hashed) in email
					loginUrl: "https://localhost.com/login", // Update with your actual login URL
					companyName: "Your Smile Matters",
					supportEmail: "ysmphotographysupport@gmail.com",
				});

				await sendEmail({
					to: email,
					subject:
						"Welcome to Your Smile Matters - Account Created Successfully",
					html: htmlContent,
				});
			} catch (emailErr) {
				console.error("Failed to send welcome email:", emailErr);
				// Don't throw error for email failure, just log it
				// The registration should still succeed even if email fails
			}

			res.status(201).json({
				status: 201,
				message: "Registration successful. Welcome email sent!",
				data: "Registration successful",
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------------------
// GET CURRENT CUSTOMER
// ---------------------------
router.get(
	"/me",
	authenticateCustomerToken,
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<{ customer: CustomerAuthResponse }>,
		next: NextFunction
	) => {
		try {
			if (!req.customer) {
				throw customError(401, "Not authenticated");
			}

			// Fetch full customer details
			const customer = await Customer.findById(req.customer._id).lean();

			if (!customer) {
				throw customError(404, "Customer not found");
			}

			const customerResponse: CustomerAuthResponse = {
				_id: customer._id.toString(),
				customer_no: customer.customer_no,
				email: customer.email,
				first_name: customer.first_name,
				last_name: customer.last_name,
				mobile_number: customer.mobile_number,
				gender: customer.gender,
				is_active: customer.is_active,
				created_at: customer.created_at,
				updated_at: customer.updated_at,
			};

			res.status(200).json({
				status: 200,
				message: "Current customer fetched successfully",
				data: { customer: customerResponse },
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------------------
// CUSTOMER LOGOUT
// ---------------------------
router.post(
	"/logout",
	async (
		req: CustomerAuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const authHeader = req.headers.authorization;

			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				throw customError(401, "No token provided for logout");
			}

			const access_token = authHeader.substring(7);

			// Get refresh token from request body (optional)
			const { refresh_token } = req.body;

			// Invalidate access token
			invalidatedCustomerTokens.add(access_token);

			// Invalidate refresh token if provided
			if (refresh_token) {
				invalidatedCustomerTokens.add(refresh_token);
			}

			// Auto-remove tokens after they expire
			try {
				const accessDecoded = jwt.decode(access_token) as jwt.JwtPayload | null;
				if (accessDecoded?.exp) {
					const ttl = accessDecoded.exp * 1000 - Date.now();
					if (ttl > 0) {
						setTimeout(
							() => invalidatedCustomerTokens.delete(access_token),
							ttl
						);
					}
				}

				if (refresh_token) {
					const refreshDecoded = jwt.decode(
						refresh_token
					) as jwt.JwtPayload | null;
					if (refreshDecoded?.exp) {
						const ttl = refreshDecoded.exp * 1000 - Date.now();
						if (ttl > 0) {
							setTimeout(
								() => invalidatedCustomerTokens.delete(refresh_token),
								ttl
							);
						}
					}
				}
			} catch (e) {
				// If we can't decode, just keep tokens in the set
			}

			res.status(200).json({
				status: 200,
				message: "Logged out successfully",
				data: null,
			});
		} catch (error) {
			if (
				error instanceof jwt.JsonWebTokenError ||
				error instanceof jwt.TokenExpiredError
			) {
				return res.status(200).json({
					status: 200,
					message: "Logged out successfully",
				});
			}
			next(error);
		}
	}
);

// ---------------------------
// REFRESH TOKEN
// ---------------------------
router.post(
	"/refresh",
	async (
		req: Request,
		res: TypedResponse<{ access_token: string; expires_in: string }>,
		next: NextFunction
	) => {
		try {
			const { refresh_token } = req.body;

			if (!refresh_token) {
				throw customError(401, "Refresh token required");
			}

			// Check if refresh token is invalidated
			if (invalidatedCustomerTokens.has(refresh_token)) {
				throw customError(401, "Refresh token has been invalidated");
			}

			// Verify refresh token
			const decoded = jwt.verify(refresh_token, config.jwtSecret) as {
				customerId: string;
				email: string;
				type: string;
			};

			// Verify it's a customer token
			if (decoded.type !== "customer") {
				throw customError(401, "Invalid token type");
			}

			// Ensure customer still exists and is active
			const customer = await Customer.findById(decoded.customerId).lean();
			if (!customer) {
				throw customError(401, "Customer not found");
			}
			if (customer.is_active === false) {
				throw customError(403, "Account is deactivated");
			}

			// Generate new access token
			const newAccessToken = generateCustomerAccessToken(
				customer._id.toString(),
				customer.email
			);

			res.status(200).json({
				status: 200,
				message: "Token refreshed successfully",
				data: {
					access_token: newAccessToken,
					expires_in: config.accessTokenExpiresIn,
				},
			});
		} catch (error) {
			if (
				error instanceof jwt.JsonWebTokenError ||
				error instanceof jwt.TokenExpiredError
			) {
				return next(customError(401, "Invalid or expired refresh token"));
			}
			next(error);
		}
	}
);

export default router;
