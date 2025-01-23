import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config';
import { CustomError, CustomRequest } from '../types';
import { invokeLambda } from '../services/lambda.service';
import { Server } from 'socket.io';
import { updatePlayerState } from '../socket/services/gameService';
import { getGameState } from '../socket/services/gameService';
import { handleGameEnd } from '../socket/handlers/game';


export const handleRunCode = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const { code, language, input } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      throw new CustomError('User not found', 401);
    }
    if(!code || !language || !input){
      throw new CustomError('Invalid request body', 400);
    }
    const matchId = req.params.matchId;


    const match = await prisma.match.findFirst({
      where: { 
        id: matchId,
        status: 'ONGOING',
        players: { some: { id: userId } }
      }
    });
    
    if (!match) {
      throw new CustomError('Match not found or already ended', 404);
    }

    const result = await invokeLambda({
      code,
      language,
      input,
      timeout: 5,
      taskId: uuidv4(),
      userId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const handleSubmitCode = async (
  req: CustomRequest, 
  res: Response, 
  next: NextFunction,
  io: Server
) => {
  try {
    const { matchId, questionId, code, language } = req.body;
    const userId = req.user?.id;

    // Get match with questions count
    const match = await prisma.match.findFirst({
      where: { 
        id: matchId,
        status: 'ONGOING',
        players: { some: { id: userId } }
      },
      include: {
        matchQuestions: true
      }
    });

    if (!match) {
      throw new CustomError('Match not found or already ended', 404);
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { testCases: true }
    });

    if (!question) {
      throw new CustomError('Question not found', 404);
    }

    if (!userId) {
      throw new CustomError('User not found', 401);
    }

    let passedTests = 0;
    let failedTestCase = null;
    let totalExecutionTime = 0;

    for (const testCase of question.testCases) {
      const result = await invokeLambda({
        code,
        language,
        input: testCase.input,
        timeout: question.timeLimit / 1000,
        taskId: uuidv4(),
        userId
      });

      if (result.error) {
        await prisma.submission.create({
          data: {
            code,
            language,
            status: 'RUNTIME_ERROR',
            matchId,
            questionId,
            userId,
            failedTestCase: passedTests + 1
          }
        });
        throw new CustomError('Runtime error', 400, result.error);
      }

      totalExecutionTime += result.executionTime || 0;
      if (result.body?.output?.trim() === testCase.output.trim()) {
        passedTests++;
      } else {
        failedTestCase = passedTests + 1;
        break;
      }
    }

    const submission = await prisma.submission.create({
      data: {
        code,
        language,
        status: passedTests === question.testCases.length ? 'ACCEPTED' : 'WRONG_ANSWER',
        matchId,
        questionId,
        userId,
        executionTime: Math.round(totalExecutionTime / question.testCases.length),
        failedTestCase
      }
    });

    // After successful submission
    if (passedTests === question.testCases.length) {
      // Get all accepted submissions for this match
      const acceptedSubmissions = await prisma.submission.findMany({
        where: {
          userId,
          matchId,
          status: 'ACCEPTED'
        },
        select: {
          questionId: true
        },
        distinct: ['questionId']
      });

      const solvedProblemIds = new Set(acceptedSubmissions.map(s => s.questionId));
      const problemsSolved = solvedProblemIds.size;

      // Update game state
      await updatePlayerState(matchId, userId, {
        problemsSolved,
        solvedProblems: solvedProblemIds,
        lastSubmission: new Date()
      });

      // Emit state update
      io.to(`match_${matchId}`).emit('game_state_update', {
        userId,
        problemId: questionId,
        status: 'ACCEPTED',
      });

      // Check if player won (solved all problems)
      if (problemsSolved === match.matchQuestions.length) {
        await handleGameEnd(io, matchId, userId);
      }
    }

    return res.json({
      submissionId: submission.id,
      status: submission.status,
      testCasesPassed: passedTests,
      totalTestCases: question.testCases.length,
      executionTime: submission.executionTime,
      failedTestCase
    });

  } catch (error) {
    next(error);
  }
}; 