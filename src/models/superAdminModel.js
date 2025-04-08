import mongoose from "mongoose";

const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: "super_admin" },
  },
  {
    timestamps: true,
  }
);
const superAdmin = mongoose.model("SuperAdmin", superAdminSchema);
export default superAdmin;
