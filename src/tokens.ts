/**
 * TextMate rules (`tokenColors` in the theme): syntax colors for every
 * language, by grammar scope. Semantic tokens (semantic.ts) refine them
 * where a language server provides them.
 *
 * Roles follow the spec's syntax table and mistpine.nvim's Tree-sitter
 * captures, so a file reads the same in both editors.
 */
import type { Token } from "@mistpine/port-kit";
import type { Colors } from "./colors.ts";

export interface Rule {
  name: string;
  scope: string[];
  settings: { foreground?: string; fontStyle?: string };
}

/** The spec's syntax token as TextMate settings: its color and its styles. */
export function style(token: Token): Rule["settings"] {
  const font = [token.italic && "italic", token.bold && "bold", token.underline && "underline"]
    .filter(Boolean)
    .join(" ");
  // An empty fontStyle resets the style a broader scope gave.
  return { foreground: token.hex.toLowerCase(), fontStyle: font };
}

export function tokenColors(c: Colors, syntax: Record<string, Token>): Rule[] {
  const s = (name: string): Rule["settings"] => {
    const token = syntax[name];
    if (!token) throw new Error(`the spec has no syntax.${name}`);
    return style(token);
  };
  const fg = (hex: string, fontStyle = ""): Rule["settings"] => ({ foreground: hex, fontStyle });
  const rule = (name: string, settings: Rule["settings"], ...scope: string[]): Rule => ({
    name,
    scope,
    settings,
  });

  return [
    rule("Text", fg(c.fg), "source", "text"),
    rule(
      "Comments",
      s("comment"),
      "comment",
      "punctuation.definition.comment",
      "string.comment",
      "comment.block.documentation",
    ),
    rule(
      "Doc comment tags",
      { ...s("comment"), fontStyle: "italic bold" },
      "comment.block.documentation storage.type",
      "comment.block.documentation keyword",
      "storage.type.class.jsdoc",
      "punctuation.definition.block.tag.jsdoc",
    ),
    rule(
      "Doc comment names and types",
      s("comment"),
      "comment.block.documentation variable",
      "comment.block.documentation entity.name.type",
    ),

    // Keywords: plain keywords and control flow are both red.
    rule(
      "Keywords",
      s("keyword"),
      "keyword",
      "storage.type",
      "storage.modifier",
      "keyword.other.using",
      "keyword.other.import",
      "entity.name.label",
    ),
    rule(
      "Control flow",
      s("control"),
      "keyword.control",
      "keyword.control.flow",
      "keyword.control.conditional",
      "keyword.control.loop",
      "keyword.control.trycatch",
      "keyword.control.import",
      "keyword.control.export",
      "keyword.control.from",
    ),
    rule(
      "Preprocessor and directives",
      s("macro"),
      "keyword.control.directive",
      "meta.preprocessor",
      "punctuation.definition.directive",
      "entity.name.function.preprocessor",
      "entity.name.function.macro",
      "support.function.macro",
    ),

    // Operators and punctuation
    rule(
      "Operators",
      s("operator"),
      "keyword.operator",
      "punctuation.accessor.optional",
      "punctuation.separator.key-value.mapping.yaml",
      "keyword.operator.type.annotation",
    ),
    rule(
      "Word operators",
      s("keyword"),
      "keyword.operator.new",
      "keyword.operator.expression",
      "keyword.operator.logical.python",
      "keyword.operator.word",
      "keyword.operator.sizeof",
      "keyword.operator.instanceof",
      "keyword.operator.typeof",
      "keyword.operator.delete",
      "keyword.operator.in",
      "keyword.operator.of",
      "keyword.operator.cast",
    ),
    rule(
      "Punctuation",
      s("punctuation"),
      "punctuation",
      "meta.brace",
      "punctuation.separator",
      "punctuation.terminator",
      "punctuation.accessor",
      "punctuation.definition.parameters",
      "punctuation.definition.typeparameters",
      "punctuation.definition.block",
      "punctuation.definition.tag",
      "meta.tag.sgml",
    ),

    // Functions: bold where defined or called, methods plain.
    rule(
      "Functions",
      s("function"),
      "entity.name.function",
      "support.function",
      "meta.function-call entity.name.function",
      "meta.function-call.generic",
      "variable.function",
    ),
    rule(
      "Methods",
      s("method"),
      "entity.name.function.member",
      "meta.method-call entity.name.function",
      "meta.method.declaration entity.name.function",
      "entity.name.function.method",
      "support.function.method",
    ),
    rule(
      "Builtin functions and variables",
      s("builtin"),
      "support.function.builtin",
      "support.function.console",
      "support.function.dom",
      "support.function.go",
      "support.function.std",
      "support.variable",
      "support.constant.math",
      "support.constant.dom",
      "variable.language",
      "variable.language.self",
      "variable.language.special.self",
      "variable.parameter.function.language.special.self",
      "variable.language.super",
      "entity.name.function.builtin",
    ),
    rule(
      "Constructors",
      s("type"),
      "entity.name.function.constructor",
      "new.expr entity.name.type",
    ),

    // Strings, escapes and regexes
    rule(
      "Strings",
      s("string"),
      "string",
      "punctuation.definition.string",
      "string.quoted",
      "string.template",
      "string.unquoted",
      "markup.inline.raw.string",
    ),
    rule(
      "Escapes and format specifiers",
      s("escape"),
      "constant.character.escape",
      "constant.character.format.placeholder",
      "constant.other.placeholder",
      "punctuation.definition.template-expression",
      "punctuation.section.embedded",
      "punctuation.definition.interpolation",
      "storage.type.format",
    ),
    rule("Embedded code in strings", fg(c.fg), "meta.template.expression", "meta.embedded.line"),
    rule(
      "Regular expressions",
      s("regex"),
      "string.regexp",
      "string.regexp punctuation.definition.string",
      "constant.other.character-class.regexp",
      "keyword.operator.quantifier.regexp",
      "constant.character.escape.backslash.regexp",
    ),

    // Numbers, constants and booleans
    rule("Numbers", s("number"), "constant.numeric", "keyword.other.unit"),
    rule(
      "Constants",
      s("constant"),
      "constant",
      "constant.other",
      "constant.other.caps",
      "variable.other.constant",
      "variable.other.enummember",
      "support.constant",
      "entity.name.constant",
      "constant.other.symbol",
      "constant.other.key",
      "constant.character",
    ),
    rule("Booleans and null", s("boolean"), "constant.language"),

    // Types
    rule(
      "Types",
      s("type"),
      "entity.name.type",
      "entity.name.class",
      "entity.name.struct",
      "entity.name.enum",
      "entity.name.interface",
      "entity.name.type.class",
      "entity.other.inherited-class",
      "support.type",
      "support.class",
      "storage.type.primitive",
      "storage.type.built-in",
      "storage.type.numeric.go",
      "storage.type.string.go",
      "storage.type.boolean.go",
      "storage.type.byte.go",
      "storage.type.rune.go",
      "storage.type.uintptr.go",
      "storage.type.error.go",
      "storage.type.java",
      "storage.type.cs",
      "storage.type.c",
      "storage.type.cpp",
      "entity.name.type.parameter",
      "entity.name.type.alias",
      "entity.name.type.module.ocaml",
    ),
    rule(
      "Type keywords stay keywords",
      s("keyword"),
      "storage.type.function",
      "storage.type.class",
    ),

    // Variables, parameters and properties
    rule("Variables", s("variable"), "variable", "variable.other", "variable.other.readwrite"),
    rule(
      "Parameters",
      s("parameter"),
      "variable.parameter",
      "meta.parameters variable",
      "entity.name.variable.parameter",
    ),
    rule(
      "Properties",
      s("property"),
      "variable.other.property",
      "variable.other.object.property",
      "variable.other.member",
      "meta.property.object",
      "support.variable.property",
      "entity.name.variable.field",
      "entity.name.variable.property",
      "meta.object-literal.key",
      "support.type.property-name",
      "entity.name.tag.yaml",
      "entity.name.tag.toml",
      "support.type.property-name.toml",
      "support.type.property-name.json",
      "support.type.property-name.css",
      "variable.object.property",
    ),
    rule(
      "Namespaces and modules",
      s("namespace"),
      "entity.name.namespace",
      "entity.name.module",
      "entity.name.package",
      "entity.name.type.namespace",
      "entity.name.type.module",
      "storage.modifier.package",
      "storage.modifier.import",
      "support.other.namespace",
      "entity.name.scope-resolution",
      "entity.name.import.go",
      "entity.name.package.go",
    ),

    // Attributes, decorators, annotations and macros
    rule(
      "Attributes and decorators",
      s("attribute"),
      "entity.other.attribute-name",
      "meta.decorator",
      "entity.name.function.decorator",
      "punctuation.decorator",
      "storage.type.annotation",
      "punctuation.definition.annotation",
      "meta.attribute",
      "entity.name.function.attribute",
    ),
    rule("Macros", s("macro"), "entity.name.function.macro.rust", "support.macro"),

    // Markup tags (HTML, XML, JSX)
    rule("Tags", s("tag"), "entity.name.tag", "support.class.component"),
    rule(
      "Tag punctuation",
      s("punctuation"),
      "punctuation.definition.tag",
      "punctuation.definition.tag.begin",
      "punctuation.definition.tag.end",
    ),
    rule(
      "Tag attributes",
      s("attribute"),
      "entity.other.attribute-name",
      "entity.other.attribute-name.html",
      "entity.other.attribute-name.jsx",
    ),

    // CSS
    rule(
      "CSS selectors",
      s("tag"),
      "entity.name.tag.css",
      "entity.name.tag.scss",
      "entity.name.tag.less",
    ),
    rule(
      "CSS classes and ids",
      s("type"),
      "entity.other.attribute-name.class.css",
      "entity.other.attribute-name.id.css",
      "entity.other.attribute-name.class",
      "entity.other.attribute-name.id",
    ),
    rule(
      "CSS pseudo-classes",
      s("keyword"),
      "entity.other.attribute-name.pseudo-class",
      "entity.other.attribute-name.pseudo-element",
    ),
    rule(
      "CSS values",
      s("constant"),
      "support.constant.property-value",
      "support.constant.font-name",
      "support.constant.color",
      "constant.other.color.rgb-value",
    ),
    rule(
      "CSS functions",
      s("builtin"),
      "support.function.misc.css",
      "support.function.transform.css",
    ),
    rule("CSS variables", s("variable"), "variable.css", "variable.scss", "variable.argument.css"),
    rule(
      "CSS at-rules",
      s("keyword"),
      "keyword.control.at-rule",
      "punctuation.definition.keyword.css",
    ),

    // Markdown and other markup
    rule(
      "Headings",
      s("heading"),
      "markup.heading",
      "entity.name.section",
      "markup.heading.setext",
    ),
    ...["green", "blue", "yellow", "cyan", "purple", "pink"].map((name, i) =>
      rule(
        `Heading ${i + 1}`,
        fg(c[name as keyof Colors] as string, "bold"),
        `heading.${i + 1}.markdown entity.name.section.markdown`,
        `heading.${i + 1}.markdown punctuation.definition.heading.markdown`,
      ),
    ),
    rule("Bold", { fontStyle: "bold" }, "markup.bold", "punctuation.definition.bold"),
    rule("Italic", { fontStyle: "italic" }, "markup.italic", "punctuation.definition.italic"),
    rule(
      "Bold italic",
      { fontStyle: "bold italic" },
      "markup.bold markup.italic",
      "markup.italic markup.bold",
    ),
    rule("Strikethrough", { fontStyle: "strikethrough" }, "markup.strikethrough"),
    rule("Underline", { fontStyle: "underline" }, "markup.underline"),
    rule("Links", s("link"), "markup.underline.link", "string.other.link.destination"),
    rule(
      "Link text",
      fg(s("link").foreground as string),
      "string.other.link.title",
      "string.other.link.description",
      "constant.other.reference.link",
      "meta.link.inline.markdown string.other.link",
    ),
    rule(
      "Inline code",
      fg(s("string").foreground as string),
      "markup.inline.raw",
      "markup.raw.monospace",
      "markup.inline.raw.string.markdown",
    ),
    rule("Code blocks", fg(c.fg), "markup.fenced_code", "markup.raw.block", "markup.raw"),
    rule("Code fence language", s("attribute"), "fenced_code.block.language"),
    rule("Quotes", fg(c.muted, "italic"), "markup.quote"),
    rule(
      "List markers",
      fg(c.orange),
      "punctuation.definition.list.begin.markdown",
      "beginning.punctuation.definition.list.markdown",
    ),
    rule("Horizontal rules", fg(c.border), "meta.separator.markdown"),
    rule("Math", s("constant"), "markup.math", "text.tex.latex"),

    // Diffs
    rule(
      "Inserted",
      fg(c.gitAdd),
      "markup.inserted",
      "meta.diff.header.to-file",
      "punctuation.definition.inserted",
    ),
    rule(
      "Deleted",
      fg(c.gitDelete),
      "markup.deleted",
      "meta.diff.header.from-file",
      "punctuation.definition.deleted",
    ),
    rule("Changed", fg(c.gitChange), "markup.changed", "punctuation.definition.changed"),
    rule("Diff ranges", fg(c.cyan), "meta.diff.range", "meta.diff.header"),

    // Shell
    rule(
      "Shell variables",
      s("variable"),
      "variable.other.normal.shell",
      "variable.other.special.shell",
    ),
    rule("Shell commands", s("function"), "entity.name.command.shell"),
    rule("Shell builtins", s("builtin"), "support.function.builtin.shell"),

    // Logs and miscellany
    rule("Invalid", fg(c.error), "invalid", "invalid.illegal"),
    rule("Deprecated", { fontStyle: "strikethrough" }, "invalid.deprecated"),
    rule("Errors in output", fg(c.error), "token.error-token"),
    rule("Warnings in output", fg(c.warning), "token.warn-token"),
    rule("Info in output", fg(c.info), "token.info-token"),
    rule("Debug in output", fg(c.purple), "token.debug-token"),
  ];
}
