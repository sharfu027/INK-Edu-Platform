import mongoose from 'mongoose';

const TeacherAttendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Format YYYY-MM-DD
      required: true
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Leave'],
      default: 'Absent'
    },
    punchIn: {
      type: Date
    },
    punchOut: {
      type: Date
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    address: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index so a teacher has only one attendance record per day
TeacherAttendanceSchema.index({ date: 1, teacher: 1 }, { unique: true });

const TeacherAttendance = mongoose.model('TeacherAttendance', TeacherAttendanceSchema);
export default TeacherAttendance;
