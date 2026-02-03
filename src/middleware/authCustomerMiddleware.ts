import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Customer } from "../models/Customer"; // Your customer model
import { verifyToken, JWTPayload } from "../utils/tokenHandler";
import { customError } from "./errorHandler";

// Define Customer authenticated user structure
export interface AuthenticatedCustomer {
	_id: string;
	email: string;
	first_name?: string;
	last_name?: string;
}

export interface CustomerAuthenticatedRequest<
	Params = Record<string, any>,
	ResBody = any,
	ReqBody = any,
	ReqQuery = Record<string, any>
> extends Request<Params, ResBody, ReqBody, ReqQuery> {
	customer?: AuthenticatedCustomer;
	token?: string;
}

// Customer token invalidation (separate from admin)
const invalidatedCustomerTokens = new Set<string>();

export const isCustomerTokenInvalidated = (token: string): boolean => {
	return invalidatedCustomerTokens.has(token);
};

export const invalidateCustomerToken = (token: string): void => {
	invalidatedCustomerTokens.add(token);
};

// Main customer authentication middleware
export const authenticateCustomerToken = async (
	req: CustomerAuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) throw customError(401, "Access token required");

		if (!authHeader.startsWith("Bearer "))
			throw customError(401, "Invalid token format. Use 'Bearer <token>'");

		const token = authHeader.substring(7);

		// Check if token is invalidated (for logout)
		if (isCustomerTokenInvalidated(token)) {
			throw customError(401, "Token has been invalidated");
		}

		// Verify token
		const decoded = verifyToken(token) as JWTPayload & { customerId: string };

		// Check if this is a customer token (you might add a 'type' field in JWT)
		if (decoded.type !== "customer") {
			throw customError(403, "Invalid token type. Customer access only");
		}

		// Fetch customer from database
		const customer = await Customer.findById(decoded.customerId).lean();

		if (!customer) {
			throw customError(401, "Customer not found or token invalid");
		}

		// Check if customer account is active
		if (customer.is_active === false) {
			throw customError(401, "Account deactivated");
		}

		// Attach customer info to request
		req.customer = {
			_id: customer._id.toString(),
			first_name: customer.first_name,
			last_name: customer.last_name,

			email: customer.email,
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

// Optional: Customer-specific verification middleware
export const requireVerifiedCustomer = (
	req: CustomerAuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		if (!req.customer) {
			throw customError(401, "Authentication required");
		}

		next();
	} catch (error) {
		next(error);
	}
};

export { invalidatedCustomerTokens };
