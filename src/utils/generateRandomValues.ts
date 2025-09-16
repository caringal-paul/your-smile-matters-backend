import crypto from "crypto";

export const generateRandomPassword = (length: number = 12): string => {
	const charset =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
	let password = "";

	// Ensure at least one of each type
	password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // Upper
	password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // Lower
	password += "0123456789"[Math.floor(Math.random() * 10)]; // Number
	password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // Special

	// Fill the rest randomly
	for (let i = 4; i < length; i++) {
		password += charset[Math.floor(Math.random() * charset.length)];
	}

	// Shuffle the password
	return password
		.split("")
		.sort(() => Math.random() - 0.5)
		.join("");
};

// utils/generateBookingNumber.ts
export const generateBookingReference = (): string => {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "BK-";

	for (let i = 0; i < 8; i++) {
		const randomIndex = Math.floor(Math.random() * chars.length);
		result += chars[randomIndex];
	}

	return result;
};

export const generateResetToken = (): {
	token: string;
	hashedToken: string;
} => {
	const token = crypto.randomBytes(32).toString("hex");
	const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

	return { token, hashedToken };
};
