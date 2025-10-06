export const formatFieldName = (name: string): string => {
	return name
		.split("_") // split snake_case
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // capitalize
		.join(" "); // rejoin with spaces
};
