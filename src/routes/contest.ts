import { Router } from 'express';

import {
  createContest,
  updateContest,
  deleteContest,
  joinContest,
  getContestDetails,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  updateContestLeaderboard,
  getContestLeaderboard,
  getUserContestRank,
  startContest,
  endContest,
  getContestStatus,
  getAllContestsByCreator,
  getAllQuestions,
  handleRunCode,
  handleSubmitCode,
  addQuestionToContestFromLibrary,
  getSubmissionByQuestionIdAndContestId
} from '../controllers';
import { getRegisteredContests } from '../controllers/contest/allContestByCreator';

const router = Router();

// Contest CRUD routes
router.post('/', createContest);

// Contest question management routes
router.post('/addQuestions', createQuestion);
router.post('/addQuestionsFromLibrary', addQuestionToContestFromLibrary);
router.put('/updateQuestions', updateQuestion);
router.delete('/deleteQuestions', deleteQuestion);
router.get('/questions/all', getAllQuestions);


router.get('/my-contests' , getAllContestsByCreator)
router.get('/my-contests/registered', getRegisteredContests);
// router.get('/:contestId', getContestDetails); Moved to route.ts so that it can be used auth free
router.put('/:contestId', updateContest);
router.delete('/:contestId', deleteContest);

// Contest leaderboard routes
router.post('/:contestId/leaderboard', updateContestLeaderboard);
router.get('/:contestId/leaderboard', getContestLeaderboard);  
router.get('/:contestId/rank', getUserContestRank);

// Contest participation route
router.post('/:contestId/join', joinContest);

// Contest status management routes
router.post('/:contestId/start', startContest);
router.post('/:contestId/end', endContest);
router.get('/:contestId/status', getContestStatus);

// Code submission routes
router.post('/:contestId/questions/:questionId/run', handleRunCode);
router.post('/:contestId/questions/:questionId/submit', handleSubmitCode);

// Contest submission routes
router.get('/:contestId/questions/:questionId/submissions', getSubmissionByQuestionIdAndContestId);

router.get('/questions/all', getAllQuestions);
export default router;
