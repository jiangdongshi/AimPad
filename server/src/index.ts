import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { settingsRouter } from './routes/settings';
import { redis } from './redis';

const app = express();

// CORS — allow production domain too
app.use(cors({
  origin: true,
  credentials: true,
}));

// JSON parser with raw body capture for debugging
app.use(express.json({
  verify: (req, _res, buf) => {
    if ((req as Request).path?.startsWith('/api/auth')) {
      const raw = buf.toString('utf-8');
      console.log(`[RAW] ${(req as Request).method} ${(req as Request).path} | Content-Type: ${req.headers['content-type']} | Content-Length: ${req.headers['content-length']} | Body bytes: ${buf.length} | Body: "${raw}"`);
    }
  },
}));

// Debug middleware — log parsed body
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path.startsWith('/api/auth')) {
    console.log(`[PARSED] ${req.method} ${req.path} | Body:`, JSON.stringify(req.body));
  }
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    await redis.connect().catch(() => {
      console.warn('[Redis] Failed to connect, verification codes will use MySQL fallback');
    });
  } catch {
    // Redis is optional for demo, MySQL fallback works
  }

  app.listen(config.PORT, () => {
    console.log(`[AimPad API] Server running on port ${config.PORT}`);
    console.log(`[AimPad API] Demo verification code: ${config.DEMO_CODE}`);
  });
}

start();
