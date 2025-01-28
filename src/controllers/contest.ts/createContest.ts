import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';

interface CreateContestBody {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  isPublic?: boolean;
  questionIds: string[];
}

export const createContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('User not found', 401);
    }

    const {
      title,
      description,
      startTime,
      endTime,
      isPublic = true,
      questionIds
    } = req.body as CreateContestBody;

    if (!title || !description || !startTime || !endTime || !questionIds?.length) {
      throw new CustomError('Missing required fields', 400);
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new CustomError('Invalid date format', 400);
    }

    if (startDateTime >= endDateTime) {
      throw new CustomError('Start time must be before end time', 400);
    }

    if (startDateTime <= new Date()) {
      throw new CustomError('Start time must be in the future', 400);
    }

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

    const contest = await prisma.contest.create({
      data: {
        title,
        description,
        startTime: startDateTime,
        endTime: endDateTime,
        isPublic,
        creatorId: userId,
        questions: {
          connect: questionIds.map(id => ({ id }))
        }
      },
      include: {
        questions: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            rating: true,
            score: true,
          }
        }
      }
    });

    return res.status(201).json({
      message: 'Contest created successfully',
      contest
    });

  } catch (error) {
    next(error);
  }
};
