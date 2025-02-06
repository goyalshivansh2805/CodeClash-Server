import { Router } from 'express';

import {
  createContest,
  updateContest,
  deleteContest,
  getContestDetails,
  addQuestionToContest,
  updateQuestionInContest,
  deleteQuestionFromContest,
  updateContestLeaderboard,
  getContestLeaderboard,
  getUserContestRank
} from '../controllers/contest';

const router = Router();

// Contest CRUD routes
router.post('/', authenticateUser, createContest);
router.get('/:contestId', authenticateUser, getContestDetails);
router.put('/:contestId', authenticateUser, updateContest);
router.delete('/:contestId', authenticateUser, deleteContest);

// Contest question management routes
router.post('/:contestId/questions', authenticateUser, addQuestionToContest);
router.put('/:contestId/questions/:questionId', authenticateUser, updateQuestionInContest);
router.delete('/:contestId/questions/:questionId', authenticateUser, deleteQuestionFromContest);

// Contest leaderboard routes
router.post('/:contestId/leaderboard', authenticateUser, updateContestLeaderboard);
router.get('/:contestId/leaderboard', authenticateUser, getContestLeaderboard);
router.get('/:contestId/rank', authenticateUser, getUserContestRank);

export default router;
