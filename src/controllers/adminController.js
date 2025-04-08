import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import moment from "moment";
import sendEmail from "../config/emailConfig.js";

dotenv.config();
const generateCID = async (name) => {
  const namePart = name.replace(/\s+/g, "").substring(0, 3).toUpperCase(); // First 3 letters (removes spaces)
  let newCid;

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Random 4-digit number
    newCid = `${namePart}${randomNumber}`;
  } while (await Admin.exists({ cid: newCid })); // Ensure unique CID

  return newCid;
};

// Admin Signup
const adminSignup = async (req, res) => {
  try {
    const { name, email, password, role, cmobile, remark } = req.body;

    const clogo = req.files?.clogo?.[0]?.filename
      ? `http://localhost:5002/uploads/logo/${req.files.clogo[0].filename}`
      : null;
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res
        .status(400)
        .json({ error: "Admin already exists with this email." });
    }

    // Generate unique CID dynamically
    const cid = await generateCID(name);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Set trial period
    const trialDays = 1; // Change as needed
    const trialStart = moment().toDate();
    const trialEnd = moment().add(trialDays, "days").toDate();
    const visitorRegisterURL = `http://localhost:5173/${cid}?lg=${encodeURIComponent(
      clogo
    )}&Id=${newAdmin._id}`;
    // Create new admin
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
      cmobile,
      cid,
      remark,
      clogo,
      role: role || "admin",
      trialStartDate: trialStart,
      trialEndDate: trialEnd,
      isActive: true,
      licenseExpiryDate: null,
      visitorRegisterURL,
    });

    await newAdmin.save();

    // Send email with login credentials
    const subject = "Admin Account Created - Login Details";
    const htmlContent = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
    <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #ddd;">
      <img src="${clogo}" alt="Company Logo" style="max-width: 150px; max-height: 100px">
    </div>

    <div style="padding: 20px;">
      <h2 style="color: #333; text-align: center;">Welcome, ${name}!</h2>
      <p style="color: #555; font-size: 16px;">Your admin account has been successfully created.</p>

      <div style="background-color: #fff; padding: 15px; border-radius: 5px; box-shadow: 0px 2px 5px rgba(0,0,0,0.1);">
        <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 8px 0;"><strong>Password:</strong> ${password}</p>
        <p style="margin: 8px 0; color: #ff4d4d;"><strong>Trial Period Ends On:</strong> ${moment(
          trialEnd
        ).format("YYYY-MM-DD")}</p>
       
      </div>

      <p style="color: #555; font-size: 14px; margin-top: 15px;">For security reasons, please change your password after logging in.</p>

      <div style="text-align: center; margin-top: 20px;">
        <a href="https://security.websitescheckup.in/sign-in" 
           style="background-color: #007bff; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
          Login Now
        </a>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
        If you have any questions, please contact our support team at 
        <a href="mailto:support@yourcompany.com" style="color: #007bff;">support@yourcompany.com</a>.
      </p>
    </div>

    <div style="text-align: center; padding: 15px; font-size: 12px; color: #777; background-color: #eee; border-top: 1px solid #ddd; margin-top: 20px;">
      &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
    </div>
  </div>
`;

    await sendEmail(email, subject, htmlContent);

    res
      .status(201)
      .json({ message: "Admin created successfully with a trail period!" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

// Admin Login
const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ error: "Admin not found." });
    }

    // Check if the admin is locked out
    if (admin.lockoutUntil && admin.lockoutUntil > Date.now()) {
      const remainingTime = Math.ceil(
        (admin.lockoutUntil - Date.now()) / (1000 * 60)
      ); // in minutes
      return res.status(403).json({
        error: `Too many failed attempts. Try again in ${remainingTime} minutes.`,
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      admin.failedAttempts += 1;

      // Lock the admin after 3 failed attempts
      if (admin.failedAttempts >= 3) {
        admin.lockoutUntil = Date.now() + 24 * 60 * 60 * 1000; // Lock for 24 hours
      }

      await admin.save();
      return res.status(400).json({ error: "Invalid credentials." });
    }

    // Reset failed attempts on successful login
    admin.failedAttempts = 0;
    admin.lockoutUntil = null;
    await admin.save();

    // Generate JWT Token
    const token = jwt.sign(
      { id: admin._id, name: admin.name, role: admin.role, cid: admin.cid },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Admin logged in successfully!",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        cid: admin.cid,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error.", details: error.message });
  }
};

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//Get all Admins
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find();
    res.status(200).json(admins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching admins", error });
  }
};

//Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Generate Reset Token
    const resetToken = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    // Reset Link
    const resetLink = `https://security.websitescheckup.in/reset-password/${resetToken}`;

    // Email Template
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: admin.email,
      subject: "🔐 Admin Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <div style="text-align: center;">
            <h2 style="color: #007bff;">🔑 Password Reset Request</h2>
            <p style="font-size: 16px; color: #333;">Hello <strong>${admin.name}</strong>,</p>
            <p style="font-size: 14px; color: #555;">
              We received a request to reset your password. Click the button below to proceed:
            </p>
            <a href="${resetLink}" 
              style="display: inline-block; padding: 12px 20px; font-size: 16px; background: #007bff; color: #fff; 
              text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">
              🔄 Reset Password
            </a>
            <p style="font-size: 14px; color: #555;">
              If you did not request this, you can safely ignore this email.
            </p>
            <p style="font-size: 12px; color: #888; margin-top: 10px;">
              ⚠ This link will expire in <strong>15 minutes</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #888;">
              Need help? Contact us at <a href="mailto:support@yourwebsite.com" style="color: #007bff;">support@yourwebsite.com</a>
            </p>
          </div>
        </div>
      `,
    };

    // Send Email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Reset link sent to email" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error sending email", details: error.message });
  }
};

//Reset password
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Find Admin
    const admin = await Admin.findOne({ email: decoded.email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Hash New Password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error resetting password", details: error.message });
  }
};

//License status
const getLicenseStatus = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const today = moment().startOf("day"); // Normalize to avoid time mismatches
    let isTrial = false;
    let trialExpiryDate = null;
    let trialDaysLeft = 0;
    let licenseExpiryDate = null;
    let licenseDaysLeft = 0;
    let isExpired = false;
    let alertMessage = null;

    // ✅ USE admin.licenseExpiryDate if available
    if (admin.licenseExpiryDate) {
      licenseExpiryDate = moment(admin.licenseExpiryDate).endOf("day");
      licenseDaysLeft = licenseExpiryDate.diff(today, "days");
      isExpired = licenseDaysLeft <= 0;

      if (licenseDaysLeft <= 7 && licenseDaysLeft > 0) {
        alertMessage = `Your license will expire in ${licenseDaysLeft} days. Please renew it.`;
      } else if (isExpired) {
        alertMessage =
          "Your license has expired. Please enter a new license key.";
      }
    } else {
      // No active license → Check trial period
      isTrial = true;
      trialExpiryDate = moment(admin.trialEndDate).endOf("day");
      trialDaysLeft = trialExpiryDate.diff(today, "days");
      isExpired = trialDaysLeft <= 0;

      if (trialDaysLeft <= 7 && trialDaysLeft > 0) {
        alertMessage = `Your trial will expire in ${trialDaysLeft} days. Please activate a license.`;
      } else if (isExpired) {
        isTrial = false;
        alertMessage =
          "Your trial period has ended. Please activate a license.";
      }
    }

    res.json({
      isTrial,
      trialExpiryDate: trialExpiryDate ? trialExpiryDate.toISOString() : null,
      trialDaysLeft,
      licenseExpiryDate: licenseExpiryDate
        ? licenseExpiryDate.toISOString()
        : null,
      licenseDaysLeft,
      isExpired,
      alertMessage,
    });
  } catch (error) {
    console.error("Error checking license status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Delete admin
const delAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findByIdAndDelete(adminId);
    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    res.status(200).json({
      message: "Admin deleted successfully!",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Total admin counts
const adminCounts = async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    res.status(200).json({
      totalAdmins: count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "server error" });
  }
};

//Get Company/Admin Details For Register Form
const getCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Admin.findOne({ cid: companyId });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({
      adminId: company._id,
      clogo: company.clogo,
      companyName: company.name,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

// Controller to fetch only the visitor registration URL
const getVisitorRegisterURL = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the admin by `_id` or `cid`
    const admin = await Admin.findOne({ $or: [{ _id: id }, { cid: id }] });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json({ visitorRegisterURL: admin.visitorRegisterURL });
  } catch (error) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export {
  adminSignup,
  adminLogin,
  forgotPassword,
  resetPassword,
  getLicenseStatus,
  delAdmin,
  adminCounts,
  getCompanyDetails,
  getVisitorRegisterURL
};
