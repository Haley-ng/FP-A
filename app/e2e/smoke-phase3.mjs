import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000/budget-vs-actual?territory=1&year=2023", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/bva.png", fullPage: true });

// Click Generate Commentary and confirm the graceful "unavailable" state renders (no API key configured)
await page.click('button:has-text("Generate Commentary")');
await page.waitForSelector("text=unavailable", { timeout: 15000 });
await page.screenshot({ path: "/tmp/bva-commentary.png", fullPage: true });

await page.goto("http://localhost:3000/variance-analysis?year=2023", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/variance-analysis.png", fullPage: true });

console.log("CONSOLE ERRORS:", JSON.stringify(errors));
await browser.close();
