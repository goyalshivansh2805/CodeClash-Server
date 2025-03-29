import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config';
import { CustomError, CustomRequest } from '../types';
import { Server } from 'socket.io';
import { updatePlayerState } from '../socket/services/gameService';
import { getGameState } from '../socket/services/gameService';
import { handleGameEnd } from '../socket/handlers/game';
import { runQueueEvents,submitQueueEvents } from '../queues/queues';
import { runQueue, submitQueue } from '../queues/queues';

enum ALLOWED_LANGUAGES {
  'python' = 'python',
  'javascript' = 'javascript',
  'java' = 'java',
  'c' = 'c',
  'cpp' = 'cpp'
}

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
    if(!ALLOWED_LANGUAGES[language as keyof typeof ALLOWED_LANGUAGES]){
      throw new CustomError('Invalid language', 400);
    }
    const matchId = req.params.matchId;


    const match = await prisma.match.findFirst({
      where: { 
        id: matchId,
        status: 'ONGOING',
        players: { some: { id: userId } }
      }
    });
    
    if (!match ) {
      throw new CustomError('Match or contest not found', 404);
    }

    const job = await runQueue.add('run-code', {
      code,
      language,
      input,
      timeout: 5,
      taskId: uuidv4(),
      userId
    });

    const result = await job.waitUntilFinished(runQueueEvents);
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
    if(!matchId || !questionId || !code || !language || !userId){
      throw new CustomError('Invalid request body', 400);
    }
    if(!ALLOWED_LANGUAGES[language as keyof typeof ALLOWED_LANGUAGES]){
      throw new CustomError('Invalid language', 400);
    }
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
      throw new CustomError('Match or contest not found', 404);
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { testCases: true }
    });

    if (!question) {
      throw new CustomError('Question not found', 404);
    }

    let passedTests = 0;
    let failedTestCase = null;
    let totalExecutionTime = 0;
    let score = 0;

    for (const testCase of question.testCases) {
      const job = await submitQueue.add('submit-code', {
        code,
        language,
        input: testCase.input,
        timeout: question.timeLimit / 1000,
        taskId: uuidv4(),
        userId
      });

      const result = await job.waitUntilFinished(submitQueueEvents);

      if (result.error) {
        await prisma.submission.create({
          data: {
            code,
            language,
            status: 'RUNTIME_ERROR',
            matchId,
            questionId,
            userId,
            failedTestCase: passedTests + 1,
            score: score,
            passedTestCases: passedTests,
            totalTestCases: question.testCases.length
          }
        });
        throw new CustomError('Runtime error', 400, result.error);
      }

      totalExecutionTime += result.executionTime || 0;
      if (result.body?.output?.trim() === testCase.output.trim()) {
        passedTests++;
        score += testCase.score;
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
        matchId: match ? matchId : null,
        questionId,
        userId,
        executionTime: Math.round(totalExecutionTime / question.testCases.length),
          failedTestCase,
        score,
        passedTestCases: passedTests,
        totalTestCases: question.testCases.length,
      }
    });

    // After successful submission
    if ((passedTests === question.testCases.length) && match) {
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
      if (problemsSolved === (match?.matchQuestions.length || 0)) {
        await handleGameEnd(io, matchId, userId);
      }
    }

    return res.json({
      submissionId: submission.id,
      status: submission.status,
      testCasesPassed: passedTests,
      totalTestCases: question.testCases.length,
      executionTime: submission.executionTime,
      failedTestCase,
      score
    });

  } catch (error) {
    next(error);
  }
}; 