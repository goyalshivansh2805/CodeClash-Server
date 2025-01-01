import { NextFunction, Request,Response } from 'express';
import {passport, prisma} from '../../config';
import { CustomError } from '../../types';
import { OauthUser } from '../../interfaces';
import jwt from 'jsonwebtoken';

const startGoogleOauth = () => {
    passport.authenticate("google", {
        scope: ["profile", "email"],
      })
}

const googleOauthCallback = (req:Request , res:Response,next:NextFunction) => {
    passport.authenticate("google", { session: false }, (err:Error, user:OauthUser) => {
        if (err) {
          next(new CustomError("An error occurred",500,err.message));
          return;
        } 
        if (!user) {
          next(new CustomError("User not found",404));
          return;
        }
        res.redirect(`${process.env.FRONTEND_URL}/oauth?token=${user.tempOAuthToken}`);
})(req, res, next);
};
  

const generateTokens =async (req:Request,res:Response,next:NextFunction) => {
    try {

      const tempOAuthToken = req.query.token as string;
      if (!tempOAuthToken) {
        next(new CustomError("Invalid token", 400));
        return;
      }
      let decoded;
      try {
        decoded = jwt.verify(tempOAuthToken, process.env.TEMP_JWT_SECRET!) as {email:string};
      } catch (error) {
        next(new CustomError("Invalid token", 400));
        return;
      }
      const user = await prisma.user.findUnique({
        where: { email: decoded.email },
      });
      if (!user) {
        next(new CustomError("User not found", 404));
        return;
      }
      if(user.tempOAuthToken !== tempOAuthToken){
        next(new CustomError("Invalid token", 400));
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
        { expiresIn: "1h" }
      );
      const refreshToken = jwt.sign(
        { userId: user.id ,version:user.version},
        refreshTokenKey,
        { expiresIn: "7d" }
      );
      await prisma.user.update({
        where: { email: decoded.email },
        data: { tempOAuthToken: null },
      });
      res.status(200).send({
        success: true,
        message: "Login successful",
        data:{
          tokens:{
            accessToken,
            refreshToken
          }
        }
      });
    } catch (error) {
      next(new CustomError("Something went wrong", 500));
    }
}
export {startGoogleOauth,googleOauthCallback,generateTokens};
