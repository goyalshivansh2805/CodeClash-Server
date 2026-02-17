import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config';
import { CustomError, CustomRequest } from '../../types';
import { invokeLambda } from '../../services/lambda.service';
import { runQueue, submitQueue, submitQueueEvents } from '../../queues/queues';
import { runQueueEvents } from '../../queues/queues';
import { SubmissionStatus } from '@prisma/client';

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
    const contestIdParam = req.params.contestId;
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

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contestIdParam);

    // Check if contest exists and is ongoing
    const contest = await prisma.contest.findFirst({
      where: { 
        ...(isUUID ? { id: contestIdParam } : { slug: contestIdParam }),
        startTime: { lte: new Date() },  
        endTime: { gte: new Date() },
        participants: { some: { userId } },
        questions: { some: { id: questionId } }
      }
    });

    if (!contest) {
      throw new CustomError('Contest not found or not active', 404);
    }

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
    const contestIdParam = req.params.contestId;
    const questionId = req.params.questionId;
    const userId = req.user?.id;

    // Check authentication
    if (!userId) {
      throw new CustomError('Unauthorized', 401);
    }

    // Validate language
    if(!ALLOWED_LANGUAGES[language as keyof typeof ALLOWED_LANGUAGES]){
      throw new CustomError('Invalid language', 400);
    }

    // Validate params
    if (!contestIdParam || !questionId) {
      throw new CustomError('Contest ID and Question ID are required', 400);
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contestIdParam);

    // Fetch contest and question
    const contest = await prisma.contest.findFirst({
      where: { 
        ...(isUUID ? { id: contestIdParam } : { slug: contestIdParam }),
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

    // Contest must exist and be active
    if (!contest) {
      throw new CustomError('Contest not found or not active', 404);
    }

    const contestId = contest.id;

    // Check user participation
    const participation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: { userId, contestId }
      }
    });

    if (!participation) {
      throw new CustomError('You have not joined this contest', 403);
    }

    if(participation.isBanned) {
      throw new CustomError('You have been banned from this contest', 403);
    }

    const question = contest.questions[0];

    // Ensure question exists
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

      // Handle runtime or TLE
      if (result.error) {

        await prisma.submission.create({
          data: {
            code,
            language,
            status: result.error === 'TIME_LIMIT_EXCEEDED'
              ? 'TIME_LIMIT_EXCEEDED'
              : 'RUNTIME_ERROR',
            contestId,
            questionId,
            userId,
            failedTestCase: passedTests + 1,
            passedTestCases: passedTests,
            totalTestCases: question.testCases.length,
            executionTime: Math.round(totalExecutionTime / question.testCases.length),
            score: 0
          }
        });

        throw new CustomError(result.error, 400, result.error);
      }

      totalExecutionTime += result.executionTime || 0;

      // Compare output
      if (result.output?.trim() === testCase.output.trim()) {
        passedTests++;
      } else {
        failedTestCase = passedTests + 1;
        break;
      }
    }

    const totalTestCases = question.testCases.length;

    // Calculate partial score
    const partialScore = Math.floor(
      (passedTests / totalTestCases) * question.score
    );

    let finalStatus: SubmissionStatus;

    // Decide final status
    if (passedTests === totalTestCases) {
      finalStatus = "ACCEPTED";
    } else if (passedTests > 0) {
      finalStatus = "WRONG_ANSWER";
    } else {
      finalStatus = "WRONG_ANSWER";
    }

    // Get previous best submission
    const previousBest = await prisma.submission.findFirst({
      where:{
        contestId,
        userId,
        questionId
      },
      orderBy:{
        score:"desc"
      }
    });

    const previousScore = previousBest?.score || 0;

    // Create new submission
    const submission = await prisma.submission.create({
      data: {
        code,
        language,
        status: finalStatus,
        contestId,
        questionId,
        userId,
        executionTime: Math.round(totalExecutionTime / totalTestCases),
        failedTestCase,
        passedTestCases: passedTests,
        totalTestCases,
        score: partialScore
      }
    });

    // Update scores only if improved
    if (partialScore > previousScore) {

      const scoreDiff = partialScore - previousScore;

      await prisma.contestParticipation.update({
        where: {
          userId_contestId: { userId, contestId }
        },
        data: {
          score: { increment: scoreDiff }
        }
      });

      await prisma.contestLeaderboard.upsert({
        where: {
          contestId_userId: { contestId, userId }
        },
        create: {
          userId,
          contestId,
          score: partialScore,
          problemsSolved: finalStatus === "ACCEPTED" ? 1 : 0,
          lastSubmissionTime: new Date()
        },
        update: {
          score: { increment: scoreDiff },
          problemsSolved: finalStatus === "ACCEPTED" && previousScore === 0
            ? { increment: 1 }
            : undefined,
          lastSubmissionTime: new Date()
        }
      });
    }

    res.json({
      submissionId: submission.id,
      status: submission.status,
      testCasesPassed: passedTests,
      totalTestCases,
      executionTime: submission.executionTime,
      failedTestCase,
      score: partialScore
    });

  } catch (error) {
    next(error);
  }
};
