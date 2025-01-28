import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';

export const deleteQuestionFromContest = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    const { contestId, questionId } = req.params;

    if (!contestId || !questionId) {
      throw new CustomError('Contest ID and Question ID are required', 400);
    }

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
      },
      include: {
        questions: {
          where: {
            id: questionId
          }
        },
        submissions: {
          where: {
            questionId
          }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest or question not found or unauthorized', 404);
    }

    // check if contest has already started
    if (contest.startTime <= new Date()) {
      throw new CustomError('Cannot delete questions from an ongoing contest', 400);
    }

    // check if there are any submissions for this question
    if (contest.submissions.length > 0) {
      throw new CustomError('Cannot delete question with existing submissions', 400);
    }

    // check if this is the last question in the contest
    if (contest.questions.length === 1) {
      throw new CustomError('Cannot delete the last question from the contest', 400);
    }

    // delete question in a transaction
    await prisma.$transaction(async (prisma) => {
      // first disconnect the question from the contest
      await prisma.contest.update({
        where: {
          id: contestId
        },
        data: {
          questions: {
            disconnect: {
              id: questionId
            }
          }
        }
      });

      // then delete the test cases
      await prisma.testCase.deleteMany({
        where: {
          questionId
        }
      });

      // finally delete the question
      await prisma.question.delete({
        where: {
          id: questionId
        }
      });
    });

    return res.json({
      message: 'Question deleted successfully from contest',
      data: {
        contestId,
        questionId,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};
