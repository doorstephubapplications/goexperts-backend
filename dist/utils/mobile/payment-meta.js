import { prisma } from '../../config/database.js';
const keyFor = (paymentId) => `payment_meta:${paymentId}`;
export const storePaymentMeta = async (paymentId, meta) => {
    const key = keyFor(paymentId);
    const value = JSON.stringify(meta);
    await prisma.setting.upsert({
        where: { key },
        create: { key, value, category: 'payments' },
        update: { value },
    });
};
export const loadPaymentMeta = async (paymentId) => {
    const row = await prisma.setting.findUnique({ where: { key: keyFor(paymentId) } });
    if (!row?.value)
        return null;
    try {
        return JSON.parse(row.value);
    }
    catch {
        return null;
    }
};
