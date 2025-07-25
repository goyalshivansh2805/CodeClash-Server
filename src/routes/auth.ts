import {Router} from 'express';
import { registerUser, loginUser,requestPasswordReset,resetPassword ,verifyOtp,resendOtp,refreshToken,isEmailExists,generateTokens,startGoogleOauth,googleOauthCallback ,startGithubOauth , githubOauthCallback, sendOtpEmail } from '../controllers';
import { registerSchema, loginSchema, resetPasswordSchema, validateRequest ,loginOtp,registerOtp} from "../middlewares";

const router = Router();

router.post('/register', validateRequest(registerSchema),registerOtp, registerUser);
router.post('/login', validateRequest(loginSchema), loginUser);
// router.post('/login/otp',loginOtp,sendOtpEmail); //off for now
router.post("/reset-password", requestPasswordReset);
router.patch("/reset-password/:token", validateRequest(resetPasswordSchema) ,resetPassword);
// router.post('/verify/login',loginOtp,verifyOtp); //off for now
router.post('/verify/register',registerOtp,verifyOtp);
router.post("/resend-otp",resendOtp);
router.post("/email",isEmailExists);
router.post("/refresh-token",refreshToken);

//Oauth routes
router.get("/google", startGoogleOauth);
router.get("/google/callback", googleOauthCallback);
router.post('/google/tokens',generateTokens);

// GitHub OAuth routes
router.get("/github", startGithubOauth);
router.get("/github/callback", githubOauthCallback);
router.post('/github/tokens', generateTokens);

export default router;