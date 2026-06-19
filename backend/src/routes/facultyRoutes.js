import express from 'express';
import multer from 'multer';
import {
  getFaculty,
  addTeacher,
  addNonTeachingStaff,
  updateFacultySettings,
  resetFacultyPassword,
  deleteFaculty,
  uploadDocument,
  downloadDocument,
  importTeachers,
  exportTeachers
} from '../controllers/facultyController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', protect, getFaculty);
router.post('/teacher', protect, authorize('admin', 'teacher'), addTeacher);
router.post('/non-teaching', protect, authorize('admin', 'teacher'), addNonTeachingStaff);
router.put('/employee/:id/settings', protect, authorize('admin', 'teacher'), updateFacultySettings);
router.post('/employee/:id/reset-password', protect, authorize('admin', 'teacher'), resetFacultyPassword);
router.delete('/employee/:id', protect, authorize('admin', 'teacher'), deleteFaculty);

router.post('/import', protect, authorize('admin', 'teacher'), importTeachers);
router.get('/export', protect, authorize('admin', 'teacher'), exportTeachers);

router.post('/employee/:id/upload-document', protect, authorize('admin', 'teacher'), upload.single('file'), uploadDocument);
router.get('/employee/:id/download-document/:filename', protect, downloadDocument);

export default router;
