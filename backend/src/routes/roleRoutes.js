import express from 'express';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/roleController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getRoles);
router.post('/', protect, authorize('admin', 'principal'), createRole);
router.put('/:id', protect, authorize('admin', 'principal'), updateRole);
router.delete('/:id', protect, authorize('admin', 'principal'), deleteRole);

export default router;
