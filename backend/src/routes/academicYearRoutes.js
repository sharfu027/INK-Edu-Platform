import express from 'express';
import {
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  activateAcademicYear,
  deleteAcademicYear
} from '../controllers/academicYearController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getAcademicYears);
router.post('/', protect, authorize('admin', 'teacher'), createAcademicYear);
router.put('/:id', protect, authorize('admin', 'teacher'), updateAcademicYear);
router.post('/:id/activate', protect, authorize('admin', 'teacher'), activateAcademicYear);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteAcademicYear);

export default router;
