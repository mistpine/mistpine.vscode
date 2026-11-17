/**
 * Checks the theme in the real apps: VS Code and Cursor (the versions pinned
 * in scripts/lib/app.ts) load it as a development extension, and
 * scripts/verify/suite.cjs asks each for `Developer: Generate Color Theme
 * From Current Settings`, which lists every registered color with the
 * value the app resolved for it.
 *
 *   pnpm verify           fail on unknown or unapplied colors
 *   pnpm verify --audit   also list the colors left to the app's defaults
 *                         that aren't mistpine colors
 *
 * It fails when the theme sets a color VS Code doesn't know (a typo, or a
 * key VS Code removed), when a color the theme sets doesn't come out as set
 * (an invalid value, or the theme not loading at all), or when a color the
 * theme leaves unset falls back to one outside the mistpine palette.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSpec } from "@mistpine/port-kit";
import { CURSOR_ONLY } from "../src/workbench.ts";
import { type App, appArgs, cursor, ROOT, run, vscode, workDir } from "./lib/app.ts";

const audit = process.argv.includes("--audit");

interface Dump {
  app: string;
  version: string;
  theme: string;
  kind: number;
  generated: string;
}

/** The generated theme's colors: set by the theme, or inherited (commented out, null when unset). */
function parse(generated: string): {
  set: Map<string, string>;
  inherited: Map<string, string | null>;
} {
  const set = new Map<string, string>();
  const inherited = new Map<string, string | null>();
  const colors = generated.slice(generated.indexOf('"colors"'), generated.indexOf('"tokenColors"'));
  for (const line of colors.split("\n")) {
    const m = line.match(/^\s*(\/\/)?"([^"]+)": (?:"(#[0-9a-fA-F]+)"|null)/);
    if (!m) continue;
    const [, comment, key, value] = m as unknown as [
      string,
      string | undefined,
      string,
      string | undefined,
    ];
    if (comment) inherited.set(key, value?.toLowerCase() ?? null);
    else if (value) set.set(key, value.toLowerCase());
  }
  return { set, inherited };
}

/** VS Code writes #rrggbb for opaque colors and #rrggbbaa otherwise. */
function normalize(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 9 && h.endsWith("ff") ? h.slice(0, 7) : h;
}

const theme = JSON.parse(
  readFileSync(join(ROOT, "themes", "mistpine-color-theme.json"), "utf8"),
) as {
  colors: Record<string, string>;
};
const { spec } = await loadSpec(ROOT);
const known = new Set<string>(
  [
    ...Object.values(spec.palette),
    ...[spec.terminal, spec.syntax, spec.ui].flatMap((t) => Object.values(t).map((v) => v.hex)),
    ...spec.ansi.map((t) => t.hex),
    ...Object.values(theme.colors),
  ].map((h) => h.toLowerCase().slice(0, 7)),
);

interface Result {
  failures: string[];
  registered: Set<string>;
}

/**
 * VS Code is the reference: the theme may only set colors it knows, and
 * every color it leaves unset must resolve to a mistpine color. Cursor runs
 * an older VS Code underneath, so colors it doesn't know yet are listed,
 * not failed; its own colors (ones VS Code doesn't register) are listed
 * with what they resolve to.
 */
function check(app: App, reference?: Set<string>): Result {
  const work = workDir(app, "verify");
  run(
    app,
    work,
    [
      "xvfb-run",
      "-a",
      "-s",
      "-screen 0 1280x800x24",
      ...appArgs(app),
      "--disable-extensions",
      "--extensionTestsPath=/repo/scripts/verify/suite.cjs",
      "/work",
    ],
    { env: { MISTPINE_OUT: "/work/dump.json" } },
  );
  const dump = JSON.parse(readFileSync(join(work, "dump.json"), "utf8")) as Dump;
  const { set, inherited } = parse(dump.generated);
  const label = `${app.name} ${dump.version === app.version ? "" : `${app.version}, VS Code `}${dump.version}`;
  const failures: string[] = [];

  if (dump.theme !== "mistpine") failures.push(`the active theme is ${dump.theme}, not mistpine`);
  const registered = new Set([...set.keys(), ...inherited.keys()]);
  if (registered.size < 500)
    failures.push(`only ${registered.size} colors registered: did the dump format change?`);

  const unknown: string[] = [];
  for (const [key, value] of Object.entries(theme.colors)) {
    if (!registered.has(key)) {
      unknown.push(key);
      continue;
    }
    const got = set.get(key);
    if (got === undefined)
      failures.push(`${key}: set to ${value} but ${app.name} uses its default`);
    else if (normalize(got) !== normalize(value))
      failures.push(`${key}: set to ${value}, ${app.name} shows ${got}`);
  }
  for (const key of unknown) {
    // VS Code must know every color but Cursor's own; Cursor must know its own.
    if (app.id === "vscode" ? !CURSOR_ONLY.has(key) : CURSOR_ONLY.has(key))
      failures.push(`${key}: not a color ${app.name} knows`);
  }

  const foreign = [...inherited].filter(
    (entry): entry is [string, string] => entry[1] !== null && !known.has(entry[1].slice(0, 7)),
  );
  const own = reference ? [...registered].filter((key) => !reference.has(key)).sort() : [];
  // The app version is pinned, so this only fails when it is bumped: the
  // new release's colors need a place in src/workbench.ts.
  if (foreign.length)
    failures.push(
      `${foreign.length} colors fall back to the app's own palette (pnpm verify --audit lists them)`,
    );

  console.log(
    `${failures.length ? "✗" : "✓"} ${label}: ${Object.keys(theme.colors).length - unknown.length} of ` +
      `${registered.size} colors set, ${foreign.length} defaults outside the mistpine colors` +
      (reference
        ? `, ${unknown.length} theme colors it doesn't have yet, ${own.length} colors of its own`
        : ""),
  );
  if (audit) {
    for (const [key, value] of foreign.sort()) console.log(`    default ${key} ${value}`);
    for (const key of own) {
      const value = set.get(key) ?? inherited.get(key);
      console.log(`    own ${key} ${value ?? "(unset)"}`);
    }
  }
  return { failures: failures.map((f) => `${label}: ${f}`), registered };
}

const code = check(vscode());
const failures = [...code.failures, ...check(cursor(), code.registered).failures];
if (failures.length) {
  console.error(`verify failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
