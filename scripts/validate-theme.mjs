import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const themes = packageJson.contributes?.themes ?? [];
const denominations = [
  ["one", "壹元 (¥1)"],
  ["two", "贰元 (¥2)"],
  ["five", "伍元 (¥5)"],
  ["ten", "拾元 (¥10)"],
  ["twenty", "贰拾元 (¥20)"],
  ["fifty", "伍拾元 (¥50)"],
  ["hundred", "壹佰元 (¥100)"]
];

if (packageJson.displayName !== "Yuan") {
  throw new Error("Extension displayName must be Yuan");
}

if (themes.length !== denominations.length * 2) {
  throw new Error(`Expected ${denominations.length * 2} contributed themes, found ${themes.length}`);
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

const relativeLuminance = (hex) => {
  const [r, g, b] = hex
    .slice(1, 7)
    .match(/../g)
    .map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a, b) => {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
};

const srgbToLinear = (value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const oklchColor = (hex) => {
  const [r, g, b] = hex
    .slice(1, 7)
    .match(/../g)
    .map((channel) => srgbToLinear(Number.parseInt(channel, 16)));

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lPrime = Math.cbrt(l);
  const mPrime = Math.cbrt(m);
  const sPrime = Math.cbrt(s);

  const a = 1.9779984951 * lPrime - 2.428592205 * mPrime + 0.4505937099 * sPrime;
  const bAxis = 0.0259040371 * lPrime + 0.7827717662 * mPrime - 0.808675766 * sPrime;
  const hue = (Math.atan2(bAxis, a) * 180) / Math.PI;

  return {
    chroma: Math.hypot(a, bAxis),
    hue: (hue + 360) % 360
  };
};

const oklchHue = (hex) => oklchColor(hex).hue;

const hueDistance = (a, b) => {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
};

const expectedThemes = new Map();
for (const [id, label] of denominations) {
  expectedThemes.set(`yuan-${id}-light`, { label: `${label} Light`, uiTheme: "vs" });
  expectedThemes.set(`yuan-${id}-dark`, { label: `${label} Dark`, uiTheme: "vs-dark" });
}

const tokenColorForScope = (tokenColors, scope) => {
  const token = tokenColors.find((entry) => {
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    return scopes.includes(scope);
  });

  return token?.settings?.foreground;
};

for (const theme of themes) {
  const expected = expectedThemes.get(theme.id);

  if (!expected) {
    throw new Error(`${theme.id} is not an expected denomination theme`);
  }

  if (theme.label !== expected.label) {
    throw new Error(`${theme.id} label must be ${expected.label}`);
  }

  if (theme.uiTheme !== expected.uiTheme) {
    throw new Error(`${theme.label} has invalid uiTheme ${theme.uiTheme}`);
  }

  const themePath = path.join(root, theme.path);
  const data = JSON.parse(fs.readFileSync(themePath, "utf8"));

  if (data.$schema !== "vscode://schemas/color-theme") {
    throw new Error(`${theme.path} is missing the VS Code color theme schema`);
  }

  if (data.name !== theme.label) {
    throw new Error(`${theme.path} name must match contributed label ${theme.label}`);
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

  const keywordColor = data.semanticTokenColors.keyword;
  const typeColor = data.semanticTokenColors.type;

  if (tokenColorForScope(data.tokenColors, "storage.type") !== keywordColor) {
    throw new Error(`${theme.path} must color storage.type declarations as keywords`);
  }

  for (const scope of ["entity.name.type", "entity.name.class", "support.type", "support.class"]) {
    if (tokenColorForScope(data.tokenColors, scope) !== typeColor) {
      throw new Error(`${theme.path} must color ${scope} identifiers as types`);
    }
  }

  const primaryHue = oklchHue(data.colors.focusBorder);
  const denominationSyntaxRoles = [
    ["keyword", keywordColor, 45],
    ["type", typeColor, 45],
    ["function", data.semanticTokenColors.function, 45],
    ["string", data.semanticTokenColors.string, 35],
    ["comment", data.semanticTokenColors.comment, 60],
    ["regexp", data.semanticTokenColors.regexp, 75]
  ];

  for (const [role, color, maximumDistance] of denominationSyntaxRoles) {
    const distance = hueDistance(primaryHue, oklchHue(color));

    if (distance > maximumDistance) {
      throw new Error(`${theme.path} ${role} hue distance ${distance.toFixed(1)} exceeds ${maximumDistance}`);
    }
  }

  const distinctCoreColors = new Set(
    ["keyword", "type", "function", "string"].map((role) => data.semanticTokenColors[role])
  );

  if (distinctCoreColors.size < 4) {
    throw new Error(`${theme.path} must keep core syntax roles visually separated`);
  }

  const surfaceColors = [
    ["editor.background", 0.006, 0.026, 45],
    ["sideBar.background", 0.01, 0.04, 45],
    ["panel.background", 0.008, 0.034, 45],
    ["button.secondaryBackground", 0.01, 0.05, 45],
    ["widget.border", 0.01, 0.055, 45]
  ];

  for (const [surface, minimumChroma, maximumChroma, maximumDistance] of surfaceColors) {
    const color = oklchColor(data.colors[surface]);
    const distance = hueDistance(primaryHue, color.hue);

    if (distance > maximumDistance) {
      throw new Error(`${theme.path} ${surface} hue distance ${distance.toFixed(1)} exceeds ${maximumDistance}`);
    }

    if (color.chroma < minimumChroma || color.chroma > maximumChroma) {
      throw new Error(
        `${theme.path} ${surface} chroma ${color.chroma.toFixed(3)} is outside ${minimumChroma}-${maximumChroma}`
      );
    }
  }

  const readablePairs = [
    ["editor.foreground", "editor.background", 7],
    ["sideBar.foreground", "sideBar.background", 4.5],
    ["button.foreground", "button.background", 4.5],
    ["terminal.foreground", "terminal.background", 7],
    ["tab.activeForeground", "tab.activeBackground", 4.5]
  ];

  for (const [foreground, background, minimum] of readablePairs) {
    const ratio = contrastRatio(data.colors[foreground], data.colors[background]);

    if (ratio < minimum) {
      throw new Error(`${theme.path} ${foreground} on ${background} contrast ${ratio.toFixed(2)} is below ${minimum}`);
    }
  }
}

console.log("Yuan theme validation passed");
