import mongoose from "mongoose";

const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // License Key
  validityDays: { type: Number, required: true }, // License Duration
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // Admin using the license
  isUsed: { type: Boolean, default: false }, // Prevent reuse
  createdAt: { type: Date, default: Date.now }, // When the license was generated
  activationDate: { type: Date },
});

const License = mongoose.model("License", licenseSchema);
export default License;
