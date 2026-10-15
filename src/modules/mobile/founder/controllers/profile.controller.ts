  import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
import { resolveMasterOptionsInput, resolveLabelOrName, resolveOptionObject } from '../../../../utils/array-option-resolver.js';
import { getJsonSetting } from '../../../../common/helpers/portal-shared.js';

async function resolveId(val: any, model: string) {
  if (!val) return "";
  try {
    const delegate = (prisma as any)[model];
    if (delegate) {
      const found = await delegate.findFirst({
        where: { OR: [{ id: val }, { name: val }] },
        select: { id: true }
      });
      return found?.id || val;
    }
  } catch { }
  return val;
}

function parseRegData(regData: any): Record<string, any> {
  if (!regData) return {};
  if (typeof regData === 'string') {
    try { return JSON.parse(regData); } catch { return {}; }
  }
  if (typeof regData === 'object') return regData;
  return {};
}

import { getMe, updateMe as authUpdateMe } from '../../auth/auth.controller.js';

export const getProfile = getMe;

export const getStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, fullName: true, email: true, avatarUrl: true, bio: true, phone: true, country: true, city: true, role: true, registrationData: true, createdAt: true, updatedAt: true }
    });

    const [profile, idea] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }).catch(() => null),
      prisma.startupIdea.findFirst({
        where: {
          founder: req.user.id,
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null)
    ]);

    const startupDetails = await getJsonSetting(req.user.id, "startup-details", {});
    const founderDetails = await getJsonSetting(req.user.id, "founder-profile-details", {});

    const reg: any = {
      ...parseRegData(user?.registrationData),
      ...startupDetails,
      ...founderDetails
    };

    if (!idea && !profile?.startupName && !reg.startupName && !profile?.pitch && !reg.pitch) {
      return res.json(successResponse('No startup details found', null));
    }

    const startupName = idea?.startupName || idea?.startup || idea?.title || profile?.startupName || reg.startupName || "";
    const startupPitch = idea?.pitch || idea?.description || profile?.pitch || reg.pitch || reg.description || user?.bio || "";
    const startupIndustry = idea?.industry || profile?.industry || reg.industry || reg.category || "";
    const startupStage = idea?.stage || profile?.stage || reg.stage || "";
    const targetFunding = idea?.funding || idea?.amountRaising || profile?.targetRaise || reg.targetRaise || reg.funding || 0;
    const raisedFunding = profile?.raised ?? reg.raised ?? 0;
    const equityOffered = idea?.equity || idea?.equityOffered || reg.equity || reg.equityOffered || 0;

    const startup = idea || {
      id: profile?.id || `fnd_${req.user.id}`,
      startup: startupName,
      startupName: startupName,
      name: startupName,
      title: startupName,
      description: startupPitch,
      pitch: startupPitch,
      oneLinePitch: startupPitch,
      industry: startupIndustry,
      stage: startupStage,
      funding: targetFunding,
      targetRaise: targetFunding,
      amountRaising: targetFunding,
      raised: raisedFunding,
      equity: equityOffered,
      equityOffered: equityOffered,
      status: "active",
      visibility: "public",
      teamSize: profile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1),
      businessPlan: reg.businessPlan || null,
      pitchDeck: profile?.pitchDeck || reg.pitchDeck || null,
      createdAt: profile?.createdAt || user?.createdAt,
      updatedAt: profile?.updatedAt || user?.updatedAt,
    };

    let rawBids: any[] = [];
    if (idea?.id) {
      try {
        rawBids = await prisma.investment.findMany({
          where: { startup: idea.id, deletedAt: null },
          orderBy: { createdAt: 'desc' }
        });
      } catch {
        rawBids = [];
      }
    }

    const countryId = await resolveId(user?.country || reg.country || "", "Country");
    const userObj = {
      id: user?.id,
      email: user?.email,
      fullName: user?.fullName,
      avatarUrl: user?.avatarUrl || null,
      logo: user?.avatarUrl || null,
      bio: user?.bio || reg.bio || reg.pitch || "",
      phone: user?.phone || reg.phone || reg.mobile || "",
      countryId: countryId,
      city: user?.city || reg.city || "",
      role: user?.role,
      registrationData: reg
    };

    const documents = [];
    if (startup.businessPlan) {
      documents.push({ id: "doc_bp", name: "Business Plan", url: startup.businessPlan, type: "pdf" });
    }
    if (startup.pitchDeck) {
      documents.push({ id: "doc_pd", name: "Pitch Deck", url: startup.pitchDeck, type: "pdf" });
    }

    const [stageObj, industryObj, categoryObj] = await Promise.all([
      resolveOptionObject(startupStage),
      resolveOptionObject(startupIndustry),
      resolveOptionObject(startupIndustry),
    ]);

    const result: any = {
      ...startup,
      id: startup.id || profile?.id || `fnd_${req.user.id}`,
      startup: startupName,
      startupName: startupName,
      name: startupName,
      title: startupName,
      pitch: startupPitch,
      oneLinePitch: startupPitch,
      description: startupPitch,
      funding: targetFunding,
      targetRaise: targetFunding,
      amountRaising: targetFunding,
      raised: raisedFunding,
      equity: equityOffered,
      equityOffered: equityOffered,
      stage: stageObj?.name || startupStage,
      stageId: stageObj?.id || startupStage,
      stageName: stageObj?.name || startupStage,
      industry: industryObj?.name || startupIndustry,
      industryId: industryObj?.id || startupIndustry,
      industryName: industryObj?.name || startupIndustry,
      category: categoryObj?.name || startupIndustry,
      categoryId: categoryObj?.id || startupIndustry,
      categoryName: categoryObj?.name || startupIndustry,
      documents,
      teamSize: profile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1),
      problemStatement: reg.problemStatement || "",
      solution: reg.solution || "",
      targetCustomers: reg.targetCustomers || "",
      marketSize: reg.marketSize || "",
      businessModel: reg.businessModel || "",
      revenueModel: reg.revenueModel || "",
      currentProgress: reg.currentProgress || "",
      demoLink: reg.demoLink || "",
      user: userObj,
      bids: rawBids
    };

    return res.json(successResponse('Startup details retrieved', result));
  } catch (error) { next(error); }
};

export const updateProfile = authUpdateMe;

export const uploadLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    const url = uploadedFileUrl(req.file);
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json(successResponse('Logo uploaded', { url }));
  } catch (error) { next(error); }
};

export const uploadCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Cover uploaded'); } catch (error) { next(error); }
};

import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getProfileCompletion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await resolveProfileCompletion(req.user.id, 'founder');
    const steps = [
      ...result.requirements.core.missing.map(m => ({ step: m.label, done: false, required: true })),
      ...result.completedSteps.map(s => ({ step: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), done: true, required: true }))
    ];
    return res.json(successResponse('Profile completion', {
      percentage: result.profileCompletion,
      percent: result.profileCompletion,
      profileCompletion: result.profileCompletion,
      isProfileComplete: result.isProfileComplete,
      profileLevel: result.profileLevel,
      operationalReady: result.operationalReady,
      requirements: result.requirements,
      verification: result.verification,
      completedSteps: result.completedSteps,
      pendingSteps: result.pendingSteps,
      steps
    }));
  } catch (error) { next(error); }
};
