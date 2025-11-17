import fs from "fs";
import path from "path";

interface InventoryAuditLogEntry {
  timestamp: string;
  requestId: string;
  action: string;
  shopId: string;
  performedBy: {
    userId: string;
    role: "owner" | "staff";
  };
  itemId?: string;
  ip?: string;
  details?: any;
}

export const logInventoryAuditEvent = async (
  entry: Omit<InventoryAuditLogEntry, "timestamp">
): Promise<void> => {
  const logEntry: InventoryAuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  console.log("[INVENTORY_AUDIT]", JSON.stringify(logEntry));

  if (process.env.NODE_ENV === "production") {
    // TODO: Implement production logging service
  }

  if (process.env.NODE_ENV === "development") {
    try {
      const logDir = path.join(__dirname, "../../../logs");
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(
        logDir,
        `inventory-audit-${new Date().toISOString().split("T")[0]}.log`
      );
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
    } catch (error) {
      console.error("Failed to write inventory audit log:", error);
    }
  }
};