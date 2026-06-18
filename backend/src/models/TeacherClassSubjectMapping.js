import mongoose from 'mongoose';

const TeacherClassSubjectMappingSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate mappings
TeacherClassSubjectMappingSchema.index({ teacher: 1, class: 1, subject: 1 }, { unique: true });

const TeacherClassSubjectMapping = mongoose.model(
  'TeacherClassSubjectMapping',
  TeacherClassSubjectMappingSchema
);
export default TeacherClassSubjectMapping;
