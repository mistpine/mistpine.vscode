/**
 * Writes the README banner, the GitHub social preview and the extension
 * icon with @mistpine/port-kit: the mistpine lockup with the `.vscode`
 * suffix in brightYellow (docs/brand.md in mistpine/mistpine).
 *
 *   pnpm banner
 *
 * The VS Code Marketplace doesn't show SVG images in a README, so the
 * banner is also drawn as assets/banner.png, which the README uses. The
 * icon is the mistpine avatar (assets/logo/avatar.svg in mistpine/mistpine,
 * read from $MISTPINE_DIR, ../mistpine or GitHub) at 256×256. The PNGs are
 * drawn by Chromium (CHROMIUM overrides playwright's).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSpec } from "@mistpine/port-kit";
import { writeBanners } from "@mistpine/port-kit/banner";
import { chromium } from "playwright-core";

const ROOT = join(import.meta.dirname, "..");
const ASSETS = join(ROOT, "assets");
mkdirSync(ASSETS, { recursive: true });
const { spec } = await loadSpec(ROOT);
await writeBanners(ASSETS, {
  palette: spec.palette,
  ansi: spec.ansi.map((t) => t.hex),
  suffix: ".vscode",
  accent: "brightYellow",
  label: "mistpine.vscode: the mistpine color scheme for VS Code and Cursor",
});

async function avatar(): Promise<string> {
  const local = join(
    process.env.MISTPINE_DIR ?? join(ROOT, "..", "mistpine"),
    "assets",
    "logo",
    "avatar.svg",
  );
  if (existsSync(local)) return readFileSync(local, "utf8");
  const url = "https://raw.githubusercontent.com/mistpine/mistpine/main/assets/logo/avatar.svg";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not download ${url}: HTTP ${res.status}`);
  return res.text();
}

/** Draws an SVG to a PNG of `width` CSS pixels at `scale`, on a transparent background. */
async function png(svg: string, width: number, scale: number, out: string): Promise<void> {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  try {
    const page = await browser.newPage({ deviceScaleFactor: scale });
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:auto}</style>${svg}`,
    );
    const el = await page.$("svg");
    if (!el) throw new Error("no svg on the page");
    writeFileSync(out, await el.screenshot({ omitBackground: true }));
  } finally {
    await browser.close();
  }
}

await png(readFileSync(join(ASSETS, "banner.svg"), "utf8"), 1280, 2, join(ASSETS, "banner.png"));
await png(await avatar(), 256, 1, join(ASSETS, "icon.png"));
console.log(
  "wrote assets/banner.svg, banner.png, icon.png, social-preview.svg and social-preview.png",
);
