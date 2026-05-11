import { Router } from 'express';
import { getSummary } from '../controllers/dashboardController';

const router = Router();

// All routes here will be protected by auth middleware in server.ts
router.get('/summary', getSummary);

export default router;
