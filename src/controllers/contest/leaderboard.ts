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

interface userScore {
  problemsSolved: number;
  totalScore: number;
  lastSubmissionTime: Date | null;
}

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

    // Check if contest exists and is active
    const contest = await prisma.contest.findUnique({
      where: { 
        id: contestId,
        endTime: { gte: new Date() }
      },
      select: { id: true,
        questions: {
          select: {
            id: true,
            score: true
          }
        }
       }
    });

    if (!contest) {
      throw new CustomError('Contest not found or ended', 404);
    }
    const participants = await prisma.contestParticipation.findMany({
      where: { contestId },
      select: { userId: true }
    });
    // Get all accepted submissions grouped by user
    const submissions = await prisma.submission.groupBy({
      by: ['userId', 'questionId'],
      where: {
        contestId,
        status: 'ACCEPTED'
      },
      _min: {
        createdAt: true
      }
    });

    // Calculate scores and update leaderboard
    const userScores = new Map<string,userScore>(
      participants.map(p => [p.userId, {
        problemsSolved: 0,
        totalScore: 0,
        lastSubmissionTime: null
      }])
    );
    for (const submission of submissions) {
      const { userId, questionId } = submission;
      const userScore = userScores.get(userId);
      if (!userScore) continue;

      const question = contest.questions.find(q => q.id === questionId);
      if (!question) continue;

      userScore.problemsSolved++;
      userScore.totalScore += question?.score || 0;
      userScore.lastSubmissionTime = submission._min.createdAt;
    }

    // Bulk update leaderboard
    await Promise.all(
      Array.from(userScores.entries()).map(([userId, data]) =>
        prisma.contestLeaderboard.upsert({
          where: {
            contestId_userId: {
              contestId,
              userId
            }
          },
          create: {
            contestId,
            userId,
            score: data.totalScore,
            problemsSolved: data.problemsSolved,
            lastSubmissionTime: data.lastSubmissionTime
          },
          update: {
            score: data.totalScore,
            problemsSolved: data.problemsSolved,
            lastSubmissionTime: data.lastSubmissionTime
          }
        })
      )
    );

    // Update ranks
    await updateLeaderboardRanks(contestId);

    res.json({
      message: 'Leaderboard updated successfully',
      updatedUsers: userScores.size
    });
  } catch (error) {
    next(error);
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

    const [leaderboard, total] = await Promise.all([
      prisma.contestLeaderboard.findMany({
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
      }),
      prisma.contestLeaderboard.count({
        where: { contestId }
      })
    ]);

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
    next(error);
  }
};

// Helper function to update ranks
async function updateLeaderboardRanks(contestId: string): Promise<void> {
  const leaderboard = await prisma.contestLeaderboard.findMany({
    where: { contestId },
    orderBy: [
      { score: 'desc' },
      { problemsSolved: 'desc' },
      { lastSubmissionTime: 'asc' }
    ]
  });

  await prisma.$transaction(
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
