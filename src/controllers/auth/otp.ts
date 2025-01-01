import { NextFunction, Response,Request } from 'express';
import {CustomError} from '../../types';
import { sendEmail } from '../../utility';
import { prisma } from '../../config';
import jwt from 'jsonwebtoken';

/**
 * Sends an OTP to the user's email for verification.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - The next middleware function.
 */
const sendOtpEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user) {
      next(new CustomError('User not found', 404));
      return;
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await Promise.allSettled([
      prisma.oTP.deleteMany({
      where: { email }
      }),
      prisma.oTP.create({
      data: {
        email,
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
      })
    ]);
    const data = `
      <body style="margin: 0; padding: 0; width: 100%; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; width: 100%; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9fafb; box-sizing: border-box;">
              <img src="https://i.ibb.co/41hPJtW/logo.png" alt="Logo" style="width: 80%; max-width: 150px; display: block; margin: 0 auto;">
              <p style="color: #555; font-size: 18px; line-height: 1.5; text-align: center;">&nbsp;Hello ${user.username},</p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">Thank you for signing up for Classence! To verify your email address, please enter the One-Time Password (OTP) below:</p>
              <div style="text-align: center; margin: 20px 0;">
                  <span style="font-size: 24px; font-weight: bold; color: #066769;">${otp}</span>
              </div>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">This OTP is valid for the next 10 minutes. Please keep it secure and do not share it with anyone.</p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">If you did not request this verification, please disregard this email.</p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">Best regards,<br>CodeClash Team</p>
              <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="font-size: 13px; color: #a1a1a1; text-align: center; line-height: 1.5;">
                  If you encounter any issues, please contact our support team at 
                  <a href="mailto:codeclash.noreply@gmail.com" style="color: #066769; text-decoration: none;">classence.help@gmail.com</a>.
              </p>
          </div>
      </body>
      `;
    
    sendEmail(user.email, 'Your OTP for email verification', data)
      .catch((error) => {console.log("Error sending email: ", error);});
  } catch (error) {
    const err = error as Error;
    next(new CustomError('Something went wrong',500,`${err.message}`));
  }
};

/**
 * Verifies the OTP sent to the user's email.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - The next middleware function.
 */
const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { email, otp } = req.body;
    email = email.trim();
    if(!email || !otp){
      next(new CustomError("Email and OTP are required", 400));
      return;
    }
    const result = await prisma.$transaction(async (tx) => {
      const storedOtp = await tx.oTP.findFirst({
        where: { 
          email,
          otp,
          expiresAt: { gt: new Date() }
        }
      });

      const user = await tx.user.findUnique({
        where: { email }
      });

      if (!user) {
        next(new CustomError("User not found", 404));
        return;
      }
      if (!storedOtp) {
        next(new CustomError("Invalid Otp", 400));
        return;
      }


      if (user.isVerified) {
        next(new CustomError("User Already Verified", 400));
        return;
      }

      await tx.user.update({
        where: { email },
        data: { isVerified: true }
      });

      await tx.oTP.delete({
        where: { id: storedOtp.id }
      });
      const accessTokenKey = process.env.ACCESS_TOKEN_SECRET;
      const refreshTokenKey = process.env.REFRESH_TOKEN_SECRET;
      if (!accessTokenKey || !refreshTokenKey) {
        console.error("Environment variables not set");
        next(new CustomError("Something went wrong", 500));
        return null;
      }
      const accessToken = jwt.sign(
        { userId: user.id,version:user.version },
        accessTokenKey,
        { expiresIn: "1h" }
      );
      const refreshToken = jwt.sign(
        { userId: user.id ,version:user.version},
        refreshTokenKey,
        { expiresIn: "7d" }
      );
      return { user, accessToken, refreshToken };
    });
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      data:{
        userId:result?.user.id,
        tokens:{
          accessToken:result?.accessToken,
          refreshToken:result?.refreshToken
      }
    }
    });

  } catch (error) {
    const err = error as Error;
    next(new CustomError('Something went wrong', 500, `${err.message}`));
  }
};

/**
 * Resends an OTP to the user's email if the user is not verified.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - The next middleware function.
 */
const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      next(new CustomError('User not found!', 404));
      return;
    }

    if (user.isVerified) {
      next(new CustomError('Email already verified!', 400));
      return;
    }


    const latestOtp = await prisma.oTP.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' }
    });

    const thirtySeconds = 30 * 1000;
    if (latestOtp && 
        Date.now() - latestOtp.createdAt.getTime() < thirtySeconds) {
      next(new CustomError('OTP requests are limited to one per 30 seconds.', 429));
      return;
    }
    sendOtpEmail(req, res, next);
    res.status(200).json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    const err = error as Error;
    next(new CustomError('Something went wrong', 500, `${err.message}`));
  }
};

    
export {verifyOtp,sendOtpEmail,resendOtp};