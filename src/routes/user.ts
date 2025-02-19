import { Router } from 'express';
import { changeUsername, deleteAccount, changePassword, getSubmissionById, getSubmissions, updateSkillLevel, logOutOfAllDevices, getLeaderboard, getWinTrend, getRecentMatches, getSubmissionByMatchId, getUserProfile, getProfileHeatmap, getRecentContest, getSubmissionByContestId    } from '../controllers';
import { validateRequest ,changePasswordSchema} from '../middlewares';

const router = Router();

router.patch('/skill-level', updateSkillLevel);
router.get('/submissions', getSubmissions);
router.get('/submissions/:id', getSubmissionById);
router.get('/submissions/match/:id', getSubmissionByMatchId);
router.get('/submissions/contest/:id', getSubmissionByContestId);


//Setting routes
router.patch('/password', validateRequest(changePasswordSchema), changePassword);
router.patch('/username', changeUsername);
router.delete('/', deleteAccount);
router.post('/logoutAllDevices', logOutOfAllDevices);

//Dashboard routes
router.get('/leaderboard', getLeaderboard);
router.get('/recent-matches', getRecentMatches);
router.get('/win-trend', getWinTrend);
router.get('/profile', getUserProfile);
router.get('/profile/heatmap', getProfileHeatmap);
router.get('/recent-contest', getRecentContest);
export default router;