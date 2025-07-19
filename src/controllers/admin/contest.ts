import { Response, NextFunction } from "express";
import { CustomRequest, CustomError } from "../../types";
import { prisma } from "../../config";
import { ContestStatus } from "@prisma/client";

const getAllContests = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const status = req.query.status as string;
    if(status !== ContestStatus.ONGOING && status !== ContestStatus.UPCOMING && status !== ContestStatus.ENDED){
        throw new CustomError("Invalid status", 400);
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    if (!userId) {
      throw new CustomError("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.isAdmin) {
      throw new CustomError("Unauthorized: Admin access required", 403);
    }
    const contests = await prisma.contest.findMany({
        where: {
            status: status as ContestStatus
        },
        skip,
        take: limit,
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        status: true,
        creator: {
            select: {
                id: true,
                username: true
            }
        }
      }
    });
    const total = await prisma.contest.count({
        where: {
            status: status as ContestStatus
        }
    });
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({contests, meta: {
        total,
        page,
        limit,
        totalPages
    }});
  } catch (error) {
    next(error);
  }
};

const getLeaderboardForContest = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const contestId = req.params.contestId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    if (!userId) {
      throw new CustomError("Unauthorized", 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user?.isAdmin) {
      throw new CustomError("Unauthorized: Admin access required", 403);
    }
    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });
    if (!contest) {
      throw new CustomError("Contest not found", 404);
    }
    const leaderboard = await prisma.contestLeaderboard.findMany({
      where: {
        contestId: contestId
      },
      skip,
      take: limit,
        select: {
        user: {
          select: {
            id: true,
            username: true,
          }
        },
        score: true,
        rank: true,
        problemsSolved: true,
        lastSubmissionTime: true,
      },
      orderBy: {
        rank: "asc"
      }
    });
    const total = await prisma.contestLeaderboard.count({
      where: {
        contestId: contestId
      }
    });
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({leaderboard, meta: {
        total,
        page,
        limit,
        totalPages
    }});
  } catch (error) {
    next(error);
  }
};  

const getUserDetailsInContest = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const contestId = req.params.contestId;
    const participantId = req.params.participantId;
    if (!contestId || !participantId) {
      throw new CustomError("Contest ID and participant ID are required", 400);
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    if (!userId) {
      throw new CustomError("Unauthorized", 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId }
    }); 
    if (!user?.isAdmin) {
      throw new CustomError("Unauthorized: Admin access required", 403);
    }
    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });
    if (!contest) {
      throw new CustomError("Contest not found", 404);
    }
    const [userDetails,contestSubmissions] = await Promise.all([
      prisma.user.findFirst({
      where: {
        id: participantId
      },
      select: {
        username: true,
        email: true
      }
    }),
    prisma.submission.findMany({
      where: {
        userId: participantId,
        contestId: contestId
      },
      skip,
      take: limit,
      select: {
        id: true,
        questionId: true,
        language: true,
        code: true,
        status: true,
        createdAt: true,
        score: true,
        passedTestCases: true,
        totalTestCases: true,
        question: {
          select: {
            title: true,
            description: true,
            inputFormat: true,
            outputFormat: true,
            constraints: true,
            testCases: {
                where: {
                    isHidden: false
                }
            }
          }
        }
      }
    })]);
    const totalSubmissions = contestSubmissions.length;
    const totalScore = contestSubmissions.reduce((acc, curr) => acc + (curr.score || 0), 0);
    const totalPassedTestCases = contestSubmissions.reduce((acc, curr) => acc + (curr.passedTestCases || 0), 0);
    const totalFailedTestCases = contestSubmissions.reduce((acc, curr) => acc + (curr.totalTestCases || 0) - (curr.passedTestCases || 0), 0);

    const totalPages = Math.ceil(totalSubmissions / limit);
    res.status(200).json({userDetails, contestSubmissions, totalSubmissions, totalScore, totalPassedTestCases, totalFailedTestCases, meta: {
        totalSubmissions,
        page,
        limit,
        totalPages
    }});
  } catch (error) {
    next(error);
  }
};
export { getAllContests, getLeaderboardForContest, getUserDetailsInContest };