import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const themes = packageJson.contributes?.themes ?? [];

if (packageJson.displayName !== "Yuan") {
  throw new Error("Extension displayName must be Yuan");
}

if (themes.length !== 2) {
  throw new Error(`Expected 2 contributed themes, found ${themes.length}`);
}

const hexColor = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const requiredWorkbenchColors = [
  "editor.background",
  "editor.foreground",
  "sideBar.background",
  "activityBar.background",
  "statusBar.background",
  "tab.activeBorderTop",
  "focusBorder",
  "button.background",
  "terminal.ansiRed",
  "terminal.ansiGreen",
  "terminal.ansiBlue"
];

for (const theme of themes) {
  if (!["vs", "vs-dark"].includes(theme.uiTheme)) {
    throw new Error(`${theme.label} has invalid uiTheme ${theme.uiTheme}`);
  }

  const themePath = path.join(root, theme.path);
  const data = JSON.parse(fs.readFileSync(themePath, "utf8"));

  if (data.$schema !== "vscode://schemas/color-theme") {
    throw new Error(`${theme.path} is missing the VS Code color theme schema`);
  }

  if (!data.name?.startsWith("Yuan ")) {
    throw new Error(`${theme.path} must be named Yuan Light or Yuan Dark`);
  }

  for (const key of requiredWorkbenchColors) {
    if (!hexColor.test(data.colors?.[key] ?? "")) {
      throw new Error(`${theme.path} is missing valid colors.${key}`);
    }
  }

  if (!Array.isArray(data.tokenColors) || data.tokenColors.length < 30) {
    throw new Error(`${theme.path} must provide a complete tokenColors array`);
  }

  if (data.semanticHighlighting !== true || typeof data.semanticTokenColors !== "object") {
    throw new Error(`${theme.path} must enable semantic highlighting and semanticTokenColors`);
  }
}

console.log("Yuan theme validation passed");
