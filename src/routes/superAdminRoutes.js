import express from "express";
import {
  superAdminLogin,
  superAdminSignup,
} from "../controllers/superAdminController.js";
import { superAdminMiddleware } from "../middleware/authMiddleware.js";
import { generateLicenseKey } from "../controllers/licenseController.js";
const router = express.Router();

router.post("/signup", superAdminSignup);
router.post("/login", superAdminLogin);
router.get("/protected", superAdminMiddleware, (req, res) => {
  res.status(200).json({
    message: "Access grantend to protected route",
    superAdmin: req.superAdmin,
    role: req.role,
  });
});
router.post("/generate-license", superAdminMiddleware, generateLicenseKey);

export default router;
