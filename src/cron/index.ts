import express from "express";
import http from "http";
import cron from "node-cron";
import envConfig from "@/config/env";
import { CronHelperStripeConnect } from "@/cron/helper/stripeConnect";
import { deletePreviousMonthEntries } from "@/cron/helper/errorLogs";
import { sendPasswordRotationReminders } from "@/cron/helper/passwordRotation";
import { connectDB, disconnectDB } from "@/db";

const startCronServer = () => {
  try {
    connectDB();

    const app = express();

    app.set("port", envConfig.CRON_PORT);

    const server = http.createServer(app);

    cron.schedule("0 0 * * *", async () => {
      await CronHelperStripeConnect.processTransfers();
    });

    // Cron job to run at the start of every month (1st day at midnight)
    cron.schedule("0 0 1 * *", () => {
      deletePreviousMonthEntries();
    });

    // Daily password-expiry reminders (14, 7, 1 days before expiry)
    // Runs daily at 9 AM
    cron.schedule("0 9 * * *", async () => {
      await sendPasswordRotationReminders();
    });

    server.listen(envConfig.CRON_PORT, () => {
      console.info(
        "Cron server is running on localhost:" + envConfig.CRON_PORT,
      );
    });
  } catch {
    disconnectDB();
    process.exit(1);
  }
};

startCronServer();
