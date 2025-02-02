import { prisma } from '../../config/prisma';
import { Problem } from '../types/match';

export async function getMatchProblems(): Promise<Problem[]> {
    const problems = await prisma.question.findMany({
      where: {
        AND: [
          { rating: { gte: 800 } },   
          { rating: { lte: 2400 } },  
        ]
      },
      orderBy: {
        rating: 'asc' 
      },
      take: 3,
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
  
    if (problems.length === 3) {
      const [easy, medium, hard] = problems;
      if (!(easy.rating < medium.rating && medium.rating < hard.rating)) {
        return await prisma.question.findMany({
          where: {
            OR: [
              { rating: { gte: 800, lte: 1200 } },   
              { rating: { gte: 1300, lte: 1700 } },   
              { rating: { gte: 1800, lte: 2400 } }  
            ]
          },
          orderBy: {
            rating: 'asc'
          },
          take: 3,
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