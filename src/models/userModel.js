import mongoose from "mongoose";

const userSchema = mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    password: { type: String },
    role: { type: String, default: "security" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    failedAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    cid: { type: String },
  },
  {
    timestamps: true,
  }
);
// Add a unique index on `email` + `createdBy` (adminId)
userSchema.index({ email: 1, createdBy: 1 }, { unique: true });
const User = mongoose.model("Users", userSchema);
export default User;
