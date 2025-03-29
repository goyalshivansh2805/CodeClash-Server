import { CustomError, CustomRequest } from "../types";
import jwt from "jsonwebtoken";
import { Request,Response,NextFunction,RequestHandler } from "express";
import { prisma } from "../config/prisma";

interface DecodedToken {
    userId:string,
    version:number
}

const verifyToken = async (req: CustomRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if(!token){
        next(new CustomError("Unauthorized", 401));
        return;
    }
    try{
        const decoded = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET!) as DecodedToken;
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                version: true
            }
        });
        if(!user || user.version !== decoded.version){
            next(new CustomError("Unauthorized", 401));
            return;
        }
        req.user = {
            id: user.id as string,
            version: user.version
        };
        next();
    }catch(error){
        next(new CustomError("Unauthorized",401));
    }
}

export default verifyToken;