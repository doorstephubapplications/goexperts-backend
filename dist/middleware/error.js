import { errorResponse } from '../core/response.js';
import { mapError } from '../core/error-mapper.js';
export const errorHandler = (err, req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json(errorResponse('Invalid JSON payload', 'INVALID_JSON'));
        return;
    }
    const bodyError = err;
    if (bodyError.type === 'entity.too.large') {
        res.status(bodyError.status || 413).json(errorResponse('Payload too large', 'PAYLOAD_TOO_LARGE'));
        return;
    }
    if (err instanceof Error && err.message === 'Not allowed by CORS') {
        res.status(403).json(errorResponse('Origin is not allowed to access this API', 'CORS_NOT_ALLOWED'));
        return;
    }
    const mapped = mapError(err);
    if (mapped.status >= 500) {
        console.error('[Error]', req.method, req.path, err);
    }
    res.status(mapped.status).json(errorResponse(mapped.message, mapped.code, mapped.errors));
};
