import { Router } from 'express';
import { createQuestion } from '../controllers/admin/question.controller';
import { verifyToken } from '../middlewares';

const router = Router();

router.post('/questions', verifyToken, createQuestion);

export default router; 