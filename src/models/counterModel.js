import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
});

export default mongoose.model("Counter", CounterSchema);
