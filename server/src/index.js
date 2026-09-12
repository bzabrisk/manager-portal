import dotenv from 'dotenv';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });
import express from 'express';
import cookieSession from 'cookie-session';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import fundraiserRoutes from './routes/fundraisers.js';
import payoutsRoutes from './routes/payouts.js';
import chatRoutes from './routes/chat.js';
import emailRoutes from './routes/email.js';
import echeckRoutes from './routes/echeck.js';
import costRoutes from './routes/cost.js';
import reportsRoutes from './routes/reports.js';
import automationsRoutes from './routes/automations.js';
import { authMiddleware } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { checkFailedPayouts } from './services/payoutHealth.js';

// Fail closed: the portal must not start without its auth configuration.
// A missing password setting used to make an empty login body authenticate,
// and a missing SESSION_SECRET used to fall back to the password or a
// hardcoded string. Now either omission is a startup error.
const REQUIRED_AUTH_ENV = ['PORTAL_PASSWORD_HASH', 'SESSION_SECRET'];
for (const name of REQUIRED_AUTH_ENV) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    console.error(`[startup] Required environment variable ${name} is missing or empty. Refusing to start.`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
}
// 15mb: the MD payout webhook (/api/automations/md-payout-report) posts a
// base64-encoded PDF; the default 100kb limit 413s it here before the router
// is ever reached.
app.use(express.json({ limit: '15mb' }));
// Railway terminates TLS and forwards through exactly one proxy hop. Trusting
// it makes req.ip the real client address (so the rate limiters key on the
// right thing) and lets `secure` cookies work. Nothing else reads req.ip.
app.set('trust proxy', 1);
// Stateless signed-cookie session (cookie-session). The whole session lives in
// the cookie, signed with SESSION_SECRET, so it survives Railway deploys and
// restarts. Payload is tiny: { authenticated, issuedAt, touchedAt }. No secrets
// are stored in it. Rotating SESSION_SECRET in Railway invalidates every
// session everywhere at once — that is the emergency revoke (see SECURITY.md).
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
app.use(cookieSession({
  name: 'portal_session',
  keys: [process.env.SESSION_SECRET],
  maxAge: SESSION_MAX_AGE_MS,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  signed: true,
}));
// Rolling expiry: cookie-session only re-sends the cookie when its contents
// change, so bump a minute-granularity timestamp on each authenticated request.
// Every request then pushes the 30-day expiry forward from "now".
app.use((req, res, next) => {
  if (req.session && req.session.authenticated) {
    req.session.touchedAt = Math.floor(Date.now() / 60000);
  }
  next();
});

app.use('/api/auth', authRoutes);
// Generous ceiling on everything else under /api (the login route has its own
// strict limiters inside authRoutes).
app.use('/api', apiLimiter);
app.use('/api/automations', automationsRoutes);  // No session auth — uses shared secret
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/fundraisers', authMiddleware, fundraiserRoutes);
app.use('/api/payouts', authMiddleware, payoutsRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/echeck', authMiddleware, echeckRoutes);
app.use('/api/cost', authMiddleware, costRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // All non-API routes serve the React app (for client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Failed daily-payout alerting: check shortly after startup, then every 30 minutes.
// Errors are logged and never allowed to crash the server.
const PAYOUT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const PAYOUT_CHECK_STARTUP_DELAY_MS = 60 * 1000;
function runPayoutCheck() {
  checkFailedPayouts().catch(err =>
    console.error('[payoutHealth] Scheduled check failed:', err.message)
  );
}
setTimeout(runPayoutCheck, PAYOUT_CHECK_STARTUP_DELAY_MS);
setInterval(runPayoutCheck, PAYOUT_CHECK_INTERVAL_MS);
