import mongoose from 'mongoose';

const TimetableSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    period: {
      type: Number,
      required: true
    },
    startTime: {
      type: String,
      required: true // e.g., "09:00"
    },
    endTime: {
      type: String,
      required: true // e.g., "09:45"
    },
    timeSlot: {
      type: String,
      required: true // e.g., "09:00-09:45"
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    date: {
      type: String, // YYYY-MM-DD
      required: false
    },
    timetableId: {
      type: String
    },
    teacherId: {
      type: String
    },
    className: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Format timeSlot before saving
TimetableSchema.pre('validate', function(next) {
  if (this.startTime && this.endTime) {
    this.timeSlot = `${this.startTime}-${this.endTime}`;
  }
  next();
});

// Pre-save hook to populate user-requested fields
TimetableSchema.pre('save', async function(next) {
  if (!this.timetableId) {
    this.timetableId = this._id.toString();
  }
  // Populate teacherId and className if not set
  if (this.teacher && !this.teacherId) {
    try {
      const TeacherModel = mongoose.model('Teacher');
      const teacherDoc = await TeacherModel.findById(this.teacher);
      if (teacherDoc) {
        this.teacherId = teacherDoc.teacherId || teacherDoc.employeeId;
      }
    } catch (e) {}
  }
  if (this.class && !this.className) {
    try {
      const ClassModel = mongoose.model('Class');
      const classDoc = await ClassModel.findById(this.class);
      if (classDoc) {
        this.className = `${classDoc.standard}-${classDoc.section}`;
      }
    } catch (e) {}
  }
  next();
});

// Prevent overlapping periods for the same class on the same day/date
TimetableSchema.index({ class: 1, day: 1, period: 1, date: 1 }, { unique: true });

const Timetable = mongoose.model('Timetable', TimetableSchema);
export default Timetable;

