import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./src/config/db.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import formRoutes from "./src/routes/formRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import DeptUserRoutes from "./src/routes/deptUserRoutes.js";
import DepartmentRoutes from "./src/routes/departmentRoutes.js";
import SuperAdminRoutes from "./src/routes/superAdminRoutes.js";

dotenv.config();
// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cookieParser());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from ONE "uploads" folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());

// Sample route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/superAdmin", SuperAdminRoutes);
app.use("/admin", adminRoutes);
app.use("/api/form", formRoutes);
app.use("/api/user", userRoutes);
app.use("/api/deptUser", DeptUserRoutes);
app.use("/api/department", DepartmentRoutes);


const port = process.env.PORT || 5001;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
