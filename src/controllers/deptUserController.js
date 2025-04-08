import bcrypt from "bcrypt";
import DeptUser from "../models/deptUserModel.js";
import Department from "../models/department.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import multer from "multer";


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const upload = multer({ storage });

// 🔹 Signup Dept User
export const Signup = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only!" });
    }

    const { name, email, password, phoneNumber, dept, role, adminId } = req.body;
    const normalizedEmail = email.toLowerCase();

    // 🔸 Check if a user with this email already exists under the same admin
    const existingUser = await DeptUser.findOne({
      email: normalizedEmail,
      createdBy: adminId,
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User already exists with this email for this admin" });
    }

    // 🔸 Find department by name AND admin (createdBy)
    const department = await Department.findOne({ name: dept, createdBy: adminId });
    if (!department) {
      return res.status(400).json({ error: "Invalid department name" });
    }

    // 🔸 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔸 Create new department user
    const newDeptUser = new DeptUser({
      name,
      email: normalizedEmail,
      phoneNumber,
      password: hashedPassword,
      dept: department._id,
      role: role || "Dept_User",
      createdBy: adminId,
      cid: req.admin.cid,
    });

    await newDeptUser.save();
    await sendEmail(name, email, password);

    res.status(201).json({
      success: true,
      message: "Dept user created successfully!",
      user: newDeptUser,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};


// Function to send email using Nodemailer
const sendEmail = async (name, email, password) => {
  try {
    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Set this in your .env file
        pass: process.env.EMAIL_PASS, // Set this in your .env file
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: email, // Receiver email
      subject: "🎉 Welcome to Security System - Your Account Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <div style="text-align: center;">
            <h2 style="color: #007bff;">🎉 Welcome, ${name}!</h2>
            <p style="font-size: 16px; color: #333;">Your account has been successfully created. Here are your login details:</p>
          </div>
          
          <div style="background: #fff; padding: 15px; border-radius: 5px; box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);">
            <ul style="list-style: none; padding: 0; font-size: 16px; color: #555;">
              <li><strong>📧 Email:</strong> ${email}</li>
              <li><strong>🔑 Password:</strong> ${password}</li>
            </ul>
          </div>
    
          <p style="text-align: center; margin-top: 20px;">
            <a href="https://security.websitescheckup.in" 
              style="display: inline-block; padding: 12px 20px; font-size: 16px; background: #007bff; color: #fff; 
              text-decoration: none; border-radius: 5px; font-weight: bold;">
              🔐 Login Now
            </a>
          </p>
    
          <p style="font-size: 14px; color: #555; text-align: center;">
            We recommend changing your password after logging in.
          </p>
    
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    
          <p style="font-size: 12px; color: #888; text-align: center;">
            If you did not sign up for this account, please contact our support team immediately.
          </p>
    
          <p style="font-size: 12px; color: #888; text-align: center;">
            💡 Need help? Contact us at <a href="mailto:support@yourwebsite.com" style="color: #007bff;">support@yourwebsite.com</a>
          </p>
          <p style="font-size: 12px; color: #888; text-align: center;">
            Best Regards, <br> <strong>Security Team</strong>
          </p>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};

// Login Dept User
export const deptUserLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user exists
    const deptUser = await DeptUser.findOne({ email });
    if (!deptUser) {
      return res.status(404).json({ error: "Dept User not found" });
    }

    // Check if the user is locked out
    if (deptUser.lockoutUntil && deptUser.lockoutUntil > Date.now()) {
      const remainingTime = Math.ceil(
        (deptUser.lockoutUntil - Date.now()) / (1000 * 60)
      ); // in minutes
      return res.status(403).json({
        error: `Too many failed attempts. Try again in ${remainingTime} minutes.`,
      });
    }

    // Compare provided password with stored hashed password
    const isMatch = await bcrypt.compare(password, deptUser.password);
    if (!isMatch) {
      deptUser.failedAttempts += 1;

      // Lock the account for 24 hours after 3 failed attempts
      if (deptUser.failedAttempts >= 3) {
        deptUser.lockoutUntil = Date.now() + 24 * 60 * 60 * 1000; // Lock for 24 hours
      }

      await deptUser.save();
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Reset failed attempts on successful login
    deptUser.failedAttempts = 0;
    deptUser.lockoutUntil = null;
    await deptUser.save();

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: deptUser._id,
        name: deptUser.name,
        email: deptUser.email,
        role: deptUser.role, // Include role in the token
        cid: deptUser.cid,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // Token expires in 1 day
    );

    res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        id: deptUser._id,
        name: deptUser.name,
        email: deptUser.email,
        role: deptUser.role,
        cid: deptUser.cid,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

// 🔹 Forgot Password - Send Reset Email
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the user exists
    const user = await DeptUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a Reset Token (expires in 1 hour)
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Send the reset password email
    await sendResetEmail(email, resetToken);

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email!",
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// 📧 Send Reset Email
const sendResetEmail = async (email, token) => {
  console.log(email);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetURL = `https://security.websitescheckup.in/reset-password-user/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔒 Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; 
                    border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <div style="text-align: center;">
            <h2 style="color: #d9534f;">🔒 Password Reset Request</h2>
            <p style="font-size: 16px; color: #333;">
              We received a request to reset your password. Click the button below to proceed.
            </p>
          </div>
    
          <div style="text-align: center; margin-top: 20px;">
            <a href="${resetURL}" 
              style="display: inline-block; padding: 12px 20px; font-size: 16px; background: #007bff; color: #fff; 
              text-decoration: none; border-radius: 5px; font-weight: bold;">
              🔐 Reset Your Password
            </a>
          </div>
    
          <p style="font-size: 14px; color: #555; text-align: center; margin-top: 20px;">
            This link will expire in <strong>1 hour</strong>. If you did not request this, please ignore this email.
          </p>
    
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    
          <p style="font-size: 12px; color: #888; text-align: center;">
            Need help? Contact our support team at 
            <a href="mailto:support@yourwebsite.com" style="color: #007bff;">support@yourwebsite.com</a>
          </p>
    
          <p style="font-size: 12px; color: #888; text-align: center;">
            Best Regards, <br> <strong>Security Team</strong>
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Password reset email sent to:", email);
  } catch (error) {
    console.error("❌ Failed to send reset email:", error);
  }
};

// 🔹 Reset Password - Update New Password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Find User
    const user = await DeptUser.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash New Password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password has been successfully reset!",
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

//Get all Dept user
export const getAllDeptUser = async (req, res) => {
  try {
    const { adminId } = req.query; // Get adminId from query params

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    const deptUsers = await DeptUser.find({ createdBy: adminId });

    res.status(200).json({
      message: "Department users fetched successfully!",
      deptUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error, Please try again later.",
    });
  }
};

// Delete a Dept User
export const DelDeptUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user to be deleted in the database
    const user = await DeptUser.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If user is found, delete the user

    res.status(200).json({ message: "Department User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//Total Empoyee count
export const DeptUsersCount = async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }
    const totalDeptUsers = await DeptUser.countDocuments({
      createdBy: adminId,
    });
    res.status(200).json({
      success: true,
      data: { totalDeptUsers: totalDeptUsers },
    });
  } catch (error) {
    console.error("Error fetching Dept users count", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

//Bulk upload Excel
export const bulkDeptUser = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only!" });
    }

    const filePath = req.file?.path;
    if (!filePath) {
      return res.status(400).json({ error: "No Excel file uploaded." });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const failed = [];
    const createdUsers = [];

    for (const record of sheet) {
      const { name, email, phoneNumber, dept } = record;
      if (!name || !email || !dept) {
        failed.push({ email, reason: "Missing fields" });
        continue;
      }

      const normalizedEmail = email.toLowerCase();
      const existing = await DeptUser.findOne({ email: normalizedEmail });
      if (existing) {
        failed.push({ email, reason: "Already exists" });
        continue;
      }

      const department = await Department.findOne({
        name: dept,
        createdBy: req.admin.id, // OR use cid: req.admin.cid if you track it that way
      });
      if (!department) {
        failed.push({ email, reason: "Invalid department" });
        continue;
      }

      const password = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new DeptUser({
        name,
        email: normalizedEmail,
        phoneNumber,
        dept: department._id,
        role: "Dept_User",
        password: hashedPassword,
        createdBy: req.admin.id,
        cid: req.admin.cid,
      });

      await newUser.save();
      createdUsers.push(newUser);

      await sendEmail(name, email, password); // Add login link in your sendEmail function
    }

    // Optional: delete uploaded file after processing
    fs.unlinkSync(path.resolve(filePath));

    res.status(201).json({
      success: true,
      message: `${createdUsers.length} users created successfully.`,
      failed,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res
      .status(500)
      .json({ error: "Something went wrong.", details: err.message });
  }
};
