import express from 'express';
import {
  requestLeave,
  getLeaveRequests,
  getSubstituteSuggestions,
  approveLeave,
  assignSubstituteDirectly
} from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/request', protect, authorize('teacher'), requestLeave);
router.get('/requests', protect, authorize('admin', 'principal', 'hod'), getLeaveRequests);
router.get('/substitute-suggestions', protect, authorize('admin', 'principal'), getSubstituteSuggestions);
router.post('/approve/:id', protect, authorize('admin', 'principal'), approveLeave);
router.post('/assign-substitute-directly', protect, authorize('admin', 'principal'), assignSubstituteDirectly);

export default router;
