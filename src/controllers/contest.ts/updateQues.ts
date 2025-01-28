import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { Difficulty, TestCase } from '@prisma/client';

interface UpdateQuestionBody {
  title?: string;
  description?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  difficulty?: Difficulty;
  rating?: number;
  score?: number;
  timeLimit?: number;
  memoryLimit?: number;
  testCases?: TestCase[];
  contestId: string;
  questionId: string;
}

export const updateQuestionInContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
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
      contestId,
      questionId
    } = req.body as UpdateQuestionBody;

    // check if contest exists and user is the creator
    const contest = await prisma.contest.findFirst({
      where: {
        id: contestId,
        creatorId: userId,
        questions: {
          some: {
            id: questionId
          }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest or question not found or unauthorized', 404);
    }

    // check if contest has already started
    if (contest.startTime <= new Date()) {
      throw new CustomError('Cannot modify questions in an ongoing contest', 400);
    }

    // validate difficulty enum if provided
    if (difficulty && !Object.values(Difficulty).includes(difficulty)) {
      throw new CustomError('Invalid difficulty level', 400);
    }

    // validate test cases if provided
    if (testCases) {
      if (!Array.isArray(testCases) || testCases.length < 2) {
        throw new CustomError('At least 2 test cases are required', 400);
      }
    }

    // update question in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // first update the question
      const updatedQuestion = await prisma.question.update({
        where: {
          id: questionId
        },
        data: {
          ...(title && { title }),
          ...(description && { description }),
          ...(inputFormat && { inputFormat }),
          ...(outputFormat && { outputFormat }),
          ...(constraints && { constraints }),
          ...(difficulty && { difficulty }),
          ...(rating && { rating }),
          ...(score && { score }),
          ...(timeLimit && { timeLimit }),
          ...(memoryLimit && { memoryLimit }),
          ...(testCases && {
            testCases: {
              deleteMany: {}, // first delete existing test cases
              create: testCases.map(tc => ({
                input: tc.input,
                output: tc.output,
                isHidden: tc.isHidden || false
              }))
            }
          })
        },
        include: {
          testCases: true
        }
      });

      return updatedQuestion;
    });

    return res.json({
      message: 'Question updated successfully',
      data: {
        questionId: result.id,
        title: result.title,
        difficulty: result.difficulty,
        rating: result.rating,
        testCasesCount: result.testCases.length,
        updatedAt: result.updatedAt
      }
    });

  } catch (error) {
    next(error);
  }
};
