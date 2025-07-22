import { Router } from 'express';
import { createQuestion } from '../controllers/admin/question.controller';
import { getAllContests, getLeaderboardForContest, getUserDetailsInContest , kickUserFromContest, banUserFromContest} from '../controllers/admin/contest';

const router = Router();

router.post('/questions', createQuestion);
router.get('/contests', getAllContests);
router.get('/contests/:contestId/leaderboard', getLeaderboardForContest);
router.get('/contests/:contestId/user-details/:participantId', getUserDetailsInContest);
router.post('/contests/:contestId/kick/:participantId', kickUserFromContest);
router.post('/contests/:contestId/ban/:participantId', banUserFromContest);

export default router; 