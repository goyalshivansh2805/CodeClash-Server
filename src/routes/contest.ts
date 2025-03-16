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
  addQuestionToContestFromLibrary
} from '../controllers/contest';

const router = Router();

// Contest CRUD routes
router.post('/', createContest);

// Contest question management routes
router.post('/addQuestions', createQuestion);
router.put('/updateQuestions', updateQuestion);
router.delete('/deleteQuestions', deleteQuestion);
router.get('/questions/all', getAllQuestions);


router.get('/my-contests' , getAllContestsByCreator)
router.get('/:contestId', getContestDetails);
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

router.get('/questions/all', getAllQuestions);
router.post('/:contestId/questions/add', addQuestionToContestFromLibrary);
export default router;
