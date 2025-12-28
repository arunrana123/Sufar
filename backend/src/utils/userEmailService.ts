import nodemailer from 'nodemailer';

// Email configuration for user app
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'ainmillions73@gmail.com',
    pass: process.env.EMAIL_PASS || 'guui mjxr dkxu cmpy',
  },
});

export const sendUserOTPEmail = async (email: string, otp: string, firstName?: string) => {
  try {
    const mailOptions = {
      from: `${process.env.EMAIL_USER || 'Sufar Service'} <${process.env.EMAIL_USER || 'noreply@sufar.com'}>`,
      to: email,
      subject: 'Password Reset OTP - Sufar Service App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #0a7ea4 0%, #2196F3 100%); color: white; padding: 40px 30px; text-align: center; }
            .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
            .subtitle { font-size: 16px; opacity: 0.9; }
            .content { padding: 40px 30px; background: #ffffff; }
            .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
            .otp-section { text-align: center; margin: 30px 0; }
            .otp-box { 
              display: inline-block;
              background: linear-gradient(135deg, #0a7ea4 0%, #2196F3 100%); 
              color: white; 
              padding: 20px 30px; 
              border-radius: 12px; 
              margin: 20px 0;
              box-shadow: 0 4px 15px rgba(10, 126, 164, 0.3);
            }
            .otp-label { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
            .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; }
            .validity { color: #FF5722; font-weight: 600; margin: 20px 0; }
            .security { 
              background: #f8f9fa; 
              border-left: 4px solid #0a7ea4; 
              padding: 20px; 
              margin: 30px 0; 
              border-radius: 0 8px 8px 0;
            }
            .security-title { color: #0a7ea4; font-weight: bold; margin-bottom: 10px; }
            .security-list { margin: 0; padding-left: 20px; }
            .security-list li { margin-bottom: 8px; }
            .footer { 
              background: #f8f9fa; 
              padding: 20px 30px; 
              text-align: center; 
              border-top: 1px solid #e0e0e0; 
            }
            .footer-text { color: #666; font-size: 14px; margin: 5px 0; }
            .footer-small { color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛠️ Sufar</div>
              <div class="subtitle">Your Trusted Service Platform</div>
            </div>
            
            <div class="content">
              <div class="greeting">Hello${firstName ? ` ${firstName}` : ''}! 👋</div>
              
              <p>You've requested to reset your password for your Sufar account. We've generated a secure verification code for you:</p>
              
              <div class="otp-section">
                <div class="otp-box">
                  <div class="otp-label">Your Verification Code</div>
                  <div class="otp-code">${otp}</div>
                </div>
              </div>
              
              <div class="validity">⏰ This code expires in 10 minutes</div>
              
              <p>Enter this code in the Sufar app to continue with your password reset.</p>
              
              <div class="security">
                <div class="security-title">🔒 Security Reminder</div>
                <ul class="security-list">
                  <li>Never share this verification code with anyone</li>
                  <li>Sufar staff will never ask for your verification code</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your account remains secure until you complete the reset process</li>
                </ul>
              </div>
              
              <p>If you need help or have questions, please contact our support team.</p>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>The Sufar Team</strong> 💙
              </p>
            </div>
            
            <div class="footer">
              <div class="footer-text">© ${new Date().getFullYear()} Sufar Service Platform. All rights reserved.</div>
              <div class="footer-small">This is an automated security message. Please do not reply to this email.</div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ User OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ User email send error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ User email service is ready');
    return true;
  } catch (error) {
    console.error('❌ User email service error:', error);
    return false;
  }
};