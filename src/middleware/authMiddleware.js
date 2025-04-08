import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import Security from "../models/userModel.js";
import Employee from "../models/deptUserModel.js";

const adminMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ message: "Invalid token format. Use 'Bearer <token>'" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedAdmin) => {
      
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      req.admin = decodedAdmin;
      
      next();
    });
  } catch (error) {
    console.error("Middleware Error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const superAdminMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization token required",
      });
    }
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        message: "Invalid token format, Use 'Bearer <token>'",
      });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedSuperAdin) => {
      if (err) {
        return res.status(403).json({
          message: "Invalid or expired token",
        });
      }
      req.superAdmin = decodedSuperAdin;
      next();
    });
  } catch (error) {
    console.error("Middleware Error:", error.message);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const checkTrialMiddleware = async (req, res, next) => {
  try {
    const { userId, userType } = req.user; // Assuming authentication is done

    let user;
    if (userType === "admin") {
      user = await Admin.findById(userId);
    } else if (userType === "security") {
      user = await Security.findById(userId);
    } else if (userType === "dept_user") {
      user = await Employee.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if trial period has expired
    const currentDate = new Date();
    if (currentDate > user.trialExpiryDate) {
      user.isTrialActive = false;
      await user.save();
      return res.status(403).json({
        message: "Trial period expired. Please subscribe to continue.",
      });
    }

    next(); // Continue if trial is active
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const checkRoleMiddleware = (requiredRole) => {
  return (req, res, next) => {
    if (req.user.userType !== requiredRole) {
      return res
        .status(403)
        .json({ message: "Access denied. You do not have permission." });
    }
    next();
  };
};

export {
  adminMiddleware,
  superAdminMiddleware,
  checkTrialMiddleware,
  checkRoleMiddleware,
};
