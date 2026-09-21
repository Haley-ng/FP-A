// Smoke test for Phase 2 drill-down (P&L + Balance Sheet). Requires dev server on :3000.
// Uses waitForURL (not text presence) to confirm each click actually navigated —
// text-based waits are unreliable here since breadcrumb labels repeat across levels.
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

async function clickAndConfirm(selector, expectedUrlSubstring, screenshotPath) {
  await page.click(selector);
  await page.waitForURL((url) => url.toString().includes(expectedUrlSubstring));
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

// --- P&L drill-down: EBITDA -> Opex -> Marketing -> Advertisements -> GL transactions ---
await page.goto("http://localhost:3000/pl?territory=1&year=2023", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/pl-summary.png", fullPage: true });

await clickAndConfirm('a:has-text("Opex")', "root=opex", "/tmp/pl-opex.png");
await clickAndConfirm('a:has-text("Marketing")', "subClass2=Marketing", "/tmp/pl-opex-marketing.png");
await clickAndConfirm('a:has-text("Advertisements")', "account=Advertisements", "/tmp/pl-opex-marketing-advertisements.png");

console.log("PL drill URL:", page.url());

// --- Balance Sheet drill-down: Assets -> a sub-category -> account -> GL transactions ---
await page.goto("http://localhost:3000/balance-sheet?territory=1&year=2023", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/bs-summary.png", fullPage: true });

await clickAndConfirm('a:has-text("Assets")', "root=assets", "/tmp/bs-assets.png");

console.log("BS drill URL:", page.url());
console.log("CONSOLE ERRORS:", JSON.stringify(errors));

await browser.close();
