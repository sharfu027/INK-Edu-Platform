import express from 'express';
import { getPeriods, createPeriod, updatePeriod, deletePeriod } from '../controllers/periodController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getPeriods);
router.post('/', protect, authorize('admin'), createPeriod);
router.put('/:id', protect, authorize('admin'), updatePeriod);
router.delete('/:id', protect, authorize('admin'), deletePeriod);

export default router;
