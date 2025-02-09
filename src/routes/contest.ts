import { Router } from 'express';
import  verifyToken  from '../middlewares/verifyToken';

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
  getUserContestRank
} from '../controllers/contest';

const router = Router();

// Contest CRUD routes
router.post('/', verifyToken, createContest);

// Contest question management routes
router.post('/addQuestions', verifyToken, createQuestion);
router.put('/updateQuestions', verifyToken, updateQuestion);
router.delete('/deleteQuestions', verifyToken, deleteQuestion);

router.get('/:contestId', verifyToken, getContestDetails);
router.put('/:contestId', verifyToken, updateContest);
router.delete('/:contestId', verifyToken, deleteContest);

// Contest leaderboard routes
router.post('/:contestId/leaderboard', verifyToken, updateContestLeaderboard);
router.get('/:contestId/leaderboard', verifyToken, getContestLeaderboard);  
router.get('/:contestId/rank', verifyToken, getUserContestRank);

// Contest participation route
router.post('/:contestId/join', verifyToken, joinContest);

export default router;
