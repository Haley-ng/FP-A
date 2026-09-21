import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000/cash-flow?territory=1&year=2023", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/cashflow-usa-2023.png", fullPage: true });

await page.goto("http://localhost:3000/?territory=1&year=2023", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/eo-with-ocf.png", fullPage: true });

console.log("CONSOLE ERRORS:", JSON.stringify(errors));
await browser.close();
