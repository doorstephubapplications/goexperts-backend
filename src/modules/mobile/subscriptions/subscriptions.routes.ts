import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { 
  getPlans, getCurrent, purchase, renew, upgrade, cancel, getHistory
} from './subscriptions.controller.js';

const router = Router();

router.get('/plans', getPlans);

router.use(authenticate);
router.get('/current', getCurrent);
router.post('/purchase', purchase);
router.post('/renew', renew);
router.post('/upgrade', upgrade);
router.post('/cancel', cancel);
router.get('/history', getHistory);

export default router;
