import { Response, Request, NextFunction } from "express";
import { prisma } from "../../config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { CustomError } from "../../types";
import {UAParser} from "ua-parser-js";
/**
 * Logs in a user by validating their email and password.
 * @param {Request} req - The request object containing email and password.
 * @param {Response} res - The response object to send the result.
 * @param {NextFunction} next - The next middleware function in the stack.
 */
const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    let { email, password } = req.body;
    email = email?.trim();
    password = password?.trim();
    if (!email || !password) {
      next(new CustomError("Email and password are required", 400));
    }
    try {

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          });

      if (!user || !user.isVerified) {
        next(new CustomError("User not found", 401));
        return;
      }

      if(!user.password){
        next(new CustomError("Password not set", 401));
        return;
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        next(new CustomError("Invalid password", 401));
        return;
      }
      const accessTokenKey = process.env.ACCESS_TOKEN_SECRET;
      const refreshTokenKey = process.env.REFRESH_TOKEN_SECRET;
      if (!accessTokenKey || !refreshTokenKey) {
        next(new CustomError("Something went wrong", 500));
        return;
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

      res.status(200).send({
        success: true,
        message: "Login successful",
        data:{
          user:{
            id:user.id,
            email:user.email,
            name:user.username,
            isVerified:user.isVerified,
          },
          tokens:{
            accessToken,
            refreshToken
          }
        }
      });
    } catch (error) {
      const err = error as Error;
      next(new CustomError("Something went wrong", 500, `${err.message}`));
    }
  };


export default loginUser;