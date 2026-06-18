import mongoose from 'mongoose';

const SubstituteAssignmentSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Format YYYY-MM-DD
      required: true
    },
    timetableEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable',
      required: true
    },
    period: {
      type: Number,
      required: true
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    originalTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    substituteTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'Completed'],
      default: 'Pending'
    }
  },
  {
    timestamps: true
  }
);

// Unique constraint to avoid assigning multiple substitutes to the same period/class/day
SubstituteAssignmentSchema.index({ date: 1, class: 1, period: 1 }, { unique: true });

const SubstituteAssignment = mongoose.model('SubstituteAssignment', SubstituteAssignmentSchema);
export default SubstituteAssignment;
