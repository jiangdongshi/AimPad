import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { redis } from './redis';

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);

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
