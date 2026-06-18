import mongoose from 'mongoose';

const SchoolSettingsSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: true,
      default: 'Golden Valley Academy'
    },
    schoolType: {
      type: String,
      required: true,
      default: 'Co-Educational'
    },
    board: {
      type: String,
      default: 'CBSE'
    },
    boardsList: {
      type: [String],
      default: ['CBSE', 'STATE', 'ICSE']
    },
    standardsList: {
      type: [String],
      default: ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
    },
    face_auth_enabled: {
      type: Boolean,
      default: true
    },
    location_auth_enabled: {
      type: Boolean,
      default: true
    },
    academicYear: {
      type: String,
      required: true,
      default: '2026-2027'
    },
    timings: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '16:00'
      },
      gracePeriod: {
        type: Number, // in minutes
        default: 30
      }
    },
    hours_per_subject: {
      type: Number,
      default: 1
    },
    game_period_mins: {
      type: Number,
      default: 45
    },
    lunch_break_mins: {
      type: Number,
      default: 45
    },
    small_break_mins: {
      type: Number,
      default: 15
    },
    hours_per_day: {
      type: Number,
      default: 8
    },
    hours_per_week: {
      type: Number,
      default: 40
    },
    hours_per_month: {
      type: Number,
      default: 160
    },
    hours_per_year: {
      type: Number,
      default: 1920
    },
    weekly_off: {
      type: String,
      default: 'Sunday'
    },
    standardsConfig: [
      {
        standard: {
          type: String,
          required: true
        },
        sections: {
          type: [String],
          default: ['A', 'B', 'C']
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

const SchoolSettings = mongoose.model('SchoolSettings', SchoolSettingsSchema);
export default SchoolSettings;
