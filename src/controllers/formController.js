import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import moment from "moment";
import Form from "../models/formModel.js";
import Counter from "../models/counterModel.js";
import Admin from "../models/adminModel.js";

// Create Form
export const createForm = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      reason,
      department,
      personToMeet,
      date,
      timeFrom,
      timeTo,
      cid,
    } = req.body;

    // Convert email to lowercase to avoid duplicates due to case sensitivity
    const normalizedEmail = email.toLowerCase();

    // Check uploaded files
    const profilePhoto = req.files?.profilePhoto?.[0]?.filename
      ? `http://localhost:5002/uploads/images/${req.files.profilePhoto[0].filename}`
      : null;

    const file = req.files?.file?.[0]?.filename
      ? `http://localhost:5002/uploads/documents/${req.files.file[0].filename}`
      : null;

    // Validate required fields
    if (
      !name ||
      !normalizedEmail ||
      !phone ||
      !reason ||
      !file ||
      !department ||
      !personToMeet ||
      !date ||
      !timeFrom ||
      !timeTo
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be filled!" });
    }

    const newForm = new Form({
      profilePhoto,
      name,
      email: normalizedEmail,
      phone,
      reason,
      file,
      department,
      personToMeet, // Store ObjectId
      date,
      timeFrom,
      timeTo,
      cid,
    });

    await newForm.save();

    // Populate department and personToMeet before sending the email
    const populatedForm = await Form.findById(newForm._id)
      .populate("department", "name") // Fetch department name
      .populate("personToMeet", "name email"); // Fetch personToMeet's name & email

    // Send email
    await sendEmailToAdminAndPerson({
      name: populatedForm.name,
      email: populatedForm.email,
      phone: populatedForm.phone,
      reason: populatedForm.reason,
      profilePhoto: populatedForm.profilePhoto,
      file: populatedForm.file,
      department: populatedForm.department?.name || "N/A", // Use populated department name
      personToMeet: populatedForm.personToMeet
        ? {
            name: populatedForm.personToMeet.name,
            email: populatedForm.personToMeet.email,
          }
        : { name: "N/A", email: null }, // Handle missing personToMeet
      date: populatedForm.date,
      timeFrom: populatedForm.timeFrom,
      timeTo: populatedForm.timeTo,
    });
    res.status(201).json({
      message: "Form submitted successfully!",
      form: newForm,
    });
  } catch (error) {
    console.error("Error in createForm:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Sends an email to the registered admin with user details
const sendEmailToAdminAndPerson = async ({
  name,
  email,
  phone,
  reason,
  profilePhoto,
  file,
  department,
  personToMeet,
  date,
  timeFrom,
  timeTo,
}) => {
  try {
    // Fetch the admin email from the database
    const admin = await Admin.findOne();
    const adminEmail = admin?.email || null;

    if (!adminEmail && !personToMeet?.email) {
      console.warn(
        "No admin or personToMeet email found. Skipping email notification."
      );
      return;
    }

    // Configure Nodemailer transport
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Generate email content dynamically
    const generateEmailHtml = (dashboardUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
        <h2 style="text-align: center; color: #333;">New Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Department:</strong> ${department}</p>
        <p><strong>Person To Meet:</strong> ${personToMeet?.name || "N/A"}</p>
        <p><strong>Date:</strong>${date}</p> 
        <p><strong>Entry Time:</strong> ${timeFrom}</p>
        <p><strong>Exit Time:</strong> ${timeTo}</p>
        
        ${
          profilePhoto
            ? `<p><strong>Profile Photo:</strong> <a href="${profilePhoto}" target="_blank">View Photo</a></p>`
            : ""
        }
        ${
          file
            ? `<p><strong>Attached File:</strong> <a href="${file}" target="_blank">Download File</a></p>`
            : ""
        }
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${dashboardUrl}" 
             style="background-color: #007BFF; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
            View in Dashboard
          </a>
        </div>
      </div>
    `;

    // Send email to admin (Redirects to Admin Dashboard `/`)
    if (adminEmail) {
      await transporter.sendMail({
        from: `"SecurityScan" <${process.env.EMAIL_USER}>`,
        to: adminEmail,
        subject: "New Form Submission - Action Required",
        html: generateEmailHtml("https://security.websitescheckup.in/"),
      });
      console.log("Email sent to admin successfully.");
    }

    // Send email to personToMeet (Redirects to Dept User Dashboard `/deptUserDashboard`)
    if (personToMeet?.email) {
      await transporter.sendMail({
        from: `"SecurityScan" <${process.env.EMAIL_USER}>`,
        to: personToMeet.email,
        subject: "You Have a Visitor Scheduled",
        html: generateEmailHtml(
          "https://security.websitescheckup.in/deptUserDashboard"
        ),
      });
      console.log("Email sent to personToMeet successfully.");
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Get All Forms
export const getAllForms = async (req, res) => {
  try {
    const { companyId } = req.query;
    // Retrieve all forms from the database
    const forms = await Form.find({ cid: companyId }).populate(
      "department personToMeet"
    );

    res.status(200).json({ message: "All forms fetched successfully!", forms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Get Form By ID
export const FormsById = async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await Form.findById(formId);

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.status(200).json({ message: "Form fetched successfully!", form });
  } catch (error) {
    console.error("Error fetching form by ID:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Get __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ Ensure uploads are stored in the project root, not inside src/
const qrCodeDir = path.join(process.cwd(), "uploads", "qrCodes");

// Ensure directory exists
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
}

// Update status
export const updateStatus = async (req, res) => {
  try {
    const { formId } = req.params;
    const { status } = req.body;

    const validStatuses = ["Approved", "Rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status value. Must be 'Approved' or 'Rejected'.",
      });
    }

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    if (form.status === status) {
      return res.status(400).json({ message: `Form is already ${status}` });
    }

    form.status = status;

    if (status === "Approved") {
      let counter = await Counter.findOneAndUpdate(
        { name: "barcodeCounter" },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
      );

      const formattedSerialNumber = String(counter.count).padStart(10, "0");
      const barcodeId = `VIS${formattedSerialNumber}`;

      // ✅ Fetch `date`, `timeFrom`, and `timeTo` from the form
      const visitDate = form.date;
      const timeFrom = form.timeFrom;
      const timeTo = form.timeTo;

      // Store QR Code details including date & time validation
      const qrCodeData = JSON.stringify({
        barcodeId,
        visitDate,
        timeFrom,
        timeTo,
      });

      const qrCodeFilename = `qrCode_${barcodeId}.png`;
      const qrCodePath = path.join(qrCodeDir, qrCodeFilename);

      await QRCode.toFile(qrCodePath, qrCodeData);

      form.barcodeId = barcodeId;
      form.qrCode = `http://localhost:5002/uploads/qrCodes/${qrCodeFilename}`;
      form.qrCodeDate = visitDate;
      form.qrCodeTimeFrom = timeFrom;
      form.qrCodeTimeTo = timeTo;

      await form.save();
      // ✅ Send Email to Visitor
      await sendApprovalEmail(form);

      return res.status(200).json({
        message: `Form ${status.toLowerCase()} successfully`,
        form,
      });
    } else {
      await form.save();
      return res.status(200).json({
        message: `Form ${status.toLowerCase()} successfully`,
        form,
      });
    }
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

const sendApprovalEmail = async (form) => {
  try {
    // ✅ Generate the QR Code as a base64 image
    const qrCodeDataURL = await QRCode.toDataURL(form.barcodeId);

    // ✅ Convert Base64 QR Code to binary buffer for email attachment
    const qrCodeBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");

    // ✅ Email Transporter Setup
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER, // Use your email
        pass: process.env.EMAIL_PASS, // Use app password if needed
      },
    });

    // ✅ Email HTML Content
    const emailHTML = `
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; text-align: center; background-color: #f5f5f5; padding: 20px;">

    <!-- Thank You Message -->
    <h2 style="margin: 10px 0; font-size: 24px; color: #1E3A8A; font-weight: bold;">Thank You for Registering!</h2>
    <p style="margin: 5px 0; font-size: 18px; color: #333;">We appreciate your interest and look forward to welcoming you.</p>

    <!-- Badge Section -->
    <table align="center" width="350" style="background-color: #0A1A3D; color: white; padding: 20px; 
        border-radius: 10px; box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.2); border: 2px solid #1E3A8A; margin-top: 15px;">
        
        <tr>
            <td align="center">
                <h2 style="margin: 0; font-size: 22px;">MetroMindz</h2>
                <p style="margin: 0; font-size: 14px;">Software Private Limited</p>
                
                <img src="${form.profilePhoto}" alt="User" style="margin-top: 10px; width: 90px; height: 90px; border-radius: 10px; border: 2px solid white;">
                
                <p style="margin-top: 5px; font-size: 22px; color: #00C0FF; fontWeight: bold;">${form.name}</p>
                <p style="margin: 5px 0; font-size: 16px;">Email: ${form.email}</p>
                <p style="margin: 5px 0; font-size: 16px;">Contact: (+91) ${form.phone}</p>

                <img src="cid:qrcode" alt="QR Code" style="margin: 5px 0; width: 120px; background-color: white; padding: 5px; border-radius: 5px;">
                
                <p style="font-size: 16px; margin-top: 5px;">Scan the QR Code <br> For Secure Authentication and Verification</p>

                <p style="font-size: 18px; font-weight: bold; margin-top: 5px;">Pass ID: ${form.barcodeId}</p>
            </td>
        </tr>
    </table>

    <!-- Security & Rules Section (Outside Badge) -->
    <h2 style="margin-top: 20px; font-size: 22px; color: #FFAA00; font-weight: bold;">Security & Entry Rules</h2>
    <ul style="font-size: 18px; margin: 10px auto; padding-left: 20px; color: #333; text-align: left; max-width: 600px;">
        <li>Once you exit, re-entry is not permitted. You must register again.</li>
        <li>Please carry a valid government ID along with this badge for verification.</li>
        <li>Unauthorized sharing of this badge is strictly prohibited.</li>
        <li>Security checks are mandatory at all entry points.</li>
        <li>For any assistance, contact our support team.</li>
    </ul>
    <p style="margin: 10px 0; font-size: 18px; text-align: center; font-weight: bold;">Thank you for your cooperation. Stay safe!</p>

</body>
`;

    // ✅ Email Options
    const mailOptions = {
      from: '"MetroMindz Security" <' + process.env.EMAIL_USER + ">",
      to: form.email,
      subject: "Your Visit Approval & QR Code",
      html: emailHTML,
      attachments: [
        {
          filename: "qrcode.png",
          content: qrCodeBuffer,
          contentType: "image/png",
          cid: "qrcode", // ✅ Ensures the QR Code is displayed inside the email
        },
      ],
    };

    // ✅ Send Email
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully with QR Code!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
// ✅ QR Code Validation Function
export const validateQRCode = (record) => {
  const currentDate = moment().format("YYYY-MM-DD");
  const currentTime = moment().format("HH:mm");

  if (record.qrCodeDate !== currentDate) {
    return { valid: false, message: "QR code is not valid for today." };
  }

  if (currentTime < record.qrCodeTimeFrom) {
    return { valid: false, message: "Still you have time to enter." };
  }

  if (currentTime > record.qrCodeTimeTo) {
    return { valid: false, message: "QR code is expired." };
  }

  return { valid: true, message: "QR code is valid." };
};

// Scan records
export const scanAndStoreFullRecord = async (req, res) => {
  try {
    const { barcodeId } = req.query;
    const { overrideEntryTime, securityApproval } = req.body;

    if (!barcodeId) {
      return res.status(400).json({ message: "barcodeId is required." });
    }

    const record = await Form.findOne({ barcodeId });

    if (!record) {
      return res.status(404).json({ message: "QR code not found." });
    }

    const validationResult = validateQRCode(record);

    if (!validationResult.valid) {
      if (validationResult.message === "Still you have time to enter.") {
        if (!securityApproval) {
          return res.status(201).json({
            earlyScan: true,
            message: validationResult.message,
            userDetails: {
              name: record.name,
              date: record.date,
              photo: record.profilePhoto,
              timeFrom: record.qrCodeTimeFrom,
              timeTo: record.qrCodeTimeTo,
              barcodeId: record.barcodeId,
            },
          });
        } else {
          console.log("✅ Security approved entry override.");
        }
      } else {
        return res.status(400).json({ message: validationResult.message });
      }
    }

    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");

    const currentTime = new Date();
    const todayDate = moment().format("YYYY-MM-DD");
    const allowedEntryTime = record.qrCodeTimeFrom
      ? moment(
          `${todayDate} ${record.qrCodeTimeFrom}`,
          "YYYY-MM-DD HH:mm"
        ).toDate()
      : null;
    console.log("current time", currentTime);
    console.log("allow entry time", allowedEntryTime);

    if (
      allowedEntryTime &&
      currentTime < allowedEntryTime &&
      !overrideEntryTime
    ) {
      if (securityApproval) {
        console.log("✅ Security approved early entry.");
      } else {
        return res.status(201).json({
          earlyScan: true,
          message: "Still you have time to enter. Security can approve entry.",
          userDetails: {
            name: record.name,
            date: record.date,
            photo: record.profilePhoto,
            timeFrom: record.qrCodeTimeFrom,
            timeTo: record.qrCodeTimeTo,
            barcodeId: record.barcodeId,
          },
        });
      }
    }

    const existingScan = await scannedCollection.findOne({ barcodeId });

    if (existingScan) {
      if (existingScan.exitTime) {
        return res.status(400).json({
          message:
            "QR code has already been scanned for exit. No further scans allowed.",
        });
      }

      await scannedCollection.updateOne(
        { barcodeId },
        { $set: { exitTime: currentTime } }
      );

      return res
        .status(200)
        .json({ message: "Exit time recorded successfully." });
    } else {
      await scannedCollection.updateOne(
        { barcodeId },
        {
          $set: {
            barcodeId,
            scannedData: record.toObject(), // Store full record
            scannedAt: currentTime,
            entryTime: currentTime,
            exitTime: null,
          },
        },
        { upsert: true }
      );

      return res
        .status(200)
        .json({ message: "Entry time recorded successfully." });
    }

    await Form.updateOne(
      { _id: record._id },
      { $set: { latestScan: currentTime } }
    );
  } catch (error) {
    console.error("❌ Error scanning record:", error);
    res.status(500).json({
      message: "An error occurred while scanning the QR code.",
      error: error.message,
    });
  }
};

// Get All scanned records
export const fetchAllScannedRecords = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required." });
    }
    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");

    // Fetch all records from the scanned_data collection
    const scannedRecords = await scannedCollection
      .aggregate([
        {
          $match: { "scannedData.cid": companyId }, // Filter by companyId
        },
        {
          $sort: { scannedAt: -1 },
        },
        {
          $lookup: {
            from: "departments",
            localField: "scannedData.department",
            foreignField: "_id",
            as: "departmentDetails",
          },
        },
        {
          $lookup: {
            from: "deptusers",
            localField: "scannedData.personToMeet",
            foreignField: "_id",
            as: "personToMeetDetails",
          },
        },
        {
          $unwind: {
            path: "$departmentDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$personToMeetDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            barcodeId: 1,
            "scannedData.name": 1,
            "scannedData.email": 1,
            "scannedData.phone": 1,
            "scannedData.reason": 1,
            "scannedData.file": 1,
            "scannedData.profilePhoto": 1,
            "scannedData.status": 1,
            "scannedData.date": 1,
            "scannedData.timeFrom": 1,
            "scannedData.timeTo": 1,
            "scannedData.gate": 1,
            "scannedData.cid": 1,
            scannedAt: 1,
            entryTime: 1,
            exitTime: 1,
            department: "$departmentDetails.name", // Extract department name
            personToMeet: "$personToMeetDetails.name", // Extract person name
          },
        },
      ])
      .toArray();

    if (!scannedRecords.length) {
      return res.status(404).json({ message: "No scanned records found." });
    }

    res.status(200).json({
      message: "All scanned records fetched successfully.",
      data: scannedRecords,
    });
  } catch (error) {
    console.error("Error fetching scanned records:", error);
    res.status(500).json({
      message: "An error occurred while fetching scanned records.",
      error: error.message,
    });
  }
};

// Fetch last 5 records
export const fetchLast5ScannedRecords = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required." });
    }
    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");

    const last5Records = await scannedCollection
      .aggregate([
        {
          $match: { "scannedData.cid": companyId }, // Filter by companyId
        },
        {
          $sort: { scannedAt: -1 },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: "departments",
            localField: "scannedData.department",
            foreignField: "_id",
            as: "departmentDetails",
          },
        },
        {
          $lookup: {
            from: "deptusers",
            localField: "scannedData.personToMeet",
            foreignField: "_id",
            as: "personToMeetDetails",
          },
        },
        {
          $unwind: {
            path: "$departmentDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$personToMeetDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            barcodeId: 1,
            "scannedData.name": 1,
            "scannedData.email": 1,
            "scannedData.phone": 1,
            "scannedData.reason": 1,
            "scannedData.file": 1,
            "scannedData.profilePhoto": 1,
            "scannedData.status": 1,
            "scannedData.date": 1,
            "scannedData.timeFrom": 1,
            "scannedData.timeTo": 1,
            "scannedData.gate": 1,
            scannedAt: 1,
            entryTime: 1,
            exitTime: 1,
            department: "$departmentDetails.name", // Extract department name
            personToMeet: "$personToMeetDetails.name", // Extract person name
          },
        },
      ])
      .toArray();

    if (!last5Records.length) {
      return res.status(404).json({ message: "No scanned records found." });
    }

    res.status(200).json({
      message: "Last 5 scanned records fetched successfully.",
      data: last5Records,
    });
  } catch (error) {
    console.error("Error fetching last 5 scanned records:", error);
    res.status(500).json({
      message: "An error occurred while fetching last 5 scanned records.",
      error: error.message,
    });
  }
};

// Fetch counts
export const reqRegCount = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    // Get the total number of forms (total visitors)
    const totalFormsCount = await Form.countDocuments({ cid: companyId });

    // Get the current time in the local timezone
    const currentTime = new Date(); 
    const localCurrentHour = currentTime.getHours().toString().padStart(2, "0");
    const localCurrentMinute = currentTime.getMinutes().toString().padStart(2, "0");

    // Get the number of pending forms that have NOT expired
    const newRequestsCount = await Form.countDocuments({
      cid: companyId,
      status: "Pending",
      $expr: {
        $gt: [
          {
            $concat: [
              { $substrCP: ["$timeTo", 0, 2] }, // Extract hours
              { $substrCP: ["$timeTo", 3, 2] }  // Extract minutes
            ]
          },
          localCurrentHour + localCurrentMinute, // Compare in local time format "HHmm"
        ],
      },
    });

    // Send response with counts
    res.json({
      success: true,
      data: {
        totalVisitors: totalFormsCount,
        newRequests: newRequestsCount, // Only active requests remain
      },
    });
  } catch (error) {
    console.error("Error fetching form counts:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching form counts.",
    });
  }
};



// Fetch Today visitors
export const todayVisitedUsers = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required." });
    }

    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");

    // Get the start and end of today's date
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Set to midnight (start of today)
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // Set to 11:59 PM (end of today)

    // Filter the documents to only count those that were scanned today
    const todayVisitors = await scannedCollection.countDocuments({
      "scannedData.cid": companyId, // Ensure filtering by companyId

      scannedAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    });

    res.json({
      success: true,
      data: {
        todayVisitors: todayVisitors,
      },
    });
  } catch (error) {
    console.error("Error fetching visitors count:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching visitors count.",
    });
  }
};

// Count based on days and month
export const dayandMonthWiseCount = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required." });
    }

    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");

    // Get start and end of the current week (Monday - Sunday)
    const startOfWeek = moment().startOf("isoWeek").toDate(); // Monday
    const endOfWeek = moment().endOf("isoWeek").toDate(); // Sunday

    // Get start and end of the current year
    const startOfYear = moment().startOf("year").toDate();
    const endOfYear = moment().endOf("year").toDate();

    // Fetch day-wise count for the current week
    const dayOfWeekCounts = await scannedCollection
      .aggregate([
        {
          $match: {
            "scannedData.cid": companyId, // Filter by company
            scannedAt: { $gte: startOfWeek, $lte: endOfWeek },
          },
        },
        {
          $project: {
            dayOfWeek: { $dayOfWeek: "$scannedAt" },
          },
        },
        {
          $group: {
            _id: "$dayOfWeek",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Fetch month-wise count for the current year
    const monthOfYearCounts = await scannedCollection
      .aggregate([
        {
          $match: {
            "scannedData.cid": companyId, // Filter by company
            scannedAt: { $gte: startOfYear, $lte: endOfYear },
          },
        },
        {
          $project: {
            monthOfYear: { $month: "$scannedAt" },
          },
        },
        {
          $group: {
            _id: "$monthOfYear",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Map day counts for the current week
    const dayCounts = dayNames.map((day, index) => {
      const count =
        dayOfWeekCounts.find((item) => item._id === index + 1)?.count || 0;
      return {
        day,
        count,
      };
    });

    // Map month counts for the current year
    const monthCounts = monthNames.map((month, index) => {
      const count =
        monthOfYearCounts.find((item) => item._id === index + 1)?.count || 0;
      return {
        month,
        count,
      };
    });

    res.json({
      success: true,
      data: {
        dayCounts,
        monthCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching day and month-wise count:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching day and month-wise count.",
    });
  }
};

//Search users from Register Form
export const searchRegisterUser = async (req, res) => {
  try {
    const { query, companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const users = await Form.find({
      cid: companyId,
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    }).populate("department personToMeet");

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error searching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Search users from Scanned Form
export const searchScannedUser = async (req, res) => {
  try {
    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");
    const { query, companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const users = await scannedCollection
      .aggregate([
        {
          $match: {
            "scannedData.cid": companyId, // ✅ First filter by companyId
          },
        },
        {
          $match: {
            $or: [
              { "scannedData.name": { $regex: query, $options: "i" } },
              { "scannedData.email": { $regex: query, $options: "i" } },
              { "scannedData.phone": { $regex: query, $options: "i" } },
              { barcodeId: { $regex: query, $options: "i" } },
            ],
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "scannedData.department",
            foreignField: "_id",
            as: "department",
          },
        },
        {
          $unwind: {
            path: "$department",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "deptusers",
            localField: "scannedData.personToMeet",
            foreignField: "_id",
            as: "personToMeet",
          },
        },
        {
          $unwind: {
            path: "$personToMeet",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $project: {
            scannedData: 1,
            barcodeId: 1,
            department: "$department.name",
            personToMeet: "$personToMeet.name",
            scannedAt: 1,
            entryTime: 1,
            exitTime: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ])
      .toArray();

    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error searching scanned user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Total Entry & Exit Coount
export const getTodayEntryExitCount = async (req, res) => {

  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required." });
    }

    const db = mongoose.connection;
    const scannedCollection = db.collection("scanned_data");

    // Get start and end of today's date in UTC format
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Midnight (start of today)

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1); // Start of tomorrow

    // Count total entries for the company
    const totalEntries = await scannedCollection.countDocuments({
      "scannedData.cid": companyId,
      entryTime: { $gte: today, $lt: tomorrow },
    });

    // Count total exits for the company
    const totalExits = await scannedCollection.countDocuments({
      "scannedData.cid": companyId,
      exitTime: { $gte: today, $lt: tomorrow },
    });

    res.json({
      success: true,
      data: { totalEntries, totalExits },
    });
  } catch (error) {
    console.error("Error getting entry and exit count:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching entry and exit count.",
    });
  }
};

// Missed Out Records
export const missedOutRecordCount = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status.json({
        message: "Company ID is required",
      });
    }
    const expiredRecords = await Form.find({
      cid: companyId,
      status: "Pending",
      $or: [
        { date: { $lt: moment().format("YYYY-MM-DD") } },
        {
          date: moment().format("YYYY-MM-DD"),
          timeTo: { $lt: moment().format("HH:mm") },
        },
      ],
    });

    return res.status(200).json({
      success: true,
      count: expiredRecords.length,
      message: "Missed out records count retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching missed out records:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
