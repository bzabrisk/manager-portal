import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.PORTAL_PASSWORD) {
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
