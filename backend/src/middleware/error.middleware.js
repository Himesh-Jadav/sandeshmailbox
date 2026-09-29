import { ZodError } from 'zod';
import { HttpError } from '../utils/errors.js';

/**
 * Global error handling middleware.
 */
export function errorHandler(err, req, res, _next) {
  // Zod validation error: 400 Bad Request
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  // Explicit HTTP error (400, 401, 404, etc.)
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      error: 'Invalid JSON payload received',
    });
  }



  // Unhandled error
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: 'Internal server error',
  });
}
