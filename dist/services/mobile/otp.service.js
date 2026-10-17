const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const otpStore = new Map();
export const normalizePhoneNumber = (phone, countryCode) => {
    const digits = phone.replace(/\D/g, '');
    const code = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    return `${code}${digits}`;
};
const cleanupExpired = (key, record) => {
    if (record.expiresAt <= Date.now()) {
        otpStore.delete(key);
        return true;
    }
    return false;
};
import crypto from 'crypto';
const generateCode = () => crypto.randomInt(100000, 1000000).toString();
const dispatchOtp = async (phoneNumber, code) => {
    // Plug SMS provider here (Twilio, MSG91, etc.).
    if (!process.env.SMS_PROVIDER_ENABLED || process.env.SMS_PROVIDER_ENABLED !== 'true') {
        // SMS provider is not configured. 
        console.log(`[DEV MODE] OTP for ${phoneNumber}: ${code}`);
        return true;
    }
    console.log(`[SMS] OTP dispatched to ${phoneNumber}`);
    return true;
};
export const issuePhoneOtp = async (phone, countryCode) => {
    const phoneNumber = normalizePhoneNumber(phone, countryCode);
    const code = generateCode();
    otpStore.set(phoneNumber, {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
    });
    const sent = await dispatchOtp(phoneNumber, code);
    if (!sent) {
        otpStore.delete(phoneNumber);
        throw new Error('FAILED_TO_SEND_SMS');
    }
    return { phoneNumber, code };
};
export const verifyPhoneOtp = (phone, countryCode, code) => {
    const phoneNumber = normalizePhoneNumber(phone, countryCode);
    const record = otpStore.get(phoneNumber);
    if (!record || cleanupExpired(phoneNumber, record)) {
        return { valid: false, reason: 'EXPIRED' };
    }
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        otpStore.delete(phoneNumber);
        return { valid: false, reason: 'TOO_MANY_ATTEMPTS' };
    }
    if (record.code !== code.trim()) {
        record.attempts += 1;
        otpStore.set(phoneNumber, record);
        return { valid: false, reason: 'INVALID' };
    }
    otpStore.delete(phoneNumber);
    return { valid: true };
};
export const issueEmailOtp = async (email) => {
    const key = `email:${email.toLowerCase().trim()}`;
    const code = generateCode();
    otpStore.set(key, { code, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
    return { email, code };
};
export const verifyEmailOtp = (email, code) => {
    const key = `email:${email.toLowerCase().trim()}`;
    const record = otpStore.get(key);
    if (!record || record.expiresAt <= Date.now())
        return { valid: false, reason: 'EXPIRED' };
    if (record.code !== code.trim())
        return { valid: false, reason: 'INVALID' };
    otpStore.delete(key);
    return { valid: true };
};
export const issuePasswordResetOtp = async (email) => {
    const key = `pwreset:${email.toLowerCase().trim()}`;
    const code = generateCode();
    otpStore.set(key, { code, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
    return { email, code };
};
export const verifyPasswordResetOtp = (email, code) => {
    const key = `pwreset:${email.toLowerCase().trim()}`;
    const record = otpStore.get(key);
    if (!record || record.expiresAt <= Date.now())
        return { valid: false, reason: 'EXPIRED' };
    if (record.code !== code.trim()) {
        record.attempts += 1;
        otpStore.set(key, record);
        return { valid: false, reason: 'INVALID' };
    }
    otpStore.delete(key);
    return { valid: true };
};
