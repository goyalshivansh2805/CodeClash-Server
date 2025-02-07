import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';

export const deleteContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('User not found', 401);
    }

    const contestId = req.params.contestId;
    if (!contestId) {
      throw new CustomError('Contest ID is required', 400);
    }

    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId
      },
      include: {
        participants: true,
        submissions: true
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    if (contest.creatorId !== userId) {
      throw new CustomError('Unauthorized: Only contest creator can delete the contest', 403);
    }

    if (contest.startTime <= new Date()) {
      throw new CustomError('Cannot delete contest that has already started', 400);
    }

    if (contest.participants.length > 0) {
      throw new CustomError('Cannot delete contest with registered participants', 400);
    }

    if (contest.submissions.length > 0) {
      throw new CustomError('Cannot delete contest with existing submissions', 400);
    }

    // perform the deletion
    // first remove all question connections
    await prisma.contest.update({
      where: {
        id: contestId
      },
      data: {
        questions: {
          set: [] // remove all question connections
        }
      }
    });

    // then delete the contest
    await prisma.contest.delete({
      where: {
        id: contestId
      }
    });

     res.json({
      message: 'Contest deleted successfully'
    });

  } catch (error) {
    return next(error);
  }
};
