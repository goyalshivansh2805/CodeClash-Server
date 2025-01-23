import { Router } from 'express';
import { handleSubmitCode, handleRunCode } from '../controllers/submission.controller';
import { io } from '../socket/socket';  // Export io instance

const router = Router();

router.post('/submit', async (req, res, next) => {
  await handleSubmitCode(req, res, next, io);
});
router.post('/run', handleRunCode);

export default router;