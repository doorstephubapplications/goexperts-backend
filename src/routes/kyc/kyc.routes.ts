import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getMyVerification,
  updateMyVerification,
  deleteMyVerification,
  getKycCatalog,
  getKycPolicy,
  submitMyVerification,
  saveMyVerificationDraft
} from "../../controllers/verification/verification.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/status", getMyVerification as any);
router.get("/me", getMyVerification as any);
router.get("/", getMyVerification as any);
router.get("/catalog", getKycCatalog as any);
router.get("/policy", getKycPolicy as any);
router.patch("/document", updateMyVerification as any);
router.patch("/", updateMyVerification as any);
router.delete("/document", deleteMyVerification as any);
router.delete("/", deleteMyVerification as any);
router.post("/submit", submitMyVerification as any);
router.post("/draft", saveMyVerificationDraft as any);

export default router;
