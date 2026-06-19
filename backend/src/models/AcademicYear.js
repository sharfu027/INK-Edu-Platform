import mongoose from 'mongoose';

const AcademicYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'upcoming'],
      default: 'upcoming'
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const AcademicYear = mongoose.model('AcademicYear', AcademicYearSchema);
export default AcademicYear;
