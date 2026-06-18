import mongoose from 'mongoose';

const LeaveRequestSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    leaveDate: {
      type: String, // Format YYYY-MM-DD
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate leave requests on the same day
LeaveRequestSchema.index({ teacher: 1, leaveDate: 1 }, { unique: true });

const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);
export default LeaveRequest;
