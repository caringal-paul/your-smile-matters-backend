import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { RoleModel } from "../models/Role";
import { User } from "../models/User";
import jwt from "jsonwebtoken";
import { verifyToken } from "../utils/tokenHandler";
import { customError } from "./errorHandler"; // Import your custom error function

// Extend Request type to include user
export interface AuthenticatedUser {
	_id: string;
	email: string;
	username: string;
	first_name: string;
	last_name: string;
	role_id: string;
	role_and_permissions?: {
		name: string;
		description?: string;
		permissions: string[];
	} | null;
}

export interface AuthenticatedRequest<
	Params = Record<string, any>,
	ResBody = any,
	ReqBody = any,
	ReqQuery = Record<string, any>
> extends Request<Params, ResBody, ReqBody, ReqQuery> {
	user?: AuthenticatedUser;
	token?: string;
}

export const authenticateAmiUserToken = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) throw customError(401, "Access token required");

		if (!authHeader.startsWith("Bearer "))
			throw customError(401, "Invalid token format. Use 'Bearer <token>'");

		const token = authHeader.substring(7);

		if (isTokenInvalidated(token)) {
			throw customError(401, "Token has been invalidated");
		}

		// ✅ jwt.verify will throw if expired or invalid
		const decoded = verifyToken(token);

		const user = await User.findById(decoded.userId)
			.populate({
				path: "role_id",
				select: "name description permissions",
			})
			.lean();

		if (!user) throw customError(401, "User not found or token invalid");
		if (user.is_active === false) throw customError(401, "Account deactivated");

		// attach user info to request
		req.user = {
			_id: user._id.toString(),
			email: user.email,
			username: user.username,
			first_name: user.first_name,
			last_name: user.last_name,
			role_id:
				user.role_id &&
				typeof user.role_id === "object" &&
				"name" in user.role_id
					? (user.role_id as any)._id.toString()
					: user.role_id?.toString() ?? "",
			role_and_permissions:
				user.role_id &&
				typeof user.role_id === "object" &&
				"name" in user.role_id
					? {
							name: (user.role_id as any).name,
							description: (user.role_id as any).description,
							permissions: (user.role_id as any).permissions || [],
					  }
					: null,
		};

		req.token = token;
		next();
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			return next(customError(401, "Access token expired"));
		}
		if (error instanceof jwt.JsonWebTokenError) {
			return next(customError(401, "Invalid token"));
		}
		next(error);
	}
};

// Optional: Permission-based middleware
export const requirePermission = (permission: string) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw customError(401, "Authentication required");
			}

			const userPermissions = req.user.role_and_permissions?.permissions || [];

			if (!userPermissions.includes(permission)) {
				throw customError(
					403,
					`Insufficient permissions. Required: ${permission}`
				);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
};

// Optional: Role-based middleware
export const requireRole = (roleName: string) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw customError(401, "Authentication required");
			}

			if (req.user.role_and_permissions?.name !== roleName) {
				throw customError(403, `Access denied. Required role: ${roleName}`);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
};

// Optional: Multiple roles middleware
export const requireAnyRole = (roles: string[]) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw customError(401, "Authentication required");
			}

			const userRole = req.user.role_and_permissions?.name;

			if (!userRole || !roles.includes(userRole)) {
				throw customError(
					403,
					`Access denied. Required roles: ${roles.join(", ")}`
				);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
};

const invalidatedTokens = new Set<string>();

export const isTokenInvalidated = (token: string): boolean => {
	return invalidatedTokens.has(token);
};

// Export the set in case you need it elsewhere
export { invalidatedTokens };
