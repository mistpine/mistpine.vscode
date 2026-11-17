/**
 * Runs inside the render container (scripts/render.ts starts it): opens
 * VS Code or Cursor on the sample repository once per scene, drives it over
 * the Chrome DevTools Protocol and saves a screenshot of each.
 *
 *   node scripts/render/drive.ts <app> <scene…>
 *
 * The app is /app/<app>, the sample repository /work/fog, the installed
 * extension /work/extensions. Screenshots go to /work/out/<scene>.png, with
 * a raw RGB dump next to each for the pixel checks (<scene>.rgb and .size).
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { type Browser, type CDPSession, chromium, type Page } from "playwright-core";

const [appName, ...wanted] = process.argv.slice(2);
if (appName !== "code" && appName !== "cursor")
  throw new Error("usage: drive.ts code|cursor <scene…>");

const OUT = "/work/out";
mkdirSync(OUT, { recursive: true });

const SETTINGS = {
  "workbench.colorTheme": "mistpine",
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "workbench.editor.empty.hint": "hidden",
  "workbench.layoutControl.enabled": false,
  "window.commandCenter": true,
  "window.restoreWindows": "none",
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoCheckUpdates": false,
  "extensions.autoUpdate": false,
  "extensions.ignoreRecommendations": true,
  "chat.disableAIFeatures": appName === "code",
  "chat.commandCenter.enabled": false,
  "security.workspace.trust.enabled": false,
  "git.openRepositoryInParentFolders": "never",
  "git.autofetch": false,
  "git.decorations.enabled": true,
  "scm.diffDecorations": "all",
  "editor.fontFamily": "'JetBrains Mono', monospace",
  "editor.fontSize": 14,
  "editor.lineHeight": 22,
  "editor.minimap.enabled": false,
  "editor.cursorBlinking": "solid",
  "editor.guides.bracketPairs": false,
  "editor.inlayHints.enabled": "off",
  "editor.stickyScroll.enabled": false,
  "editor.accessibilitySupport": "off",
  "editor.lightbulb.enabled": "off",
  "editor.hover.delay": 100,
  "diffEditor.renderSideBySide": true,
  "diffEditor.hideUnchangedRegions.enabled": false,
  "terminal.integrated.fontFamily": "'JetBrains Mono'",
  "terminal.integrated.fontSize": 14,
  "terminal.integrated.cursorBlinking": false,
  "terminal.integrated.shellIntegration.enabled": false,
  "terminal.integrated.defaultProfile.linux": "fog",
  "terminal.integrated.profiles.linux": {
    fog: { path: "bash", args: ["--rcfile", "/repo/scripts/render/prompt.bashrc"] },
  },
  "markdown.preview.fontSize": 14,
  "python.languageServer": "None",
  "files.exclude": { "**/.git": true, "**/__pycache__": true },
  "cursor.general.disableHttp2": true,
};

interface Scene {
  /** CSS pixels; screenshots are taken at twice that. */
  width: number;
  height: number;
  /** Files to open, relative to the sample repository; the last one is active. */
  files: string[];
  act?: (page: Page) => Promise<void>;
}

// ------------------------------------------------------------------ helpers

const key = (page: Page, combo: string) => page.keyboard.press(combo);

/** Runs a command from the command palette, by its title. */
async function command(page: Page, title: string): Promise<void> {
  await key(page, "F1");
  await page.waitForSelector(
    ".quick-input-widget:not([style*='display: none']) .quick-input-box input",
  );
  await page.keyboard.type(title, { delay: 10 });
  await sleep(400);
  await key(page, "Enter");
  await sleep(600);
}

/**
 * Cursor opens behind a full-window sign-in screen (its AI features need an
 * account). The workbench is loaded underneath; take the overlay out of the
 * page so the screenshot shows the editor as it is when signed out.
 */
async function hideSignIn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const overlay = document.querySelector(".onboarding-v2-overlay");
    let top: Element | null = overlay;
    while (top?.parentElement && !top.parentElement.classList.contains("monaco-workbench"))
      top = top.parentElement;
    top?.remove();
    document.querySelector(".monaco-workbench")?.classList.remove("modal-dialog-visible");
  });
  await sleep(500);
}

/** Opens a file of the sample repository through Quick Open, making it the active editor. */
async function open(page: Page, file: string): Promise<void> {
  await key(page, "Control+P");
  await page.waitForSelector(
    ".quick-input-widget:not([style*='display: none']) .quick-input-box input",
  );
  await page.keyboard.type(file, { delay: 10 });
  await sleep(600);
  await key(page, "Enter");
  await sleep(800);
}

/** Moves the cursor to a line and column (1-based) from the top of the file, without scrolling it. */
async function cursorTo(page: Page, line: number, column = 1): Promise<void> {
  await key(page, "Control+Home");
  for (let i = 1; i < line; i++) await key(page, "ArrowDown");
  await key(page, "Home");
  for (let i = 1; i < column; i++) await key(page, "ArrowRight");
  await sleep(300);
}

/** Moves the cursor to a line and column (1-based) through Go to Line. */
async function goTo(page: Page, line: number, column = 1): Promise<void> {
  await key(page, "Control+G");
  await page.waitForSelector(
    ".quick-input-widget:not([style*='display: none']) .quick-input-box input",
  );
  await page.keyboard.type(`${line}:${column}`, { delay: 10 });
  await key(page, "Enter");
  await sleep(300);
}

/** Types a command into the terminal and waits for it to print. */
async function shell(page: Page, line: string, wait = 800): Promise<void> {
  await page.keyboard.type(line, { delay: 5 });
  await key(page, "Enter");
  await sleep(wait);
}

/** Waits until the TypeScript server has colored the file (semantic tokens). */
async function semanticTokens(page: Page): Promise<void> {
  // The language server needs a moment on a cold start; there is no event for it.
  await sleep(6000);
  await page.mouse.move(1, 1);
}

// ------------------------------------------------------------------ scenes

const SCENES: Record<string, Scene> = {
  // The README image: the editor on forecast.ts with the explorer, git
  // decorations, a word highlight and the terminal.
  preview: {
    width: 1400,
    height: 900,
    files: ["fog/forecast.py", "README.md", "src/forecast.ts"],
    async act(page) {
      await command(page, "View: Show Explorer");
      await semanticTokens(page);
      await key(page, "Control+`");
      await sleep(1500);
      await shell(page, "git --no-pager log --oneline --graph --decorate -6 --color=always", 1200);
      await shell(page, "git status --short", 800);
      await key(page, "Control+1");
      await cursorTo(page, 15, 9);
      await sleep(800);
    },
  },
  python: {
    width: 1200,
    height: 800,
    files: ["fog/forecast.py"],
    async act(page) {
      await command(page, "View: Show Explorer");
      await goTo(page, 26, 9);
      await sleep(800);
    },
  },
  diff: {
    width: 1200,
    height: 800,
    files: ["fog/forecast.py"],
    async act(page) {
      await command(page, "View: Show Source Control");
      await sleep(1500);
      await page.click(".scm-view .monaco-list-row:has-text('forecast.py')");
      await sleep(2000);
    },
  },
  palette: {
    width: 1200,
    height: 800,
    files: ["src/forecast.ts"],
    async act(page) {
      await command(page, "View: Show Explorer");
      await semanticTokens(page);
      // Preferences: Color Theme, by its keybinding (its title also matches
      // the Marketplace theme browser).
      await key(page, "Control+K");
      await key(page, "Control+T");
      await sleep(800);
      await page.keyboard.type("mist", { delay: 20 });
      await sleep(800);
    },
  },
  completion: {
    width: 1200,
    height: 800,
    files: ["src/forecast.ts"],
    async act(page) {
      await command(page, "View: Show Explorer");
      await semanticTokens(page);
      await goTo(page, 30, 5);
      await key(page, "End");
      await key(page, "Enter");
      await page.keyboard.type("reading.", { delay: 40 });
      await sleep(1500);
    },
  },
  find: {
    width: 1200,
    height: 800,
    files: ["fog/forecast.py"],
    async act(page) {
      await command(page, "View: Show Explorer");
      await key(page, "Control+F");
      await page.keyboard.type("reading", { delay: 20 });
      await sleep(400);
      await key(page, "Enter");
      await sleep(600);
    },
  },
  markdown: {
    width: 1200,
    height: 800,
    files: ["README.md"],
    async act(page) {
      await command(page, "Markdown: Open Preview to the Side");
      await sleep(2500);
      await key(page, "Control+1");
      await sleep(300);
    },
  },
  terminal: {
    width: 1200,
    height: 800,
    files: ["fog/forecast.py"],
    async act(page) {
      await key(page, "Control+`");
      await sleep(1500);
      await command(page, "View: Toggle Maximized Panel");
      await sleep(500);
      await shell(page, "bash /repo/scripts/render/palette.sh", 1200);
      await shell(page, "git --no-pager diff --color=always --stat; ls --color=always", 800);
    },
  },
  // Cursor: the editor beside its agent panel. (Its Show Explorer leaves an
  // empty side bar while signed out, so this scene doesn't open it.)
  agent: {
    width: 1400,
    height: 900,
    files: ["src/forecast.ts"],
    async act(page) {
      await semanticTokens(page);
      await goTo(page, 15, 9);
      await sleep(800);
    },
  },
};

// ------------------------------------------------------------------ driver

interface Session {
  browser: Browser;
  page: Page;
  cdp: CDPSession;
  stop: () => void;
}

async function launch(scene: string, spec: Scene): Promise<Session> {
  const data = `/work/data-${scene}`;
  rmSync(data, { recursive: true, force: true });
  mkdirSync(`${data}/User`, { recursive: true });
  writeFileSync(`${data}/User/settings.json`, JSON.stringify(SETTINGS, null, 2));
  const port = 9222;
  const app = spawn(
    `/app/${appName}`,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-updates",
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-workspace-trust",
      "--disable-telemetry",
      "--no-cached-data",
      `--user-data-dir=${data}`,
      "--extensions-dir=/work/extensions",
      `--remote-debugging-port=${port}`,
      "/work/fog",
      ...spec.files.map((f) => `/work/fog/${f}`),
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
      detached: true,
      env: { ...process.env, VSCODE_CLI: "" },
    },
  );
  const stop = () => {
    try {
      process.kill(-(app.pid as number), "SIGKILL");
    } catch {}
  };

  let browser: Browser | undefined;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => undefined);
  }
  if (!browser) throw new Error(`${scene}: the app never opened its DevTools port`);

  let page: Page | undefined;
  for (let i = 0; i < 60 && !page; i++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().includes("workbench"));
    if (!page) await sleep(500);
  }
  if (!page) throw new Error(`${scene}: no workbench window`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: spec.width,
    height: spec.height,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.waitForSelector(".monaco-workbench .part.editor", { timeout: 60_000 });
  // Let the workbench restore the editors and the extensions activate.
  await sleep(4000);
  return { browser, page, cdp, stop };
}

const names = wanted.length ? wanted : Object.keys(SCENES);
for (const name of names) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`unknown scene ${name}`);
  const { browser, page, cdp, stop } = await launch(name, scene);
  try {
    const active = scene.files.at(-1);
    const play = async () => {
      if (appName === "cursor") await hideSignIn(page);
      if (active) await open(page, active);
      await scene.act?.(page);
    };
    await play().catch(async (error: unknown) => {
      // What the app showed when the scene went wrong, for debugging.
      const shot = (await cdp.send("Page.captureScreenshot", { format: "png" })) as {
        data: string;
      };
      writeFileSync(`${OUT}/${name}-error.png`, Buffer.from(shot.data, "base64"));
      throw error;
    });
    const file = `${OUT}/${name}.png`;
    // CDP's own capture keeps the 2× device scale (Playwright's resets it).
    const shot = (await cdp.send("Page.captureScreenshot", { format: "png" })) as { data: string };
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    const size = execFileSync("identify", ["-format", "%w %h", file], { encoding: "utf8" });
    execFileSync("convert", [file, "-depth", "8", `rgb:${OUT}/${name}.rgb`]);
    writeFileSync(`${OUT}/${name}.size`, size);
    console.log(`${name}: ${size}`);
  } finally {
    await browser.close().catch(() => {});
    stop();
    await sleep(500);
  }
}
