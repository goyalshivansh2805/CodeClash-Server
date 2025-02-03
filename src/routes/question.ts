import {Router} from 'express';
import { getQuestion } from '../controllers';

const router = Router();

router.get('/:problemId', getQuestion);


export default router;