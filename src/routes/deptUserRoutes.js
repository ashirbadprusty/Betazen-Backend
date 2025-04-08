import express from "express";
import {
  bulkDeptUser,
  DelDeptUser,
  deptUserLogin,
  DeptUsersCount,
  forgotPassword,
  getAllDeptUser,
  resetPassword,
  Signup,
  upload,
} from "../controllers/deptUserController.js";
import { adminMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/signup", adminMiddleware, Signup);
router.post("/login", deptUserLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/", getAllDeptUser);
router.delete("/:userId", DelDeptUser);
router.get("/totalDeptUser", DeptUsersCount);
router.post("/bulk-upload", adminMiddleware, upload.single("file"), bulkDeptUser);

export default router;
