import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { generateSlug } from '../../utility/slugGenerator';

interface CreateContestBody {
  title: string;
  slug?: string;
  description?: string;
  startTime: string;
  endTime: string;
  isPublic?: boolean;
  questionIds?: string[];
  organizationName?: string;
  rules?: string;
  prizes?: string;
  score?: string;
}

export const createContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('User not found', 401);
    }

    const {
      title,
      slug: providedSlug,
      description,
      startTime,
      endTime,
      isPublic = true,
      questionIds = [],
      organizationName,
      rules,
      prizes,
      score
    } = req.body as CreateContestBody;

    if (!title || !startTime || !endTime) {
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

    // Generate or validate slug
    let slug = providedSlug ? generateSlug(providedSlug) : generateSlug(title);

    // Check for uniqueness
    let existingContest = await prisma.contest.findUnique({ where: { slug } });
    if (existingContest) {
      if (providedSlug) {
        throw new CustomError('Slug already exists', 409);
      }
      // If auto-generated, append suffix
      let counter = 1;
      const originalSlug = slug;
      while (existingContest) {
        slug = `${originalSlug}-${counter}`;
        existingContest = await prisma.contest.findUnique({ where: { slug } });
        counter++;
      }
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
        slug,
        description,
        startTime: startDateTime,
        endTime: endDateTime,
        isPublic,
        creatorId: userId,
        organizationName,
        rules,
        prizes,
        score: score,
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

    res.status(201).json({
      message: 'Contest created successfully',
      contest
    });

  } catch (error) {
    return next(error);
  }
};
