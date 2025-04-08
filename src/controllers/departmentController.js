import Department from "../models/department.js";

// Create a department
export const DeptCreate = async (req, res) => {
  try {
    let { name, adminId } = req.body;
    // Convert name to lowercase and trim whitespace
    name = name.trim().toLowerCase();
    
    // Check if department already exists
    const existingDept = await Department.findOne({ name, createdBy: adminId });
    if (existingDept) {
      return res
        .status(400)
        .json({ message: "Department already exists in this company!" });
    }

    const department = new Department({ name, createdBy: adminId });
    await department.save();
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: "Error creating department", error:error.message });
  }
};

// Fetch all departments
export const getDept = async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is  required" });
    }
    const departments = await Department.find({ createdBy: adminId });
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching departments", error });
  }
};

//Delete a department
export const delDepartment = async (req, res) => {
  try {
    const { deptId } = req.params;
    const department = await Department.findByIdAndDelete(deptId);
    if (!department) {
      return res.status(404).json({
        message: "Department not found",
      });
    }
    res.status(200).json({
      message: "Department deleted successfully!",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
