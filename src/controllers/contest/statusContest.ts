import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { ContestStatus } from '@prisma/client';


export const startContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { contestId } = req.params;

    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId,
        creatorId: userId
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found or unauthorized', 404);
    }

    if (contest.status !== ContestStatus.UPCOMING) {
      throw new CustomError('Contest can only be started from UPCOMING status', 400);
    }

    const now = new Date();
    
    // if (now < contest.startTime) {
    //   throw new CustomError('Cannot start contest before scheduled start time', 400);
    // }

    await prisma.contest.update({
      where: { id: contestId },
      data: {
        status: ContestStatus.ONGOING,
        startTime: now
      }
    });

    res.json({
      message: 'Contest started successfully',
      startTime: now
    });
  } catch (error) {
    next(error);
  }
};


export const endContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { contestId } = req.params;

    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId,
        creatorId: userId
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found or unauthorized', 404);
    }

    if (contest.status !== ContestStatus.ONGOING) {
      throw new CustomError('Only ongoing contests can be ended', 400);
    }

    const now = new Date();
    await prisma.contest.update({
      where: { id: contestId },
      data: {
        status: ContestStatus.ENDED,
        endTime: now
      }
    });

    // update final leaderboard
    await prisma.contestLeaderboard.findMany({
      where: { contestId },
      orderBy: [
        { score: 'desc' },
        { problemsSolved: 'desc' },
        { lastSubmissionTime: 'asc' }
      ]
    }).then(entries => 
      Promise.all(entries.map((entry, index) =>
        prisma.contestLeaderboard.update({
          where: { id: entry.id },
          data: { rank: index + 1 }
        })
      ))
    );

    res.json({
      message: 'Contest ended successfully',
      endTime: now
    });
  } catch (error) {
    next(error);
  }
};

export const getContestStatus = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contestId } = req.params;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: {
        status: true,
        startTime: true,
        endTime: true,
        _count: {
          select: {
            participants: true,
            submissions: true
          }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    res.json({
      status: contest.status,
      startTime: contest.startTime,
      endTime: contest.endTime,
      participantCount: contest._count.participants,
      submissionCount: contest._count.submissions
    });
  } catch (error) {
    next(error);
  }
};
