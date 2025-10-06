// Service categories that photographers can specialize in
export const ServiceCategoryEnum = {
	Photography: "Photography",
	Beauty: "Beauty",
	Styling: "Styling",
	Equipment: "Equipment",
	Other: "Other",
} as const;

export type ServiceCategory = keyof typeof ServiceCategoryEnum;
