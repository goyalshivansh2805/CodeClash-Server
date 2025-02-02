import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../types";
import { prisma } from "../../config";

export const getQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questionId = req.params.problemId;
        const question = await prisma.question.findUnique({
            where: {
                id: questionId
            },
            include: {
                testCases: {
                    where: {
                        isHidden: false
                    }
                }
            }
        })
        if(!question){
            next(new CustomError("Question not found", 404));
            return;
        }
        res.status(200).json({
            success: true,
            message: "Question fetched successfully",
            data: question
        })
    } catch (error) {
        const err = error as Error;
        next(new CustomError("Something went wrong", 500, `${err.message}`));
    }
}

export default getQuestion;