import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
import { resolveMasterOptionsInput } from '../../../../utils/array-option-resolver.js';

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
export const updateProfile = authUpdateMe;

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    const url = uploadedFileUrl(req.file);
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json(successResponse('Avatar uploaded', { url }));
  } catch (error) { next(error); }
};

export const uploadCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Cover uploaded'); } catch (error) { next(error); }
};

export const uploadDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Document uploaded'); } catch (error) { next(error); }
};

import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getProfileCompletion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await resolveProfileCompletion(req.user.id, 'investor');
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

