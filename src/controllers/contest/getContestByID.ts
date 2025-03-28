import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { ContestStatus } from '@prisma/client';

export const getContestDetails = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('User not found', 401);
    }

    const contestId = req.params.contestId;
    if (!contestId) {
      throw new CustomError('Contest ID is required', 400);
    }

    const now = new Date();

    // base contest query with common fields
    const contest = await prisma.contest.findUnique({
      where: {
        id: contestId
      },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        isPublic: true,
        status: true,
        createdAt: true,
        creatorId: true,
        organizationName: true,
        rules: true,
        prizes: true,
        score: true,
        creator: {
          select: {
            id: true,
            username: true,
            rating: true
          }
        },
        participants: {
          where: {
            userId: userId
          },
          select: {
            joinedAt: true,
            score: true,
            rank: true
          }
        },
        _count: {
          select: {
            questions: true,
            participants: true
          }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found', 404);
    }

    // access permissions
    if (!contest.isPublic && contest.creatorId !== userId && contest.participants.length === 0) {
      throw new CustomError('Unauthorized to view this contest', 403);
    }

    // update contest status based on current time
    let status = contest.status;
    if (now < contest.startTime && status !== ContestStatus.UPCOMING) {
      status = ContestStatus.UPCOMING;
    } else if (now >= contest.startTime && now <= contest.endTime && status !== ContestStatus.ONGOING) {
      status = ContestStatus.ONGOING;
    } else if (now > contest.endTime && status !== ContestStatus.ENDED) {
      status = ContestStatus.ENDED;
    }

    // udate status if changed
    if (status !== contest.status) {
      await prisma.contest.update({
        where: { id: contestId },
        data: { status }
      });
    }

    // prepare base response
    const baseResponse = {
      id: contest.id,
      title: contest.title,
      description: contest.description,
      startTime: contest.startTime,
      endTime: contest.endTime,
      isPublic: contest.isPublic,
      status,
      createdAt: contest.createdAt,
      organizationName: contest.organizationName,
      rules: contest.rules,
      prizes: contest.prizes,
      score: contest.score,
      creator: contest.creator,
      isRegistered: contest.participants.length > 0,
      isCreator: contest.creatorId === userId,
      userStats: contest.participants[0] || null,
      participantCount: contest._count.participants,
      questionCount: contest._count.questions
    };

    // handle different contest states
    switch (status) {
      case ContestStatus.UPCOMING: {
        // for upcoming contests, only creator can see questions with IDs
        if (contest.creatorId === userId) {
          const questions = await prisma.contest.findUnique({
            where: { id: contestId },
            select: {
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
            message: 'Contest details retrieved successfully',
            contest: { ...baseResponse, questions: questions?.questions }
          });
        } else {
          res.json({
            message: 'Contest details retrieved successfully',
            contest: baseResponse
          });
        }
        break;
      }

      case ContestStatus.ONGOING: {
        // all participants can see question details with IDs during contest
        const contestData = await prisma.contest.findUnique({
          where: { id: contestId },
          select: {
            questions: {
              select: {
                id: true,
                title: true,
                description: true,
                inputFormat: true,
                outputFormat: true,
                constraints: true,
                difficulty: true,
                rating: true,
                score: true,
                timeLimit: true,
                memoryLimit: true
              }
            }
          }
        });

        const submissionStats = await prisma.submission.groupBy({
          by: ['questionId', 'status'],
          where: {
            contestId,
            userId
          },
          _count: true
        });

        const questionsWithStats = contestData?.questions.map(question => ({
          ...question,
          submissions: submissionStats
            .filter(stat => stat.questionId === question.id)
            .reduce((acc, stat) => ({
              ...acc,
              [stat.status.toLowerCase()]: stat._count
            }), {})
        }));

        res.json({
          message: 'Contest details retrieved successfully',
          contest: { ...baseResponse, questions: questionsWithStats }
        });
        break;
      }

      case ContestStatus.ENDED: {
        // everyone can see full question details after contest ends
        const contestData = await prisma.contest.findUnique({
          where: { id: contestId },
          select: {
            questions: {
              select: {
                id: true,
                title: true,
                description: true,
                inputFormat: true,
                outputFormat: true,
                constraints: true,
                difficulty: true,
                rating: true,
                score: true,
                timeLimit: true,
                memoryLimit: true,
                testCases: {
                  select: {
                    input: true,
                    output: true,
                    isHidden: true
                  }
                }
              }
            },
            leaderboard: {
              orderBy: {
                score: 'desc'
              },
              take: 10,
              include: {
                user: {
                  select: {
                    username: true,
                    rating: true
                  }
                }
              }
            }
          }
        });

        res.json({
          message: 'Contest details retrieved successfully',
          contest: {
            ...baseResponse,
            questions: contestData?.questions,
            topPerformers: contestData?.leaderboard
          }
        });
        break;
      }

      default:
        res.json({
          message: 'Contest details retrieved successfully',
          contest: baseResponse
        });
    }

  } catch (error) {
    next(error);
  }
};