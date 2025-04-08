import mongoose from "mongoose";

const departmentSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    }, // Tracks the admin who created it
  },
  { timestamps: true }
);


// ✅ Allow same name for different admins but unique per admin
departmentSchema.index({ name: 1, createdBy: 1 }, { unique: true });

const Department = mongoose.model("Department", departmentSchema);
export default Department;
