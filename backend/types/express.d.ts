// Augment Express Request to include `user` from JWT payload
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
      };
    }
  }
}
