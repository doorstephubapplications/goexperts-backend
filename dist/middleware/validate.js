import { ZodError } from 'zod';
import { errorResponse } from '../core/response.js';
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            return next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_ERROR', errors));
            }
            return next(error);
        }
    };
};
