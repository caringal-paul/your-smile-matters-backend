export const formatToPeso = (amount: string | undefined) => {
	if (!amount) return;

	const num = typeof amount === "string" ? parseFloat(amount) : amount;

	return `₱ ${num.toLocaleString("en-NG", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
};
