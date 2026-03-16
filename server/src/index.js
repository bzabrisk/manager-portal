import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import fundraiserRoutes from './routes/fundraisers.js';
import payoutsRoutes from './routes/payouts.js';
import chatRoutes from './routes/chat.js';
import emailRoutes from './routes/email.js';
import echeckRoutes from './routes/echeck.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
}
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.PORTAL_PASSWORD || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/fundraisers', authMiddleware, fundraiserRoutes);
app.use('/api/payouts', authMiddleware, payoutsRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/echeck', authMiddleware, echeckRoutes);

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
