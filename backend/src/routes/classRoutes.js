import express from 'express';
import { getClasses, createClass, deleteClass } from '../controllers/classController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getClasses);
router.post('/', protect, authorize('admin', 'teacher'), createClass);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteClass);

export default router;
