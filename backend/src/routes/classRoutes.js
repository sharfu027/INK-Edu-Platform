import express from 'express';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  importClasses,
  exportClasses
} from '../controllers/classController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getClasses);
router.post('/', protect, authorize('admin', 'teacher'), createClass);
router.put('/:id', protect, authorize('admin', 'teacher'), updateClass);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteClass);

router.post('/import', protect, authorize('admin', 'teacher'), importClasses);
router.get('/export', protect, authorize('admin', 'teacher'), exportClasses);

export default router;
