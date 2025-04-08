import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

export const upload = multer({ storage });

/**
 * Create a new user - Only an Admin can perform this action.
 */
export const createUser = async (req, res) => {
  try {
    // Ensure req.admin is properly set by middleware
    if (!req.admin || req.admin.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only!" });
    }

    const { name, email, password, role, adminId } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Check if user with same email or name exists under the same adminId
    const existingUser = await User.findOne({
      email: normalizedEmail,
      createdBy: adminId,
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User with this email or name already exists in the company!",
      });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "security",
      createdBy: adminId, // Ensure createdBy uses `adminId`
      cid: req.admin.cid,
    });

    await newUser.save();

    // Send email with credentials
    await sendEmail(email, name, password);

    res.status(201).json({
      message: "User created successfully and email sent!",
      user: newUser,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

// Function to send email using Nodemailer
const sendEmail = async (email, name, password) => {
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
      subject: "🎉 Welcome to Security Portal - Your Account Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; 
                    border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <div style="text-align: center;">
            <h2 style="color: #007bff;">🎉 Welcome, ${name}!</h2>
            <p style="font-size: 16px; color: #333;">
              Your account has been successfully created. Here are your login details:
            </p>
          </div>
    
          <div style="background: #fff; padding: 15px; border-radius: 5px; box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);">
            <ul style="list-style: none; padding: 0; font-size: 16px; color: #555;">
              <li><strong>📧 Email:</strong> ${email}</li>
              <li><strong>🔑 Password:</strong> ${password}</li>
            </ul>
          </div>
    
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://security.websitescheckup.in" 
              style="display: inline-block; padding: 12px 20px; font-size: 16px; background: #28a745; color: #fff; 
              text-decoration: none; border-radius: 5px; font-weight: bold;">
              🔑 Login Now
            </a>
          </div>
    
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

//User Login
export const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the user is locked out
    if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
      const remainingTime = Math.ceil(
        (user.lockoutUntil - Date.now()) / (1000 * 60)
      ); // in minutes
      return res.status(403).json({
        error: `Too many failed attempts. Try again in ${remainingTime} minutes.`,
      });
    }

    // Compare provided password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedAttempts += 1;

      // Lock the account for 24 hours after 3 failed attempts
      if (user.failedAttempts >= 3) {
        user.lockoutUntil = Date.now() + 24 * 60 * 60 * 1000; // Lock for 24 hours
      }

      await user.save();
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Reset failed attempts on successful login
    user.failedAttempts = 0;
    user.lockoutUntil = null;
    await user.save();

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        cid: user.cid,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // Token expires in 1 day
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        cid: user.cid,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

//Get all Users
export const getAllUsers = async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }
    const users = await User.find({ createdBy: adminId });
    res.status(200).json({ message: "All users fetched successfully!", users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error, Please try again later." });
  }
};

//Search user based on name, email
export const searchUser = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    });

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error searching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reset password send mail
export const sendPasswordResetEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a JWT reset token (expires in 1 hour)
    const resetToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Send reset link via email
    const transporter = nodemailer.createTransport({
      service: "Gmail", // Use your email provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `http://localhost:3000/reset-password-user/${resetToken}`;

    const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; 
                border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
      
      <h2 style="color: #007bff; text-align: center;">🔒 Password Reset Request</h2>
      
      <p style="font-size: 16px; color: #333; text-align: center;">
        We received a request to reset your password. Click the button below to proceed.
      </p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${resetLink}" target="_blank" 
          style="display: inline-block; padding: 12px 20px; font-size: 16px; background: #007BFF; color: #fff; 
          text-decoration: none; border-radius: 5px; font-weight: bold;">
          🔑 Reset Password
        </a>
      </div>
  
      <p style="font-size: 14px; color: #555; text-align: center;">
        This link is valid for <strong>1 hour</strong>. If you did not request a password reset, 
        please ignore this email or contact support.
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
  `;

    await transporter.sendMail({
      from: `"SecurityScan" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: emailContent,
    });

    res.json({ message: "Password reset email sent!" });
  } catch (error) {
    console.error("Error sending reset email:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

//Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Find the user by email extracted from token
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();
    res.json({ message: "Password reset successful!" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Delete a security
export const delSecurity = async (req, res) => {
  try {
    const { userId } = req.params;

    const security = await User.findByIdAndDelete(userId);
    if (!security) {
      return res.status(404).json({
        message: "User not foound!",
      });
    }

    res.status(200).json({
      message: "Security deleted successfully!",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//Total Security/Users count
export const totalUserCount = async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }
    const totalUserCount = await User.countDocuments({ createdBy: adminId });
    res.status(200).json({
      success: true,
      data: { totalUser: totalUserCount },
    });
  } catch (error) {
    console.error("Error fetching User count", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//Bulk Security create
export const bulkSecurity = async (req, res) => {
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
      const { name, email } = record;
      if (!name || !email) {
        failed.push({ email, reason: "Missing required fields" });
        continue;
      }

      const normalizedEmail = String(email)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

      const existing = await User.findOne({
        email: normalizedEmail,
        createdBy: req.admin.id,
      });
      if (existing) {
        failed.push({ email, reason: "Already exists" });
        continue;
      }

      const password = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "Security",
        createdBy: req.admin.id,
        cid: req.admin.cid,
      });

      await newUser.save();
      createdUsers.push(newUser);

      await sendEmail(email, name, password);
    }

    // Delete uploaded file **AFTER** processing
    fs.unlinkSync(path.resolve(filePath));

    res.status(201).json({
      success: true,
      message: `${createdUsers.length} users created successfully.`,
      failed,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({
      error: "Something went wrong.",
      details: error.message,
    });
  }
};
