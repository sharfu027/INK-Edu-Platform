import mongoose from 'mongoose';

const AuditLogsSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true
    },
    className: {
      type: String,
      required: true
    },
    teacherName: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'AuditLogs',
    timestamps: true
  }
);

const AuditLogs = mongoose.model('AuditLogs', AuditLogsSchema);
export default AuditLogs;
