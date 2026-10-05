import rateLimit from "express-rate-limit";
export const contactRateLimitHandler = (req, res) => {
    return res.status(429).json({
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        retryAfterSeconds: 900,
    });
};
/**
 * Dedicated rate limiter for public contact form submissions.
 * Protects against spam, automated bots, SMTP exhaustion, and database flooding.
 */
export const contactRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 5, // Limit each IP to 5 contact submissions per windowMs
    standardHeaders: true, // Return standard RateLimit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
    legacyHeaders: false,
    keyGenerator: (req) => {
        const forwarded = req.headers["x-forwarded-for"];
        const ip = typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : req.socket.remoteAddress || "unknown-ip";
        return `contact:${ip}`;
    },
    handler: contactRateLimitHandler,
});
