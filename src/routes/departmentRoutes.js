import express from "express";
import {
  delDepartment,
  DeptCreate,
  getDept,
} from "../controllers/departmentController.js";

const router = express.Router();

router.post("/create", DeptCreate);
router.get("/", getDept);
router.delete("/:deptId", delDepartment);

export default router;
