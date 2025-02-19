import { NextFunction, Response,Request } from 'express';
import {CustomError, CustomOtpRequest} from '../../types';
import { sendEmail } from '../../utility';
import { prisma } from '../../config';
import jwt from 'jsonwebtoken';
import {UAParser} from "ua-parser-js";

const generateEmailContent = (otp: string, username: string, type: string) => {
  const isRegister = type === "register";
  const subjectText = isRegister
    ? "Thank you for signing up for CodeClash! To verify your email address, please enter the One-Time Password (OTP) below:"
    : "To log in to CodeClash, please enter the One-Time Password (OTP) below:";
  const closingText = isRegister
    ? "If you did not request this verification, please disregard this email."
    : "If you did not attempt to log in, please disregard this email.";

  return `
      <body style="margin: 0; padding: 0; width: 100%; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; width: 100%; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9fafb; box-sizing: border-box;">
              <img src="https://i.ibb.co/T1BNfgR/Untitled.jpg" alt="Logo" style="width: 80%; max-width: 150px; display: block; margin: 0 auto;">
              <p style="color: #555; font-size: 18px; line-height: 1.5; text-align: center;">&nbsp;Hello ${username},</p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">${subjectText}</p>
              <div style="text-align: center; margin: 20px 0;">
                  <span style="font-size: 24px; font-weight: bold; color: #ad44d9;">${otp}</span>
              </div>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">This OTP is valid for the next 10 minutes. Please keep it secure and do not share it with anyone.</p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">${closingText}</p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">Best regards,<br>CodeClash Team</p>
              <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="font-size: 13px; color: #a1a1a1; text-align: center; line-height: 1.5;">
                  If you encounter any issues, please contact our support team at 
                  <a href="mailto:codeclash.noreply@gmail.com" style="color: #ad44d9; text-decoration: none;">codeclash.noreply@gmail.com</a>.
              </p>
          </div>
      </body>
      `;
};

/**
 * Sends an OTP to the user's email for verification.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - The next middleware function.
 */
const sendOtpEmail = async (req: CustomOtpRequest, res: Response, next: NextFunction) => {
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
    const data = generateEmailContent(otp, user.username as string, req.type!);
    if(req.type === "login"){
      res.status(200).json({ success: true, message: 'OTP sent to your email' });
    }
    sendEmail(
      user.email,
      req.type === "register" ? "Your OTP for email verification" : "Your OTP for login",
      data
    ).catch((error) => {console.log("Error sending email: ", error);});
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
const verifyOtp = async (req: CustomOtpRequest, res: Response, next: NextFunction) => {
  try {
    let { email, otp } = req.body;
    email = email.trim().toLowerCase();
    const type = req.type;
    if(!email || !otp || !type){
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


      if (user.isVerified && type === "register") {
        next(new CustomError("User Already Verified", 400));
        return;
      }
      if (!user.isVerified && type === "login") {
        next(new CustomError("User Not Verified", 400));
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
        { expiresIn: "10h" }
      );
      const refreshToken = jwt.sign(
        { userId: user.id ,version:user.version},
        refreshTokenKey,
        { expiresIn: "7d" }
      );
      const userAgent = req.headers["user-agent"];
      const parser = new UAParser(userAgent);
      const uaDetails = parser.getResult();
      const forwardedFor = Array.isArray(req.headers["x-forwarded-for"]) 
          ? req.headers["x-forwarded-for"][0] 
          : req.headers["x-forwarded-for"];

      const sessionData = {
        userId: user.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        refreshToken: refreshToken,
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: forwardedFor?.split(",")[0]?.trim() || req.ip || "Unknown",
        userAgent: userAgent || "Unknown",
        location: forwardedFor?.split(",")[0]?.trim() || "Unknown",
        device: String(req.headers["x-device"] || uaDetails.device?.model || "Unknown"),
        browser: String(req.headers["x-browser"] || uaDetails.browser?.name || "Unknown"),
        os: String(req.headers["x-os"] || uaDetails.os?.name || "Unknown"),
      };

      await prisma.session.create({
        data:sessionData
      })
      return { user, accessToken, refreshToken };
    });
    
    res.status(200).json({
      success: true,
      message: type === "register" ? "Email verified successfully" : "Logged in successfully",
      data:{
        user:{
          id:result?.user.id,
          username:result?.user.username,
          email:result?.user.email,
          isVerified:result?.user.isVerified,          
        },
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
const resendOtp = async (req: CustomOtpRequest, res: Response, next: NextFunction) => {
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