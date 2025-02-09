import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';

export const joinContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    const { contestId } = req.params;
    if (!contestId) {
      throw new CustomError('Contest ID is required', 400);
    }

    // Check if contest exists and is public
    const contest = await prisma.contest.findUnique({
      where: {
        id: contestId
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    if (!contest.isPublic && contest.creatorId !== userId) {
      throw new CustomError('Contest is private', 403);
    }

    // Check if contest hasn't ended
    if (new Date() > contest.endTime) {
      throw new CustomError('Contest has ended', 400);
    }

    // Check if user is already registered
    const existingParticipation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId
        }
      }
    });

    if (existingParticipation) {
      throw new CustomError('Already registered for this contest', 400);
    }

    // Register user for the contest
    const participation = await prisma.contestParticipation.create({
      data: {
        contestId,
        userId,
        joinedAt: new Date(),
        score: 0,
        rank: null
      },
      include: {
        contest: {
          select: {
            title: true,
            startTime: true,
            endTime: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Successfully joined the contest',
      data: {
        contestId,
        contestTitle: participation.contest.title,
        startTime: participation.contest.startTime,
        endTime: participation.contest.endTime,
        joinedAt: participation.joinedAt
      }
    });

  } catch (error) {
    next(error);
  }
};
