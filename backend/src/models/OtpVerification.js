import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['signup', 'forgot_password', 'login', 'update_password', 'generic'],
      default: 'signup',
    },
    channel: {
      type: String,
      enum: ['sms', 'call'],
      default: 'sms',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup when expiresAt timestamp arrives
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick phone + purpose lookup
otpVerificationSchema.index({ phone: 1, purpose: 1 });

const OtpVerification = mongoose.model('OtpVerification', otpVerificationSchema);

export default OtpVerification;
