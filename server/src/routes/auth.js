import { Router } from 'express';
import bcrypt from 'bcrypt';

const router = Router();

router.post('/login', async (req, res) => {
  const password = req.body?.password;
  // Reject missing / empty / non-string passwords before any comparison so a
  // malformed body can never match a misconfigured or unset server value.
  if (typeof password !== 'string' || password.length === 0) {
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
  } else {
    res.status(401).json({ error: 'Incorrect password' });
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
