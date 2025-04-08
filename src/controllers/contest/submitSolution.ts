import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { invokeLambda } from '../../services/lambda.service';
import { runQueue, submitQueue, submitQueueEvents } from '../../queues/queues';
import { runQueueEvents } from '../../queues/queues';

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
    const contestId = req.params.contestId;
    const questionId = req.params.questionId;

    if (!userId) {
      throw new CustomError('User not found', 401);
    }
    if(!code || !language || !input){
      throw new CustomError('Invalid request body', 400);
    }
    if(!ALLOWED_LANGUAGES[language as keyof typeof ALLOWED_LANGUAGES]){
      throw new CustomError('Invalid language', 400);
    }

    // Check if contest exists and is ongoing
    const contest = await prisma.contest.findFirst({
      where: { 
        id: contestId,
        status: 'ONGOING',
        participants: { some: { userId } },
        questions: { some: { id: questionId } }
      }
    });

    const job = await runQueue.add('run-code', {
      code,
      language,
      input,
      timeoutMs: 2000,
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
  next: NextFunction
): Promise<void> => {
  try {
    const { code, language } = req.body;
    const contestId = req.params.contestId;
    const questionId = req.params.questionId;
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    if(!ALLOWED_LANGUAGES[language as keyof typeof ALLOWED_LANGUAGES]){
      throw new CustomError('Invalid language', 400);
    }

    if (!contestId || !questionId) {
      throw new CustomError('Contest ID and Question ID are required', 400);
    }

    // Check if contest exists and is ongoing
    const contest = await prisma.contest.findFirst({
      where: { 
        id: contestId,
        startTime: { lte: new Date() },
        endTime: { gte: new Date() },
        questions: { some: { id: questionId } }
      },
      include: {
        questions: {
          where: { id: questionId },
          select: {
            score: true,
            testCases: true,
            timeLimit:true
          }
        }
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found or not active', 404);
    }

    // Check if user has joined the contest
    const participation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId
        }
      }
    });

    if (!participation) {
      throw new CustomError('You have not joined this contest', 403);
    }

    const question = contest.questions[0];
    if (!question) {
      throw new CustomError('Question not found', 404);
    }

    let passedTests = 0;
    let failedTestCase = null;
    let totalExecutionTime = 0;

    // Run test cases
    for (const testCase of question.testCases) {
      const job = await submitQueue.add('submit-code', {
        code,
        language,
        input: testCase.input,
        timeoutMs: question.timeLimit,
        taskId: uuidv4(),
        userId
      });

      const result = await job.waitUntilFinished(submitQueueEvents);

      if (result.error) {
        await prisma.submission.create({
          data: {
            code,
            language,
            status: result.error === 'TIME_LIMIT_EXCEEDED' ? 'TIME_LIMIT_EXCEEDED' : 'RUNTIME_ERROR',
            contestId,
            questionId,
            userId,
            failedTestCase: passedTests + 1
          }
        });
        throw new CustomError(result.error, 400, result.error);
      }

      totalExecutionTime += result.executionTime || 0;
      if (result.output?.trim() === testCase.output.trim()) {
        passedTests++;
      } else {
        failedTestCase = passedTests + 1;
        break;
      }
    }

    const isAccepted = passedTests === question.testCases.length;
    
    // Create submission record
    const submission = await prisma.submission.create({
      data: {
        code,
        language,
        status: isAccepted ? 'ACCEPTED' : 'WRONG_ANSWER',
        contestId,
        questionId,
        userId,
        executionTime: Math.round(totalExecutionTime / question.testCases.length),
        failedTestCase
      }
    });

    // If solution is accepted, update contest participation score
    if (isAccepted) {
      const userPreviousSubmission = await prisma.submission.findMany({
        where:{
          contestId,
          userId,
          questionId,
          status:"ACCEPTED"
        }
      });

      // Update contest leaderboard
      if(!userPreviousSubmission){
        Promise.all([await prisma.contestParticipation.update({
          where: {
            userId_contestId: {
              userId,
              contestId
            }
          },
          data: {
            score: {
              increment: question.score
            }
          }
        }),await prisma.contestLeaderboard.upsert({
          where: {
            contestId_userId: {
              contestId,
              userId
            }
          },
          create: {
            userId,
            contestId,
            score: question.score,
            problemsSolved: 1,
            lastSubmissionTime: new Date()
          },
          update: {
            score: { increment: question.score },
            problemsSolved: { increment: 1 },
            lastSubmissionTime: new Date()
          }
        })])
      }
    }

    res.json({
      submissionId: submission.id,
      status: submission.status,
      testCasesPassed: passedTests,
      totalTestCases: question.testCases.length,
      executionTime: submission.executionTime,
      failedTestCase,
      score: isAccepted ? question.score : 0
    });

  } catch (error) {
    next(error);
  }
}; 