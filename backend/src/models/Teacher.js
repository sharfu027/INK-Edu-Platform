import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    qualification: {
      type: String,
      required: true
    },
    experience: {
      type: Number, // in years
      required: true,
      default: 0
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'On Leave'],
      default: 'Active'
    },
    teacherId: {
      type: String
    },
    teacherName: {
      type: String
    },
    department: {
      type: String,
      default: 'General'
    }
  },
  {
    timestamps: true
  }
);

TeacherSchema.pre('save', function(next) {
  if (!this.teacherId) {
    this.teacherId = this.employeeId;
  }
  if (!this.teacherName) {
    this.teacherName = this.name;
  }
  next();
});

const Teacher = mongoose.model('Teacher', TeacherSchema);
export default Teacher;
