const rateLimits = new Map();
export const checkRateLimit = (userId, action, limit, windowMs) => {
    const key = `${userId}:${action}`;
    const now = Date.now();
    let record = rateLimits.get(key);
    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + windowMs };
        rateLimits.set(key, record);
        return true;
    }
    if (record.count >= limit) {
        return false;
    }
    record.count += 1;
    return true;
};
