import { Router } from "express";
import {healthRoute,authRoute,userRoute,matchRoute,adminRoute,questionRoute} from "./";
import { verifyToken } from "../middlewares";

const router = Router();

router.use("/health", healthRoute);
router.use("/auth", authRoute);
router.use("/user", verifyToken, userRoute);
router.use("/match", verifyToken, matchRoute);
router.use("/admin", verifyToken, adminRoute);
router.use("/question", verifyToken, questionRoute);
export default router;
