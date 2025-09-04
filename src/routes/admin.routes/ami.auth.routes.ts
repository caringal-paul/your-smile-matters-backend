import { Router, Request, NextFunction } from "express";
import {
	comparePassword,
	generateAccessToken,
	generateRefreshToken,
} from "../../utils/tokenHandler";
import { User } from "../../models/User";
import mongoose from "mongoose";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
	invalidatedTokens,
} from "../../middleware/authMiddleware";
import { customError } from "../../middleware/errorHandler";
import { TypedResponse } from "../../types/base.types";
import config from "../../config/token";

const router = Router();

// ---------------------------
// TYPES
// ---------------------------
export type RoleResponse = {
	_id: string;
	name: string;
	description?: string;
	permissions: string[];
};

export type UserAuthResponse = {
	_id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	mobile_number: string;
	role_id: string;
	role_and_permissions: RoleResponse | null;
};

export type LoginResponse = {
	user: UserAuthResponse;
	access_token: string;
	refresh_token: string;
	expires_in: string;
};

// ---------------------------
// LOGIN
// ---------------------------
router.post(
	"/login",
	async (
		req: Request,
		res: TypedResponse<LoginResponse>,
		next: NextFunction
	) => {
		try {
			const { email, password } = req.body;

			// Validate input
			if (!email || !password) {
				throw customError(400, "Email and password are required");
			}

			// Find user and populate role information
			const user = await User.findOne({ email })
				.populate({
					path: "role_id",
					select: "name description permissions",
				})
				.select("+password")
				.lean();

			if (!user) {
				throw customError(401, "Invalid email or password");
			}

			// Check if user is active
			if (user.is_active === false) {
				throw customError(401, "Account is deactivated");
			}

			// Verify password
			const isPasswordValid = await comparePassword(password, user.password);
			if (!isPasswordValid) {
				throw customError(401, "Invalid email or password");
			}

			// ✅ Generate tokens using utils
			const access_token = generateAccessToken(user._id.toString(), user.email);
			const refresh_token = generateRefreshToken(
				user._id.toString(),
				user.email
			);

			// Store refresh token in database
			await User.findByIdAndUpdate(user._id, {
				refresh_token,
				last_login: new Date(),
			});

			// Prepare user response data
			const isRolePopulated =
				user.role_id &&
				typeof user.role_id === "object" &&
				!(user.role_id instanceof mongoose.Types.ObjectId) &&
				"name" in user.role_id;

			const roleDoc = isRolePopulated ? (user.role_id as any) : null;

			const userResponse: UserAuthResponse = {
				_id: user._id.toString(),
				username: user.username,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				mobile_number: user.mobile_number,
				role_id: roleDoc?._id?.toString() ?? user.role_id?.toString() ?? "",
				role_and_permissions: roleDoc
					? {
							_id: roleDoc._id.toString(),
							name: roleDoc.name,
							description: roleDoc.description,
							permissions: roleDoc.permissions || [],
					  }
					: null,
			};

			res.status(200).json({
				status: 200,
				message: "Login successful",
				data: {
					user: userResponse,
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
// GET CURRENT USER
// ---------------------------
router.get(
	"/me",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<{ user: UserAuthResponse }>,
		next: NextFunction
	) => {
		try {
			if (!req.user) {
				throw customError(401, "Not authenticated");
			}

			res.status(200).json({
				status: 200,
				message: "Current user fetched successfully",
				data: { user: req.user as UserAuthResponse },
			});
		} catch (error) {
			next(error);
		}
	}
);

// ---------------------------
// LOGOUT
// ---------------------------
router.post(
	"/logout",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
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
			invalidatedTokens.add(access_token);

			// Invalidate refresh token if provided
			if (refresh_token) {
				invalidatedTokens.add(refresh_token);
			}

			// Clear refresh token from database
			if (req.user?._id) {
				await User.findByIdAndUpdate(req.user._id, {
					refresh_token: null,
					lastLogout: new Date(),
				});
			}

			// Auto-remove tokens after they expire
			try {
				const accessDecoded = jwt.decode(access_token) as any;
				if (accessDecoded?.exp) {
					const ttl = accessDecoded.exp * 1000 - Date.now();
					if (ttl > 0) {
						setTimeout(() => invalidatedTokens.delete(access_token), ttl);
					}
				}

				if (refresh_token) {
					const refreshDecoded = jwt.decode(refresh_token) as any;
					if (refreshDecoded?.exp) {
						const ttl = refreshDecoded.exp * 1000 - Date.now();
						if (ttl > 0) {
							setTimeout(() => invalidatedTokens.delete(refresh_token), ttl);
						}
					}
				}
			} catch (e) {
				// If we can't decode, just keep tokens in the set
			}

			res.status(200).json({
				status: 200,
				message: "Logged out successfully",
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

			// Check if refresh token is invalidated (optional in-memory blacklist)
			if (invalidatedTokens.has(refresh_token)) {
				throw customError(401, "Refresh token has been invalidated");
			}

			// Verify refresh token
			const decoded = jwt.verify(
				refresh_token,
				(process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)!
			) as { userId: string; email: string };

			// Ensure user still exists and is active
			const user = await User.findById(decoded.userId).lean();
			if (!user) {
				throw customError(401, "User not found");
			}
			if (user.is_active === false) {
				throw customError(403, "Account is deactivated");
			}

			// Generate new access token
			const newAccessToken = jwt.sign(
				{
					userId: user._id.toString(),
					email: user.email,
				},
				process.env.JWT_SECRET as string,
				{
					expires_in: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as
						| string
						| number,
				} as jwt.SignOptions
			);

			res.status(200).json({
				status: 200,
				message: "Token refreshed successfully",
				data: {
					access_token: newAccessToken,
					expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
				},
			});
		} catch (error) {
			if (
				error instanceof jwt.JsonWebTokenError ||
				error instanceof jwt.TokenExpiredError
			) {
				throw customError(401, "Invalid or expired refresh token");
			}
			next(error);
		}
	}
);

export default router;
