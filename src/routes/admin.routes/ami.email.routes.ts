import { Router, Request, Response } from "express";
import { sendEmail } from "../../utils/emailSender";

const router = Router();

// Send an email
router.post("/send", async (req: Request, res: Response) => {
	try {
		const { to, subject, text, html, cc, bcc } = req.body;

		if (!to || !subject) {
			return res.status(400).json({
				success: false,
				message: "Missing required fields: to, subject",
			});
		}

		const info = await sendEmail({
			to,
			subject,
			text,
			html,
			cc,
			bcc,
		});

		res.status(200).json({
			success: true,
			message: "Email sent successfully",
			data: {
				messageId: info.messageId,
				accepted: info.accepted,
				rejected: info.rejected,
			},
		});
	} catch (error) {
		console.error("Error sending email:", error);
		res.status(500).json({
			success: false,
			message: "Failed to send email",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

export default router;
