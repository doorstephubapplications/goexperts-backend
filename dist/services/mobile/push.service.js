import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../../config/database.js';
import { SETTINGS_DEFAULTS } from '../settings/settings.defaults.js';
// Initialize Firebase Admin safely
const initFirebaseAdmin = () => {
    try {
        if (getApps().length === 0) {
            if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                initializeApp({
                    credential: cert(serviceAccount)
                });
                console.log('Firebase Admin initialized successfully from service account key');
            }
            else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
                initializeApp({
                    credential: cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    })
                });
                console.log('Firebase Admin initialized successfully from env vars');
            }
            else {
                console.info('Firebase Admin NOT initialized (Missing FIREBASE_SERVICE_ACCOUNT_KEY or credentials). Push notifications running in dev mock mode.');
            }
        }
    }
    catch (error) {
        console.error('Failed to initialize Firebase Admin:', error);
    }
};
initFirebaseAdmin();
export const saveDeviceToken = async (userId, token, platform, deviceId, deviceName) => {
    try {
        if (deviceId) {
            const existing = await prisma.deviceToken.findFirst({
                where: { userId, deviceId }
            });
            if (existing) {
                await prisma.deviceToken.update({
                    where: { id: existing.id },
                    data: { token, platform: platform || 'unknown', isActive: true, lastSeenAt: new Date(), updatedAt: new Date() }
                });
                return;
            }
        }
        await prisma.deviceToken.upsert({
            where: { token },
            update: { userId, deviceId, platform: platform || 'unknown', isActive: true, lastSeenAt: new Date(), updatedAt: new Date() },
            create: { userId, token, deviceId, platform: platform || 'unknown', isActive: true },
        });
    }
    catch (error) {
        console.error('Failed to save device token:', error);
    }
};
export const removeDeviceToken = async (token, deviceId, userId) => {
    try {
        if (token && userId) {
            await prisma.deviceToken.deleteMany({ where: { token, userId } });
        }
        else if (token) {
            await prisma.deviceToken.deleteMany({ where: { token } });
        }
        else if (deviceId && userId) {
            await prisma.deviceToken.deleteMany({ where: { deviceId, userId } });
        }
    }
    catch (error) {
        console.error('Failed to remove device token:', error);
    }
};
// Cached Global Push Layout (admin-updated branding & presentation settings)
let cachedGlobalPushLayout = null;
let lastGlobalLayoutFetch = 0;
async function getGlobalPushLayout() {
    const now = Date.now();
    if (cachedGlobalPushLayout && now - lastGlobalLayoutFetch < 30000) {
        return cachedGlobalPushLayout;
    }
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: "PUSH_CAMPAIGN_GLOBAL_LAYOUT" },
        });
        if (setting?.value) {
            cachedGlobalPushLayout = JSON.parse(setting.value);
            lastGlobalLayoutFetch = now;
            return cachedGlobalPushLayout;
        }
    }
    catch (err) {
        // silently fallback to null
    }
    return null;
}
export const sendPushNotification = async (userId, title, body, data) => {
    if (getApps().length === 0) {
        if (process.env.NODE_ENV === 'production') {
            console.error(`[PUSH PRODUCTION FAILED] Firebase Admin uninitialized! Push notification skipped for User ${userId}.`);
            return false;
        }
        console.log(`[DEV MODE] Push skipped for User ${userId}. Title: ${title}`);
        return true; // Simulate success only in development
    }
    try {
        const tokens = await prisma.deviceToken.findMany({ where: { userId, isActive: true } });
        if (tokens.length === 0) {
            console.log(`No active device tokens found for User ${userId}`);
            return false; // Can't deliver, maybe retry later
        }
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        const globalLayout = await getGlobalPushLayout();
        const isAdOrCustomPush = Boolean(data?.campaignId ||
            data?.isCampaign ||
            data?.isCustomPush ||
            data?.category === "General" ||
            data?.category === "Promotional" ||
            data?.eventType === "PROMOTIONAL");
        // Notification color priority:
        // 1. Explicit color passed in data.brandColor
        // 2. Admin's global layout brandColor for campaigns and custom push
        // 3. Dynamic role color from industry_colors
        // 4. Default #38B2AC
        let notificationColor = '#38B2AC';
        if (data?.brandColor) {
            notificationColor = String(data.brandColor);
        }
        else if (isAdOrCustomPush && globalLayout?.brandColor) {
            notificationColor = String(globalLayout.brandColor);
        }
        else if (dbUser?.role) {
            try {
                const setting = await prisma.setting.findUnique({ where: { key: "settings:industry_colors" } });
                const colors = setting?.value ? JSON.parse(setting.value) : SETTINGS_DEFAULTS.industry_colors;
                const roleKey = dbUser.role.toLowerCase();
                for (const [key, color] of Object.entries(colors)) {
                    if (key.toLowerCase() === roleKey || key.toLowerCase() === roleKey + 's') {
                        notificationColor = String(color);
                        break;
                    }
                }
            }
            catch (colorError) {
                console.warn('Error fetching dynamic role color for push:', colorError);
            }
        }
        // Media resolution:
        // If ad campaign or custom push and no specific image provided, use admin's global logo or default banner
        const imgUrl = data?.imageUrl ||
            data?.appLogoUrl ||
            (isAdOrCustomPush ? (globalLayout?.appLogoUrl || globalLayout?.defaultBannerUrl) : null) ||
            data?.senderAvatar ||
            data?.sender_avatar;
        const categoryId = data?.category || data?.eventType || data?.type;
        const isSoundEnabled = data?.soundEnabled !== false && (!isAdOrCustomPush || globalLayout?.soundEnabled !== false);
        const messages = tokens.map(t => ({
            token: t.token,
            notification: {
                title,
                body,
                ...(imgUrl ? { imageUrl: imgUrl } : {})
            },
            android: {
                notification: {
                    sound: isSoundEnabled ? 'default' : undefined,
                    color: notificationColor,
                    icon: 'ic_notification', // Custom notification icon if available in android/app/src/main/res/drawable
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    defaultLightSettings: true,
                    defaultVibrateTimings: true,
                    defaultSound: isSoundEnabled,
                    ...(imgUrl ? { imageUrl: imgUrl } : {})
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: isSoundEnabled ? 'default' : undefined,
                        badge: data?.badgeCount ? Number(data.badgeCount) : (isAdOrCustomPush && globalLayout?.badgeCount ? Number(globalLayout.badgeCount) : 1),
                        mutableContent: true,
                        ...(categoryId ? { category: String(categoryId) } : {}),
                    }
                },
                fcmOptions: imgUrl ? { imageUrl: imgUrl } : undefined,
            },
            data: data ? Object.fromEntries(Object.entries({
                ...data,
                appName: data.appName || (isAdOrCustomPush ? globalLayout?.appName : undefined),
                brandColor: notificationColor,
            })
                .filter(([_, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, String(v)])) : {}
        }));
        const response = await getMessaging().sendEach(messages);
        console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);
        // Automatically remove/deactivate invalid or expired FCM tokens
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const errorCode = resp.error.code;
                    if (errorCode === 'messaging/invalid-registration-token' ||
                        errorCode === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[idx].token);
                    }
                }
            });
            if (invalidTokens.length > 0) {
                await prisma.deviceToken.updateMany({
                    where: { token: { in: invalidTokens } },
                    data: { isActive: false }
                });
                console.log(`Deactivated ${invalidTokens.length} invalid device tokens.`);
            }
        }
        return response.successCount > 0;
    }
    catch (error) {
        console.error('Failed to send push notification:', error);
        return false;
    }
};
