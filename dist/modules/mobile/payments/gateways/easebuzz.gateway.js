import crypto from 'crypto';
import { prisma } from '../../../../config/database.js';
export const generateEasebuzzHash = (parts) => crypto.createHash('sha512').update(parts.join('|')).digest('hex');
const cleanEasebuzzText = (value, fallback, maxLength) => {
    const cleaned = String(value || fallback)
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return cleaned || fallback;
};
const cleanEasebuzzEmail = (value) => {
    const email = String(value || '').trim();
    if (!email || !email.includes('@')) {
        throw new Error('USER_EMAIL_REQUIRED_FOR_PAYMENT');
    }
    return email;
};
const cleanEasebuzzPhone = (value) => {
    const phone = String(value || '').replace(/[^\d]/g, '').trim();
    return phone.length >= 10 ? phone.slice(-10) : '9999999999';
};
const cleanEasebuzzFirstName = (value) => {
    const firstname = cleanEasebuzzText(String(value || '').split(' ')[0], '', 50);
    if (!firstname) {
        throw new Error('USER_NAME_REQUIRED_FOR_PAYMENT');
    }
    return firstname;
};
export const initiateEasebuzzPayment = async (amount, currency, metadata = {}) => {
    let key = process.env.EASEBUZZ_KEY || '';
    let salt = process.env.EASEBUZZ_SALT || '';
    let easeEnv = (process.env.EASEBUZZ_ENV || 'live').toLowerCase();
    try {
        const pmSetting = await prisma.setting.findUnique({
            where: { key: 'settings:section:payments' },
        });
        if (pmSetting?.value) {
            const pmData = JSON.parse(pmSetting.value);
            if (pmData.merchantKey || pmData.apiKey) {
                key = String(pmData.merchantKey || pmData.apiKey).trim();
            }
            if (pmData.salt || pmData.webhookSecret) {
                salt = String(pmData.salt || pmData.webhookSecret).trim();
            }
            if (pmData.environment) {
                easeEnv = String(pmData.environment).toLowerCase().trim();
            }
        }
    }
    catch (err) {
        console.warn('[EASEBUZZ MOBILE] Setting lookup warning, using env config only', err);
    }
    if (!key || !salt) {
        throw new Error('EASEBUZZ_GATEWAY_NOT_CONFIGURED');
    }
    const txnid = `EB${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const productinfo = cleanEasebuzzText(metadata.productinfo || metadata.purpose || metadata.planId, 'GoExperts Payment', 80);
    const firstname = cleanEasebuzzFirstName(metadata.firstname || metadata.fullName);
    const email = cleanEasebuzzEmail(metadata.email);
    const phone = cleanEasebuzzPhone(metadata.phone);
    const isProd = easeEnv === 'live' || easeEnv === 'prod' || easeEnv === 'production';
    const apiHost = process.env.API_BASE_URL || (isProd
        ? 'https://apiai.goexperts.in/api'
        : 'http://localhost:5001/api');
    const surl = String(metadata.successUrl || process.env.EASEBUZZ_SUCCESS_URL || `${apiHost}/payments/webhooks/easebuzz`);
    const furl = String(metadata.failureUrl || process.env.EASEBUZZ_FAILURE_URL || `${apiHost}/payments/webhooks/easebuzz`);
    const hash = generateEasebuzzHash([
        key,
        txnid,
        amount.toFixed(2),
        productinfo,
        firstname,
        email,
        '', '', '', '', '', '', '', '', '', '',
        salt,
    ]);
    const body = new URLSearchParams({
        key,
        txnid,
        amount: amount.toFixed(2),
        productinfo,
        firstname,
        email,
        phone,
        surl,
        furl,
        hash,
    });
    const baseUrl = isProd ? 'https://pay.easebuzz.in' : 'https://testpay.easebuzz.in';
    const response = await fetch(`${baseUrl}/payment/initiateLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const result = (await response.json());
    if (result.status !== 1 || !result.data) {
        const errorMsg = typeof result.data === 'string' ? result.data : (result.error_desc || 'EASEBUZZ_INITIATE_FAILED');
        throw new Error(errorMsg);
    }
    return {
        paymentId: txnid,
        gateway: 'easebuzz',
        amount,
        currency,
        paymentUrl: `${baseUrl}/pay/${result.data}`,
        orderId: txnid,
        gatewayPayload: {
            accessKey: result.data,
            txnid,
            payMode: isProd ? 'production' : 'test',
        },
    };
};
/** Reverse hash verification for Easebuzz callback/status. */
export const verifyEasebuzzReverseHash = (txnid, amount, status, receivedHash, email = '', firstname = '', productinfo = '') => {
    const key = process.env.EASEBUZZ_KEY || '';
    const salt = process.env.EASEBUZZ_SALT || '';
    if (!key || !salt)
        return false;
    const expected = generateEasebuzzHash([
        salt,
        status,
        '', '', '', '', '', '', '', '', '', '', '',
        email,
        firstname,
        productinfo,
        amount,
        txnid,
        key,
    ]);
    return receivedHash === expected;
};
