import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  buildMockHealth,
  buildMockLeaderboard,
  buildMockPremiumSpinStatus,
  buildMockSession,
  buildMockTournament
} from "./mock-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(__dirname, "output");
const VIEWPORT = { width: 1080, height: 1920 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};

function startStaticServer(port = 8765) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      let filePath = path.join(ROOT, safePath === "/" ? "v5.html" : safePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function installRoutes(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (url.includes("/health")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockHealth())
      });
    }

    if (url.includes("/api/session")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockSession())
      });
    }

    if (url.includes("/api/leaderboard")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockLeaderboard())
      });
    }

    if (url.includes("/api/tournaments/active") || url.includes("/api/tournaments/leaderboard")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockTournament())
      });
    }

    if (url.includes("/api/premium-spin")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockPremiumSpinStatus())
      });
    }

    if (url.includes("/api/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    }

    return route.continue();
  });
}

async function preparePage(page) {
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "preview=1",
        initDataUnsafe: {
          user: {
            id: 999001,
            first_name: "Wealthia",
            username: "wealthia_player"
          }
        },
        ready() {},
        expand() {},
        disableVerticalSwipes() {},
        close() {},
        openInvoice() {},
        themeParams: {
          bg_color: "#0b0f1a",
          text_color: "#ffffff",
          button_color: "#f5c842"
        },
        colorScheme: "dark"
      }
    };

    try {
      localStorage.setItem("wealthia_onboarding_v1", "done");
      sessionStorage.setItem("wealthia_msg_backend-connected", String(Date.now()));
    } catch {
      // ignore
    }
  });
}

async function polishForCapture(page, options = {}) {
  if (!options.keepOverlays) {
    await closeOverlays(page);
  }
  await page.evaluate(() => {
    const hide = (selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.style.setProperty("display", "none", "important");
      });
    };

    hide("#syncBar");
    hide(".sync-bar");
    hide(".toast");
    hide("#offlineModal");
    hide("#onboarding");
    hide("#channelGateModal");
    hide(".rank-offline-note");

    document.body.classList.remove("channel-gate-active", "premium-spin-open-body");
  });
}

async function closeOverlays(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById("premiumSpinOverlay");
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("premium-spin-open-body");
  });
}

async function clickTab(page, tabId) {
  await closeOverlays(page);
  await page.click(`[data-tab="${tabId}"]`, { timeout: 10000 });
  await page.waitForTimeout(900);
}

async function capture(page, name, options = {}) {
  await polishForCapture(page, options);
  const file = path.join(OUTPUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`Saved ${file}`);
}

const SHOTS = [
  {
    name: "01-main-tap",
    async run(page) {
      await clickTab(page, "mainPanel");
    }
  },
  {
    name: "02-main-empire",
    async run(page) {
      await clickTab(page, "mainPanel");
      await page.evaluate(() => {
        const level = document.getElementById("empireLevel");
        const city = document.getElementById("cityValue");
        if (level) level.textContent = "18";
        if (city) city.textContent = "440,500";
      });
    }
  },
  {
    name: "03-city-build",
    async run(page) {
      await clickTab(page, "cityPanel");
    }
  },
  {
    name: "04-city-casino-spin",
    async run(page) {
      await clickTab(page, "cityPanel");
      await page.evaluate(() => {
        const spin = document.getElementById("casinoSpinCard");
        const premium = document.getElementById("premiumSpinCard");
        if (spin) spin.hidden = false;
        if (premium) premium.hidden = false;
      });
    }
  },
  {
    name: "05-rank-podium",
    async run(page) {
      await clickTab(page, "rankPanel");
      await page.waitForTimeout(1200);
    }
  },
  {
    name: "06-tasks",
    async run(page) {
      await clickTab(page, "tasksPanel");
    }
  },
  {
    name: "07-earn",
    async run(page) {
      await clickTab(page, "earnPanel");
    }
  },
  {
    name: "08-friends",
    async run(page) {
      await clickTab(page, "friendsPanel");
    }
  },
  {
    name: "09-premium-wheel",
    captureOptions: { keepOverlays: true },
    async run(page) {
      await clickTab(page, "cityPanel");
      await page.evaluate(() => {
        const premium = document.getElementById("premiumSpinCard");
        if (premium) premium.hidden = false;
      });
      await page.click("#premiumSpinOpenButton");
      await page.waitForTimeout(1000);
    }
  },
  {
    name: "10-gold-rush",
    async run(page) {
      await clickTab(page, "mainPanel");
      await page.evaluate(() => {
        const mount = document.getElementById("goldRushMount");
        if (!mount) return;
        mount.innerHTML = `
          <article class="gold-rush-banner gold-rush-banner--active">
            <div class="gold-rush-banner__glow" aria-hidden="true"></div>
            <div class="gold-rush-banner__content">
              <span class="gold-rush-banner__badge">Gold Rush</span>
              <strong>2x Tap Power · 12m left</strong>
              <p>Tap fast while the rush is live!</p>
            </div>
          </article>
        `;
      });
    }
  },
  {
    name: "11-daily-prize",
    async run(page) {
      await clickTab(page, "rankPanel");
      await page.waitForTimeout(800);
    }
  },
  {
    name: "12-lucky-spin",
    async run(page) {
      await clickTab(page, "cityPanel");
      await page.evaluate(() => {
        const spin = document.getElementById("casinoSpinCard");
        if (spin) spin.hidden = false;
      });
      await page.locator("#casinoSpinCard").scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
  }
];

async function recordDemoVideo(page) {
  const videoDir = path.join(OUTPUT, "video-frames");
  fs.mkdirSync(videoDir, { recursive: true });

  const sequence = [
    ["mainPanel", 1800],
    ["cityPanel", 1800],
    ["rankPanel", 2200],
    ["tasksPanel", 1600],
    ["earnPanel", 1600],
    ["friendsPanel", 1600],
    ["cityPanel", 1200]
  ];

  for (const [tabId, delay] of sequence) {
    await clickTab(page, tabId);
    if (tabId === "cityPanel" && delay === 1200) {
      await page.click("#premiumSpinOpenButton").catch(() => {});
      await page.waitForTimeout(1200);
      await page.keyboard.press("Escape").catch(() => {});
      await page.evaluate(() => {
        const overlay = document.getElementById("premiumSpinOverlay");
        if (overlay) overlay.hidden = true;
        document.body.classList.remove("premium-spin-open-body");
      });
    }
    await page.waitForTimeout(delay);
  }
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });

  const server = await startStaticServer(8765);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      colorScheme: "dark",
      recordVideo: {
        dir: OUTPUT,
        size: VIEWPORT
      }
    });

    const page = await context.newPage();
    await installRoutes(page);
    await preparePage(page);

    await page.goto("http://127.0.0.1:8765/v5.html?preview=1", {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(2500);

    for (const shot of SHOTS) {
      await shot.run(page);
      await capture(page, shot.name, shot.captureOptions || {});
    }

    await recordDemoVideo(page);
    await page.waitForTimeout(800);

    const video = page.video();
    await context.close();

    if (video) {
      const webmPath = path.join(OUTPUT, "wealthia-demo.webm");
      await video.saveAs(webmPath);
      console.log(`Saved ${webmPath}`);

      const mp4Path = path.join(OUTPUT, "wealthia-demo.mp4");
      const ffmpeg = spawnSync("ffmpeg", [
        "-y",
        "-i",
        webmPath,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        mp4Path
      ], { stdio: "ignore" });

      if (ffmpeg.status === 0) {
        console.log(`Saved ${mp4Path}`);
      }
    }

    const zipPath = path.join(__dirname, "wealthia-telegram-preview.zip");
    spawnSync("zip", ["-j", zipPath, ...fs.readdirSync(OUTPUT)
      .filter((name) => /\.(png|mp4|webm|md)$/i.test(name))
      .map((name) => path.join(OUTPUT, name))], { stdio: "ignore" });
    if (fs.existsSync(zipPath)) {
      console.log(`Saved ${zipPath}`);
    }

    writeReadme();
    console.log("\nDone! Upload files from preview/output/ to Telegram BotFather preview.");
  } finally {
    await browser.close();
    server.close();
  }
}

function writeReadme() {
  const readme = `# Wealthia — Telegram Mini App Preview Media

Bu qovluqda BotFather / Telegram Developer panelində **Önizleme** bölməsinə yükləmək üçün hazır fayllar var.

## Fayllar

### 12 ekran görüntüsü (PNG, 1080×1920)
1. \`01-main-tap.png\` — Əsas ekran, TAP
2. \`02-main-empire.png\` — İmperiya statistikası
3. \`03-city-build.png\` — Şəhər tikintisi
4. \`04-city-casino-spin.png\` — Casino, Lucky Spin, Premium Spin
5. \`05-rank-podium.png\` — Gündəlik yarış podyumu
6. \`06-tasks.png\` — Tapşırıqlar
7. \`07-earn.png\` — Qazanma / VIP Earn
8. \`08-friends.png\` — Dost dəvəti
9. \`09-premium-wheel.png\` — Premium çarx
10. \`10-gold-rush.png\` — Gold Rush
11. \`11-daily-prize.png\` — Gündəlik $10 mükafat
12. \`12-lucky-spin.png\` — Lucky Spin kartı

### Video
- \`wealthia-demo.mp4\` — Telegram-a yükləmək üçün tövsiyə olunur
- \`wealthia-demo.webm\` — ehtiyat format

### Hamısı bir ZIP-də
- \`../wealthia-telegram-preview.zip\`

## Telegram-a necə yükləmək olar

1. Telegram-da **@BotFather** aç (və ya Developer panelində Wealthia botu)
2. **Bot Settings → Configure Mini App → Preview** (Önizleme)
3. **Önizleme Ekle** düyməsinə bas
4. 12 şəkli sıra ilə yüklə **və ya** bir video yüklə
5. Dil: **Ana** (default) kifayətdir; istəsən **Azərbaycan** üçün tərcümə də əlavə edə bilərsən

## Yenidən yaratmaq

\`\`\`bash
cd preview
npm install
npm run generate
\`\`\`

## Qeyd

Şəkillər demo məlumatlarla (mock API) yaradılır — real oyunçu adları və xallar nümunədir.
Canlı oyundan çəkmək istəsən, oyunu telefonda açıb ekran görüntüsü də edə bilərsən.
`;

  fs.writeFileSync(path.join(OUTPUT, "README-AZ.md"), readme, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
