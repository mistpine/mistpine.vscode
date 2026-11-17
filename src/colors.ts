/**
 * The roles the theme is written in, resolved from the mistpine spec: the
 * spec's editor UI table under short names (as mistpine.nvim's colors.lua
 * has them), the text tones, and the blends this port adds.
 */
import { mix, type Spec, type Token } from "@mistpine/port-kit";

/** The largest per-channel error (0–255) a translucent color may have. */
export const TINT_TOLERANCE = 3;

const channels = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

const byte = (n: number) => n.toString(16).padStart(2, "0");

/** `hex` at an alpha of 0–1, as `#rrggbbaa`. */
export function alpha(hex: string, a: number): string {
  if (a < 0 || a > 1) throw new Error(`alpha ${a} is outside 0–1`);
  return `${hex.slice(0, 7)}${byte(Math.round(a * 255))}`;
}

/** `top` (`#rrggbb` or `#rrggbbaa`) composited over the opaque `base`, as sRGB alpha blending does. */
export function over(top: string, base: string): string {
  const a = top.length === 9 ? Number.parseInt(top.slice(7), 16) / 255 : 1;
  const t = channels(top);
  const b = channels(base);
  return `#${b.map((v, i) => byte(Math.round(v + a * ((t[i] as number) - v)))).join("")}`;
}

/**
 * `source` at the alpha that makes it look like `target` over `base`.
 *
 * VS Code draws find matches, word highlights and diff backgrounds over the
 * text's own decorations, so they must be translucent. The spec's blends are
 * opaque (mixed in OKLab); this picks the alpha whose sRGB composite over the
 * editor background lands on the spec's hex, and fails if no alpha gets
 * within TINT_TOLERANCE of it.
 */
export function tint(target: string, source: string, base: string): string {
  const T = channels(target);
  let best = { hex: "", err: Number.POSITIVE_INFINITY };
  for (let a = 1; a < 255; a++) {
    const hex = `${source.slice(0, 7)}${byte(a)}`;
    const got = channels(over(hex, base));
    const err = Math.max(...got.map((v, i) => Math.abs(v - (T[i] as number))));
    if (err < best.err) best = { hex, err };
  }
  if (best.err > TINT_TOLERANCE)
    throw new Error(
      `no alpha of ${source} over ${base} comes within ${TINT_TOLERANCE} of ${target} (best: ${best.err})`,
    );
  return best.hex;
}

export type Colors = ReturnType<typeof resolve>;

export function resolve(spec: Spec) {
  const p = spec.palette as Record<string, string>;
  const pick = (table: Record<string, Token>, group: string, name: string): string => {
    const hex = table[name]?.hex;
    if (!hex) throw new Error(`the spec has no ${group}.${name}`);
    return hex.toLowerCase();
  };
  const pal = (name: string): string => {
    const hex = p[name];
    if (!hex) throw new Error(`the spec has no palette color ${name}`);
    return hex.toLowerCase();
  };
  const ui = (name: string) => pick(spec.ui, "ui", name);
  const term = (name: string) => pick(spec.terminal, "terminal", name);

  const bg = ui("editorBg");
  /** An accent blended over the editor background, as the spec's diff colors are. */
  const blend = (hex: string, amount: number) => mix(bg, hex, amount);

  const c = {
    // The palette, by its own names.
    bg0: pal("bg0"),
    bg1: pal("bg1"),
    bg2: pal("bg2"),
    bg3: pal("bg3"),
    bg4: pal("bg4"),
    fg0: pal("fg0"),
    fg1: pal("fg1"),
    fg2: pal("fg2"),
    fg3: pal("fg3"),
    red: pal("red"),
    orange: pal("orange"),
    yellow: pal("yellow"),
    green: pal("green"),
    cyan: pal("cyan"),
    blue: pal("blue"),
    purple: pal("purple"),
    pink: pal("pink"),

    // The spec's editor UI roles.
    bg,
    fg: ui("editorFg"),
    panel: ui("panelBg"),
    cursorLine: ui("cursorLine"),
    lineNr: ui("lineNr"),
    lineNrActive: ui("lineNrActive"),
    selection: ui("selection"),
    nonText: ui("nonText"),
    border: ui("border"),
    matchParen: ui("matchParen"),
    search: ui("searchBg"),
    curSearch: ui("curSearchBg"),
    accent: ui("accent"),
    statusBg: ui("statusBg"),
    statusFg: ui("statusFg"),
    pmenu: ui("pmenuBg"),
    pmenuSel: ui("pmenuSel"),
    tabInactive: ui("tabInactiveBg"),
    error: ui("error"),
    warning: ui("warning"),
    info: ui("info"),
    hint: ui("hint"),
    ok: ui("ok"),
    diffAdd: ui("diffAdd"),
    diffChange: ui("diffChange"),
    diffDelete: ui("diffDelete"),
    diffText: ui("diffText"),
    gitAdd: ui("gitAdd"),
    gitChange: ui("gitChange"),
    gitDelete: ui("gitDelete"),

    // Text tones: fg0 is decoration only, fg1 the dimmest readable text.
    text: pal("fg3"),
    subtle: pal("fg2"),
    muted: pal("fg1"),
    dim: pal("fg0"),

    // The terminal, from the spec's terminal table.
    terminal: {
      background: term("background"),
      foreground: term("foreground"),
      cursor: term("cursor"),
      cursorText: term("cursorText"),
      selectionBg: term("selectionBg"),
      selectionFg: term("selectionFg"),
    },
    ansi: spec.ansi.map((t) => t.hex.toLowerCase()),

    // Blends this port adds, all an accent over bg1 like the spec's own (and
    // the same as mistpine.nvim's where it has them).
    diffTextAdd: blend(pal("green"), 0.35),
    diffTextDelete: blend(pal("red"), 0.35),
    debugLine: blend(pal("yellow"), 0.15),
    debugLineFocused: blend(pal("green"), 0.15),
    gitAddStaged: blend(ui("gitAdd"), 0.5),
    gitChangeStaged: blend(ui("gitChange"), 0.5),
    gitDeleteStaged: blend(ui("gitDelete"), 0.5),
    mergeCommon: blend(pal("fg1"), 0.15),
    mergeCommonHeader: blend(pal("fg1"), 0.35),
    /** A primary button or badge under the pointer: the accent, a little lighter. */
    accentHover: mix(ui("accent"), pal("fg3"), 0.15),
    /** Diagnostic panels sit on a faint tint of their color over bg0 (mistpine.nvim's virtual text). */
    virtual: {
      error: mix(pal("bg0"), ui("error"), 0.08),
      warning: mix(pal("bg0"), ui("warning"), 0.08),
      info: mix(pal("bg0"), ui("info"), 0.08),
      hint: mix(pal("bg0"), ui("hint"), 0.08),
    },
  };
  return c;
}
