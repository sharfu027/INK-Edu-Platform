import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    password_hash: {
      type: String,
      required: true
    },
    face_embeddings: {
      type: [String], // Encrypted embedding strings (from Fernet)
      default: []
    },
    registeredLocation: {
      latitude: Number,
      longitude: Number
    },
    skip_location: {
      type: Boolean,
      default: false
    },
    skip_face: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      default: 'teacher'
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

// Pre-save password hashing middleware
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password_hash);
};

const User = mongoose.model('User', UserSchema);
export default User;
