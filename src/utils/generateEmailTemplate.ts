// FOR CUSTOMER USERS
export const renderBookingApprovalEmail = (opts: {
	firstName: string;
	lastName: string;
	customerNo: string;
	email: string;
	bookingNo: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Booking Approval Pending - ${opts.companyName}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Booking Sent for Approval 🕒
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        Your booking is currently under review.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.firstName} ${opts.lastName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        Thank you for your booking. Your request has been sent for approval.<br/>
                        Once confirmed, we will send you a confirmation email.
                      </p>
                      <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #eef6ff;background:#fbfdff;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#846e62;font-family:Arial,Helvetica,sans-serif;text-align:center;">
                            <p style="margin:0;">
                              <strong>Customer Number:</strong> 
                              <span style="font-family:monospace;background:#846e62;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.customerNo}
                              </span>
                            </p>
                            <p style="margin:10px 0 0;"><strong>Booking Number:</strong> 
                              <span style="font-family:monospace;background:#846e62;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.bookingNo}
                              </span>
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Email:</strong> ${opts.email}
                            </p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 18px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        ⚠️ Please wait for the confirmation email.  
                        You will be notified once your booking is approved.
                      </p>
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact us at
                        <a href="mailto:${
													opts.supportEmail
												}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};

export const renderSupportEmail = (opts: {
	name: string;
	email: string;
	subject: string;
	message: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
      <title>New Support Inquiry - ${opts.companyName}</title>
    </head>
    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
      <center style="width:100%;background:#f6f7fb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:28px 16px;text-align:center;">
              <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                
                <tr>
                  <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                    <h2 style="margin:0;font-size:20px;color:#846e62;">
                      New Support Request 📩
                    </h2>
                    <p style="margin:6px 0 0;font-size:14px;color:#51606b;">
                      Someone has submitted a support inquiry.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="left" style="padding:24px 36px;text-align:left;">
                    
                    <p style="margin:0 0 16px;font-size:15px;color:#846e62;">
                      <strong>Name:</strong> ${opts.name || "Anonymous"}
                    </p>

                    <p style="margin:0 0 16px;font-size:15px;color:#846e62;">
                      <strong>Email:</strong> ${
												opts.email || "No email provided"
											}
                    </p>

                    <p style="margin:0 0 16px;font-size:15px;color:#846e62;">
                      <strong>Subject:</strong> ${opts.subject}
                    </p>

                    <table cellpadding="12" cellspacing="0" style="margin:12px 0;border:1px solid #eef6ff;background:#fbfdff;border-radius:8px;width:100%;">
                      <tr>
                        <td style="font-size:14px;color:#475569;line-height:1.6;">
                          <strong>Message:</strong>
                          <br/>
                          <div style="margin-top:8px;white-space:pre-wrap;">
                            ${opts.message}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />

                    <p style="margin:0;font-size:13px;color:#64748b;">
                      This email was automatically generated from your support form.
                      If you have questions, contact us at  
                      <a href="mailto:${
												opts.supportEmail
											}" style="color:#0b61d1;text-decoration:none;">
                        ${opts.supportEmail}
                      </a>.
                    </p>

                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;">
                    © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </center>
    </body>
  </html>`;
};

export const renderCustomerWelcomeEmail = (opts: {
	firstName: string;
	lastName: string;
	customerNo: string;
	email: string;
	password: string;
	loginUrl: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Welcome to ${opts.companyName}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Welcome to ${opts.companyName}! 🎉
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        Your customer account has been created
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.firstName} ${opts.lastName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        Thank you for joining us! Your customer account has been successfully created.<br/>
                        Here are your account details:
                      </p>
                      <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #eef6ff;background:#fbfdff;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#846e62;font-family:Arial,Helvetica,sans-serif;text-align:center;">
                            <p style="margin:0;">
                              <strong>Customer Number:</strong> 
                              <span style="font-family:monospace;background:#846e62;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.customerNo}
                              </span>
                            </p>
                            <p style="margin:10px 0 0;"><strong>Email:</strong> ${
															opts.email
														}</p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Temporary Password:</strong>
                              <span style="font-family:monospace;background:#cbbfb8;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.password}
                              </span>
                            </p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 18px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        <strong>⚠️ Important:</strong> Please change your password after your first login for security.
                      </p>
                      <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                        <tr>
                          <td bgcolor="#846e62" align="center" style="border-radius:6px;">
                            <a href="${
															opts.loginUrl
														}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#fff;text-decoration:none;font-weight:600;border-radius:6px;">
                              Login to Your Account
                            </a>
                          </td>
                        </tr>
                      </table>
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        <strong>What's next?</strong>
                      </p>
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        • Browse our products and services<br/>
                        • Update your profile information<br/>
                        • Start shopping with exclusive customer benefits
                      </p>
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact us at
                        <a href="mailto:${
													opts.supportEmail
												}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};

// FOR AMI USERS
export const renderBookingApprovedEmail = (opts: {
	firstName: string;
	lastName: string;
	bookingNo: string;
	bookingDate: string;
	startTime: string;
	endTime: string;
	photographerName?: string | undefined;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Booking Approved - ${opts.companyName}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Booking Approved!
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        Your booking has been confirmed!
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.firstName} ${opts.lastName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        Great news! Your booking has been approved and confirmed.<br/>
                        We look forward to capturing your special moments!
                      </p>
                      <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dcfce7;background:#bdada4;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#846e62;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;">
                              <strong>Booking Number:</strong> 
                              <span style="font-family:monospace;background:#6f5a4d;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.bookingNo}
                              </span>
                            </p>
                            <p style="margin:10px 0 0;color:#333;">
                              <strong>Date:</strong> ${opts.bookingDate}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Time:</strong> ${opts.startTime} - ${
		opts.endTime
	}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Photographer:</strong> ${
																opts.photographerName ?? "To Be Assigned"
															}
                            </p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 18px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        📸 Please arrive 10 minutes before your scheduled time.<br/>
                        If you need to reschedule or have any questions, please contact us.
                      </p>
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact us at
                        <a href="mailto:${
													opts.supportEmail
												}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};

export const renderPhotographerWelcomeEmail = ({
	name,
	email,
	password,
	loginUrl,
	companyName,
	supportEmail,
}: {
	name: string;
	email: string;
	password: string;
	loginUrl: string;
	companyName: string;
	supportEmail: string;
}): string => {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Welcome to ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
	<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
		<tr>
			<td align="center">
				<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
							<h1 style="color: #ffffff; margin: 0; font-size: 28px;">📸 Welcome to ${companyName}!</h1>
						</td>
					</tr>
					
					<!-- Content -->
					<tr>
						<td style="padding: 40px 30px;">
							<h2 style="color: #333333; margin-top: 0;">Hello ${name}! 👋</h2>
							<p style="color: #666666; font-size: 16px; line-height: 1.6;">
								We're excited to have you join our team of photographers! Your account has been created successfully.
							</p>
							
							<div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
								<h3 style="margin-top: 0; color: #333333;">Your Login Credentials</h3>
								<p style="color: #666666; margin: 10px 0;">
									<strong>Email:</strong> ${email}
								</p>
								<p style="color: #666666; margin: 10px 0;">
									<strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${password}</code>
								</p>
							</div>
							
							<p style="color: #666666; font-size: 16px; line-height: 1.6;">
								⚠️ <strong>Important:</strong> Please change your password after your first login for security purposes.
							</p>
							
							<div style="text-align: center; margin: 40px 0;">
								<a href="${loginUrl}" style="background-color: #667eea; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
									Login to Your Account
								</a>
							</div>
							
							<div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin-top: 30px;">
								<p style="color: #856404; margin: 0; font-size: 14px;">
									<strong>📌 Next Steps:</strong><br>
									1. Login with your temporary password<br>
									2. Update your profile and portfolio<br>
									3. Set your availability schedule<br>
									4. Start accepting bookings!
								</p>
							</div>
						</td>
					</tr>
					
					<!-- Footer -->
					<tr>
						<td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
							<p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
								Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #667eea; text-decoration: none;">${supportEmail}</a>
							</p>
							<p style="color: #999999; font-size: 12px; margin: 0;">
								© ${new Date().getFullYear()} ${companyName}. All rights reserved.
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
	`;
};

export const renderNewAccountEmail = (opts: {
	role: string;
	firstName: string;
	email: string;
	password: string;
	loginUrl: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Welcome</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Welcome to ${opts.companyName}
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        Your ${opts.role} account is ready
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.firstName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        We’ve created a new <strong>${opts.role}</strong> account for you.<br/>
                        Use the credentials below to sign in:
                      </p>
                      <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #eef6ff;background:#fbfdff;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#846e62;font-family:Arial,Helvetica,sans-serif;text-align:center;">
                            <p style="margin:0;"><strong>Email:</strong> ${opts.email}</p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Temporary password:</strong>
                              <span style="font-family:monospace;background:#cbbfb8;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.password}
                              </span>
                            </p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 18px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        Please change your password after signing in.
                      </p>
                      <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                        <tr>
                          <td bgcolor="#846e62" align="center" style="border-radius:6px;">
                            <a href="${opts.loginUrl}" style="display:inline-block;padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#fff;text-decoration:none;font-weight:600;border-radius:6px;">
                              Sign in to your account
                            </a>
                          </td>
                        </tr>
                      </table>
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact
                        <a href="mailto:${opts.supportEmail}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${opts.companyName}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};

// * NEW
export const renderBookingConfirmedAdminEmail = (opts: {
	customerName: string;
	customerEmail: string;
	bookingNo: string;
	bookingDate: string;
	startTime: string;
	endTime: string;
	photographerName?: string;
	confirmedBy: string; // Actual user/admin who confirmed
	companyName: string;
	supportEmail: string;
}) => {
	return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
      <title>Booking Confirmed - ${opts.companyName}</title>
    </head>
    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
      <center style="width:100%;background:#f6f7fb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:28px 16px;text-align:center;">
              <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                <tr>
                  <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                    <h2 style="margin:0;font-size:20px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                      Booking Confirmed Notification
                    </h2>
                    <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                      A booking has been confirmed in the system.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:24px 36px;">
                    <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                      <strong>Customer:</strong> ${opts.customerName} (${
		opts.customerEmail
	})
                    </p>
                    <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dcfce7;background:#f3f4f6;border-radius:8px;width:100%;">
                      <tr>
                        <td style="font-size:13px;color:#333;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                          <p style="margin:0;">
                            <strong>Booking Number:</strong> 
                            <span style="font-family:monospace;background:#6f5a4d;padding:4px 8px;border-radius:4px;color:#fff;">
                              ${opts.bookingNo}
                            </span>
                          </p>
                          <p style="margin:6px 0 0;">
                            <strong>Date:</strong> ${opts.bookingDate}
                          </p>
                          <p style="margin:6px 0 0;">
                            <strong>Time:</strong> ${opts.startTime} - ${
		opts.endTime
	}
                          </p>
                          <p style="margin:6px 0 0;">
                            <strong>Photographer:</strong> ${
															opts.photographerName ?? "To Be Assigned"
														}
                          </p>
                          <p style="margin:6px 0 0;">
                            <strong>Confirmed By:</strong> ${opts.confirmedBy}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                      Please review the booking in the admin panel if needed.
                    </p>
                    <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                    <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                      Contact support: 
                      <a href="mailto:${
												opts.supportEmail
											}" style="color:#0b61d1;text-decoration:none;">
                        ${opts.supportEmail}
                      </a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                    © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
    </body>
  </html>
  `;
};

/**
 * Email template when customer requests reschedule (sent to Super Admin)
 */
export const renderRescheduleRequestAdminEmail = (opts: {
	adminName: string;
	customerName: string;
	customerEmail: string;
	bookingNo: string;
	currentBookingDate: string;
	currentStartTime: string;
	currentEndTime: string;
	newBookingDate: string;
	newStartTime: string;
	newEndTime: string;
	rescheduleReason: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>New Reschedule Request - ${opts.companyName}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#d97706;font-family:Arial,Helvetica,sans-serif;">
                        🔔 New Reschedule Request
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        Action Required - Review Request
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.adminName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        A customer has submitted a reschedule request that requires your review.
                      </p>
                      
                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #fde68a;background:#fef3c7;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#92400e;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-size:14px;font-weight:bold;color:#d97706;">
                              Customer Information
                            </p>
                            <p style="margin:8px 0 0;color:#333;">
                              <strong>Name:</strong> ${opts.customerName}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Email:</strong> ${opts.customerEmail}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Booking #:</strong> 
                              <span style="font-family:monospace;background:#d97706;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.bookingNo}
                              </span>
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#374151;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-size:14px;font-weight:bold;color:#6b7280;">
                              Current Schedule
                            </p>
                            <p style="margin:8px 0 0;color:#333;">
                              <strong>Date:</strong> ${opts.currentBookingDate}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Time:</strong> ${
																opts.currentStartTime
															} - ${opts.currentEndTime}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dcfce7;background:#d1fae5;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#065f46;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-size:14px;font-weight:bold;color:#059669;">
                              Requested New Schedule
                            </p>
                            <p style="margin:8px 0 0;color:#333;">
                              <strong>Date:</strong> ${opts.newBookingDate}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Time:</strong> ${opts.newStartTime} - ${
		opts.newEndTime
	}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#1e3a8a;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-size:14px;font-weight:bold;color:#2563eb;">
                              Reason for Reschedule
                            </p>
                            <p style="margin:8px 0 0;color:#333;font-style:italic;">
                              "${opts.rescheduleReason}"
                            </p>
                          </td>
                        </tr>
                      </table>

                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact us at
                        <a href="mailto:${
													opts.supportEmail
												}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};

/**
 * Email template when reschedule is approved (sent to Customer)
 */
export const renderRescheduleApprovedCustomerEmail = (opts: {
	firstName: string;
	lastName: string;
	bookingNo: string;
	newBookingDate: string;
	newStartTime: string;
	newEndTime: string;
	photographerName?: string;
	adminNotes?: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Reschedule Request Approved - ${opts.companyName}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#10b981;font-family:Arial,Helvetica,sans-serif;">
                        ✓ Reschedule Request Approved!
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        Your booking has been successfully rescheduled
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.firstName} ${opts.lastName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        Great news! Your reschedule request has been approved.<br/>
                        Your booking has been updated to the new date and time.
                      </p>
                      <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dcfce7;background:#d1fae5;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#065f46;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;">
                              <strong>Booking Number:</strong> 
                              <span style="font-family:monospace;background:#059669;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.bookingNo}
                              </span>
                            </p>
                            <p style="margin:10px 0 0;color:#333;">
                              <strong>New Date:</strong> ${opts.newBookingDate}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>New Time:</strong> ${
																opts.newStartTime
															} - ${opts.newEndTime}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Photographer:</strong> ${
																opts.photographerName ?? "To Be Assigned"
															}
                            </p>
                          </td>
                        </tr>
                      </table>
                      ${
												opts.adminNotes
													? `
                      <table cellpadding="10" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#1e3a8a;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-weight:bold;color:#2563eb;">
                              Notes from Admin:
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              ${opts.adminNotes}
                            </p>
                          </td>
                        </tr>
                      </table>
                      `
													: ""
											}
                      <p style="margin:0 0 18px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        📸 Please arrive 10 minutes before your scheduled time.<br/>
                        We look forward to seeing you at your new appointment!
                      </p>
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact us at
                        <a href="mailto:${
													opts.supportEmail
												}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};

/**
 * Email template when reschedule is approved (sent to other Super Admins)
 */
export const renderRescheduleApprovedAdminEmail = (opts: {
	adminName: string;
	approvedBy: string;
	customerName: string;
	customerEmail: string;
	bookingNo: string;
	newBookingDate: string;
	newStartTime: string;
	newEndTime: string;
	photographerName?: string;
	adminNotes?: string;
	companyName: string;
	supportEmail: string;
}) => {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Reschedule Request Approved - ${opts.companyName}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">
        <center style="width:100%;background:#f6f7fb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 16px;text-align:center;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="padding:24px 36px;border-bottom:1px solid #eee;text-align:center;">
                      <h2 style="margin:0;font-size:20px;color:#10b981;font-family:Arial,Helvetica,sans-serif;">
                        ✓ Reschedule Request Approved
                      </h2>
                      <p style="margin:6px 0 0;font-size:14px;color:#51606b;font-family:Arial,Helvetica,sans-serif;">
                        A booking has been successfully rescheduled
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 36px;text-align:center;">
                      <p style="margin:0 0 12px;font-size:15px;color:#846e62;font-family:Arial,Helvetica,sans-serif;">
                        Hi ${opts.adminName},
                      </p>
                      <p style="margin:0 0 16px;font-size:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
                        <strong>${
													opts.approvedBy
												}</strong> has approved a reschedule request.
                      </p>
                      
                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#374151;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-size:14px;font-weight:bold;color:#6b7280;">
                              Customer Information
                            </p>
                            <p style="margin:8px 0 0;color:#333;">
                              <strong>Name:</strong> ${opts.customerName}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Email:</strong> ${opts.customerEmail}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Booking #:</strong> 
                              <span style="font-family:monospace;background:#6b7280;padding:4px 8px;border-radius:4px;color:#fff;">
                                ${opts.bookingNo}
                              </span>
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dcfce7;background:#d1fae5;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#065f46;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-size:14px;font-weight:bold;color:#059669;">
                              New Schedule
                            </p>
                            <p style="margin:8px 0 0;color:#333;">
                              <strong>Date:</strong> ${opts.newBookingDate}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Time:</strong> ${opts.newStartTime} - ${
		opts.newEndTime
	}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Photographer:</strong> ${
																opts.photographerName ?? "To Be Assigned"
															}
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              <strong>Approved By:</strong> ${opts.approvedBy}
                            </p>
                          </td>
                        </tr>
                      </table>

                      ${
												opts.adminNotes
													? `
                      <table cellpadding="12" cellspacing="0" align="center" style="margin:12px auto 18px;border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;">
                        <tr>
                          <td style="font-size:13px;color:#1e3a8a;font-family:Arial,Helvetica,sans-serif;text-align:left;">
                            <p style="margin:0;font-weight:bold;color:#2563eb;">
                              Admin Notes:
                            </p>
                            <p style="margin:6px 0 0;color:#333;">
                              ${opts.adminNotes}
                            </p>
                          </td>
                        </tr>
                      </table>
                      `
													: ""
											}
                      
                      <hr style="border:none;border-top:1px solid #eee;margin:20px auto;width:80%;" />
                      <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                        Need help? Contact us at
                        <a href="mailto:${
													opts.supportEmail
												}" style="color:#0b61d1;text-decoration:none;">
                          ${opts.supportEmail}
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 36px;background:#fbfdff;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                      © ${new Date().getFullYear()} ${
		opts.companyName
	}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>`;
};
