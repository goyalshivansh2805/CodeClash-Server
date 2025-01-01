import {Router} from 'express';
import { registerUser, loginUser,requestPasswordReset,resetPassword ,verifyOtp,resendOtp,isEmailExists,generateTokens,startGoogleOauth,googleOauthCallback} from '../controllers';
import { registerSchema, loginSchema, resetPasswordSchema, validateRequest } from "../middlewares";

const router = Router();

router.post('/register', validateRequest(registerSchema), registerUser);
router.post('/login', validateRequest(loginSchema), loginUser);
router.post("/reset-password", requestPasswordReset);
router.patch("/reset-password/:token", validateRequest(resetPasswordSchema) ,resetPassword);
router.post('/verify',verifyOtp);
router.post("/resend-otp",resendOtp);
router.post("/is-email-exists",isEmailExists);

//Oauth routes
router.get("/google", startGoogleOauth);
router.get("/google/callback", googleOauthCallback);
router.get('/google/tokens',generateTokens);
  
export default router;