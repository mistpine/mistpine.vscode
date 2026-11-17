/**
 * Semantic token colors (`semanticTokenColors` in the theme), for language
 * servers that provide them (TypeScript, Rust, Go, Python with Pylance…).
 *
 * They match mistpine.nvim's `@lsp.*` links: readonly variables stay
 * variables (TypeScript marks every `const` readonly), the default library is
 * the builtin color, and deprecated symbols are struck through. Each rule
 * sets bold and italic explicitly, because VS Code resolves every style
 * property on its own: `function.defaultLibrary` would otherwise inherit
 * `function`'s bold.
 */
import type { Token } from "@mistpine/port-kit";

export interface SemanticStyle {
  foreground?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export function semanticTokenColors(syntax: Record<string, Token>): Record<string, SemanticStyle> {
  const s = (name: string): SemanticStyle => {
    const token = syntax[name];
    if (!token) throw new Error(`the spec has no syntax.${name}`);
    return {
      foreground: token.hex.toLowerCase(),
      bold: token.bold ?? false,
      italic: token.italic ?? false,
      underline: token.underline ?? false,
    };
  };

  return {
    namespace: s("namespace"),
    module: s("namespace"),
    type: s("type"),
    class: s("type"),
    enum: s("type"),
    interface: s("type"),
    struct: s("type"),
    typeParameter: s("type"),
    typeAlias: s("type"),
    builtinType: s("type"),
    generic: s("type"),
    parameter: s("parameter"),
    variable: s("variable"),
    "variable.readonly": s("variable"),
    "variable.defaultLibrary": s("builtin"),
    "variable.readonly.defaultLibrary": s("builtin"),
    property: s("property"),
    "property.readonly": s("property"),
    "property.defaultLibrary": s("property"),
    enumMember: s("constant"),
    event: s("property"),
    decorator: s("attribute"),
    attribute: s("attribute"),
    lifetime: s("attribute"),
    function: s("function"),
    "function.defaultLibrary": s("builtin"),
    method: s("method"),
    "method.defaultLibrary": s("builtin"),
    macro: s("macro"),
    label: s("keyword"),
    keyword: s("keyword"),
    modifier: s("keyword"),
    selfKeyword: s("builtin"),
    selfTypeKeyword: s("builtin"),
    comment: s("comment"),
    string: s("string"),
    escapeSequence: s("escape"),
    formatSpecifier: s("escape"),
    number: s("number"),
    boolean: s("boolean"),
    regexp: s("regex"),
    operator: s("operator"),
    "*.deprecated": { strikethrough: true },
  };
}
