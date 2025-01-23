import { Router } from 'express';
import { updateSkillLevel } from '../controllers';

const router = Router();

router.patch('/skill-level', updateSkillLevel);

export default router;