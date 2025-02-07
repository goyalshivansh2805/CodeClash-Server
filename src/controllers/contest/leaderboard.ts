import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { SubmissionStatus } from '@prisma/client';

// enum SubmissionStatus {
//   PENDING,
//   ACCEPTED,
//   WRONG_ANSWER,
//   TIME_LIMIT_EXCEEDED,
//   MEMORY_LIMIT_EXCEEDED,
//   RUNTIME_ERROR,
//   COMPILATION_ERROR
// }



// Function to update contest leaderboard
export const updateContestLeaderboard = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const contestId = req.params.contestId;
    if (!contestId) {
      throw new CustomError('Contest ID is required', 400);
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        questions: true,
        submissions: {
          where: {
            status: 'ACCEPTED'
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        participants: true
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    // Group submissions by user
    const userSubmissions = new Map();
    contest.submissions.forEach(submission => {
      if (!userSubmissions.has(submission.userId)) {
        userSubmissions.set(submission.userId, new Set());
      }
      userSubmissions.get(submission.userId).add(submission.questionId);
    });

    // Calculate scores and create leaderboard entries
    const leaderboardEntries = await Promise.all(
      Array.from(userSubmissions.entries()).map(async ([userId, solvedQuestions]) => {
        const userSubmissions = contest.submissions.filter(s => s.userId === userId);
        const lastSubmission = userSubmissions[userSubmissions.length - 1];

        // Calculate total score based on question scores
        const score = Array.from(solvedQuestions).reduce((total: number, questionId) => {
          const question = contest.questions.find(q => q.id === questionId);
          return total + (question?.score || 0);
        }, 0);

        return prisma.contestLeaderboard.upsert({
          where: {
            contestId_userId: {
              contestId: contest.id,
              userId: userId
            }
          },
          create: {
            contestId: contest.id,
            userId: userId,
            score: score,
            problemsSolved: solvedQuestions.size,
            lastSubmissionTime: lastSubmission?.createdAt
          },
          update: {
            score: score,
            problemsSolved: solvedQuestions.size,
            lastSubmissionTime: lastSubmission?.createdAt
          }
        });
      })
    );

    // Update ranks
    await updateLeaderboardRanks(contestId);

     res.json({
      message: 'Leaderboard updated successfully',
      entriesUpdated: leaderboardEntries.length
    });
  } catch (error) {
    return next(error);
  }
};

// Function to get contest leaderboard
export const getContestLeaderboard = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const contestId = req.params.contestId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    const leaderboard = await prisma.contestLeaderboard.findMany({
      where: { contestId },
      orderBy: [
        { score: 'desc' },
        { problemsSolved: 'desc' },
        { lastSubmissionTime: 'asc' }
      ],
      skip,
      take: limit,
      include: {
        user: {
          select: {
            username: true,
            rating: true,
            profileImage: true
          }
        }
      }
    });

    const total = await prisma.contestLeaderboard.count({
      where: { contestId }
    });

     res.json({
      leaderboard,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    });
  } catch (error) {
    return next(error);
  }
};

// Helper function to update ranks
async function updateLeaderboardRanks(contestId: string) {
  const leaderboard = await prisma.contestLeaderboard.findMany({
    where: { contestId },
    orderBy: [
      { score: 'desc' },
      { problemsSolved: 'desc' },
      { lastSubmissionTime: 'asc' }
    ]
  });

  // Update ranks
  await Promise.all(
    leaderboard.map((entry, index) =>
      prisma.contestLeaderboard.update({
        where: { id: entry.id },
        data: { rank: index + 1 }
      })
    )
  );
}

// Function to get user's rank in a contest
export const getUserContestRank = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const contestId = req.params.contestId;

    if (!userId || !contestId) {
      throw new CustomError('User ID and Contest ID are required', 400);
    }

    const userRank = await prisma.contestLeaderboard.findUnique({
      where: {
        contestId_userId: {
          contestId,
          userId
        }
      },
      include: {
        user: {
          select: {
            username: true,
            rating: true
          }
        }
      }
    });

    if (!userRank) {
      throw new CustomError('User has not participated in this contest', 404);
    }

     res.json({
      rank: userRank.rank,
      score: userRank.score,
      problemsSolved: userRank.problemsSolved,
      lastSubmissionTime: userRank.lastSubmissionTime,
      user: userRank.user
    });
  } catch (error) {
    return next(error);
  }
};
