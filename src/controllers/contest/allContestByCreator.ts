import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { ContestStatus } from '@prisma/client';

export const getAllContestsByCreator = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    const contests = await prisma.contest.findMany({
      where: {
        creatorId: userId
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        status: true,
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // update status based on current time
    const now = new Date();
    const updatedContests = contests.map(contest => {
      let currentStatus = contest.status;
      
    //   if (now < contest.startTime) {
    //     currentStatus = ContestStatus.UPCOMING;
    //   } else if (now >= contest.startTime && now <= contest.endTime) {
    //     currentStatus = ContestStatus.ONGOING;
    //   } else {
    //     currentStatus = ContestStatus.ENDED;
    //   }

      return {
        contestId: contest.id,
        title: contest.title,
        startTime: contest.startTime,
        endTime: contest.endTime,
        status: currentStatus,
        participantCount: contest._count.participants
      };
      
    });

    res.json({
      message: 'Contests retrieved successfully',
      contests: updatedContests
    });

  } catch (error) {
    next(error);
  }
};
