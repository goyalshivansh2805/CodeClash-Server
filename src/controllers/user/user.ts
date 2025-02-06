import { Response, NextFunction } from "express";
import { CustomRequest, CustomError } from "../../types";
import { prisma } from "../../config";
import { Skill } from "@prisma/client";
import bcrypt from "bcrypt";


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

const changePassword = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.user?.id;
    if (!id) {
      next(new CustomError("User not found", 404));
      return;
    }
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
    if (!oldPassword || !newPassword) {
      next(new CustomError("Old and new password are required", 400));
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user) {
      next(new CustomError("User not found", 404));
      return;
    }
    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password as string);
    if(!isPasswordCorrect){
      next(new CustomError("Old password is incorrect", 400));
      return;
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword
      }
    });
    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
  }
}

const changeUsername = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.user?.id;
    if (!id) {
      next(new CustomError("User not found", 404));
      return;
    }
    const { username } = req.body as { username: string };
    if (!username) {
      next(new CustomError("Username is required", 400));
      return;
    }
    if(username.length < 3){
      next(new CustomError("Username must be at least 3 characters long", 400));
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if(!user){
      next(new CustomError("User not found", 404));
      return;
    }
    await prisma.user.update({
      where: { id },
      data: {
        username
      }
    });
    res.status(200).json({
      success: true,
      message: "Username changed successfully"
    });
  } catch (error) {
    next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
  }
}

const logOutOfAllDevices = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.user?.id;
    if (!id) {
      next(new CustomError("User not found", 404));
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if(!user){
      next(new CustomError("User not found", 404));
      return;
    }
    await prisma.user.update({
      where: { id },
      data: {
        version: user.version + 1
      }
    });
    res.status(200).json({
      success: true,
      message: "Logged out of all devices successfully"
    });
  } catch (error) {
    next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
  }
}

const deleteAccount = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.user?.id;
    if (!id) {
      next(new CustomError("User not found", 404));
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if(!user){
      next(new CustomError("User not found", 404));
      return;
    }
    await prisma.user.delete({
      where: { id }
    });
    res.status(200).json({
      message: "Account deleted successfully"
    });
  } catch (error) {
    next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
  }
}

const getUserProfile = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.user?.id;
    if (!id) {
      next(new CustomError("User not found", 404));
      return;
    }
    const [user,totalCount,winsCount] = await prisma.$transaction([
      prisma.user.findUnique({
        where: { id },
        select:{
          id:true,
          username:true,
          wins:true,
          email:true,
        skillLevel:true,
        rating:true,
        winStreak:true,
        maxWinStreak:true,
      }
    }),
    prisma.match.count({
      where:{
        players:{
          some:{
            id:id
          }
        },
        status:"COMPLETED"
      }
    }),
    prisma.match.count({
      where:{
        winnerId:id,
        status:"COMPLETED"
      }
    }),
    ]);
    if(!user){
      next(new CustomError("User not found", 404));
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        ...user,
        totalMatches:totalCount,
        wins:winsCount,
        losses:totalCount - winsCount,
        winRate:totalCount > 0 ? (winsCount / totalCount) * 100 : 0,
        winStreak:user.winStreak,
        maxWinStreak:user.maxWinStreak
      }
    });
  } catch (error) {
    next(new CustomError("Something went wrong", 500, `${(error as Error).message}`));
  }
}

export { updateSkillLevel, changePassword, changeUsername, logOutOfAllDevices, deleteAccount, getUserProfile };