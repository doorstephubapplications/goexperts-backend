/** Application error with safe client-facing message and code. */
export class AppError extends Error {
    statusCode;
    code;
    errors;
    constructor(message, statusCode, code, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.errors = errors;
        this.name = 'AppError';
    }
}
