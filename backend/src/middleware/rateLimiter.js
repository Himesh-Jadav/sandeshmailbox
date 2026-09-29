/**
 * In-memory sliding window rate limiter to protect Groq API tokens from abuse.
 * Tracks requests per client IP or authorized user token.
 */
export function createRateLimiter({
  windowMs = 10 * 60 * 1000, // 10 minutes
  max = 20,                  // max requests per windowMs
  message = 'Too many requests. Please wait a few minutes before sending more questions.',
} = {}) {
  const hits = new Map();

  // Periodic cleanup of expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, active);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    // Identify client by user ID if authenticated or IP
    const clientKey = req.user?.id || req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
    const now = Date.now();
    const timestamps = hits.get(clientKey) || [];

    // Filter to only timestamps inside the current window
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const oldest = recent[0];
      const resetInSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
      res.setHeader('Retry-After', resetInSeconds);
      return res.status(429).json({
        error: message,
        retryAfter: resetInSeconds,
      });
    }

    recent.push(now);
    hits.set(clientKey, recent);
    next();
  };
}
