import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';

interface UpdateContestBody {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  isPublic?: boolean;
  questionIds?: string[];
  organizationName?: string;
  rules?: string;
  prizes?: string;
  score?: string;
}

export const updateContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('User not found', 401);
    }

    const contestIdParam = req.params.contestId;
    if (!contestIdParam) {
      throw new CustomError('Contest ID is required', 400);
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contestIdParam);

    const existingContest = await prisma.contest.findUnique({
      where: isUUID ? { id: contestIdParam } : { slug: contestIdParam },
      include: {
        participants: true
      }
    });

    if (!existingContest) {
      throw new CustomError('Contest not found', 404);
    }

    if (existingContest.creatorId !== userId) {
      throw new CustomError('Unauthorized', 403);
    }

    // Adding Questions to a contest that has already started or has participants is not allowed

    // if (existingContest.startTime <= new Date()) {
    //   throw new CustomError('Cannot update contest that has already started', 400);
    // }

    // if (existingContest.participants.length > 0) {
    //   throw new CustomError('Cannot update contest with registered participants', 400);
    // }

    const {
      title,
      description,
      startTime,
      endTime,
      isPublic,
      questionIds,
      organizationName,
      rules,
      prizes,
      score
    } = req.body as UpdateContestBody;

    let startDateTime = existingContest.startTime;
    let endDateTime = existingContest.endTime;

    if (startTime) {
      startDateTime = new Date(startTime);
      if (isNaN(startDateTime.getTime())) {
        throw new CustomError('Invalid start time format', 400);
      }
      if (startDateTime <= new Date()) {
        throw new CustomError('Start time must be in the future', 400);
      }
    }

    if (endTime) {
      endDateTime = new Date(endTime);
      if (isNaN(endDateTime.getTime())) {
        throw new CustomError('Invalid end time format', 400);
      }
    }

    if (startDateTime >= endDateTime) {
      throw new CustomError('Start time must be before end time', 400);
    }

    let questionConnections;
    if (questionIds?.length) {
      const questions = await prisma.question.findMany({
        where: {
          id: {
            in: questionIds
          }
        }
      });

      if (questions.length !== questionIds.length) {
        throw new CustomError('One or more questions not found', 404);
      }

      questionConnections = {
        set: questionIds.map(id => ({ id }))
      };
    }

    const updatedContest = await prisma.contest.update({
      where: {
        id: existingContest.id
      },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(startTime && { startTime: startDateTime }),
        ...(endTime && { endTime: endDateTime }),
        ...(typeof isPublic !== 'undefined' && { isPublic }),
        ...(organizationName && { organizationName }),
        ...(rules && { rules }),
        ...(prizes && { prizes }),
        ...(score && { score }),
        ...(questionConnections && { questions: questionConnections })
      },
      include: {
        questions: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            rating: true,
            score: true
          }
        }
      }
    });

    res.json({
      message: 'Contest updated successfully',
      contest: updatedContest
    });

  } catch (error) {
    return next(error);
  }
};
