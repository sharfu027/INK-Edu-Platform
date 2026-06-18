import mongoose from 'mongoose';

const StudentAttendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Format YYYY-MM-DD
      required: true
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    studentName: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late'],
      default: 'Present'
    }
  },
  {
    timestamps: true
  }
);

// Compound index to ensure clean daily reports
StudentAttendanceSchema.index({ date: 1, class: 1, studentName: 1 }, { unique: true });

const StudentAttendance = mongoose.model('StudentAttendance', StudentAttendanceSchema);
export default StudentAttendance;
