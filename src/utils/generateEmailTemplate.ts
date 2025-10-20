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
