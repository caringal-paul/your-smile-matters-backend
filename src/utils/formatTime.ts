export const formatTime12Hour = (time24: string | null | undefined): string => {
	if (!time24) return "N/A"; // handle null/undefined

	const [hourStr, minuteStr] = time24.split(":");
	if (hourStr === undefined || minuteStr === undefined) return "N/A";

	let hour = parseInt(hourStr, 10);
	const minute = parseInt(minuteStr, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	hour = hour % 12;
	if (hour === 0) hour = 12;

	return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};
