import { Router } from "express";
import { sendEmail } from "../../utils/emailSender";
import { renderSupportEmail } from "../../utils/generateEmailTemplate";

const router = Router();

router.post("/", async (req, res, next) => {
	try {
		const { name, email, subject, message } = req.body;

		await sendEmail({
			to: "yoursmilemattersp@gmail.com",
			from: `"Support Form" <${process.env.SMTP_USER}>`,
			replyTo: email || undefined,
			subject: `Support Inquiry: ${subject}`,
			html: renderSupportEmail({
				name,
				email,
				subject,
				message,
				companyName: "Your Smile Matters Photography",
				supportEmail: "yoursmilematters@gmail.com",
			}),
		});

		res.status(200).json({
			status: 200,
			message: "Email sent successfully",
			data: "Email sent successfully",
		});
	} catch (error) {
		next(error);
	}
});

export default router;
