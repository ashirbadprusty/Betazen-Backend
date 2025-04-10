import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import DeptUser from "../models/deptUserModel.js";
import User from "../models/userModel.js";

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

const authMiddleware = async (req, res, next) => {
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check by decoded.id instead of _id
    if (decoded.role === "admin") {
      const admin = await Admin.findById(decoded.id);
      if (admin) {
        req.admin = admin;
        return next();
      }
    }

    if (decoded.role === "security") {
      const security = await User.findById(decoded.id);
      if (security) {
        req.security = security;
        return next();
      }
    }

    if (decoded.role === "Dept_User") {
      const deptUser = await DeptUser.findById(decoded.id);
      if (deptUser) {
        req.deptUser = deptUser;
        return next();
      }
    }

    return res.status(403).json({ message: "Unauthorized user" });
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { adminMiddleware, superAdminMiddleware, authMiddleware };
