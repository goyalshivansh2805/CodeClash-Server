import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config";
import { CustomError, CustomRequest } from "../../types";

const getSubmissions = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const id = req.user?.id;
        if(!id){
            next(new CustomError("User not found", 404));
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }

        const { page = 1, limit = 10 } = req.query;
        const pageNumber = parseInt(page as string);
        const pageLimit = parseInt(limit as string);

        const skip = (pageNumber - 1) * pageLimit;
        const take = pageLimit;

        const [submissions, totalCount] = await Promise.all([
            prisma.submission.findMany({
                where: {
                    userId: id
                },
                orderBy: {
                    createdAt: "desc"
                },
                select:{
                    id:true,
                    status:true,
                    question:{
                        select:{
                            title:true,
                            difficulty:true
                        }
                    },
                    createdAt:true,
                    language:true,
                    passedTestCases:true,
                    totalTestCases:true,
                    score:true
                },
                skip,
                take
            }),
            prisma.submission.count({
                where: {
                    userId: id
                }
            })
        ]);

        const totalPages = Math.ceil(totalCount / pageLimit);

        res.status(200).json({
            success: true,
            submissions,
            pagination: {
                totalCount,
                totalPages,
                currentPage: pageNumber,
                limit: pageLimit
            }
        });
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
};

const getSubmissionById = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const id = req.user?.id;
        if(!id){
            next(new CustomError("User not found", 404));
            return;
        }
        const submissionId = req.params.id;
        if(!submissionId){
            next(new CustomError("Submission ID is required", 400));
            return;
        }
        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            select:{
                id:true,
                status:true,
                question:{
                    select:{
                        title:true,
                        difficulty:true
                    }
                },
                createdAt:true,
                language:true,
                code:true,
                match:{
                    select:{
                        id:true,
                        status:true,
                        winnerId:true,
                        createdAt:true,
                    }
                },
                passedTestCases:true,
                totalTestCases:true,
                score:true
            }
        });
        
        if(!submission){
            next(new CustomError("Submission not found", 404));
            return;
        }
        res.status(200).json({
            success: true,
            submission
        });
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}

const getSubmissionByMatchId = async(req:CustomRequest,res:Response,next:NextFunction)=>{
    try {
        const id = req.user?.id;
        if(!id){
            next(new CustomError("User not found", 404));
            return;
        }
        const matchId = req.params.id;
        const {page = 1,limit = 10} = req.query;
        const pageNumber = parseInt(page as string);
        const pageLimit = parseInt(limit as string);
        const skip = (pageNumber - 1) * pageLimit;
        const take = pageLimit;
        if(!matchId){
            next(new CustomError("Match ID is required", 400));
            return;
        }
        const user = await prisma.user.findUnique({
            where:{
                id
            }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }
        const [match,totalCount] = await Promise.all([
            prisma.match.findUnique({
                where:{
                    id:matchId
                },
            select:{
                submissions:{
                    where:{
                        userId:id
                    },
                    select:{
                        id:true,
                        status:true,
                        createdAt:true,
                        language:true,
                        question:{
                            select:{
                                title:true,
                                difficulty:true
                            }
                        },
                        passedTestCases:true,
                        totalTestCases:true,
                        score:true
                    },
                    skip,
                    take
                }
            }
            }),
            prisma.submission.count({
                where:{
                    matchId,
                    userId:id
                }
            })
        ]);
        if(!match){
            next(new CustomError("Match not found", 404));
            return;
        }
        const totalPages = Math.ceil(totalCount / pageLimit);
        const submissions = match.submissions.slice(skip,skip+take);
        res.status(200).json({
            success: true,
            submissions,
            pagination: {
                totalCount,
                totalPages,
                currentPage: pageNumber,
                limit: pageLimit
            }
        });
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}

const getSubmissionByContestId = async(req:CustomRequest,res:Response,next:NextFunction)=>{
    try {
        const id = req.user?.id;
        if(!id){
            next(new CustomError("User not found", 404));
            return;
        }
        const contestId = req.params.id;
        const {page = 1,limit = 10} = req.query;
        const pageNumber = parseInt(page as string);
        const pageLimit = parseInt(limit as string);
        const skip = (pageNumber - 1) * pageLimit;
        const take = pageLimit;
        if(!contestId){
            next(new CustomError("Contest ID is required", 400));
            return;
        }
        const user = await prisma.user.findUnique({
            where:{
                id
            }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }
        const [submissions, totalCount] = await Promise.all([
            prisma.submission.findMany({
                where: {
                    contestId,
                    userId: id
                },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    language: true,
                    question: {
                        select: {
                            title: true,
                            difficulty: true
                        }
                    },
                    passedTestCases: true,
                    totalTestCases: true,
                    score: true
                },
                skip,
                take,
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.submission.count({
                where: {
                    contestId,
                    userId: id
                }
            })
        ]);
        if(!submissions || submissions.length === 0){
            next(new CustomError("No submissions found for the given contest", 404));
            return;
        }
        const totalPages = Math.ceil(totalCount / pageLimit);
        res.status(200).json({
            success: true,
            submissions,
            pagination: {
                totalCount,
                totalPages,
                currentPage: pageNumber,
                limit: pageLimit
            }
        });
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}

const getSubmissionByQuestionIdAndContestId = async(req:CustomRequest,res:Response,next:NextFunction)=>{
    try {
        const id = req.user?.id;
        if(!id){
            next(new CustomError("User not found", 404));
            return;
        }
        const questionId = req.params.questionId;
        const contestId = req.params.contestId;
        const {page = 1,limit = 10} = req.query;
        const pageNumber = parseInt(page as string);
        const pageLimit = parseInt(limit as string);
        const skip = (pageNumber - 1) * pageLimit;
        const take = pageLimit;         
        if(!questionId || !contestId){
            next(new CustomError("Question ID and Contest ID are required", 400));
            return;
        }
        const user = await prisma.user.findUnique({
            where:{
                id
            }
        });
        if(!user){
            next(new CustomError("User not found", 404));
            return;
        }
        const [question,contest] = await Promise.all([
            prisma.question.findUnique({
                where:{
                    id:questionId
                }
            }),
            prisma.contest.findUnique({
                where:{
                    id:contestId
                }
            })
        ])
        if(!question || !contest){
            next(new CustomError("Question or Contest not found", 404));
            return;
        }
        const [submissions,totalCount] = await Promise.all([
            prisma.submission.findMany({
                where:{
                    questionId,
                    contestId,
                    userId:id
                },
                skip,
                take    
            }),
            prisma.submission.count({
                where:{
                    questionId,
                    contestId,
                    userId:id
                }
            })
        ])
        const totalPages = Math.ceil(totalCount / pageLimit);
        res.status(200).json({
            success: true,
            submissions,
            pagination: {
                totalCount,
                totalPages,
                currentPage: pageNumber,
                limit: pageLimit
            }
        });
    } catch (error) {
        next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
    }
}
export { getSubmissions, getSubmissionById, getSubmissionByMatchId, getSubmissionByContestId, getSubmissionByQuestionIdAndContestId };