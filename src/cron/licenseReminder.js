import cron from "cron";
import moment from "moment";
import Admin from "../models/adminModel.js";
import sendEmail from "../config/emailConfig.js";

cron.schedule("0 0 * * *", async () => {
  console.log("Checking license expirations...");
  const upcomingExpiryDate = moment().add(7, "days").toDate();
  const expiringAdmins = await Admin.find({
    licenseExpiryDate: { $lte: upcomingExpiryDate },
    isActive: true,
  });

  for (let admin of expiringAdmins) {
    const emailText = `Your license expires on ${admin.licenseExpiryDate}. Renew soon!`;
    await sendEmail(admin.email, "License Expiry Reminder", emailText);
    console.log(`Reminder sent to: ${admin.email}`);
  }
});
