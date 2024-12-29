import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
    res.json({
        message: "Server is running",
        success: true,
    })
});

export default router;