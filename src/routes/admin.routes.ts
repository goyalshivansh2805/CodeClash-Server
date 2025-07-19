import { Router } from 'express';
import { createQuestion } from '../controllers/admin/question.controller';
import { getAllContests, getLeaderboardForContest, getUserDetailsInContest } from '../controllers/admin/contest';

const router = Router();

router.post('/questions', createQuestion);
router.get('/contests', getAllContests);
router.get('/contests/:contestId/leaderboard', getLeaderboardForContest);
router.get('/contests/:contestId/user-details/:participantId', getUserDetailsInContest);

export default router; 