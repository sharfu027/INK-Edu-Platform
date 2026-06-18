import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getSettings);
router.post('/', protect, authorize('admin', 'teacher'), updateSettings);

export default router;
