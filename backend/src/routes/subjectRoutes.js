import express from 'express';
import {
  getSubjects,
  createSubject,
  deleteSubject,
  getMappings,
  createMapping,
  deleteMapping
} from '../controllers/subjectController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getSubjects);
router.post('/', protect, authorize('admin', 'teacher'), createSubject);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteSubject);

router.get('/mappings', protect, getMappings);
router.post('/mappings', protect, authorize('admin', 'teacher'), createMapping);
router.delete('/mappings/:id', protect, authorize('admin', 'teacher'), deleteMapping);

export default router;
