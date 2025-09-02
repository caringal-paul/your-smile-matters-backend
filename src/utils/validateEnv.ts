export const validateEnvironment = () => {
	const requiredVars = ["JWT_SECRET"];

	for (const varName of requiredVars) {
		if (!process.env[varName]) {
			console.error(`❌ Missing required environment variable: ${varName}`);
			process.exit(1);
		}
	}

	console.log("✅ Environment variables validated");
};
