import mongoose from 'mongoose';

const ClassStatusSchema = new mongoose.Schema(
  {
    statusId: {
      type: String,
      required: true,
      unique: true
    },
    className: {
      type: String,
      required: true
    },
    assignedTeacherId: {
      type: String,
      required: true
    },
    activeTeacherId: {
      type: String,
      default: null
    },
    statusColor: {
      type: String,
      enum: ['GREEN', 'RED', 'YELLOW'],
      default: 'RED'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'ClassStatus',
    timestamps: true
  }
);

const ClassStatus = mongoose.model('ClassStatus', ClassStatusSchema);
export default ClassStatus;
