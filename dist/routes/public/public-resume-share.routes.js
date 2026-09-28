import { Router } from "express";
import { getSharedResume, exportSharedResumePdf } from "../../controllers/public/public-resume-share.controller.js";
const publicResumeShareRouter = Router();
publicResumeShareRouter.get("/:token", getSharedResume);
publicResumeShareRouter.post("/:token/pdf", exportSharedResumePdf);
export default publicResumeShareRouter;
