import moment from "moment";
import Admin from "../models/adminModel.js";
import sendEmail from "../config/emailConfig.js";
import License from "../models/licenseModel.js";

// Generate a license key (Super Admin)
export const generateLicenseKey = async (req, res) => {
  try {
    const { adminId, validityDays } = req.body;

    if (!adminId || !validityDays) {
      return res
        .status(400)
        .json({ error: "Admin ID and validity days are required." });
    }

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found." });
    }

    // Generate a random license key
    const segments = 5; // Number of groups
    const segmentLength = 5; // Length of each group

    let licenseKey = Array.from({ length: segments }, () =>
      Math.random().toString(36).substr(2, segmentLength).toUpperCase()
    ).join("-");
    const expiryDate = moment().add(validityDays, "days").toDate();
    // Store license key in DB
    const newLicense = new License({
      key: licenseKey,
      validityDays,
      assignedTo: admin._id,
      expiryDate,
      isUsed: false, // Initially, the license is unused
    });

    await newLicense.save();

    // Send license key to admin email (DO NOT UPDATE THE DATABASE YET)
    const emailText = `
     <!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>License Key Activation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            color: #333;
            padding-bottom: 10px;
            border-bottom: 2px solid #ddd;
        }
        .content {
            font-size: 16px;
            color: #555;
            margin-top: 20px;
            line-height: 1.6;
        }
        .license-key {
            display: block;
            background:rgba(54, 55, 55, 0.75);
            color: #ffffff;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            letter-spacing: 2px;
        }
        .footer {
            text-align: center;
            font-size: 14px;
            color: #888;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">🔑 License Key Activation</div>
        <div class="content">
            <p>Dear <strong>${admin.name}</strong>,</p>
            <p>We are pleased to provide you with your new license key. Please find the details below:</p>
            <span class="license-key">${licenseKey}</span>
            <p>This key is valid for <strong>${validityDays} days</strong>.</p>
            <p>To activate your license, please enter this key in your <strong>Admin Panel</strong>.</p>
            <p>If you have any questions or need assistance, feel free to contact our support team.</p>
        </div>
        <div class="footer">
            Best regards, <br>
            <strong>Betazen Security Team</strong>
        </div>
    </div>
</body>
</html>
  `;

    await sendEmail(admin.email, "Your License Key", emailText);

    res.json({
      message: "License key generated and sent via email.",
    });
  } catch (error) {
    console.error("Error generating license key:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

// Activate license
export const activateLicense = async (req, res) => {
  try {
    const { licenseKey } = req.body;
    const adminId = req.admin.id;

    if (!licenseKey) {
      return res.status(400).json({ message: "License key required" });
    }

    // ✅ 1. Check if the admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // ✅ 2. Find a new, unused license
    const license = await License.findOne({ key: licenseKey, isUsed: false });
    if (!license) {
      return res
        .status(400)
        .json({ message: "Invalid or already used License Key" });
    }

    const activationDate = new Date();
    const newExpiryDate = moment(activationDate)
      .add(license.validityDays, "days")
      .toDate();

    // ✅ 3. Extend license if admin already has an expired license
    if (
      admin.licenseExpiryDate &&
      new Date(admin.licenseExpiryDate) < new Date()
    ) {
      console.log("Extending expired license...");
    }

    // ✅ 4. Update Admin with new expiry date
    const updatedAdmin = await Admin.updateOne(
      { _id: adminId },
      {
        $set: {
          licenseExpiryDate: newExpiryDate,
          isActive: true,
        },
      },
      { runValidators: true }
    );

    if (updatedAdmin.modifiedCount === 0) {
      return res
        .status(500)
        .json({ message: "Failed to update admin license info" });
    }

    // ✅ 5. Mark license as used and set activation date
    const updatedLicense = await License.updateOne(
      { _id: license._id },
      {
        $set: {
          isUsed: true,
          activationDate: activationDate,
        },
      },
      { runValidators: true }
    );

    if (updatedLicense.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update license info" });
    }

    res.json({
      message: "License Activated Successfully!",
      success: true,
    });
  } catch (error) {
    console.error("Error activating license:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
