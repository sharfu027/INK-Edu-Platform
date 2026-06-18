import express from 'express';
import {
  getAttendanceLogs,
  punchIn,
  punchOut,
  verifyLogout,
  getDailyStatus,
  getConsolidatedReport,
  getStudentAttendance,
  markStudentAttendance,
  classLogin,
  classLogout
} from '../controllers/attendanceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Punch In / Out is public (authenticated via biometric face match + employee ID + GPS boundaries)
router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);
router.post('/verify-logout', verifyLogout);

// Authenticated reporting and student logs
router.get('/', protect, getAttendanceLogs);
router.get('/daily-status', protect, getDailyStatus);
router.get('/report/consolidated', protect, getConsolidatedReport);
router.get('/students', protect, getStudentAttendance);
router.post('/students', protect, markStudentAttendance);

// Class Login/Logout
router.post('/class-login', protect, classLogin);
router.post('/class-logout', protect, classLogout);

export default router;
