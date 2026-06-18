import express from 'express';
import multer from 'multer';
import {
  checkUser,
  register,
  login,
  verifyFace,
  faceLogin,
  getProfile,
  logout,
  geocode
} from '../controllers/authController.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import {
  getAttendanceLogs,
  punchIn,
  punchOut,
  verifyLogout,
  getDailyStatus,
  getConsolidatedReport
} from '../controllers/attendanceController.js';
import {
  getFaculty,
  updateFacultySettings,
  deleteFaculty,
  resetFacultyPassword,
  uploadDocument,
  downloadDocument
} from '../controllers/facultyController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Core Auth
router.post('/check-user', checkUser);
router.post('/register', register);
router.post('/login', login);
router.post('/verify-face', verifyFace);
router.post('/face-login', faceLogin);
router.get('/profile', protect, getProfile);
router.post('/logout', logout);
router.post('/geocode', geocode);

// Wake up/Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', database: 'connected', detail: 'All services are operational' });
});

// Settings Bridge
router.get('/settings', protect, getSettings);
router.post('/settings', protect, authorize('admin', 'teacher'), updateSettings);

// Attendance Logs & Status Bridge
router.get('/attendance', protect, getAttendanceLogs);
router.post('/attendance/punch-in', punchIn);
router.post('/attendance/punch-out', punchOut);
router.post('/attendance/verify-logout', verifyLogout);
router.get('/attendance/daily-status', protect, getDailyStatus);
router.get('/attendance/report/consolidated', protect, getConsolidatedReport);

// Faculty Management Bridge
router.get('/admin/employees', protect, getFaculty);
router.put('/admin/employee/:id/settings', protect, authorize('admin', 'teacher'), updateFacultySettings);
router.delete('/admin/employee/:id', protect, authorize('admin', 'teacher'), deleteFaculty);
router.post('/admin/employee/:id/reset-password', protect, authorize('admin', 'teacher'), resetFacultyPassword);
router.post('/admin/employee/:id/upload-document', protect, authorize('admin', 'teacher'), upload.single('file'), uploadDocument);
router.get('/admin/employee/:id/download-document/:filename', protect, downloadDocument);

export default router;
