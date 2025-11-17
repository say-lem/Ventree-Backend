import fs from "fs";
import path from "path";

interface SalesAuditLogEntry {
  timestamp: string;
  requestId: string;
  action: string;
  shopId: string;
  performedBy: {
    userId: string;
    role: "owner" | "staff";
  };
  saleId?: string;
  ip?: string;
  details?: any;
}

export const logSalesAuditEvent = async (
  entry: Omit<SalesAuditLogEntry, "timestamp">
): Promise<void> => {
  const logEntry: SalesAuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  console.log("[SALES_AUDIT]", JSON.stringify(logEntry));

  // Production: send to logging service
  if (process.env.NODE_ENV === "production") {
    // TODO: Implement production logging
  }

  // Development: write to file
  if (process.env.NODE_ENV === "development") {
    try {
      const logDir = path.join(__dirname, "../../../logs");
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(
        logDir,
        `sales-audit-${new Date().toISOString().split("T")[0]}.log`
      );
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
    } catch (error) {
      console.error("Failed to write sales audit log:", error);
    }
  }
};