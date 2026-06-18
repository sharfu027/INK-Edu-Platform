import mongoose from 'mongoose';

const ClassSessionSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    period: {
      type: Number,
      required: true
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
      required: true
    },
    loginTime: {
      type: Date,
      required: true
    },
    logoutTime: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active'
    },
    loginLocation: {
      latitude: Number,
      longitude: Number
    },
    logoutLocation: {
      latitude: Number,
      longitude: Number
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate active/completed class sessions for the same class, period, and date
ClassSessionSchema.index({ class: 1, period: 1, date: 1 }, { unique: true });

const ClassSession = mongoose.model('ClassSession', ClassSessionSchema);
export default ClassSession;
