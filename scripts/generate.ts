/**
 * Writes themes/mistpine-color-theme.json from src/ and the mistpine spec.
 *
 *   pnpm generate          write the theme
 *   pnpm generate --check  fail if the theme is out of date
 *
 * It also checks the theme: the spec's blends recompute to the spec's hexes,
 * every color is a valid #rrggbb or #rrggbbaa, and every pair of text and
 * surface colors clears 4.5:1 (WCAG 2), translucent surfaces composited
 * over what they sit on.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contrast, loadSpec, mix } from "@mistpine/port-kit";
import { over, resolve } from "../src/colors.ts";
import { semanticTokenColors } from "../src/semantic.ts";
import { tokenColors } from "../src/tokens.ts";
import { workbench } from "../src/workbench.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "themes", "mistpine-color-theme.json");
const check = process.argv.includes("--check");

const { spec, source } = await loadSpec(ROOT);
const c = resolve(spec);

/** Recomputes the spec's own blends, so `mix` provably matches the spec. */
function verifyBlends(): void {
  const named: Record<string, string> = { "@terminal.background": c.terminal.background };
  let checked = 0;
  for (const [name, token] of Object.entries(spec.ui)) {
    if (!token.derived) continue;
    const m = token.derived.match(/^mix\((\S+), \$(\w+), (\d+)%\)$/);
    if (!m) throw new Error(`ui.${name}: unknown blend ${token.derived}`);
    const [, base, key, pct] = m as unknown as [string, string, string, string];
    const from = named[base] ?? spec.palette[base.replace(/^\$/, "")];
    const to = spec.palette[key];
    if (!from || !to) throw new Error(`ui.${name}: unknown color in ${token.derived}`);
    const got = mix(from, to, Number(pct) / 100);
    if (got !== token.hex.toLowerCase())
      throw new Error(`mix for ui.${name} gives ${got}, spec says ${token.hex}`);
    checked++;
  }
  // The spec has blends; finding none means its format changed under us.
  if (checked === 0) throw new Error("the spec has no blends: did its format change?");
}

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;

function verifyFormat(colors: Record<string, string>): void {
  for (const [key, value] of Object.entries(colors))
    if (!HEX.test(value)) throw new Error(`${key}: ${value} is not #rrggbb or #rrggbbaa`);
}

/**
 * Text that must clear 4.5:1 on its surface. `X.foreground` pairs with
 * `X.background` automatically (and `…Foreground` with `…Background`); these
 * are the pairs whose names don't line up. Surfaces that are themselves
 * translucent are composited over the editor background.
 */
const PAIRS: [string, string][] = [
  ["foreground", "sideBar.background"],
  ["foreground", "panel.background"],
  ["foreground", "menu.background"],
  ["descriptionForeground", "sideBar.background"],
  ["descriptionForeground", "editor.background"],
  ["descriptionForeground", "quickInput.background"],
  ["editor.foreground", "editor.lineHighlightBackground"],
  ["editor.foreground", "editor.selectionBackground"],
  ["editor.findMatchForeground", "editor.findMatchBackground"],
  ["editor.findMatchHighlightForeground", "editor.findMatchHighlightBackground"],
  ["editorLineNumber.activeForeground", "editor.lineHighlightBackground"],
  ["input.placeholderForeground", "input.background"],
  ["list.highlightForeground", "sideBar.background"],
  ["list.highlightForeground", "list.activeSelectionBackground"],
  ["list.highlightForeground", "list.hoverBackground"],
  ["quickInputList.focusHighlightForeground", "quickInputList.focusBackground"],
  ["quickInputList.focusHighlightForeground", "quickInput.background"],
  ["editorSuggestWidget.highlightForeground", "editorSuggestWidget.background"],
  ["editorSuggestWidget.focusHighlightForeground", "editorSuggestWidget.selectedBackground"],
  ["sideBar.foreground", "list.hoverBackground"],
  ["sideBar.foreground", "list.inactiveSelectionBackground"],
  ["tab.inactiveForeground", "editorGroupHeader.tabsBackground"],
  ["tab.activeForeground", "tab.activeBackground"],
  ["titleBar.activeForeground", "titleBar.activeBackground"],
  ["breadcrumb.foreground", "breadcrumb.background"],
  ["panelTitle.activeForeground", "panel.background"],
  ["panelTitle.inactiveForeground", "panel.background"],
  ["activityBar.inactiveForeground", "activityBar.background"],
  ["textLink.foreground", "editor.background"],
  ["textLink.foreground", "sideBar.background"],
  ["textPreformat.foreground", "textPreformat.background"],
  ["editorCodeLens.foreground", "editor.background"],
  ["editorGhostText.foreground", "editor.background"],
  ["editorGhostText.foreground", "editor.lineHighlightBackground"],
  ["notificationLink.foreground", "notifications.background"],
  ["gitDecoration.addedResourceForeground", "sideBar.background"],
  ["gitDecoration.modifiedResourceForeground", "sideBar.background"],
  ["gitDecoration.deletedResourceForeground", "sideBar.background"],
  ["gitDecoration.untrackedResourceForeground", "sideBar.background"],
  ["gitDecoration.ignoredResourceForeground", "sideBar.background"],
  ["gitDecoration.renamedResourceForeground", "sideBar.background"],
  ["gitDecoration.conflictingResourceForeground", "sideBar.background"],
  ["gitDecoration.submoduleResourceForeground", "sideBar.background"],
  ["gitDecoration.modifiedResourceForeground", "list.activeSelectionBackground"],
  ["list.errorForeground", "sideBar.background"],
  ["list.warningForeground", "sideBar.background"],
  ["debugTokenExpression.name", "sideBar.background"],
  ["debugTokenExpression.value", "sideBar.background"],
  ["debugTokenExpression.string", "sideBar.background"],
  ["debugTokenExpression.number", "sideBar.background"],
  ["debugConsole.infoForeground", "panel.background"],
  ["debugConsole.warningForeground", "panel.background"],
  ["debugConsole.errorForeground", "panel.background"],
  ["debugConsole.sourceForeground", "panel.background"],
  ["terminal.foreground", "terminal.background"],
  ["terminal.selectionForeground", "terminal.selectionBackground"],
  ["inputValidation.errorForeground", "inputValidation.errorBackground"],
  ["inputValidation.warningForeground", "inputValidation.warningBackground"],
  ["inputValidation.infoForeground", "inputValidation.infoBackground"],
  ["keybindingLabel.foreground", "keybindingLabel.background"],
];

/**
 * Colors named `…Foreground` that aren't text (WCAG 2 exempts disabled text;
 * a progress bar's fill is a graphic).
 */
const EXEMPT = new Set(["disabledForeground", "welcomePage.progress.foreground"]);

/**
 * Pairs allowed below 4.5:1, down to a floor, and why. Each comes from the
 * spec itself rather than from a choice made here.
 */
const ALLOW: Record<string, { min: number; why: string }> = {
  "gitDecoration.modifiedResourceForeground on list.activeSelectionBackground": {
    min: 4,
    why: "the spec's gitChange (blue) on its selection (bg3), as in mistpine.nvim's file trees",
  },
};

function verifyContrast(colors: Record<string, string>): string[] {
  const pairs = new Map<string, [string, string]>();
  for (const key of Object.keys(colors)) {
    const bg = key.endsWith(".foreground")
      ? key.replace(/\.foreground$/, ".background")
      : key.endsWith("Foreground")
        ? key.replace(/Foreground$/, "Background")
        : undefined;
    if (bg && bg in colors && !EXEMPT.has(key)) pairs.set(`${key} on ${bg}`, [key, bg]);
  }
  for (const [fg, bg] of PAIRS) pairs.set(`${fg} on ${bg}`, [fg, bg]);

  const failures: string[] = [];
  for (const [label, [fgKey, bgKey]] of pairs) {
    const fg = colors[fgKey];
    const bg = colors[bgKey];
    if (!fg || !bg) {
      failures.push(`${label}: not set`);
      continue;
    }
    const surface = over(bg, c.bg);
    const ratio = contrast(over(fg, surface), surface);
    const allowed = ALLOW[label];
    const min = allowed?.min ?? 4.5;
    if (ratio < min) failures.push(`${label}: ${fg} on ${surface} is ${ratio.toFixed(2)}:1`);
  }
  for (const label of Object.keys(ALLOW))
    if (!pairs.has(label)) failures.push(`${label}: allowed in ALLOW but no longer checked`);
  return failures;
}

verifyBlends();
const colors = workbench(c);
verifyFormat(colors);
const failures = verifyContrast(colors);
if (failures.length) {
  console.error(`contrast too low:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
const theme = {
  $schema: "vscode://schemas/color-theme",
  name: "mistpine",
  type: "dark",
  // Not part of VS Code's schema; the file says where it comes from instead of a comment.
  $comment: `mistpine ${pkg.version} for VS Code and Cursor, generated by scripts/generate.ts from src/ and the mistpine spec (https://github.com/mistpine/mistpine). Do not edit by hand. MIT License.`,
  semanticHighlighting: true,
  colors,
  tokenColors: tokenColors(c, spec.syntax),
  semanticTokenColors: semanticTokenColors(spec.syntax),
};
const json = `${JSON.stringify(theme, null, 2)}\n`;

if (check) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {}
  if (current !== json) {
    console.error("themes/mistpine-color-theme.json is out of date: run pnpm generate");
    process.exit(1);
  }
  console.log(`themes/mistpine-color-theme.json is up to date (spec: ${source})`);
} else {
  writeFileSync(OUT, json);
  console.log(
    `wrote themes/mistpine-color-theme.json: ${Object.keys(colors).length} colors (spec: ${source})`,
  );
}
