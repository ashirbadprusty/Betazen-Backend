import SuperAdmin from "../models/superAdminModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
//Super Admin Signup
export const superAdminSignup = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Check if admin already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    if (existingSuperAdmin) {
      return res
        .status(400)
        .json({ error: "Super admin already exists with this email." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const newSuperAdmin = new SuperAdmin({
      name,
      email,
      password: hashedPassword,
      role: role || "super_admin", // Default to "admin" if role not provided
    });

    await newSuperAdmin.save();

    res.status(201).json({ message: "Super admin created successfully!" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

//Super Admin Login
export const superAdminLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const superAdmin = await SuperAdmin.findOne({ email });
    if (!superAdmin) {
      return res.status(404).json({ error: "Super admin not found" });
    }
    const isMatch = await bcrypt.compare(password, superAdmin.password);
    if (!isMatch) {
      await superAdmin.save();
      return res.status(400).json({
        message: "Invalid credentials!",
      });
    }
    const token = jwt.sign(
      {
        id: superAdmin._id,
        name: superAdmin.name,
        role: superAdmin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Super Admin logged in successfully!",
      token,
      superAdmin: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};
