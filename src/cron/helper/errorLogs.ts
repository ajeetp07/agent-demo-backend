import { ErrorLogs } from "@/db/models/errorLogs";

export function deletePreviousMonthEntries() {
  // Get the first day of the current month
  const startOfCurrentMonth = new Date();
  startOfCurrentMonth.setUTCDate(1);
  startOfCurrentMonth.setUTCHours(0, 0, 0, 0);

  // Delete documents where `createdAt` is before the first day of the current month
  ErrorLogs.deleteMany({
    createdAt: { $lt: startOfCurrentMonth },
  })
    .then((result) => {
      console.log(
        `${result.deletedCount} entries from previous months deleted.`,
      );
    })
    .catch((error) => {
      console.error("Error deleting previous month entries:", error);
    });
}
