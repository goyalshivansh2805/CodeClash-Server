import { Response, Request, NextFunction } from "express";
import { prisma } from "../../config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { sendEmail } from "../../utility"; 
import { CustomError } from "../../types";

const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { email } = req.body;
    email = email?.trim().toLowerCase();
    
    if (!email) {
      next(new CustomError('Email is required', 400));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });
  
    if (!user || !user.isVerified) {
      next(new CustomError('User not found', 404));
      return;
    }

    const thirtySeconds = 0.5 * 60 * 1000;
    const now = new Date();
    
    if (user.lastPasswordResetRequest && 
        (now.getTime() - user.lastPasswordResetRequest.getTime()) < thirtySeconds) {
      next(new CustomError('You can request a new password reset link only every 30 sec', 429));
      return;
    }
  
    const token = jwt.sign({ userId: user.id }, process.env.RESET_PASSWORD_TOKEN_SECRET as string, { expiresIn: '1h' });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: new Date(Date.now() + 3600000),
        lastPasswordResetRequest: now
      }});
    const data = `
    <body style="margin: 0; padding: 0; width: 100%; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; width: 100%; margin: 20px auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://i.ibb.co/41hPJtW/logo.png" alt="Logo" style="width: 120px; max-width: 100%;">
        </div>
        <p style="color: #333333; font-size: 18px; line-height: 1.5; text-align: center; margin: 0 20px;">
          Hello ${user.username},
        </p>
        <p style="color: #555555; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 20px;">
          We received a request to reset your password. Click the button below to proceed:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #066769; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <p style="color: #555555; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 20px;">
          If you didn't request this, please ignore this email. Your account will remain secure.
        </p>
        <p style="color: #555555; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 20px;">
          Best regards,<br>
          CodeClash Team
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="font-size: 13px; color: #a1a1a1; text-align: center; margin: 20px;">
          If you're having trouble clicking the button, copy and paste the URL below into your web browser:
        </p>
        <p style="font-size: 13px; color: #066769; word-break: break-all; text-align: center; margin: 0;">
          <a href="${resetUrl}" style="color: #066769; text-decoration: none;">${resetUrl}</a>
        </p>
      </div>
    </body>
  `;

    
    sendEmail(user.email, 'Password Reset Request', data)
      .catch((error)=>{console.log("Error sending email: ", error);});
  
    res.status(200).json({ 
      success: true, 
      message: 'Password reset link has been sent to your email! Please check your inbox, it should arrive within a few seconds.'
    });
  } catch (error) {
    const err = error as Error;
    next(new CustomError('Something went wrong',500,`${err.message}`));
  }
};

const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    let { password } = req.body;
    password = password.trim();

    if (!password) {
      next(new CustomError('Password is required', 400));
      return;
    }

    if (typeof token !== 'string') {
      next(new CustomError('Invalid token', 400));
      return;
    }
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.RESET_PASSWORD_TOKEN_SECRET as string) as jwt.JwtPayload;
    } catch (error) {
      next(new CustomError('Invalid token', 400));
      return;
    }
    const userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.resetPasswordToken !== token) {
      next(new CustomError('Invalid token', 400));
      return;
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      next(new CustomError('Invalid or expired token', 400));
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken: null,
        resetPasswordExpires: null,
        password: hashedPassword,
        version: { increment: 1 }
      }
    });

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    const err = error as Error;
    next(new CustomError('Something went wrong', 500, `${err.message}`));
  }
};

export { requestPasswordReset, resetPassword };