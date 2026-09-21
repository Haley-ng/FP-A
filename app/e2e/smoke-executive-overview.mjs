// Smoke test for the Executive Overview page (Phase 1). Requires the dev
// server already running on :3000 (`npm run dev`). Not a full test suite —
// proves the filter round-trip and currency switch actually render without
// console errors, following the repo's own "run and drive it" convention.
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector("text=Executive Overview");
await page.screenshot({ path: "/tmp/eo-default.png", fullPage: true });

// Step 1: select Germany + FY2023 (currency stays disabled until reload)
await page.selectOption('select[name="territory"]', "4");
await page.selectOption('select[name="year"]', "2023");
await page.click('button:has-text("Apply")');
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Executive Overview");
await page.screenshot({ path: "/tmp/eo-germany-usd.png", fullPage: true });

// Step 2: now that territory=4 is applied, currency select should be enabled
await page.selectOption('select[name="currency"]', "local");
await page.click('button:has-text("Apply")');
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Executive Overview");
await page.screenshot({ path: "/tmp/eo-germany-local.png", fullPage: true });

console.log("CONSOLE ERRORS:", JSON.stringify(errors));
console.log("URL after filter:", page.url());

await browser.close();
