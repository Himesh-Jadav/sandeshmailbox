import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    hasSetPassword: {
      type: Boolean,
      default: false,
    },
    createdVia: {
      type: String,
      enum: ['web', 'ivr', 'sms'],
      default: 'web',
      required: true,
    },
    aliasIds: {
      type: [String],
      default: [],
    },
    displayName: {
      type: String,
      default: '',
    },
    dob: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say', '', null],
      default: null,
    },
    profilePictureUrl: {
      type: String,
      default: null,
    },
    profilePictureGridFsId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    publicKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', userSchema);
export default User;
