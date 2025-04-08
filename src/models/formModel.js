import mongoose from "mongoose";

const formSchema = mongoose.Schema(
  {
    profilePhoto: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    reason: { type: String, required: true },
    file: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    personToMeet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeptUser",
      required: true,
    },
    date: { type: String },
    timeFrom: { type: String },
    timeTo: { type: String },
    gate: { type: String },
    qrCode: { type: String },
    barcodeId: { type: String },
    qrCodeDate: { type: String },
    qrCodeTimeFrom: { type: String },
    qrCodeTimeTo: { type: String },
    cid: { type: String },
  },
  {
    timestamps: true,
  }
);

const Form = mongoose.model("Form", formSchema);
export default Form;
