import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import config from "../config/token";

interface JWTPayload {
	userId: string;
	email: string;
	iat?: number;
	exp?: number;
	type?: "access" | "refresh";
}

// ---------------------------
// Generate Access Token
// ---------------------------
export const generateAccessToken = (userId: string, email: string): string => {
	console.log("Access Token:", process.env.JWT_ACCESS_EXPIRES_IN);

	return jwt.sign({ userId, email, type: "access" }, config.jwtSecret, {
		expiresIn: config.accessTokenExpiresIn as SignOptions["expiresIn"],
	});
};

// ---------------------------
// Generate Refresh Token
// ---------------------------
export const generateRefreshToken = (userId: string, email: string): string => {
	return jwt.sign({ userId, email, type: "refresh" }, config.jwtSecret, {
		expiresIn: config.refreshTokenExpiresIn as SignOptions["expiresIn"],
	});
};

// ---------------------------
// Verify Token
// ---------------------------
export const verifyToken = (token: string): JWTPayload => {
	console.log("isVerified?", jwt.verify(token, config.jwtSecret));
	return jwt.verify(token, config.jwtSecret) as JWTPayload;
};

// ---------------------------
// Password Helpers
// ---------------------------
export const hashPassword = async (password: string): Promise<string> => {
	return bcrypt.hash(password, 12);
};

export const comparePassword = async (
	password: string,
	hashedPassword?: string
): Promise<boolean> => {
	try {
		if (!password || !hashedPassword) {
			throw new Error("Password or hashed password is missing");
		}
		return await bcrypt.compare(password, hashedPassword);
	} catch (error) {
		console.error("Error in comparePassword:", error);
		throw error;
	}
};
