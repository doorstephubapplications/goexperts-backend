import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';
import { getIo } from '../../../../socket/index.js';

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = String(req.query.filter || '').toLowerCase();

    const where: any = {
      userId: req.user.id,
      status: { not: 'deleted' },
    };

    if (filter === 'unread' || req.query.unread === 'true') {
      where.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          userId: req.user.id,
          readAt: null,
          status: { notIn: ['deleted', 'draft', 'cancelled'] },
        },
      }),
    ]);

    const shaped = notifications.map((n) => {
      let metadata: Record<string, unknown> = {};
      if (n.metadata) {
        try {
          const parsed = JSON.parse(n.metadata);
          if (parsed && typeof parsed === 'object') {
            metadata = parsed as Record<string, unknown>;
          }
        } catch (_) {
          // Ignore malformed metadata safely
        }
      }

      const contextId =
        metadata.contextId ??
        metadata.context_id ??
        metadata.projectId ??
        metadata.project_id ??
        metadata.proposalId ??
        metadata.proposal_id ??
        metadata.conversationId ??
        metadata.conversation_id ??
        metadata.meetingId ??
        metadata.meeting_id ??
        metadata.contractId ??
        metadata.contract_id ??
        metadata.startupId ??
        metadata.startup_id ??
        n.contextId ??
        null;

      const isRead = Boolean(n.readAt) || n.status === 'read';

      return {
        id: n.id,
        userId: n.userId,
        type: n.type || 'system',
        category: n.type || 'system',
        title: n.title,
        message: n.message,
        body: n.message,
        channel: n.channel,
        priority: n.priority,
        status: n.status,
        readAt: n.readAt,
        read: isRead,
        isRead,
        actionUrl: n.actionUrl || (metadata.route as string) || (metadata.actionUrl as string) || null,
        route: n.actionUrl || (metadata.route as string) || null,
        contextType: n.contextType,
        contextId,
        entityId: contextId,
        count: n.count || 1,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        metadata,
      };
    });

    return res.json(
      successResponse('Notifications retrieved', shaped, {
        page,
        limit,
        total,
        unreadCount,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        readAt: null,
        status: { notIn: ['deleted', 'draft', 'cancelled'] },
      },
    });
    return res.json(successResponse('Unread count retrieved', { count, unreadCount: count }));
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { readAt: new Date(), status: 'read' },
    });

    // Notify via socket
    try {
      const io = getIo();
      if (io) {
        const remainingUnread = await prisma.notification.count({
          where: {
            userId: req.user.id,
            readAt: null,
            status: { notIn: ['deleted', 'draft', 'cancelled'] },
          },
        });
        io.to(req.user.id).emit('notification:updated', { notificationId: id, read: true });
        io.to(req.user.id).emit('notification:count', { unread: remainingUnread });
      }
    } catch (_) {}

    return res.json(successResponse('Notification marked as read'));
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        readAt: null,
        status: { notIn: ['deleted', 'draft', 'cancelled'] },
      },
      data: { readAt: new Date(), status: 'read' },
    });

    try {
      const io = getIo();
      if (io) {
        io.to(req.user.id).emit('notification:count', { unread: 0 });
      }
    } catch (_) {}

    return res.json(successResponse('All notifications marked as read', { updated: result.count }));
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { status: 'deleted' },
    });
    return res.json(successResponse('Notification deleted'));
  } catch (error) {
    next(error);
  }
};

export const getPreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: req.user.id },
    });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: req.user.id },
      });
    }

    let parsedExtra = {};
    if (prefs.preferences) {
      try {
        parsedExtra = JSON.parse(prefs.preferences);
      } catch (_) {}
    }

    return res.json(
      successResponse('Preferences retrieved', {
        ...prefs,
        categories: parsedExtra,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      emailEnabled,
      pushEnabled,
      inAppEnabled,
      smsEnabled,
      whatsappEnabled,
      marketingEmails,
      securityAlerts,
      messageNotifications,
      updateNotifications,
      categories,
    } = req.body;

    const extraPrefs = JSON.stringify({
      marketingEmails: Boolean(marketingEmails),
      securityAlerts: securityAlerts !== false, // default true
      messageNotifications: messageNotifications !== false,
      updateNotifications: updateNotifications !== false,
      ...(categories && typeof categories === 'object' ? categories : {}),
    });

    const updateData: any = {
      preferences: extraPrefs,
      updatedAt: new Date(),
    };
    if (typeof emailEnabled === 'boolean') updateData.emailEnabled = emailEnabled;
    if (typeof pushEnabled === 'boolean') updateData.pushEnabled = pushEnabled;
    if (typeof inAppEnabled === 'boolean') updateData.inAppEnabled = inAppEnabled;
    if (typeof smsEnabled === 'boolean') updateData.smsEnabled = smsEnabled;
    if (typeof whatsappEnabled === 'boolean') updateData.whatsappEnabled = whatsappEnabled;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.user.id },
      update: updateData,
      create: {
        userId: req.user.id,
        emailEnabled: emailEnabled ?? true,
        pushEnabled: pushEnabled ?? true,
        inAppEnabled: inAppEnabled ?? true,
        smsEnabled: smsEnabled ?? false,
        whatsappEnabled: whatsappEnabled ?? false,
        preferences: extraPrefs,
      },
    });

    return res.json(successResponse('Preferences updated successfully', prefs));
  } catch (error) {
    next(error);
  }
};

export const testEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await NotificationEngine.queueNotification({
      userId: req.user.id,
      type: 'test_email',
      title: 'Test Email Notification',
      message: 'This is a test notification verifying your Go Experts email delivery pipeline.',
      channel: 'email',
      payload: { title: 'Test Email', message: 'Pipeline operational!' },
    });
    return res.json(successResponse('Test email notification queued'));
  } catch (error) {
    next(error);
  }
};
