import { verifySessionToken } from '../services/token.service.js';
import { getUserById } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Express middleware to enforce valid Bearer session JWT.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header required (format: Bearer <token>)');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedError('Token is missing');
    }

    const decoded = verifySessionToken(token);
    const user = await getUserById(decoded.userId);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
