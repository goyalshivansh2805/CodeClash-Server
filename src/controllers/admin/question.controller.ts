import { Response, NextFunction } from "express";
import { CustomRequest, CustomError } from "../../types";
import { prisma } from "../../config";
import { Difficulty } from "@prisma/client";

export const createQuestion = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.isAdmin) {
      throw new CustomError("Unauthorized: Admin access required", 403);
    }

    const {
      title,
      description,
      inputFormat,
      outputFormat,
      constraints,
      difficulty,
      rating,
      timeLimit,
      memoryLimit,
      testCases,
    } = req.body;

    // Validate required fields
    if (!title || !description || !difficulty || !rating || !testCases) {
      throw new CustomError("Missing required fields", 400);
    }

    // Validate difficulty enum
    if (!Object.values(Difficulty).includes(difficulty)) {
      throw new CustomError("Invalid difficulty level", 400);
    }

    // Validate test cases
    if (!Array.isArray(testCases) || testCases.length < 2) {
      throw new CustomError("At least 2 test cases are required", 400);
    }

    const question = await prisma.question.create({
      data: {
        title,
        description,
        inputFormat,
        outputFormat,
        constraints,
        difficulty,
        rating,
        timeLimit: timeLimit || 2000,
        memoryLimit: memoryLimit || 256,
        creator: {
          connect: { id: userId }
        },
        isAddedByAdmin: true,
        testCases: {
          create: testCases.map(tc => ({
            input: tc.input,
            output: tc.output,
            isHidden: tc.isHidden || false,
            score: tc.score || 100
          }))
        }
      },
      include: {
        testCases: true
      }
    });

    res.status(201).json({
      success: true,
      data: question
    });

  } catch (error) {
    next(error);
  }
}; 