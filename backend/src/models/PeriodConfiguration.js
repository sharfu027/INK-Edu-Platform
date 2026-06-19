import mongoose from 'mongoose';

const PeriodConfigurationSchema = new mongoose.Schema(
  {
    periodNumber: {
      type: Number,
      required: false
    },
    periodName: {
      type: String,
      required: true,
      trim: true
    },
    startTime: {
      type: String,
      required: true, // format "HH:MM"
      trim: true
    },
    endTime: {
      type: String,
      required: true, // format "HH:MM"
      trim: true
    },
    isBreak: {
      type: Boolean,
      default: false
    },
    schoolId: {
      type: String,
      default: 'default',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index to quickly sort periods by start time chronologically
PeriodConfigurationSchema.index({ startTime: 1 });

const PeriodConfiguration = mongoose.model('PeriodConfiguration', PeriodConfigurationSchema);
export default PeriodConfiguration;
