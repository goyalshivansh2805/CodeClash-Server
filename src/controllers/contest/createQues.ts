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
    if (!Array.isArray(testCases) || testCases.length < 1) {
      throw new CustomError('At least 1 test case is required', 400);
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
              isHidden: tc.isHidden || false,
              score: tc.score || 100
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

export const addQuestionToContestFromLibrary = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }
    const { questionId, contestId } = req.body;
    if (!questionId || !contestId) {
      throw new CustomError('Missing required fields', 400);
    }
    const question = await prisma.question.findUnique({
      where: {
        id: questionId
      }
    });
    if (!question) {
      throw new CustomError('Question not found', 404);
    }
    const contest = await prisma.contest.findUnique({
      where: {
        id: contestId
      },
      include: {
        questions: true
      }
    });
    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }
    if (contest.creatorId !== userId) {
      throw new CustomError('Unauthorized', 401);
    }
    if(contest.startTime <= new Date()) {
      throw new CustomError('Cannot add questions to an ongoing contest', 400);
    }
    if(contest.questions.find((q) => q.id === questionId)) {
      throw new CustomError('Question already exists in contest', 400);
    }
    await prisma.contest.update({
      where: {
        id: contestId
      },
      data: {
        questions: { connect: { id: questionId } }
      }
    });
    res.status(200).json({
      message: 'Question added to contest successfully'
    });
  } catch (error) { 
    return next(error);
  }
}

export const getContestQuestions = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contestId } = req.params;
    if (!contestId) {
      throw new CustomError('Contest ID is missing', 400);
    }
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId }
    }); 
    if (!user?.isAdmin) {
      throw new CustomError('Unauthorized', 401);
    }
    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId,
        participants: {
          some: {
            userId
          }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    const questions = await prisma.question.findMany({
      where: {
        contests: {
          some: {
            id: contestId
          }
        }
      }
    });

    res.status(200).json({
      message: 'Contest questions fetched successfully',
      data: questions
    });
  } catch (error) {
    return next(error);
  }
};