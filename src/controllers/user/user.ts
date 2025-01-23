import { Response, NextFunction } from "express";
import { CustomRequest, CustomError } from "../../types";
import { prisma } from "../../config";
import { Skill } from "@prisma/client";


const updateSkillLevel = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
)=> {
  try {
    const id = req.user?.id;
    if (!id) {
      next(new CustomError("User not found", 404));
      return;
    }
    const { skillLevel } = req.body as { skillLevel: Skill };
    if (!skillLevel || !Object.values(Skill).includes(skillLevel)) {
      next(new CustomError("Invalid skill level", 400));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      next(new CustomError("User not found", 404));
      return;
    }

    if (user.skillLevel !== null) {
      next(new CustomError("Skill level can only be set once", 400));
      return;
    }

    const defaultRatings: Record<Skill, number> = {
      BEGINNER: 800,
      INTERMEDIATE: 1200,
      PRO: 1600
    };

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        skillLevel,
        rating: defaultRatings[skillLevel],
      }
    });

    res.status(200).json({
      success: true,
      data: {
        skillLevel: updatedUser.skillLevel,
        rating: updatedUser.rating
      }
    });
  } catch (error) {
    next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
  }
};

export { updateSkillLevel };