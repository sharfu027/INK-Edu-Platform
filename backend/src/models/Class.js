import mongoose from 'mongoose';

const ClassSchema = new mongoose.Schema(
  {
    standard: {
      type: String,
      required: true,
      trim: true
    },
    className: {
      type: String,
      required: false,
      trim: true
    },
    section: {
      type: String,
      required: true,
      trim: true
    },
    board: {
      type: String,
      default: 'CBSE',
      required: true
    },
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: false
    },
    strength: {
      type: Number,
      default: 0
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

// Mirror standard and className
ClassSchema.pre('save', function (next) {
  if (this.className && !this.standard) {
    this.standard = this.className;
  } else if (this.standard && !this.className) {
    this.className = this.standard;
  }
  next();
});

// Unique compound index on standard + section + board
ClassSchema.index({ standard: 1, section: 1, board: 1 }, { unique: true });

const Class = mongoose.model('Class', ClassSchema);
export default Class;
