import fs from "fs";
import path from "path";

export const logAuditEvent = async (entry: any) => {
  const logEntry = { timestamp: new Date().toISOString(), ...entry };
  console.log("[AUDIT]", JSON.stringify(logEntry));

  if (process.env.NODE_ENV === "development") {
    const logDir = path.join(__dirname, "../../../logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `audit-${new Date().toISOString().split("T")[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
  }
};
