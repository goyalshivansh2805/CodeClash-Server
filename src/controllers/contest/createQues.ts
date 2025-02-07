import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { Difficulty, TestCase } from '@prisma/client';

interface AddQuestionBody {
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  difficulty: Difficulty;
  rating: number;
  score: number;
  timeLimit?: number;
  memoryLimit?: number;
  testCases: TestCase[];
  contestId: string;
}

export const createQuestion = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    const {
      title,
      description,
      inputFormat,
      outputFormat,
      constraints,
      difficulty,
      rating,
      score,
      timeLimit,
      memoryLimit,
      testCases,
      contestId
    } = req.body as AddQuestionBody;


    if (!contestId) {
      throw new CustomError('Contest ID is missing', 400);
    }


    // check if contest exists and user is the creator
    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId,
        creatorId: userId
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found or unauthorized', 404);
    }

    // check if contest has already started
    if (contest.startTime <= new Date()) {
      throw new CustomError('Cannot add questions to an ongoing contest', 400);
    }

    if (!title || !description || !difficulty || !rating || !score || !testCases) {
      throw new CustomError('Missing required fields', 400);
    }

    // validate difficulty enum
    if (!Object.values(Difficulty).includes(difficulty)) {
      throw new CustomError('Invalid difficulty level', 400);
    }

    // validate test cases
    if (!Array.isArray(testCases) || testCases.length < 2) {
      throw new CustomError('At least 2 test cases are required', 400);
    }

    // create question and add to contest in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // first create the question
      const question = await prisma.question.create({
        data: {
          title,
          description,
          inputFormat,
          outputFormat,
          constraints,
          difficulty,
          rating,
          score,
          timeLimit: timeLimit || 2000,
          memoryLimit: memoryLimit || 256,
          creator: {
            connect: { id: userId }
          },
          testCases: {
            create: testCases.map(tc => ({
              input: tc.input,
              output: tc.output,
              isHidden: tc.isHidden || false
            }))
          },
          // connect the question to the contest
          contests: {
            connect: [{ id: contestId }]
          }
        },
        include: {
          testCases: true
        }
      });

      return question;
    });

     res.status(201).json({
      message: 'Question added to contest successfully',
      data: {
        questionId: result.id,
        title: result.title,
        difficulty: result.difficulty,
        rating: result.rating,
        score: result.score,
        testCasesCount: result.testCases.length
      }
    });

  } catch (error) {
    return next(error);
  }
};