import { prisma } from '../../config/database.js';
const VALID_ROLES = ['freelancer', 'client', 'investor', 'founder'];
export const isValidRole = (role) => VALID_ROLES.includes(role);
export const createRoleProfile = async (userId, role, db = prisma) => {
    // In the unified role model, ensure all 4 role profiles exist for every user
    await Promise.all([
        db.freelancerProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
        }).catch(() => null),
        db.clientProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
        }).catch(() => null),
        db.investorProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
        }).catch(() => null),
        db.founderProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
        }).catch(() => null),
    ]);
};
export const bootstrapUserResources = async (userId, db = prisma) => {
    await db.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0, currency: 'INR' },
    });
    await db.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: { userId },
    });
};
export const bootstrapNewUser = async (userId, role, db = prisma) => {
    await createRoleProfile(userId, role, db);
    await bootstrapUserResources(userId, db);
};
