import {prisma} from "../../config"
import { CustomError } from "../../types";
import { Request, Response, NextFunction } from "express";

const isEmailExists = async(req:Request,res:Response,next:NextFunction) => {
    try {
        let {email} = req.body;
        email = email?.trim().toLowerCase();
        if(!email){
            next(new CustomError("Email is required",400));
            return;
        }
        const user = await prisma.user.findUnique({
            where: { email },
        });
        let flow: number;

        if (!user) {
            flow = 1;
        } else if (user && !user.password) {
            flow = 2;
        } else {
            flow = 3;
        }

        res.status(200).send({
            success: true,
            message: "Flow determined successfully",
            data: {
                flow,
            },
        });

    } catch (error) {
        next(new CustomError("Something went wrong",500))
    }
}

export default isEmailExists;