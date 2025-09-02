const getRequiredEnvVar = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Environment variable ${name} is required`);
	}
	return value;
};

const config = {
	jwtSecret: getRequiredEnvVar("JWT_SECRET"),
	accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
	refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "3d",
	port: process.env.PORT || 3000,
};

export default config;
