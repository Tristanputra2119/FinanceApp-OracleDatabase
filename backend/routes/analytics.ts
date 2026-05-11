import { Router } from 'express';
import { getChartData, getCategoryBreakdown } from '../controllers/analyticsController';

const router = Router();

router.get('/chart',     getChartData);
router.get('/breakdown', getCategoryBreakdown);

export default router;
