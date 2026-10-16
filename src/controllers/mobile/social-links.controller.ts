import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { prisma } from '../../config/db.js';
import { FooterPublicService } from '../../modules/footer/footer.service.js';

const footerService = new FooterPublicService();

export const getPlatformSocialLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const footerData = await footerService.getPublishedFooter().catch(() => null);
    let platformSocialLinks = (footerData?.socialLinks || [])
      .filter((s: any) => s.isEnabled !== false && typeof s.url === 'string' && s.url.trim().length > 0)
      .map((s: any) => ({
        id: s.id,
        platform: s.platform,
        url: s.url.trim(),
        label: s.label || s.platform,
        isPlatform: true,
      }));

    const hasTwitter = platformSocialLinks.some((l: any) => {
      const p = String(l.platform || '').toUpperCase();
      return p === 'TWITTER' || p === 'X' || (l.url && (l.url.includes('twitter.com') || l.url.includes('x.com')));
    });

    if (!hasTwitter) {
      const defaultTwitterUrl = process.env.TWITTER_URL || 'https://x.com/goexpertsindia';
      platformSocialLinks.push({
        id: 'canonical-platform-twitter',
        platform: 'TWITTER',
        url: defaultTwitterUrl,
        label: 'Follow Go Experts on X (Twitter)',
        isPlatform: true,
      });
    }

    res.json({
      success: true,
      data: platformSocialLinks,
    });
  } catch (error) {
    console.error('Error fetching platform social links:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUserSocialLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = (req.query?.userId as string) || req.user?.id;
    if (!targetUserId) {
      res.status(400).json({ success: false, message: 'userId is required or session must be authenticated' });
      return;
    }

    // 1. Fetch links from dedicated socialLink table
    const tableLinks = await (prisma as any).socialLink.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    // 2. Also check freelancerProfile for any saved profile URLs
    const profile = await (prisma as any).freelancerProfile.findUnique({
      where: { userId: targetUserId },
      select: {
        linkedInUrl: true,
        githubUrl: true,
        dribbbleUrl: true,
        portfolioUrl: true,
        websiteUrl: true,
      },
    }).catch(() => null);

    const mergedLinks = [...tableLinks];
    if (profile) {
      const existingPlatforms = new Set(mergedLinks.map((l: any) => String(l.platform || '').toLowerCase()));
      if (profile.linkedInUrl && !existingPlatforms.has('linkedin')) {
        mergedLinks.push({ id: `profile-linkedin-${targetUserId}`, userId: targetUserId, platform: 'LINKEDIN', url: profile.linkedInUrl });
      }
      if (profile.githubUrl && !existingPlatforms.has('github')) {
        mergedLinks.push({ id: `profile-github-${targetUserId}`, userId: targetUserId, platform: 'GITHUB', url: profile.githubUrl });
      }
      if (profile.dribbbleUrl && !existingPlatforms.has('dribbble')) {
        mergedLinks.push({ id: `profile-dribbble-${targetUserId}`, userId: targetUserId, platform: 'DRIBBLE', url: profile.dribbbleUrl });
      }
      const webUrl = profile.websiteUrl || profile.portfolioUrl;
      if (webUrl && !existingPlatforms.has('website')) {
        mergedLinks.push({ id: `profile-website-${targetUserId}`, userId: targetUserId, platform: 'WEBSITE', url: webUrl });
      }
      if (profile.portfolioUrl && profile.portfolioUrl !== profile.websiteUrl && !existingPlatforms.has('portfolio')) {
        mergedLinks.push({ id: `profile-portfolio-${targetUserId}`, userId: targetUserId, platform: 'PORTFOLIO', url: profile.portfolioUrl });
      }
    }

    res.json({
      success: true,
      data: mergedLinks,
    });
  } catch (error) {
    console.error('Error fetching user social links:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getSocialLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  const targetUserId = req.query?.userId as string;
  // If request explicitly targets a user with ?userId= or /me, return user social links
  if (targetUserId) {
    return getUserSocialLinks(req, res);
  }
  return getPlatformSocialLinks(req, res);
};

export const addSocialLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { platform, url } = req.body;

    if (!platform || !url) {
      res.status(400).json({ success: false, message: 'Platform and URL are required' });
      return;
    }

    const link = await (prisma as any).socialLink.create({
      data: {
        userId,
        platform,
        url,
      },
    });

    res.json({ success: true, link, message: 'Social link added successfully' });
  } catch (error) {
    console.error('Error adding social link:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateSocialLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { platform, url } = req.body;

    // Check if link exists and belongs to user
    const existingLink = await (prisma as any).socialLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      res.status(404).json({ success: false, message: 'Social link not found' });
      return;
    }

    if (existingLink.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const updatedLink = await (prisma as any).socialLink.update({
      where: { id },
      data: {
        platform: platform ?? existingLink.platform,
        url: url ?? existingLink.url,
      },
    });

    res.json({ success: true, link: updatedLink, message: 'Social link updated successfully' });
  } catch (error) {
    console.error('Error updating social link:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteSocialLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check if link exists and belongs to user
    const existingLink = await (prisma as any).socialLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      res.status(404).json({ success: false, message: 'Social link not found' });
      return;
    }

    if (existingLink.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    await (prisma as any).socialLink.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Social link deleted successfully' });
  } catch (error) {
    console.error('Error deleting social link:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
