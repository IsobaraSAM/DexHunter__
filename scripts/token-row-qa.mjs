// Visual + layout checks for the compact token row across feeds and viewports.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.QA_URL || "http://127.0.0.1:8080/";
const outDir = "/workspace/screenshots/token-row";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const viewports = [
  { name: "w320", width: 320, height: 720 },
  { name: "w390", width: 390, height: 844 },
  { name: "w768", width: 768, height: 1024 },
  { name: "w1024", width: 1024, height: 800 },
  { name: "w1280", width: 1280, height: 800 },
  { name: "w1440", width: 1440, height: 900 },
];

const feeds = [
  { id: "trending", tab: "#tab_trending" },
  { id: "latest", tab: "#tab_latest" },
  { id: "mints", tab: "#tab_fresh_mints" },
];

function px(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const row = document.querySelector("[data-token-row]");
    const overflow = doc.scrollWidth - doc.clientWidth;
    if (!row) {
      return {
        hasRow: false,
        overflow,
        body: (document.body?.innerText || "").slice(0, 400),
        table: Boolean(document.querySelector("table")),
      };
    }
    const cs = getComputedStyle(row);
    const logo = row.querySelector(".token-row-logo");
    const badge = row.querySelector(".token-row-chain");
    const symbol = row.querySelector(".token-row-symbol");
    const name = row.querySelector(".token-row-name");
    const price = row.querySelector(".token-row-price");
    const pct = row.querySelector(".token-row-pct");
    const line2 = row.querySelector(".token-row-line2");
    const metric = row.querySelector(".token-row-metric");
    const icon = row.querySelector(".token-row-icon");
    const socials = row.querySelector(".token-row-socials");
    const divider = row.querySelector(".token-row-divider");
    const social = row.querySelector(".token-row-social");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
        fontSize: s.fontSize,
        gap: s.gap,
        marginTop: s.marginTop,
      };
    };
    const rowBox = row.getBoundingClientRect();
    const line2Box = line2?.getBoundingClientRect();
    const pctBox = pct?.getBoundingClientRect();
    const socialInLine2 = Boolean(socials && line2?.contains(socials));
    const line2Overflow = line2 ? line2.scrollWidth - line2.clientWidth : 0;
    return {
      hasRow: true,
      overflow,
      rowH: Math.round(rowBox.height * 100) / 100,
      rowW: Math.round(rowBox.width * 100) / 100,
      padL: cs.paddingLeft,
      padR: cs.paddingRight,
      logo: box(logo),
      badge: box(badge),
      symbol: box(symbol),
      symbolText: symbol?.textContent || "",
      symbolOverflow: symbol ? symbol.scrollWidth - symbol.clientWidth : 0,
      name: box(name),
      price: box(price),
      pct: box(pct),
      line2: box(line2),
      metric: box(metric),
      icon: box(icon),
      social: box(social),
      socialsGap: socials ? getComputedStyle(socials).gap : null,
      divider: box(divider),
      socialInLine2,
      gapBelowPct: pctBox && line2Box ? Math.round((line2Box.top - pctBox.bottom) * 100) / 100 : null,
      line2Overflow,
      rowCount: document.querySelectorAll("[data-token-row]").length,
    };
  });
}

const results = [];

for (const theme of ["dark", "light"]) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    await context.addInitScript((mode) => {
      localStorage.setItem("dexhunter_view_mode", "compact");
      localStorage.setItem("theme_mode", mode);
      localStorage.setItem("theme", mode);
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err).slice(0, 300)));
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);
    // Only walk feeds on the primary mobile + desktop widths to keep runtime sane.
    const feedList = vp.name === "w390" || vp.name === "w1440" ? feeds : [feeds[0]];
    for (const feed of feedList) {
      if (feed.id !== "trending") {
        await page.click(feed.tab);
        await page.waitForTimeout(800);
      }
      try {
        await page.waitForSelector("[data-token-row], table tbody tr, text=No tokens", { timeout: 20000 });
      } catch {
        /* record empty */
      }
      await page.waitForTimeout(400);
      const metrics = await measure(page);
      const shot = `${outDir}/${theme}-${vp.name}-${feed.id}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      results.push({ theme, viewport: vp.name, width: vp.width, feed: feed.id, errors, metrics, shot });
    }
    await context.close();
  }
}

// Cards mode, both themes, mobile + desktop, trending only.
for (const theme of ["dark", "light"]) {
  for (const vp of [
    { name: "w390", width: 390, height: 844 },
    { name: "w1440", width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript((mode) => {
      localStorage.setItem("dexhunter_view_mode", "cards");
      localStorage.setItem("theme_mode", mode);
      localStorage.setItem("theme", mode);
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err).slice(0, 300)));
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const shot = `${outDir}/cards-${theme}-${vp.name}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    results.push({ theme, viewport: vp.name, mode: "cards", overflow, errors, shot });
    await context.close();
  }
}

await browser.close();
const summary = results.map((r) => ({
  theme: r.theme,
  viewport: r.viewport,
  width: r.width,
  feed: r.feed || "cards",
  mode: r.mode || "compact",
  overflow: r.metrics?.overflow ?? r.overflow,
  rowH: r.metrics?.rowH ?? null,
  hasRow: r.metrics?.hasRow ?? false,
  logo: r.metrics?.logo,
  badge: r.metrics?.badge,
  priceFs: r.metrics?.price?.fontSize,
  pctFs: r.metrics?.pct?.fontSize,
  metricFs: r.metrics?.metric?.fontSize,
  icon: r.metrics?.icon,
  social: r.metrics?.social,
  socialsGap: r.metrics?.socialsGap,
  socialInLine2: r.metrics?.socialInLine2,
  gapBelowPct: r.metrics?.gapBelowPct,
  line2Overflow: r.metrics?.line2Overflow,
  symbolOverflow: r.metrics?.symbolOverflow,
  symbol: r.metrics?.symbolText,
  pad: r.metrics ? `${r.metrics.padL}/${r.metrics.padR}` : null,
  errors: r.errors,
  shot: r.shot,
}));
console.log(JSON.stringify(summary, null, 2));
