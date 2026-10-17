import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
import { getMyVerification, updateMyVerification, deleteMyVerification } from "../../controllers/verification/verification.controller.js";
import { getInvestorDashboard, getInvestorProfile, updateInvestorProfile, listWatchlist, addToWatchlist, removeFromWatchlist, getInvestorPortfolio, listInvestorInvestments, createInvestorInvestment, listInvestorMeetings, createInvestorMeeting, listInvestorMessages, createInvestorMessage, getInvestorWallet, depositInvestorWallet, withdrawInvestorWallet, listInvestorInvoices, getInvestorAnalytics, getInvestorReports, listInvestorNotifications, markInvestorNotificationRead, markAllInvestorNotificationsRead, listInvestorDocuments, addInvestorDocument, listInvestorSubscriptions, purchaseInvestorSubscription, getInvestorSettings, updateInvestorSettings, listAllFounders, listInvestorReviews, addInvestorTeamMember, deleteInvestorTeamMember, listInvestorTeam, } from "../../controllers/investor/investor.controller.js";
const router = Router();
router.use(authMiddleware);
// Portal media upload is needed DURING onboarding for avatars and documents
router.post("/media/upload", upload.single("file"), uploadFile);
// Verification routes must be accessible before onboarding completion so users can upload KYC documents
router.get("/verification", getMyVerification);
router.patch("/verification", updateMyVerification);
router.delete("/verification", deleteMyVerification);
router.use(requireOnboarding);
// ── Shared Portal Routes (accessible to all authenticated portal roles: investor, freelancer, client, founder) ──
router.get("/watchlist", listWatchlist);
router.post("/watchlist", addToWatchlist);
router.delete("/watchlist/:id", removeFromWatchlist);
router.get("/portfolio", getInvestorPortfolio);
router.get("/investments", listInvestorInvestments);
router.post("/investments", createInvestorInvestment);
// ── Investor-Specific Routes (requires portal role) ──
const investorOnly = portalRoleMiddleware(["investor", "client", "founder", "freelancer", "admin", "super_admin"]);
router.get("/dashboard", investorOnly, getInvestorDashboard);
router.get("/profile", investorOnly, getInvestorProfile);
router.patch("/profile", investorOnly, updateInvestorProfile);
router.put("/profile", investorOnly, updateInvestorProfile);
router.get("/meetings", investorOnly, listInvestorMeetings);
router.post("/meetings", investorOnly, createInvestorMeeting);
router.get("/messages", investorOnly, listInvestorMessages);
router.post("/messages", investorOnly, createInvestorMessage);
router.get("/wallet", investorOnly, getInvestorWallet);
router.post("/wallet/deposit", investorOnly, depositInvestorWallet);
router.post("/wallet/withdraw", investorOnly, withdrawInvestorWallet);
router.get("/invoices", investorOnly, listInvestorInvoices);
router.get("/analytics", investorOnly, getInvestorAnalytics);
router.get("/reports", investorOnly, getInvestorReports);
router.get("/notifications", investorOnly, listInvestorNotifications);
router.patch("/notifications/read-all", investorOnly, markAllInvestorNotificationsRead);
router.patch("/notifications/:id/read", investorOnly, markInvestorNotificationRead);
router.get("/documents", investorOnly, listInvestorDocuments);
router.post("/documents", investorOnly, addInvestorDocument);
router.get("/subscription", investorOnly, listInvestorSubscriptions);
router.get("/subscriptions", investorOnly, listInvestorSubscriptions);
router.post("/subscription/purchase", investorOnly, purchaseInvestorSubscription);
router.post("/subscriptions/purchase", investorOnly, purchaseInvestorSubscription);
router.get("/settings", investorOnly, getInvestorSettings);
router.patch("/settings", investorOnly, updateInvestorSettings);
router.get("/all-founders", investorOnly, listAllFounders);
router.get("/reviews", investorOnly, listInvestorReviews);
// Team endpoints
router.get("/team", listInvestorTeam);
router.post("/team", addInvestorTeamMember);
router.delete("/team/:id", deleteInvestorTeamMember);
// Professional Services
import { listFreelancerServices, getFreelancerServiceById, createFreelancerService, updateFreelancerService, deleteFreelancerService, } from "../../controllers/freelancer/freelancer-modules.controller.js";
router.get("/services", listFreelancerServices);
router.get("/profile/services", listFreelancerServices);
router.post("/services", createFreelancerService);
router.post("/profile/services", createFreelancerService);
router.get("/services/:id", getFreelancerServiceById);
router.get("/profile/services/:id", getFreelancerServiceById);
router.put("/services/:id", updateFreelancerService);
router.put("/profile/services/:id", updateFreelancerService);
router.delete("/services/:id", deleteFreelancerService);
router.delete("/profile/services/:id", deleteFreelancerService);
// Languages
import { listFreelancerLanguages, createFreelancerLanguage, updateFreelancerLanguage, deleteFreelancerLanguage, } from "../../controllers/freelancer/freelancer-modules.controller.js";
router.get("/languages", listFreelancerLanguages);
router.get("/profile/languages", listFreelancerLanguages);
router.post("/languages", createFreelancerLanguage);
router.post("/profile/languages", createFreelancerLanguage);
router.put("/languages/:id", updateFreelancerLanguage);
router.put("/profile/languages/:id", updateFreelancerLanguage);
router.delete("/languages/:id", deleteFreelancerLanguage);
router.delete("/profile/languages/:id", deleteFreelancerLanguage);
// Profile Custom FAQs
import { getMyProfileFaqs, saveMyProfileFaqs } from "../../controllers/user-faqs.controller.js";
router.get("/profile/faqs", getMyProfileFaqs);
router.put("/profile/faqs", saveMyProfileFaqs);
router.post("/profile/faqs", saveMyProfileFaqs);
export default router;
