import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';

export const removeQuestion = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);

    const { contestId, questionId } = req.body;
    if (!contestId || !questionId) {
      throw new CustomError('Contest ID and Question ID required', 400);
    }

    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId,
        creatorId: userId,
        questions: {
          some: { id: questionId }
        }
      },
      include: {
        submissions: {
          where: { questionId }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest or question not found', 404);
    }

    if (contest.startTime <= new Date()) {
      throw new CustomError('Cannot modify ongoing contest', 400);
    }

    if (contest.submissions.length > 0) {
      throw new CustomError(
        'Cannot remove question with existing submissions', 400
      );
    }

    //disconnect question from contest
    await prisma.contest.update({
      where: { id: contestId },
      data: {
        questions: {
          disconnect: { id: questionId }
        }
      }
    });

    res.status(200).json({
      message: 'Question removed from contest successfully'
    });
  } catch (error) {
    next(error);
  }
};
