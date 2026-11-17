/**
 * Renders the README images from the real apps and checks their pixels:
 * assets/preview.png and assets/screenshots/*.png.
 *
 *   pnpm render              every scene in VS Code, the agent scene in Cursor
 *   pnpm render palette diff only these scenes
 *
 * The extension is packaged with vsce and installed into each app the way
 * a user would install the .vsix, then scripts/render/drive.ts opens the
 * app on a small sample git repository (scripts/render/sample, with a few
 * commits and an unstaged change) in Docker under Xvfb, once per scene.
 * Every screenshot must show the spec's colors where the theme puts them:
 * the surfaces, the syntax colors and the terminal palette.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSpec } from "@mistpine/port-kit";
import { type Expect, expectPixels, load } from "@mistpine/port-kit/pixels";
import { type App, cursor, ROOT, run, vscode } from "./lib/app.ts";

const WORK = join(ROOT, ".render");
const ASSETS = join(ROOT, "assets");
const { spec } = await loadSpec(ROOT);
/** A color from the spec, or an error naming what is missing. */
function hex(value: string | { hex: string } | undefined, what: string): string {
  const h = typeof value === "string" ? value : value?.hex;
  if (!h) throw new Error(`the spec has no ${what}`);
  return h.toLowerCase();
}
const pal = (name: string) => hex(spec.palette[name], `palette.${name}`);
const syn = (name: string) => hex(spec.syntax[name], `syntax.${name}`);
const ui = (name: string) => hex(spec.ui[name], `ui.${name}`);
const ansi = (i: number) => hex(spec.ansi[i], `ansi ${i}`);

// ---------------------------------------------------------------- sample repo

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "mistpine",
  GIT_AUTHOR_EMAIL: "mistpine@example.com",
  GIT_COMMITTER_NAME: "mistpine",
  GIT_COMMITTER_EMAIL: "mistpine@example.com",
};

/** A small git repo with a branch, a merge, a tag, an unstaged change and a new file. */
function sampleRepo(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(ROOT, "scripts", "render", "sample"), dir, { recursive: true });
  let clock = Date.parse("2026-10-12T09:00:00Z") / 1000;
  const git = (...args: string[]) => {
    clock += 5400;
    execFileSync("git", args, {
      cwd: dir,
      stdio: "ignore",
      env: { ...gitEnv, GIT_AUTHOR_DATE: `${clock} +0000`, GIT_COMMITTER_DATE: `${clock} +0000` },
    });
  };
  const edit = (file: string, from: string, to: string) => {
    const path = join(dir, file);
    const text = readFileSync(path, "utf8");
    if (!text.includes(from)) throw new Error(`sample: ${file} has no ${JSON.stringify(from)}`);
    writeFileSync(path, text.replace(from, to));
  };

  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "feat: record ridge readings");
  git("tag", "v0.1.0");
  git("switch", "-qc", "ridge-alerts");
  edit("fog/stations.py", '"ridge-01"', '"ridge-01",\n    "ridge-04"');
  git("commit", "-qam", "feat(stations): add ridge-04");
  git("switch", "-q", "main");
  edit("README.md", "## Limits", "## Limits\n\nReadings older than `max_age` are ignored.");
  git("commit", "-qam", "docs: explain reading age");
  git("merge", "-q", "--no-ff", "ridge-alerts", "-m", "merge: ridge alerts");
  git("tag", "v0.2.0");
  // Left in the working tree: a modified file (with an added, a changed and
  // a removed hunk) and an untracked one.
  edit("fog/forecast.py", "FOG_LIMIT = 1_000", "FOG_LIMIT = 800");
  edit(
    "fog/forecast.py",
    "    def record(self, reading: Reading) -> bool:",
    "    def forget(self, station: str) -> None:\n        self._seen.pop(station, None)\n\n    def record(self, reading: Reading) -> bool:",
  );
  edit("fog/forecast.py", "        now = now or datetime.now()\n", "");
  writeFileSync(join(dir, "fog", "alerts.py"), '"""Fog alerts for the ridge stations."""\n');
}

// ---------------------------------------------------------------- pixel checks

/**
 * What each screenshot must show, in exact spec colors. Minimums are about
 * half of what a good render has (screenshots are 2×). Text colors are
 * checked with a small tolerance: glyph edges are antialiased, their cores
 * are the color itself.
 */
const text = (label: string, hex: string, min = 150): Expect => ({ label, hex, min, tolerance: 4 });
const surface = (label: string, hex: string, min = 20_000): Expect => ({ label, hex, min });
/**
 * A translucent fill (diff, search): the theme's alpha lands within 3 of the
 * spec's blend (generate.ts checks that), and Chromium's compositing rounds
 * a step or two further.
 */
const tinted = (label: string, hex: string, min: number): Expect => ({
  label,
  hex,
  min,
  tolerance: 5,
});

const CHROME: Expect[] = [
  surface("editor (bg1)", pal("bg1"), 200_000),
  surface("side bar, title bar, tabs (bg0)", pal("bg0"), 100_000),
  surface("status bar (bg2)", pal("bg2"), 10_000),
];

const TS: Expect[] = [
  text("keywords (red)", syn("keyword")),
  text("functions (green, bold)", syn("function")),
  text("types (yellow)", syn("type")),
  text("properties and parameters (blue)", syn("property")),
  text("numbers and constants (purple)", syn("number"), 60),
  text("regex (cyan)", syn("regex"), 60),
  text("operators and builtins (orange)", syn("operator"), 40),
  text("comments (fg1)", syn("comment"), 60),
  text("punctuation (fg2)", syn("punctuation")),
  text("variables (fg3)", syn("variable")),
];

const EXPECT: Record<string, Expect[]> = {
  preview: [
    ...CHROME,
    ...TS,
    surface("current line (bg2)", pal("bg2"), 20_000),
    text("active line number (yellow)", pal("yellow")),
    text("terminal blue (ANSI 4)", ansi(4), 60),
    text("terminal magenta (ANSI 5)", ansi(5), 60),
  ],
  python: [...CHROME, ...TS.filter((e) => !e.label.startsWith("regex"))],
  diff: [
    surface("editor (bg1)", pal("bg1"), 100_000),
    tinted("added line (diffAdd)", ui("diffAdd"), 5_000),
    tinted("removed line (diffDelete)", ui("diffDelete"), 5_000),
  ],
  palette: [
    ...CHROME,
    surface("quick input (bg2)", pal("bg2"), 40_000),
    surface("focused item (bg3)", pal("bg3"), 5_000),
    text("matched characters (orange)", pal("orange"), 40),
  ],
  completion: [
    ...CHROME,
    surface("suggest widget (bg2)", pal("bg2"), 20_000),
    surface("selected item (bg3)", pal("bg3"), 3_000),
  ],
  find: [
    ...CHROME,
    surface("current match (orange)", pal("orange"), 1_000),
    tinted("other matches (searchBg)", ui("searchBg"), 1_000),
  ],
  markdown: [
    surface("editor (bg1)", pal("bg1"), 200_000),
    text("headings (green)", syn("heading")),
    text("links (cyan)", syn("link"), 60),
  ],
  terminal: [
    surface("terminal (bg1)", pal("bg1"), 100_000),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) =>
      surface(`ANSI ${i}`, ansi(i), 3_000),
    ),
  ],
  agent: [
    surface("editor and agent panel (bg1)", pal("bg1"), 200_000),
    surface("title bar and tabs (bg0)", pal("bg0"), 20_000),
    surface("status bar (bg2)", pal("bg2"), 10_000),
    ...TS.slice(0, 4),
  ],
};

// ---------------------------------------------------------------- run

const SCENES: Record<App["id"], string[]> = {
  vscode: ["preview", "python", "diff", "palette", "completion", "find", "markdown", "terminal"],
  cursor: ["agent"],
};

const wanted = process.argv.slice(2);
mkdirSync(join(WORK), { recursive: true });
const vsix = join(WORK, "mistpine.vsix");
execFileSync(
  join(ROOT, "node_modules", ".bin", "vsce"),
  ["package", "--no-dependencies", "-o", vsix],
  { cwd: ROOT, stdio: "ignore" },
);

const failures: string[] = [];
const shots: Record<string, string> = {};
for (const app of [vscode(), cursor()]) {
  const scenes = SCENES[app.id].filter((s) => !wanted.length || wanted.includes(s));
  if (!scenes.length) continue;
  const work = join(WORK, app.id, "render");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "extensions"), { recursive: true });
  sampleRepo(join(work, "fog"));
  cpSync(vsix, join(work, "mistpine.vsix"));
  const cli = app.id === "vscode" ? "/app/bin/code" : "/app/bin/cursor";
  const bin = app.id === "vscode" ? "code" : "cursor";
  console.log(`${app.name} ${app.version}: ${scenes.join(", ")}`);
  run(
    app,
    work,
    [
      "sh",
      "-c",
      `${cli} --install-extension /work/mistpine.vsix --extensions-dir /work/extensions --user-data-dir /work/cli >/work/install.log 2>&1 && ` +
        `cd /work/fog && xvfb-run -a -s "-screen 0 3000x2000x24" node /repo/scripts/render/drive.ts ${bin} ${scenes.join(" ")}`,
    ],
    { timeout: 120 * scenes.length + 60 },
  );
  for (const scene of scenes) {
    const base = join(work, "out", scene);
    const fails = expectPixels(load(base), EXPECT[scene] ?? []);
    const label = `${scene} (${app.name})`;
    if (fails.length) failures.push(`${label}:\n  ${fails.join("\n  ")}`);
    console.log(`${fails.length ? "✗" : "✓"} ${label}`);
    shots[scene] = `${base}.png`;
  }
}

if (failures.length) {
  console.error(`render: pixel checks failed (screenshots in .render/)\n${failures.join("\n")}`);
  process.exit(1);
}
mkdirSync(join(ASSETS, "screenshots"), { recursive: true });
for (const [scene, file] of Object.entries(shots)) {
  const out =
    scene === "preview" ? join(ASSETS, "preview.png") : join(ASSETS, "screenshots", `${scene}.png`);
  cpSync(file, out);
}
console.log(`wrote ${Object.keys(shots).length} images to assets/`);
