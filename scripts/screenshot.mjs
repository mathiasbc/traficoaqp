#!/usr/bin/env node
/**
 * Takes screenshots of the app for the README.
 * Run with: node scripts/screenshot.mjs
 * Requires: dev server running on localhost:3000
 */
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "..", "screenshots");

const browser = await chromium.launch();
const page = await browser.newPage();

// Mobile viewport (matches typical phone)
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

// Wait for map to load
await page.waitForSelector(".leaflet-container", { timeout: 10000 }).catch(() => {});

// Screenshot 1: Main view (above the fold)
await page.screenshot({
  path: path.join(screenshotsDir, "main.png"),
  fullPage: false,
});

// Scroll down to show route cards
await page.evaluate(() => window.scrollTo(0, 400));

// Screenshot 2: Route cards + chart
await page.screenshot({
  path: path.join(screenshotsDir, "routes.png"),
  fullPage: false,
});

// Scroll back up and take full page
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({
  path: path.join(screenshotsDir, "full.png"),
  fullPage: true,
});

await browser.close();
console.log("Screenshots saved to", screenshotsDir);
