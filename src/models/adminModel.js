import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    clogo: { type: String, required: function () { return this.isNew; } },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true },
    cid: { type: String, required: function () { return this.isNew; } },
    password: { type: String, required: true },
    cmobile: { type: String, required: function () { return this.isNew; } },
    remark: { type: String },
    role: { type: String, enum: ["admin", "superadmin"], default: "admin" },
    failedAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    trialStartDate: Date,
    trialEndDate: Date,
    licenseExpiryDate: Date,
    isActive: { type: Boolean, default: true },
    visitorRegisterURL: { type: String }, // ✅ New field to store visitor registration URL
  },
  { timestamps: true }
);


const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
