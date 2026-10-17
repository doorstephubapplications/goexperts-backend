export const successResponse = (message, data, meta) => ({
    success: true,
    message,
    data: (data ?? null),
    meta: meta ?? null,
    timestamp: new Date().toISOString()
});
export const errorResponse = (message, code = 'ERROR', errors = []) => ({
    success: false,
    message,
    data: null,
    meta: null,
    errors,
    code: typeof code === 'number' ? String(code) : code,
    timestamp: new Date().toISOString()
});
