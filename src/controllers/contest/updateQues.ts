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
  contestId?: string;
  questionId: string;
}

export const updateQuestion = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log("Update Question Request:", req.body);
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    
    const {
      questionId,
      contestId,
      ...updateData
    } = req.body as UpdateQuestionBody;

    // First check if the question exists and user is the creator
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        creatorId: userId
      }
    });

    if (!question) {
      throw new CustomError('Question not found or unauthorized', 404);
    }

    // If contestId is provided, verify contest constraints
    if (contestId) {
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
        throw new CustomError('Contest not found or question not in contest', 404);
      }

      if (contest.startTime <= new Date()) {
        throw new CustomError('Cannot modify questions in an ongoing contest', 400);
      }
    }

    // Validate inputs
    if (updateData.difficulty && !Object.values(Difficulty).includes(updateData.difficulty)) {
      throw new CustomError('Invalid difficulty level', 400);
    }

    if (updateData.testCases && (!Array.isArray(updateData.testCases) || updateData.testCases.length < 2)) {
      throw new CustomError('At least 2 test cases are required', 400);
    }

    // Update question
    const result = await prisma.question.update({
      where: {
        id: questionId
      },
      data: {
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.description && { description: updateData.description }),
        ...(updateData.inputFormat && { inputFormat: updateData.inputFormat }),
        ...(updateData.outputFormat && { outputFormat: updateData.outputFormat }),
        ...(updateData.constraints && { constraints: updateData.constraints }),
        ...(updateData.difficulty && { difficulty: updateData.difficulty }),
        ...(updateData.rating && { rating: updateData.rating }),
        ...(updateData.score && { score: updateData.score }),
        ...(updateData.timeLimit && { timeLimit: updateData.timeLimit }),
        ...(updateData.memoryLimit && { memoryLimit: updateData.memoryLimit }),
        ...(updateData.testCases && {
          testCases: {
            deleteMany: {},
            create: updateData.testCases.map(tc => ({
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

    res.json({
      message: 'Question updated successfully',
      data: {
        questionId: result.id,
        title: result.title,
        difficulty: result.difficulty,
        rating: result.rating,
        score: result.score,
        testCasesCount: result.testCases.length,
        updatedAt: result.updatedAt
      }
    });

  } catch (error) {
    return next(error);
  }
};
