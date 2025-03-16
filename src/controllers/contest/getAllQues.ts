import { NextFunction, Response } from 'express';
import { prisma } from '../../config';
import { CustomRequest } from '../../types';

export const getAllQuestions = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        select: {
          id: true,
          title: true,
          rating: true,
          score: true,
          createdAt: true,
        },
        where:{
          OR:[
            {isAddedByAdmin: true},
            {creatorId: req.user?.id}
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.question.count()
    ]);

    res.status(200).json({
      success: true,
      data: {
        questions,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
