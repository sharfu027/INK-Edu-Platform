import express from 'express';
import { getTimetables, createTimetableEntry, updateTimetableEntry, deleteTimetableEntry, createTeacherSchedule } from '../controllers/timetableController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getTimetables);
router.post('/', protect, authorize('admin', 'teacher'), createTimetableEntry);
router.put('/:id', protect, authorize('admin', 'teacher'), updateTimetableEntry);
router.post('/teacher-schedule', protect, authorize('admin', 'teacher'), createTeacherSchedule);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteTimetableEntry);

export default router;

