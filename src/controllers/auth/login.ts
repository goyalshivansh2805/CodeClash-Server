import { Response, Request, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { CustomError } from "../../types";

const prisma = new PrismaClient();

export const loginUser = [

  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    try {

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          });

      if (!user) {
        next(new CustomError("Invalid email or password", 401));
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        next(new CustomError("Invalid email or password", 401));
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || "your_secret_key",
        { expiresIn: "1h" }
      );

      res.status(200).send({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      const err = error as Error;
      next(new CustomError("Something went wrong", 500, `${err.message}`));
    }
  },
];
