import { Router } from "express";
import {healthRoute} from "./";

const router = Router();

router.use("/health", healthRoute);

export default router;