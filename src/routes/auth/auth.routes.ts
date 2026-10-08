import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  register,
  registerAdmin,
  logout,
  refresh,
  me,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPassword,
  changePassword,
  updateProfile,
  uploadAvatar,
  sendOtp,
  verifyOtp,
  getOtpInfo,
  sendVerificationLink,
  updateVerificationData,
  saveOnboardingDraft,
  checkEmailVerification,
  switchRole,
  getAvailableRoles,
  checkActivationEligibility,
  activateRole,
} from "../../controllers/auth/auth.controller.js";
import {
  googleAuthStart,
  googleAuthCallback,
  appleAuthStart,
  appleAuthCallback,
  selectSocialRole,
  linkSocialAccount,
} from "../../controllers/auth/social-auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/signup", register);
router.post("/admin/register", registerAdmin);
router.post("/admin/signup", registerAdmin);
router.post("/logout", authMiddleware as any, logout as any);
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
router.post("/change-password", authMiddleware as any, changePassword as any);
router.post("/switch-role", authMiddleware as any, switchRole as any);
router.post("/activate-role", authMiddleware as any, activateRole as any);
router.get("/roles", authMiddleware as any, getAvailableRoles as any);
router.get("/check-activation-eligibility", authMiddleware as any, checkActivationEligibility as any);
router.get("/me", authMiddleware as any, me as any);
router.put("/me", authMiddleware as any, updateProfile as any);
router.put("/profile", authMiddleware as any, updateProfile as any);
router.post("/avatar", authMiddleware as any, upload.single("file"), uploadAvatar as any);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/otp-info", getOtpInfo);
router.get("/check-email-verification", checkEmailVerification);
router.post("/send-verification-link", sendVerificationLink);
router.patch("/verification", authMiddleware as any, updateVerificationData as any);
router.patch("/onboarding/draft", authMiddleware as any, saveOnboardingDraft as any);
router.put("/onboarding/draft", authMiddleware as any, saveOnboardingDraft as any);

// Social Auth Routes
router.get("/google", googleAuthStart);
router.get("/google/callback", googleAuthCallback as any);
router.get("/apple", appleAuthStart as any);
router.post("/apple/callback", appleAuthCallback as any);

// Social Post-Auth Transaction Routes (No authMiddleware because they use the short-lived registration token)
router.post("/social/select-role", selectSocialRole as any);
router.post("/social/link", linkSocialAccount as any);

export default router;
