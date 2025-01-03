import { Response, NextFunction,Request } from 'express';
import { CustomOtpRequest,CustomError } from '../types';
import { prisma } from '../config';

const loginOtp =async (req: CustomOtpRequest, res: Response, next: NextFunction) => {
    try {
        let {email} = req.body;
        email = email?.trim().toLowerCase();
        if (!email) {
            next(new CustomError("Email is required", 400));
            return;
        }
        const user =await prisma.user.findUnique({
            where: { email }
        });
        if (!user || !user.isVerified) {
            next(new CustomError("User not found", 404));
            return;
        }
        req.type = 'login';
        next();
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}

const registerOtp = (req: CustomOtpRequest, res: Response, next: NextFunction) => {
    let { email } = req.body;
    email = email?.trim().toLowerCase();
    if (!email) {
        next(new CustomError("Email is required", 400));
        return;
    }
    req.type = 'register';
    next();
}

export { loginOtp, registerOtp };