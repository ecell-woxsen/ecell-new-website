import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

import { getAssetUrl, getFrameUrl, getPackUrl, R2_PUBLIC_BASE_URL } from "../app/lib/assets";

console.log("==========================================");
console.log("🧪 R2 Asset Loader Integration Verification");
console.log("==========================================");
console.log("Configured R2 Base URL:", R2_PUBLIC_BASE_URL);

const testCases = [
  { name: "Scrollytelling Frame 1", url: getFrameUrl(1) },
  { name: "Scrollytelling Frame 18 (Fast Boot)", url: getFrameUrl(18) },
  { name: "Scrollytelling Frame 630 (Events)", url: getFrameUrl(630) },
  { name: "Scrollytelling Frame 1262 (Final)", url: getFrameUrl(1262) },
  { name: "Scrollytelling 720p Frame 1", url: getFrameUrl(1, "720p") },
  { name: "Scrollytelling Mobile Frame 1", url: getFrameUrl(1, "mobile_720p") },
  { name: "Scrollytelling Mobile Frame 18", url: getFrameUrl(18, "mobile_720p") },
  { name: "Scrollytelling Mobile Frame 630", url: getFrameUrl(630, "mobile_720p") },
  { name: "Scrollytelling Mobile Frame 840", url: getFrameUrl(840, "mobile_720p") },
  { name: "Scrollytelling Mobile Pack 0", url: getPackUrl(0, "mobile_720p") },
  { name: "Scrollytelling Mobile Pack 52", url: getPackUrl(52, "mobile_720p") },
  { name: "Official E-Cell Logo", url: getAssetUrl("/ecell-logo.png") },
  { name: "Ambient Video Loop", url: getAssetUrl("/still_shot.mp4") },
  { name: "Event Image (Hult)", url: getAssetUrl("/events/hult.png") },
  { name: "Event Image (Panel)", url: getAssetUrl("/events/panel-discussion.jpg") },
  { name: "Event Image (Game Night)", url: getAssetUrl("/events/game-night.jpg") },
  { name: "Service Portfolio PDF", url: getAssetUrl("/ECell_Woxsen_ServicePortfolio.pdf") },
];

let allPassed = true;

for (const test of testCases) {
  try {
    const res = await fetch(test.url, { method: "HEAD" });
    const contentType = res.headers.get("content-type");
    const contentLength = res.headers.get("content-length");
    const status = res.status;

    if (status === 200) {
      console.log(`✅ [HTTP 200] ${test.name.padEnd(30)} -> ${contentType} (${(Number(contentLength) / 1024).toFixed(1)} KB)`);
      console.log(`   URL: ${test.url}`);
    } else {
      console.error(`❌ [HTTP ${status}] ${test.name} FAILED! URL: ${test.url}`);
      allPassed = false;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ [Network Error] ${test.name}: ${message}`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log("\n🎉 ALL ASSET INTEGRATION TESTS PASSED PERFECTLY!");
} else {
  console.error("\n⚠️ Some asset tests failed. Please review the log.");
  process.exit(1);
}
