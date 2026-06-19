import mongoose from 'mongoose';

const SubjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    subjectName: {
      type: String,
      required: false,
      trim: true
    },
    subjectCode: {
      type: String,
      required: false,
      trim: true
    },
    description: {
      type: String,
      required: false,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Mirror name and subjectName
SubjectSchema.pre('save', function (next) {
  if (this.subjectName && !this.name) {
    this.name = this.subjectName;
  } else if (this.name && !this.subjectName) {
    this.subjectName = this.name;
  }
  next();
});

const Subject = mongoose.model('Subject', SubjectSchema);
export default Subject;
