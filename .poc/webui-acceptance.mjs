import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = "http://localhost:5174";
const routes = [
  { name: "projects", path: "/" },
  { name: "kanban", path: "/projects/p1" },
  { name: "task-detail", path: "/tasks/t1" },
  { name: "events", path: "/events" },
  { name: "agents", path: "/agents" },
  { name: "handoff", path: "/handoff" },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "small-desktop", width: 1024, height: 768 },
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
];

const outRoot = path.resolve(".agent/reports/assets/webui-acceptance");
const dateTag = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(outRoot, dateTag);
await fs.mkdir(runDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();

const logs = [];
const failures = [];

page.on("console", (msg) => {
  const type = msg.type();
  if (type === "error" || type === "warning") {
    logs.push({ type, text: msg.text(), url: page.url() });
  }
});

page.on("pageerror", (err) => {
  failures.push({ type: "pageerror", message: err.message, url: page.url() });
});

page.on("response", (res) => {
  const status = res.status();
  if (status >= 400) {
    failures.push({ type: "http", status, url: res.url() });
  }
});

async function visitAndCapture(route, viewport) {
  await page.setViewport(viewport);
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(400);
  const file = `${route.name}-${viewport.name}.png`;
  await page.screenshot({ path: path.join(runDir, file), fullPage: true });
}

for (const route of routes) {
  for (const viewport of viewports) {
    await visitAndCapture(route, viewport);
  }
}

// Basic interaction smoke checks
await page.setViewport(viewports[0]);
await page.goto(`${baseUrl}/`, { waitUntil: "networkidle2", timeout: 30000 });
if (await page.$("button")) {
  await page.click("button");
  await page.keyboard.press("Escape");
}
await page.click('a[href="/projects/p1"]');
await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
await page.click('a[href="/tasks/t1"]');
await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
await page.goBack({ waitUntil: "networkidle2" });
await page.goForward({ waitUntil: "networkidle2" });

// Keyboard shortcut checks
await page.keyboard.down("Meta");
await page.keyboard.press("k");
await page.keyboard.up("Meta");
await sleep(300);
await page.keyboard.press("Escape");
await page.keyboard.press("?");
await sleep(300);
await page.keyboard.press("Escape");

const report = {
  baseUrl,
  runDir,
  routes: routes.map((r) => r.path),
  viewports,
  logCount: logs.length,
  failureCount: failures.length,
  logs,
  failures,
  generatedAt: new Date().toISOString(),
};

const reportPath = path.join(runDir, "report.json");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
await browser.close();

console.log(JSON.stringify({ runDir, reportPath, logCount: logs.length, failureCount: failures.length }, null, 2));
