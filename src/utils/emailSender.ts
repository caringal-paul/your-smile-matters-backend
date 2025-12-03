import nodemailer, { Transporter, SentMessageInfo } from "nodemailer";

export interface EmailOptions {
	from?: string;
	replyTo?: string;
	to: string | string[];
	subject: string;
	text?: string;
	html?: string;
	cc?: string[];
	bcc?: string[];
	attachments?: Array<{
		filename: string;
		content: Buffer | string;
		contentType?: string;
	}>;
}

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
	if (!transporter) {
		transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: parseInt(process.env.SMTP_PORT || "587"),
			secure: process.env.SMTP_PORT === "465",
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASSWORD,
			},
		});
	}
	return transporter;
};

export const sendEmail = async (
	options: EmailOptions
): Promise<SentMessageInfo> => {
	const toArray = Array.isArray(options.to) ? options.to : [options.to];

	try {
		const transport = getTransporter();

		const info = await transport.sendMail({
			from: options.from || process.env.SMTP_USER,
			replyTo: options.replyTo,
			to: toArray.join(", "),
			cc: options.cc?.join(", "),
			bcc: options.bcc?.join(", "),
			subject: options.subject,
			text: options.text,
			html: options.html,
			attachments: options.attachments,
		});

		return info;
	} catch (error) {
		console.error("Error sending email:", error);
		throw error;
	}
};

export const verifyConnection = async (): Promise<boolean> => {
	try {
		const transport = getTransporter();
		await transport.verify();
		console.log("SMTP connection verified");
		return true;
	} catch (error) {
		console.error("SMTP connection failed:", error);
		return false;
	}
};
