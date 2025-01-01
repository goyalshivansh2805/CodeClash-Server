import { Response, Request, NextFunction } from "express";
import { prisma } from "../../config";
import bcrypt from "bcrypt";
import { sendOtpEmail } from "..";
import { CustomError } from "../../types";

type RequestBody = {
  email: string;
  password: string;
  username?: string;
};

// register a new user
const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { email, password, username }: RequestBody = req.body;

  email = email?.trim().toLowerCase();
  password = password?.trim();
  username = username?.trim();

  if (!email || !password || !username) {
    next(new CustomError("Email, password and username are required", 400));
    return;
  }

  try {

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser?.isVerified) {
      next(new CustomError("Email already exists", 400));
      return;
    }else if(existingUser && !existingUser.isVerified){
      await prisma.user.delete({
        where: { id: existingUser.id },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          username,
        }
      });
    
    sendOtpEmail(req, res, next);

    res.status(201).send({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    const err = error as Error;
    next(new CustomError("Something went wrong", 500, `${err.message}`));
  }
};

export default registerUser;