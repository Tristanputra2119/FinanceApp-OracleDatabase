import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import db from './db';

dotenv.config();

import authRoutes from './routes/auth';
import expensesRoutes from './routes/expenses';
import dashboardRoutes from './routes/dashboard';
import analyticsRoutes from './routes/analytics';
import authMiddleware from './middleware/authMiddleware';

const app = express();

// ─── 1. CORS ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (health checks, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Request']
};
app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions));

// ─── 2. Body parsers ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── 3. Security headers ─────────────────────────────────────────────────────
app.use(helmet());

// ─── 4. XSS sanitizer (Express 5 compatible) ─────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const sanitizeValue = (val: unknown): unknown => {
      if (typeof val === 'string') {
        return val.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return sanitizeObject(val as Record<string, unknown>);
      }
      return val;
    };
    const sanitizeObject = (obj: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) out[key] = sanitizeValue(obj[key]);
      return out;
    };
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
});

// ─── 5. Health check (public, no X-App-Request required) ────────────────────
app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 6. API access guard — block direct browser/external URL access ──────────
// All /api/* routes MUST include X-App-Request: 1 header (set by our frontend)
// Direct browser navigation, curl without header, etc. will get 403
app.use('/api', (req: Request, res: Response, next: NextFunction): void => {
  const xAppRequest = req.header('X-App-Request');
  if (xAppRequest !== '1') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Direct API access is not permitted. Use the application.'
    });
    return;
  }
  next();
});

// ─── 7. Rate limiting ────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// ─── 8. Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/expenses',  authMiddleware, expensesRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);

// ─── 9. Global error handler ─────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[Global Error Handler]', err.stack || err.message);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// ─── Server startup ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer(): Promise<void> {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await db.getPool();
      app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
        console.log(`🔒 API protected — requires X-App-Request: 1 header`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;
