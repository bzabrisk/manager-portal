import { Router } from 'express';
import bcrypt from 'bcrypt';
import { loginIpLimiter, loginGlobalLimiter } from '../middleware/rateLimit.js';
import { loginAudit } from '../services/loginAudit.js';

const router = Router();

// Order matters: the per-IP limiter runs first so a single bad actor is cut
// off before they eat into the shared global budget.
router.post('/login', loginIpLimiter, loginGlobalLimiter, async (req, res) => {
  const password = req.body?.password;
  // Reject missing / empty / non-string passwords before any comparison so a
  // malformed body can never match a misconfigured or unset server value.
  if (typeof password !== 'string' || password.length === 0) {
    loginAudit.recordRejected(req.ip);
    return res.status(400).json({ error: 'Password is required' });
  }
  // PORTAL_PASSWORD_HASH is a bcrypt hash (see scripts/hash-password.mjs).
  // bcrypt.compare is constant-time and never sees the stored plaintext.
  let matches = false;
  try {
    matches = await bcrypt.compare(password, process.env.PORTAL_PASSWORD_HASH);
  } catch (err) {
    console.error('[auth] bcrypt.compare failed — is PORTAL_PASSWORD_HASH a valid bcrypt hash?', err.message);
  }
  if (matches) {
    req.session.authenticated = true;
    res.json({ success: true });
    // Alerting is best-effort and must never delay or fail the login.
    loginAudit.recordSuccess(req.ip).catch(() => {});
  } else {
    res.status(401).json({ error: 'Incorrect password' });
    loginAudit.recordFailure(req.ip).catch(() => {});
  }
});

router.get('/check', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
