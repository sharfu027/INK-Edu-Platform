import express from 'express';
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getMappings,
  createMapping,
  deleteMapping,
  importSubjects,
  exportSubjects
} from '../controllers/subjectController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getSubjects);
router.post('/', protect, authorize('admin', 'teacher'), createSubject);
router.put('/:id', protect, authorize('admin', 'teacher'), updateSubject);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteSubject);

router.post('/import', protect, authorize('admin', 'teacher'), importSubjects);
router.get('/export', protect, authorize('admin', 'teacher'), exportSubjects);

router.get('/mappings', protect, getMappings);
router.post('/mappings', protect, authorize('admin', 'teacher'), createMapping);
router.delete('/mappings/:id', protect, authorize('admin', 'teacher'), deleteMapping);

export default router;
