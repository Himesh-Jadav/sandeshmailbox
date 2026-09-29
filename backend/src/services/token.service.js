import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/errors.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new HttpError(500, 'JWT_SECRET is not configured in backend/.env');
  }
  return secret;
}

/**
 * Creates a short-lived setup token for setting password after OTP verification.
 * Payload: { phone, scope: 'set-password' }
 * Expiration: 10 minutes
 * @param {string} phone
 * @returns {string} Signed JWT setup token
 */
export function createSetupToken(phone) {
  const secret = getJwtSecret();
  return jwt.sign({ phone, scope: 'set-password' }, secret, { expiresIn: '10m' });
}

/**
 * Verifies the setup token.
 * Rejects with 401 if expired, invalid signature, or wrong scope.
 * @param {string} token
 * @returns {{ phone: string, scope: string }}
 */
export function verifySetupToken(token) {
  if (!token || typeof token !== 'string') {
    throw new HttpError(401, 'Setup token is required');
  }

  const secret = getJwtSecret();

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Setup token has expired. Please verify OTP again.');
    }
    throw new HttpError(401, 'Invalid setup token');
  }

  if (decoded.scope !== 'set-password') {
    throw new HttpError(401, 'Invalid token scope. A setup token is required.');
  }

  if (!decoded.phone) {
    throw new HttpError(401, 'Invalid setup token: missing phone claim');
  }

  return decoded;
}

/**
 * Creates a short-lived password reset token after OTP verification.
 * Payload: { phone, scope: 'reset-password' }
 * Expiration: 15 minutes
 * @param {string} phone
 * @returns {string} Signed JWT reset token
 */
export function createResetToken(phone) {
  const secret = getJwtSecret();
  return jwt.sign({ phone, scope: 'reset-password' }, secret, { expiresIn: '15m' });
}

/**
 * Verifies the password reset token.
 * Rejects with 401 if expired, invalid signature, or wrong scope.
 * @param {string} token
 * @returns {{ phone: string, scope: string }}
 */
export function verifyResetToken(token) {
  if (!token || typeof token !== 'string') {
    throw new HttpError(401, 'Reset token is required');
  }

  const secret = getJwtSecret();

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Reset token has expired. Please verify OTP again.');
    }
    throw new HttpError(401, 'Invalid reset token');
  }

  if (decoded.scope !== 'reset-password') {
    throw new HttpError(401, 'Invalid token scope. A reset token is required.');
  }

  if (!decoded.phone) {
    throw new HttpError(401, 'Invalid reset token: missing phone claim');
  }

  return decoded;
}

/**
 * Creates a session token for an authenticated user.
 * Payload: { userId, phone }
 * Expiration: 7 days
 * @param {object} user
 * @returns {string} Signed session JWT
 */
export function createSessionToken(user) {
  const secret = getJwtSecret();
  const userId = (user._id ? user._id.toString() : user.id) || '';
  return jwt.sign({ userId, phone: user.phone }, secret, { expiresIn: '7d' });
}

/**
 * Verifies a session token.
 * Rejects with 401 if expired or invalid.
 * @param {string} token
 * @returns {{ userId: string, phone: string }}
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') {
    throw new HttpError(401, 'Session token is required');
  }

  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded.userId) {
      throw new HttpError(401, 'Invalid session token: missing userId');
    }
    return decoded;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Session token has expired');
    }
    throw new HttpError(401, 'Invalid session token');
  }
}
