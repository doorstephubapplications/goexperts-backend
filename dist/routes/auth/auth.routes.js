import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, registerAdmin, logout, refresh, me, forgotPassword, verifyPasswordResetOtp, resetPassword, changePassword, updateProfile, uploadAvatar, sendOtp, verifyOtp, getOtpInfo, sendVerificationLink, updateVerificationData, saveOnboardingDraft, checkEmailVerification, } from "../../controllers/auth/auth.controller.js";
import { googleAuthStart, googleAuthCallback, appleAuthStart, appleAuthCallback, selectSocialRole, linkSocialAccount, } from "../../controllers/auth/social-auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
const router = Router();
router.post("/login", login);
router.post("/register", register);
router.post("/signup", register);
router.post("/admin/register", registerAdmin);
router.post("/admin/signup", registerAdmin);
router.post("/logout", authMiddleware, logout);
router.post("/refresh", refresh);
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per `window`
    message: { success: false, message: "Too many password reset requests from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/verify-password-reset-otp", forgotPasswordLimiter, verifyPasswordResetOtp);
router.post("/reset-password", forgotPasswordLimiter, resetPassword);
router.post("/change-password", authMiddleware, changePassword);
router.get("/me", authMiddleware, me);
router.put("/me", authMiddleware, updateProfile);
router.put("/profile", authMiddleware, updateProfile);
router.post("/avatar", authMiddleware, upload.single("file"), uploadAvatar);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/otp-info", getOtpInfo);
router.get("/check-email-verification", checkEmailVerification);
router.post("/send-verification-link", sendVerificationLink);
router.patch("/verification", authMiddleware, updateVerificationData);
router.patch("/onboarding/draft", authMiddleware, saveOnboardingDraft);
router.put("/onboarding/draft", authMiddleware, saveOnboardingDraft);
// Social Auth Routes
router.get("/google", googleAuthStart);
router.get("/google/callback", googleAuthCallback);
router.get("/apple", appleAuthStart);
router.post("/apple/callback", appleAuthCallback);
// Social Post-Auth Transaction Routes (No authMiddleware because they use the short-lived registration token)
router.post("/social/select-role", selectSocialRole);
router.post("/social/link", linkSocialAccount);
export default router;
