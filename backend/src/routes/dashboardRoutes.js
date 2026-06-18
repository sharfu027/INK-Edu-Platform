import express from 'express';
import { 
  getTeacherDashboard, 
  getAdminDashboard, 
  getConsolidatedStats, 
  getIndividualStats,
  getClassStatus,
  getMonitoringStats,
  getAuditLogs,
  getClassHistory
} from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/teacher', protect, authorize('admin', 'principal', 'hod', 'teacher'), getTeacherDashboard);
router.get('/admin', protect, authorize('admin', 'principal', 'hod'), getAdminDashboard);
router.get('/consolidated-stats', protect, authorize('admin', 'principal', 'hod'), getConsolidatedStats);
router.get('/individual-stats/:teacherId', protect, authorize('admin', 'principal', 'hod'), getIndividualStats);

// New Timetable Monitoring Module routes
router.get('/class-status', protect, authorize('admin', 'principal', 'hod'), getClassStatus);
router.get('/monitoring-stats', protect, authorize('admin', 'principal', 'hod'), getMonitoringStats);
router.get('/audit-logs', protect, authorize('admin', 'principal', 'hod'), getAuditLogs);
router.get('/class-history/:classId', protect, authorize('admin', 'principal', 'hod'), getClassHistory);

export default router;

