import nodemailer from 'nodemailer';

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || 'your-app-password', // Gmail App Password
  },
});

export const sendOTPEmail = async (email: string, otp: string, workerName?: string) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'Sufar Service <noreply@sufar.com>',
      to: email,
      subject: 'Password Reset OTP - Sufar Worker App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF7A2C 0%, #FF5722 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px solid #FF7A2C; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #FF7A2C; letter-spacing: 8px; }
            .warning { color: #666; font-size: 14px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sufar Worker App</h1>
              <p>Password Reset Request</p>
            </div>
            <div class="content">
              <p>Hello${workerName ? ` ${workerName}` : ''},</p>
              <p>You have requested to reset your password. Use the OTP code below to complete the process:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
              
              <div class="warning">
                <p>⚠️ <strong>Security Notice:</strong></p>
                <ul>
                  <li>Never share this OTP with anyone</li>
                  <li>Sufar will never ask for your OTP via phone or email</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>
              
              <p>If you need assistance, please contact our support team.</p>
              
              <p>Best regards,<br><strong>Sufar Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Sufar. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error);
    return false;
  }
};

