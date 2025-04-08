import express from "express";
import {
  adminCounts,
  adminLogin,
  adminSignup,
  delAdmin,
  forgotPassword,
  getAllAdmins,
  getCompanyDetails,
  getLicenseStatus,
  getVisitorRegisterURL,
  resetPassword
} from "../controllers/adminController.js";
import { activateLicense } from "../controllers/licenseController.js";
import { adminMiddleware } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";
const router = express.Router();

router.post("/signup", upload.fields([{ name: "clogo" }]), adminSignup);
router.post("/login", adminLogin);
router.get("/", getAllAdmins);
router.get("/protected", adminMiddleware, (req, res) => {
  res.status(200).json({
    message: "Access granted to protected route",
    admin: req.admin,
    role: req.role,
  });
});
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.delete("/:adminId", delAdmin);
router.post("/activate-license", adminMiddleware, activateLicense);
router.get("/license-status", adminMiddleware, getLicenseStatus);
router.get("/totalCounts", adminCounts);
router.get("/:companyId",getCompanyDetails);
router.get("/visitor-url/:id", getVisitorRegisterURL);
export default router;
