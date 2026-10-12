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
    const platformSocialLinks = (footerData?.socialLinks || [])
      .filter((s: any) => s.isEnabled !== false)
      .map((s: any) => ({
        id: s.id,
        platform: s.platform,
        url: s.url,
        label: s.label,
        isPlatform: true,
      }));

    // 2. Fetch user's profile links if authenticated or query has userId
    let userLinks: any[] = [];
    const targetUserId = userId || (req.query?.userId as string);
    if (targetUserId) {
      userLinks = await (prisma as any).socialLink.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []);
    }

    res.json({
      success: true,
      data: platformSocialLinks,
      channels: platformSocialLinks,
      userLinks,
      links: platformSocialLinks.length > 0 ? platformSocialLinks : userLinks,
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
