import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const denominations = [
  { id: "one", label: "壹元 (¥1)", hue: 103, chroma: 0.1 },
  { id: "two", label: "贰元 (¥2)", hue: 178, chroma: 0.1 },
  { id: "five", label: "伍元 (¥5)", hue: 294, chroma: 0.11 },
  { id: "ten", label: "拾元 (¥10)", hue: 232, chroma: 0.1 },
  { id: "twenty", label: "贰拾元 (¥20)", hue: 52, chroma: 0.1 },
  { id: "fifty", label: "伍拾元 (¥50)", hue: 151, chroma: 0.11 },
  { id: "hundred", label: "壹佰元 (¥100)", hue: 22, chroma: 0.11 }
];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const degToRad = (deg) => (deg * Math.PI) / 180;
const channelToHex = (value) => Math.round(clamp(value) * 255).toString(16).padStart(2, "0").toUpperCase();

const oklchToHex = (l, c, h) => {
  const a = c * Math.cos(degToRad(h));
  const b = c * Math.sin(degToRad(h));

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const lmsL = lPrime ** 3;
  const lmsM = mPrime ** 3;
  const lmsS = sPrime ** 3;

  const linearR = 4.0767416621 * lmsL - 3.3077115913 * lmsM + 0.2309699292 * lmsS;
  const linearG = -1.2684380046 * lmsL + 2.6097574011 * lmsM - 0.3413193965 * lmsS;
  const linearB = -0.0041960863 * lmsL - 0.7034186147 * lmsM + 1.707614701 * lmsS;

  const encode = (value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

  return `#${channelToHex(encode(linearR))}${channelToHex(encode(linearG))}${channelToHex(encode(linearB))}`;
};

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

const readableOn = (background, light = "#FFFFFF", dark = "#1F211D") =>
  contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;

const alpha = (hex, value) => `${hex}${value}`;
const hue = (base, offset) => (base + offset + 360) % 360;

const paletteFor = (denomination, mode) => {
  const isDark = mode === "dark";
  const h = denomination.hue;
  const c = denomination.chroma;

  const neutral = isDark
    ? {
        editor: oklchToHex(0.205, 0.018, h),
        chrome: oklchToHex(0.16, 0.014, h),
        panel: oklchToHex(0.245, 0.018, h),
        raised: oklchToHex(0.3, 0.02, h),
        border: oklchToHex(0.36, 0.02, h),
        borderSoft: oklchToHex(0.28, 0.016, h),
        foreground: "#D8D2C4",
        foregroundStrong: "#F0E8D8",
        muted: "#8A867C",
        variable: "#C6D6DE"
      }
    : {
        editor: oklchToHex(0.985, 0.012, h),
        chrome: oklchToHex(0.955, 0.018, h),
        panel: oklchToHex(0.97, 0.014, h),
        raised: oklchToHex(0.91, 0.024, h),
        border: oklchToHex(0.83, 0.028, h),
        borderSoft: oklchToHex(0.88, 0.022, h),
        foreground: "#2F2B26",
        foregroundStrong: "#1F1B16",
        muted: "#7B766A",
        variable: "#42516A"
      };

  const primary = oklchToHex(isDark ? 0.72 : 0.54, c, h);
  const primaryStrong = oklchToHex(isDark ? 0.8 : 0.45, c, h);
  const primarySoft = oklchToHex(isDark ? 0.36 : 0.9, c * 0.62, h);
  const keyword = oklchToHex(isDark ? 0.74 : 0.49, 0.11, h);
  const string = oklchToHex(isDark ? 0.77 : 0.5, 0.08, hue(h, 16));
  const func = oklchToHex(isDark ? 0.78 : 0.53, 0.09, hue(h, 32));
  const type = oklchToHex(isDark ? 0.75 : 0.49, 0.09, hue(h, -28));
  const regexp = oklchToHex(isDark ? 0.76 : 0.5, 0.09, hue(h, 58));
  const comment = oklchToHex(isDark ? 0.72 : 0.47, 0.055, hue(h, -12));
  const cyan = oklchToHex(isDark ? 0.78 : 0.52, 0.08, hue(h, -42));
  const error = oklchToHex(isDark ? 0.74 : 0.5, 0.12, 22);

  return {
    ...neutral,
    primary,
    primaryStrong,
    primarySoft,
    keyword,
    string,
    func,
    type,
    regexp,
    comment,
    cyan,
    error,
    buttonForeground: readableOn(primary),
    isDark
  };
};

const tokenColors = (p) => [
  { scope: ["meta.embedded", "source.groovy.embedded", "string meta.image.inline.markdown", "variable.legacy.builtin.python"], settings: { foreground: p.foreground } },
  { scope: "emphasis", settings: { fontStyle: "italic" } },
  { scope: "strong", settings: { fontStyle: "bold" } },
  { scope: "comment", settings: { foreground: p.comment } },
  { scope: "constant.language", settings: { foreground: p.type } },
  { scope: ["constant.numeric", "variable.other.enummember", "keyword.operator.plus.exponent", "keyword.operator.minus.exponent"], settings: { foreground: p.string } },
  { scope: "constant.regexp", settings: { foreground: p.regexp } },
  { scope: ["entity.name.tag", "entity.name.selector"], settings: { foreground: p.keyword } },
  { scope: "entity.other.attribute-name", settings: { foreground: p.type } },
  { scope: ["entity.other.attribute-name.class.css", "source.css entity.other.attribute-name.class", "entity.other.attribute-name.id.css", "source.css entity.other.attribute-name.pseudo-class", "entity.other.attribute-name.scss"], settings: { foreground: p.func } },
  { scope: "invalid", settings: { foreground: p.error } },
  { scope: "markup.underline", settings: { fontStyle: "underline" } },
  { scope: "markup.bold", settings: { fontStyle: "bold", foreground: p.type } },
  { scope: "markup.heading", settings: { fontStyle: "bold", foreground: p.keyword } },
  { scope: "markup.italic", settings: { fontStyle: "italic", foreground: p.regexp } },
  { scope: "markup.strikethrough", settings: { fontStyle: "strikethrough" } },
  { scope: "markup.deleted", settings: { foreground: p.error } },
  { scope: "markup.inserted", settings: { foreground: p.comment } },
  { scope: "markup.changed", settings: { foreground: p.func } },
  { scope: "markup.quote", settings: { foreground: p.comment } },
  { scope: "markup.inline.raw", settings: { foreground: p.string } },
  { scope: "meta.diff.header", settings: { foreground: p.type } },
  { scope: "storage", settings: { foreground: p.keyword } },
  { scope: "storage.type", settings: { foreground: p.keyword } },
  { scope: ["keyword", "keyword.control", "keyword.operator.expression"], settings: { foreground: p.keyword } },
  { scope: "keyword.operator", settings: { foreground: p.foreground } },
  { scope: ["string", "constant.other.symbol"], settings: { foreground: p.string } },
  { scope: ["punctuation.definition.string", "punctuation.definition.comment"], settings: { foreground: p.muted } },
  { scope: ["support.function", "entity.name.function"], settings: { foreground: p.func } },
  { scope: ["support.class", "support.type", "entity.name.type", "entity.name.class", "entity.name.namespace"], settings: { foreground: p.type } },
  { scope: ["variable", "meta.definition.variable.name", "support.variable", "entity.name.variable", "constant.other.placeholder"], settings: { foreground: p.variable } },
  { scope: ["variable.language", "constant.character.escape"], settings: { foreground: p.keyword } },
  { scope: ["meta.object-literal.key", "entity.name.label"], settings: { foreground: p.variable } },
  { scope: ["punctuation.definition.group.regexp", "punctuation.definition.character-class.regexp", "keyword.operator.negation.regexp", "support.other.parenthesis.regexp"], settings: { foreground: p.func } },
  { scope: ["constant.character.character-class.regexp", "keyword.operator.or.regexp", "keyword.control.anchor.regexp"], settings: { foreground: p.keyword } },
  { scope: "keyword.operator.quantifier.regexp", settings: { foreground: p.foreground } },
  { scope: ["constant.character", "constant.other.option"], settings: { foreground: p.type } }
];

const semanticTokenColors = (p) => ({
  namespace: p.type,
  type: p.type,
  class: p.type,
  enum: p.type,
  interface: p.type,
  struct: p.type,
  typeParameter: p.regexp,
  parameter: p.variable,
  variable: p.variable,
  property: p.variable,
  enumMember: p.string,
  event: p.func,
  function: p.func,
  method: p.func,
  macro: p.func,
  keyword: p.keyword,
  comment: p.comment,
  string: p.string,
  number: p.string,
  regexp: p.regexp,
  operator: p.foreground,
  decorator: p.regexp,
  newOperator: p.keyword,
  stringLiteral: p.string,
  customLiteral: p.string,
  numberLiteral: p.string
});

const workbenchColors = (p) => ({
  "activityBar.activeBorder": p.primary,
  "activityBar.background": p.chrome,
  "activityBar.border": p.borderSoft,
  "activityBar.foreground": p.foreground,
  "activityBar.inactiveForeground": p.muted,
  "activityBarBadge.background": p.keyword,
  "activityBarBadge.foreground": readableOn(p.keyword),
  "badge.background": p.raised,
  "badge.foreground": p.foreground,
  "button.background": p.primary,
  "button.border": alpha(readableOn(p.primary), "1A"),
  "button.foreground": p.buttonForeground,
  "button.hoverBackground": p.primaryStrong,
  "button.secondaryBackground": p.raised,
  "button.secondaryForeground": p.foreground,
  "button.secondaryHoverBackground": p.panel,
  "chat.slashCommandBackground": alpha(p.primarySoft, "99"),
  "chat.slashCommandForeground": p.primaryStrong,
  "chat.editedFileForeground": p.func,
  "checkbox.background": p.editor,
  "checkbox.border": p.border,
  "debugToolBar.background": p.chrome,
  "descriptionForeground": p.muted,
  "dropdown.background": p.editor,
  "dropdown.border": p.border,
  "dropdown.foreground": p.foreground,
  "dropdown.listBackground": p.editor,
  "editor.background": p.editor,
  "editor.findMatchBackground": alpha(p.func, p.isDark ? "88" : "66"),
  "editor.findMatchHighlightBackground": alpha(p.func, p.isDark ? "44" : "55"),
  "editor.foreground": p.foreground,
  "editor.inactiveSelectionBackground": p.raised,
  "editor.lineHighlightBackground": p.panel,
  "editor.selectionBackground": p.primarySoft,
  "editor.selectionHighlightBackground": alpha(p.primarySoft, "88"),
  "editor.wordHighlightBackground": alpha(p.func, p.isDark ? "33" : "40"),
  "editor.wordHighlightStrongBackground": alpha(p.regexp, p.isDark ? "55" : "66"),
  "editorBracketMatch.background": alpha(p.func, "55"),
  "editorBracketMatch.border": p.func,
  "editorCursor.foreground": p.keyword,
  "editorGroup.border": p.borderSoft,
  "editorGroupHeader.tabsBackground": p.chrome,
  "editorGroupHeader.tabsBorder": p.borderSoft,
  "editorGutter.addedBackground": p.comment,
  "editorGutter.deletedBackground": p.error,
  "editorGutter.modifiedBackground": p.type,
  "editorIndentGuide.background1": p.borderSoft,
  "editorIndentGuide.activeBackground1": p.muted,
  "editorLineNumber.activeForeground": p.primary,
  "editorLineNumber.foreground": p.muted,
  "editorOverviewRuler.border": p.borderSoft,
  "editorSuggestWidget.background": p.panel,
  "editorSuggestWidget.border": p.border,
  "editorSuggestWidget.foreground": p.foreground,
  "editorSuggestWidget.highlightForeground": p.type,
  "editorSuggestWidget.selectedBackground": p.raised,
  "editorWidget.background": p.panel,
  "editorWidget.border": p.border,
  "errorForeground": p.error,
  "focusBorder": p.primary,
  foreground: p.foreground,
  "icon.foreground": p.foreground,
  "input.background": p.editor,
  "input.border": p.border,
  "input.foreground": p.foreground,
  "input.placeholderForeground": p.muted,
  "inputOption.activeBackground": alpha(p.primarySoft, "99"),
  "inputOption.activeBorder": p.primary,
  "inputOption.activeForeground": readableOn(p.primarySoft),
  "keybindingLabel.background": p.raised,
  "keybindingLabel.border": p.border,
  "keybindingLabel.foreground": p.foreground,
  "list.activeSelectionBackground": p.primarySoft,
  "list.activeSelectionForeground": readableOn(p.primarySoft),
  "list.activeSelectionIconForeground": readableOn(p.primarySoft),
  "list.dropBackground": alpha(p.func, "55"),
  "list.focusAndSelectionOutline": p.primary,
  "list.focusBackground": alpha(p.primarySoft, "88"),
  "list.highlightForeground": p.type,
  "list.hoverBackground": p.panel,
  "list.inactiveSelectionBackground": p.raised,
  "menu.background": p.editor,
  "menu.border": p.border,
  "menu.foreground": p.foreground,
  "menu.selectionBackground": p.primary,
  "menu.selectionForeground": p.buttonForeground,
  "notebook.cellBorderColor": p.borderSoft,
  "notebook.selectedCellBackground": alpha(p.primarySoft, "66"),
  "notificationCenterHeader.background": p.chrome,
  "notificationCenterHeader.foreground": p.foreground,
  "notifications.background": p.editor,
  "notifications.border": p.borderSoft,
  "notifications.foreground": p.foreground,
  "panel.background": p.panel,
  "panel.border": p.borderSoft,
  "panelInput.border": p.border,
  "panelTitle.activeBorder": p.primary,
  "panelTitle.activeForeground": p.foreground,
  "panelTitle.inactiveForeground": p.muted,
  "peekViewEditor.background": p.editor,
  "peekViewEditor.matchHighlightBackground": alpha(p.func, "66"),
  "peekViewResult.background": p.panel,
  "peekViewResult.matchHighlightBackground": alpha(p.func, "66"),
  "pickerGroup.border": p.border,
  "pickerGroup.foreground": p.comment,
  "ports.iconRunningProcessForeground": p.primary,
  "progressBar.background": p.primary,
  "quickInput.background": p.panel,
  "quickInput.foreground": p.foreground,
  "searchEditor.textInputBorder": p.border,
  "settings.dropdownBackground": p.editor,
  "settings.dropdownBorder": p.border,
  "settings.headerForeground": p.foregroundStrong,
  "settings.modifiedItemIndicator": p.func,
  "settings.numberInputBorder": p.border,
  "settings.textInputBorder": p.border,
  "sideBar.background": p.chrome,
  "sideBar.border": p.borderSoft,
  "sideBar.foreground": p.foreground,
  "sideBarSectionHeader.background": p.panel,
  "sideBarSectionHeader.border": p.borderSoft,
  "sideBarSectionHeader.foreground": p.foreground,
  "sideBarTitle.foreground": p.foregroundStrong,
  "statusBar.background": p.chrome,
  "statusBar.border": p.borderSoft,
  "statusBar.debuggingBackground": p.func,
  "statusBar.debuggingForeground": readableOn(p.func),
  "statusBar.focusBorder": p.primary,
  "statusBar.foreground": p.foreground,
  "statusBar.noFolderBackground": p.editor,
  "statusBarItem.errorBackground": p.error,
  "statusBarItem.focusBorder": p.primary,
  "statusBarItem.hoverBackground": alpha(readableOn(p.chrome), "1A"),
  "statusBarItem.hoverForeground": p.foregroundStrong,
  "statusBarItem.prominentBackground": p.raised,
  "statusBarItem.remoteBackground": p.primary,
  "statusBarItem.remoteForeground": p.buttonForeground,
  "tab.activeBackground": p.editor,
  "tab.activeBorder": p.editor,
  "tab.activeBorderTop": p.primary,
  "tab.activeForeground": p.foregroundStrong,
  "tab.border": p.borderSoft,
  "tab.hoverBackground": p.editor,
  "tab.inactiveBackground": p.chrome,
  "tab.inactiveForeground": p.muted,
  "tab.lastPinnedBorder": p.border,
  "tab.selectedBorderTop": p.keyword,
  "tab.unfocusedActiveBorder": p.editor,
  "tab.unfocusedActiveBorderTop": p.borderSoft,
  "tab.unfocusedHoverBackground": p.chrome,
  "terminal.background": p.editor,
  "terminal.foreground": p.foreground,
  "terminal.inactiveSelectionBackground": p.raised,
  "terminal.tab.activeBorder": p.primary,
  "terminalCursor.foreground": p.keyword,
  "terminal.ansiBlack": p.isDark ? "#1A1B18" : "#2F2B26",
  "terminal.ansiRed": p.error,
  "terminal.ansiGreen": p.string,
  "terminal.ansiYellow": p.func,
  "terminal.ansiBlue": p.type,
  "terminal.ansiMagenta": p.regexp,
  "terminal.ansiCyan": p.cyan,
  "terminal.ansiWhite": p.isDark ? "#D8D2C4" : "#E8E1D3",
  "terminal.ansiBrightBlack": p.muted,
  "terminal.ansiBrightRed": p.keyword,
  "terminal.ansiBrightGreen": p.primary,
  "terminal.ansiBrightYellow": p.func,
  "terminal.ansiBrightBlue": p.type,
  "terminal.ansiBrightMagenta": p.regexp,
  "terminal.ansiBrightCyan": p.cyan,
  "terminal.ansiBrightWhite": p.foregroundStrong,
  "textBlockQuote.background": p.panel,
  "textBlockQuote.border": p.comment,
  "textCodeBlock.background": p.panel,
  "textLink.activeForeground": p.keyword,
  "textLink.foreground": p.type,
  "textPreformat.background": p.raised,
  "textPreformat.foreground": p.foreground,
  "textSeparator.foreground": p.border,
  "titleBar.activeBackground": p.chrome,
  "titleBar.activeForeground": p.foreground,
  "titleBar.border": p.borderSoft,
  "titleBar.inactiveBackground": p.editor,
  "titleBar.inactiveForeground": p.muted,
  "welcomePage.progress.foreground": p.primary,
  "welcomePage.tileBackground": p.panel,
  "widget.border": p.border
});

const themeFor = (denomination, mode) => {
  const p = paletteFor(denomination, mode);

  return {
    $schema: "vscode://schemas/color-theme",
    name: `${denomination.label} ${mode === "light" ? "Light" : "Dark"}`,
    type: mode,
    semanticHighlighting: true,
    colors: workbenchColors(p),
    tokenColors: tokenColors(p),
    semanticTokenColors: semanticTokenColors(p)
  };
};

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
packageJson.contributes.themes = denominations.flatMap((denomination) => [
  {
    id: `yuan-${denomination.id}-light`,
    label: `${denomination.label} Light`,
    uiTheme: "vs",
    path: `./themes/yuan-${denomination.id}-light-color-theme.json`
  },
  {
    id: `yuan-${denomination.id}-dark`,
    label: `${denomination.label} Dark`,
    uiTheme: "vs-dark",
    path: `./themes/yuan-${denomination.id}-dark-color-theme.json`
  }
]);

fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

for (const denomination of denominations) {
  for (const mode of ["light", "dark"]) {
    const filename = `yuan-${denomination.id}-${mode}-color-theme.json`;
    fs.writeFileSync(path.join(root, "themes", filename), `${JSON.stringify(themeFor(denomination, mode), null, 2)}\n`);
  }
}

console.log(`Generated ${denominations.length * 2} Yuan denomination themes`);
