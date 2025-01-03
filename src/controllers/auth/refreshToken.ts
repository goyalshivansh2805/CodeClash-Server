import { Response,Request,NextFunction } from "express";
import { CustomError } from "../../types";
import jwt from "jsonwebtoken";
import { prisma } from "../../config";


/**
 * Generates a new access token for the user.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - The next middleware function.
 */
const refreshToken = async (req:Request,res:Response,next:NextFunction) => {
    try {
        const {refreshToken} = req.body;
        if (!refreshToken) {
            next(new CustomError("No refresh token provided", 400));
            return;
        }
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as { userId: string, version: number };                                                                                                   
        } catch (error) {
            next(new CustomError("Invalid refresh token", 400));
            return;
        }
        const user = await prisma.user.findUnique({
            where: {
                id: decoded.userId,
                version: decoded.version
            }
        });
        if (!user) {
            next(new CustomError("User not found", 404));
            return;
        }
        const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: "1h" });
        res.status(200).json({
            success: true,
            message: "Access token generated successfully",
            data: {
                tokens:{
                    accessToken
                }
            }
        });
    } catch (error) {                                                                                                                                                                               
        const err = error as Error;                     
        next(new CustomError("Something went wrong", 500, `${err.message}`));
    }
}

export default refreshToken;