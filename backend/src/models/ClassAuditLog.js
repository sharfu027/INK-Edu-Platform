import mongoose from 'mongoose';

const ClassAuditLogSchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    period: {
      type: Number,
      required: true
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    action: {
      type: String,
      enum: ['enter', 'leave'],
      required: true
    },
    isSubstitute: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const ClassAuditLog = mongoose.model('ClassAuditLog', ClassAuditLogSchema);
export default ClassAuditLog;
