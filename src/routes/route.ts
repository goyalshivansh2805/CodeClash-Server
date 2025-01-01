import { Router } from "express";
import {healthRoute,authRoute} from "./";

const router = Router();

router.use("/health", healthRoute);
router.use("/auth", authRoute);

export default router;