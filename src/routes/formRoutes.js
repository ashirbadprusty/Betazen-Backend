import express from "express";
import {
  createForm,
  FormsById,
  getAllForms,
  scanAndStoreFullRecord,
  updateStatus,
  fetchAllScannedRecords,
  fetchLast5ScannedRecords,
  reqRegCount,
  todayVisitedUsers,
  dayandMonthWiseCount,
  searchRegisterUser,
  searchScannedUser,
  getTodayEntryExitCount,
  missedOutRecordCount,
} from "../controllers/formController.js";
import { upload } from "../middleware/upload.js";
import mongoose from "mongoose";

const router = express.Router();

router.post(
  "/submit",
  upload.fields([{ name: "profilePhoto" }, { name: "file" }]),
  createForm
);
router.get("/allForms", getAllForms);
router.get("/getForm/:formId", FormsById);
router.patch("/statusUpdate/:formId", updateStatus);
router.post("/scan", scanAndStoreFullRecord);
router.get("/getAllScannedData", fetchAllScannedRecords);
router.get("/last5records", fetchLast5ScannedRecords);
router.get("/reqRegCount", reqRegCount);
router.get("/todayVistedUsers", todayVisitedUsers);
router.get("/stats", dayandMonthWiseCount);
router.get("/searchRegUser", searchRegisterUser);
router.get("/searchScannedUser", searchScannedUser);
router.get("/missedRecordCount", missedOutRecordCount);
router.get("/entry-exit-count", getTodayEntryExitCount);

router.get("/check-scan", async (req, res) => {
  const { barcodeId } = req.query;
  if (!barcodeId) {
    return res.status(400).json({ message: "barcodeId is required." });
  }

  const scannedCollection = mongoose.connection.collection("scanned_data");
  const existingScan = await scannedCollection.findOne({ barcodeId });

  if (existingScan && existingScan.entryTime) {
    return res.json({ alreadyScanned: true });
  }

  return res.json({ alreadyScanned: false });
});

export default router;
