import mongoose from "mongoose";

const deptUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String,  required: true },
    password: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
    dept: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    role: { type: String, default: "Dept_User" },
    failedAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    cid:{type: String},
  },
  {
    timestamps: true, // Corrected spelling
  }
);
// ✅ Enforce uniqueness on combination of email + createdBy (adminId)
deptUserSchema.index({ email: 1, createdBy: 1 }, { unique: true });

const DeptUser = mongoose.model("DeptUser", deptUserSchema); // Fixed naming issue
export default DeptUser;
