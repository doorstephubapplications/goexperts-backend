import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { prisma } from '../../config/db.js';
import { FooterPublicService } from '../../modules/footer/footer.service.js';

const footerService = new FooterPublicService();

export const getSocialLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    // 1. Fetch public platform channels (configured by admin)
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

    // Ensure Twitter / X channel is present if missing from footer config
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

    // 2. Fetch user's profile links if targetUserId is available
    const targetUserId = userId || (req.query?.userId as string);
    if (targetUserId) {
      const userLinks = await (prisma as any).socialLink.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []);

      res.json({
        success: true,
        data: platformSocialLinks,
        ...(userLinks && userLinks.length > 0 ? { userLinks } : {}),
      });
      return;
    }

    res.json({
      success: true,
      data: platformSocialLinks,
    });
  } catch (error) {
    console.error('Error fetching social links:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
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
