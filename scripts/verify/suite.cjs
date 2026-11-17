// Runs inside the app's extension host (--extensionTestsPath) with mistpine
// selected in the user settings. It writes what the app resolved:
// `Developer: Generate Color Theme From Current Settings` lists every
// registered color id, with the theme's value or, commented out, the default.
const fs = require("node:fs");
const vscode = require("vscode");

exports.run = async () => {
  const out = process.env.MISTPINE_OUT;
  if (!out) throw new Error("MISTPINE_OUT is not set");
  // The theme is applied from settings.json at startup; give the
  // workbench a moment to finish restoring before asking for it.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await vscode.commands.executeCommand("workbench.action.generateColorTheme");
  const editor = vscode.window.activeTextEditor;
  if (!editor) throw new Error("generateColorTheme opened no editor");
  const result = {
    app: vscode.env.appName,
    version: vscode.version,
    theme: vscode.workspace.getConfiguration("workbench").get("colorTheme"),
    kind: vscode.window.activeColorTheme.kind,
    generated: editor.document.getText(),
  };
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
};
