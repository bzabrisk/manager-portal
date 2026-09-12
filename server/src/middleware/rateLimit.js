// Rate limiters. The portal has one user and one shared password, so the
// login route is the entire attack surface: it gets two limiters (per-IP and
// global) that count only failed attempts. Everything else under /api gets a
// generous per-IP ceiling that normal use (2-minute polling) never reaches.
//
// All limiters key on req.ip, which is correct only because index.js sets
// app.set('trust proxy', 1) — Railway sits behind one proxy hop.

import { rateLimit } from 'express-rate-limit';
import { loginAudit } from '../services/loginAudit.js';

export const LOGIN_LOCKOUT_MESSAGE = 'Too many attempts. Try again in 15 minutes.';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function lockoutHandler(req, res) {
  loginAudit.recordRateLimited(req.ip);
  res.status(429).json({ error: LOGIN_LOCKOUT_MESSAGE, code: 'RATE_LIMITED' });
}

// 5 failed attempts per 15 minutes per IP.
export const loginIpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: lockoutHandler,
});

// 20 failed attempts per hour across ALL addresses, so an attacker rotating
// IPs still hits a wall. Krista can be caught by this too; that is the price.
export const loginGlobalLimiter = rateLimit({
  windowMs: ONE_HOUR,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: () => 'global',
  handler: lockoutHandler,
});

// 300 requests per 15 minutes per IP on every other /api route.
export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // The login route has its own, stricter limiters above.
  skip: (req) => req.path === '/auth/login',
  message: { error: 'Too many requests. Please wait a few minutes and try again.', code: 'RATE_LIMITED' },
});
