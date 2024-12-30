import { Response, Request, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { sendOtpEmail } from "";
import { CustomError } from "../../types";

const prisma = new PrismaClient();

type RequestBody = {
  email: string;
  password: string;
  username?: string;
  profileImage?: string;
};

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { email, password, username, profileImage }: RequestBody = req.body;

  email = email?.trim();
  password = password?.trim();
  username = username?.trim();
  profileImage = profileImage?.trim();

  if (!email || !password) {
    next(new CustomError("Email and password are required", 400));
    return;
  }

  const lowerEmail = email.toLowerCase();

  try {

    const existingUser = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (existingUser) {
      next(new CustomError("Email already exists", 400));
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
        data: {
          email: lowerEmail,
          password: hashedPassword,
          username: username || null,
          profileImage: profileImage || null,
        },
        select: {
          id: true,
          email: true,
          username: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    sendOtpEmail(req, res, next);

    res.status(201).send({
      success: true,
      message: "OTP sent to your email",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        profileImage: newUser.profileImage,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    const err = error as Error;
    next(new CustomError("Something went wrong", 500, `${err.message}`));
  }
};
