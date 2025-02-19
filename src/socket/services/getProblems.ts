import { prisma } from '../../config/prisma';
import { Problem } from '../types/match';
import { MatchMode } from '@prisma/client';
export async function getMatchProblems(mode: MatchMode): Promise<Problem[]> {
    let problemCount = 3;
    if(mode === "STANDARD"){
      problemCount = 3;
    }else if(mode === "SPEED"){
      problemCount = 1;
    }
    const problems = await prisma.question.findMany({
      where: {
        AND: [
          { rating: { gte: 800 } },   
          { rating: { lte: 2400 } },  
        ],
        isAddedByAdmin: true
      },
      orderBy: {
        rating: 'asc' 
      },
      take: problemCount,
      select: {
        id: true,
        title: true,
        description: true,
        rating: true,
        testCases: {
          where: { isHidden: false }, 
          select: {
            input: true,
            output: true,
            isHidden: true
          }
        }
      }
    });
  
    if (problems.length === problemCount && mode === "STANDARD") {
      const [easy, medium, hard] = problems;
      if (!(easy.rating < medium.rating && medium.rating < hard.rating)) {
        return await prisma.question.findMany({
          where: {
            OR: [
              { rating: { gte: 800, lte: 1200 } },   
              { rating: { gte: 1300, lte: 1700 } },   
              { rating: { gte: 1800, lte: 2400 } }  
            ],
            isAddedByAdmin: true
          },
          orderBy: {
            rating: 'asc'
          },
          take: problemCount,
          select: {
            id: true,
            title: true,
            description: true,
            rating: true,
            testCases: {
              select: {
                input: true,
                output: true,
                isHidden: true
              }
            }
          }
        });
      }
    }
  
    return problems as Problem[];
  }