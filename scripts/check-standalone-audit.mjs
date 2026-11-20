import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (
  report.auditReportVersion !== 2 ||
  report.error ||
  !report.vulnerabilities
) {
  throw new Error("Missing complete npm audit report");
}

// Next can trace files from the build installation, including packages outside
// the runtime manifest. Check each reported installation path against the image.
const shipped = new Set();
for (const issue of Object.values(report.vulnerabilities)) {
  if (!["high", "critical"].includes(issue.severity)) continue;
  for (const path of issue.nodes) {
    if (existsSync(join(".next/standalone", path))) shipped.add(path);
  }
}
if (shipped.size) {
  throw new Error(
    "High-severity advisories in standalone packages: " +
      [...shipped].join(", "),
  );
}
console.log("Standalone trace checked against the full installation audit");
