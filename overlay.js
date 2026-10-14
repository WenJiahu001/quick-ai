(() => {
  if (globalThis.__selectionAiOverlayInstalled) return;
  globalThis.__selectionAiOverlayInstalled = true;
  const extensionApi = globalThis.quickAiBrowserApi;

  const initialCardWidth = Math.min(800, Math.max(1, window.innerWidth - 32));
  const initialLeft = Math.max(12, window.innerWidth - initialCardWidth - 12);
  const host = document.createElement("div");
  host.id = "selection-ai-overlay-host";
  // 显式计算左坐标，避免宿主自动宽度影响首次显示时的右侧对齐。
  host.style.cssText = `all:initial;position:fixed;z-index:2147483647;top:20px;left:${initialLeft}px;right:auto`;
  (document.documentElement || document.body).appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .card {
      --card-bg:#fff; --card-text:#172033; --muted-text:#53627a; --divider:#edf0f5;
      --soft-bg:#fafbfc; --control-bg:#fff; --control-border:#e3e8f0;
      --selected-bg:#f5f8ff; --selected-border:#dce6f6; --selected-text:#202d43;
      --code-bg:#f1f4f8; --quote-bg:#f7f9fc; --answer-heading-text:#172033;
      --answer-font-size:16px; --accent:#2359d6; --error:#9c2b20;
      box-sizing: border-box; width: min(800px, calc(100vw - 32px)); height: min(640px, calc(78vh - 24px));
      min-width: min(300px, calc(100vw - 32px)); min-height: min(240px, calc(100vh - 40px));
      max-width: calc(100vw - 32px); max-height: calc(100vh - 40px); resize: both;
      display: flex; flex-direction: column; overflow: hidden; color: var(--card-text);
      background: var(--card-bg); border: 1px solid var(--divider); border-radius: 14px;
      box-shadow: 0 16px 48px rgba(12, 24, 48, .24);
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .card[data-theme="warm"] {
      --card-bg:#fffaf1; --card-text:#382f23; --muted-text:#796a55; --divider:#eee2cc;
      --soft-bg:#fff5e3; --control-bg:#fffdf8; --control-border:#e9dcc5;
      --selected-bg:#fff1d8; --selected-border:#ead6ad; --selected-text:#3e3324;
      --code-bg:#f2e9da; --quote-bg:#fff1d8; --answer-heading-text:#30271c; --accent:#a45b18;
    }
    .card[data-theme="dark"] {
      --card-bg:#171b22; --card-text:#e6eaf1; --muted-text:#aab4c4; --divider:#303846;
      --soft-bg:#202630; --control-bg:#242b36; --control-border:#3a4555;
      --selected-bg:#222b38; --selected-border:#3b4b61; --selected-text:#e1e8f2;
      --code-bg:#252d39; --quote-bg:#222b38; --answer-heading-text:#edf1f7; --accent:#8ab4ff; --error:#ff938d;
    }
    .card[data-theme="mint"] {
      --card-bg:#f4fbf7; --card-text:#193b30; --muted-text:#557469; --divider:#d8eae1;
      --soft-bg:#eaf5ef; --control-bg:#fbfefc; --control-border:#cfe2d8;
      --selected-bg:#e0f2e8; --selected-border:#b8dcca; --selected-text:#21483a;
      --code-bg:#e6f0ea; --quote-bg:#e8f5ed; --answer-heading-text:#163d30; --accent:#247754; --error:#9c2b20;
    }
    .card[data-theme="slate"] {
      --card-bg:#f2f5f9; --card-text:#253346; --muted-text:#5b6b80; --divider:#d9e1ea;
      --soft-bg:#e9eff5; --control-bg:#fafbfd; --control-border:#cbd6e2;
      --selected-bg:#e1ebf5; --selected-border:#bfd0e1; --selected-text:#2c435b;
      --code-bg:#e5ebf1; --quote-bg:#e7eef6; --answer-heading-text:#20374f; --accent:#416d9c; --error:#9c2b20;
    }
    .card[hidden] { display: none; }
    .header { display:flex; align-items:center; gap:10px; padding:13px 14px; border-bottom:1px solid var(--divider); cursor:move; user-select:none; }
    .title { flex:1; font-weight:650; font-size:14px; }
    button { color:inherit; font:inherit; cursor:pointer; }
    .visibility-button, .display-settings-button { display:grid; place-items:center; flex:none; width:30px; height:30px; padding:0; border:1px solid var(--control-border); border-radius:8px; background:var(--control-bg); color:var(--muted-text); }
    .visibility-button:hover, .display-settings-button:hover { filter:brightness(.96); }
    .visibility-button:focus-visible, .display-settings-button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .display-settings-button[aria-expanded="true"] { color:var(--accent); border-color:var(--accent); }
    .display-settings-button svg { width:17px; height:17px; }
    .restore-button { position:fixed; top:20px; right:12px; display:grid; place-items:center; width:30px; height:30px; padding:0; border:1px solid #e3e8f0; border-radius:8px; color:#53627a; background:#fff; box-shadow:none; font-size:14px; line-height:1; cursor:pointer; }
    .restore-button[hidden] { display:none; }
    .restore-button:hover { background:#f0f3f8; }
    .restore-button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .display-settings { flex:none; padding:11px 14px 12px; border-bottom:1px solid var(--divider); background:var(--soft-bg); }
    .display-settings[hidden] { display:none; }
    .settings-row { display:flex; align-items:center; gap:10px; }
    .settings-label, .settings-value { color:var(--muted-text); font-size:12px; font-weight:600; }
    .settings-label { min-width:56px; }
    .settings-value { min-width:34px; text-align:right; font-variant-numeric:tabular-nums; }
    .font-size-slider { flex:1; min-width:90px; margin:0; accent-color:var(--accent); }
    .style-options { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin-top:9px; }
    .style-option { display:flex; align-items:center; gap:6px; min-height:30px; padding:4px 9px; border:1px solid var(--control-border); border-radius:8px; color:var(--muted-text); background:var(--control-bg); font-size:12px; }
    .style-option[aria-pressed="true"] { color:var(--card-text); border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
    .style-option:focus-visible, .font-size-slider:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .style-swatch { width:12px; height:12px; border:1px solid rgba(80,90,110,.25); border-radius:50%; }
    .style-swatch[data-theme-choice="paper"] { background:#fff; }
    .style-swatch[data-theme-choice="warm"] { background:#f2d8aa; }
    .style-swatch[data-theme-choice="dark"] { background:#252d39; }
    .style-swatch[data-theme-choice="mint"] { background:#b8dcca; }
    .style-swatch[data-theme-choice="slate"] { background:#bfd0e1; }
    .context-area { flex:none; padding:10px 14px 0; }
    .request-details { padding:7px 9px; border:1px solid var(--divider); border-radius:8px; background:var(--soft-bg); }
    .request-details summary { color:var(--muted-text); font-size:11px; font-weight:550; cursor:pointer; }
    .request-text { max-height:160px; overflow:auto; margin:7px 0 0; padding:7px 8px; border:1px solid var(--control-border); border-radius:6px; color:var(--muted-text); background:var(--control-bg); white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; font-size:12px; }
    .selected-panel { margin-top:9px; padding:10px 12px 12px; border:1px solid var(--selected-border); border-radius:10px; background:var(--selected-bg); }
    .selected-text { display:block; max-height:120px; overflow:auto; margin:0; padding:0; color:var(--selected-text); white-space:break-spaces; overflow-wrap:anywhere; tab-size:4; text-indent:2em; font:inherit; font-size:14px; font-weight:550; line-height:1.6; }
    .reading-area { flex:1; min-height:0; overflow:auto; border-top:1px solid var(--divider); }
    .answer-heading { display:flex; align-items:center; gap:8px; margin:10px 16px 0; color:var(--muted-text); font-size:12px; font-weight:650; }
    .answer-heading span { flex:1; }
    .copy-button { display:grid; place-items:center; width:36px; height:36px; padding:0; border:1px solid var(--control-border); border-radius:9px; background:var(--control-bg); }
    .copy-button[hidden] { display:none; }
    .copy-button:hover { filter:brightness(.96); }
    .copy-button:focus-visible, .button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .copy-button svg { width:17px; height:17px; }
    .body { padding:10px 16px 18px; overflow-wrap:anywhere; min-height:60px; line-height:1.65; font-size:var(--answer-font-size); }
    .body.streaming { white-space:normal; }
    .body .plain-text { white-space:pre-wrap; overflow-wrap:anywhere; }
    .body:empty::before { content:"正在等待回复…"; color:var(--muted-text); }
    .body h1, .body h2, .body h3, .body h4 { margin:1.1em 0 .5em; line-height:1.3; color:var(--answer-heading-text); }
    .body h1 { font-size:1.45em; } .body h2 { font-size:1.3em; } .body h3 { font-size:1.15em; }
    .body p { margin:.55em 0; }
    .body ul, .body ol { margin:.55em 0; padding-left:1.6em; }
    .body li { padding-left:.15em; }
    .body blockquote { margin:.7em 0; padding:.2em .8em; border-left:3px solid var(--control-border); color:var(--muted-text); background:var(--quote-bg); }
    .body pre { overflow:auto; margin:.75em 0; padding:12px; border-radius:9px; background:var(--code-bg); font:.9em/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .body code { padding:.12em .35em; border-radius:4px; background:var(--code-bg); font: .9em ui-monospace, SFMono-Regular, Consolas, monospace; }
    .body pre code { padding:0; background:transparent; font-size:1em; }
    .body table { width:100%; margin:.8em 0; border-collapse:collapse; font-size:.95em; }
    .body th, .body td { padding:7px 9px; border:1px solid var(--control-border); text-align:left; vertical-align:top; }
    .body th { background:var(--code-bg); font-weight:650; }
    .body a { color:var(--accent); text-decoration:underline; }
    .body hr { border:0; border-top:1px solid var(--control-border); margin:1em 0; }
    .status { padding:0 16px 12px; color:var(--muted-text); font-size:12px; }
    .actions { display:flex; justify-content:center; padding:0 14px 14px; }
    .button { min-width:108px; min-height:40px; border:0; border-radius:9px; padding:7px 18px; background:var(--answer-heading-text); color:var(--card-bg); font-weight:600; }
    .button:hover { filter:brightness(1.15); }
    .retry-button { min-width:108px; min-height:40px; border:1px solid var(--control-border); border-radius:9px; padding:7px 18px; color:var(--accent); background:var(--soft-bg); font-weight:600; }
    .retry-button:hover { filter:brightness(.96); }
    .retry-button:disabled { opacity:.6; cursor:wait; }
    .hide-action-button { min-width:108px; min-height:40px; border:1px solid var(--control-border); border-radius:9px; padding:7px 18px; color:var(--card-text); background:var(--control-bg); font-weight:600; }
    .hide-action-button:hover { filter:brightness(.96); }
    .error { color:var(--error); }
    .spinner { width:14px; height:14px; border:2px solid var(--control-border); border-top-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation:none; } }
  `;

  const card = document.createElement("section");
  card.className = "card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "AI 回复");
  card.hidden = true;

  const header = document.createElement("header");
  header.className = "header";
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = "AI 回复";
  const displaySettingsButton = document.createElement("button");
  displaySettingsButton.className = "display-settings-button";
  displaySettingsButton.type = "button";
  displaySettingsButton.setAttribute("aria-label", "显示样式设置");
  displaySettingsButton.setAttribute("aria-expanded", "false");
  displaySettingsButton.title = "字体与显示风格";
  const displaySettingsIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  displaySettingsIcon.setAttribute("viewBox", "0 0 24 24");
  displaySettingsIcon.setAttribute("fill", "none");
  displaySettingsIcon.setAttribute("stroke", "currentColor");
  displaySettingsIcon.setAttribute("stroke-width", "1.8");
  displaySettingsIcon.setAttribute("stroke-linecap", "round");
  displaySettingsIcon.setAttribute("stroke-linejoin", "round");
  displaySettingsIcon.setAttribute("aria-hidden", "true");
  const displaySettingsPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  displaySettingsPath.setAttribute("d", "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-6v2m0 15v2m10-9h-2m-16 0H2m17.07-7.07-1.42 1.42M6.35 17.65l-1.42 1.42m14.14 0-1.42-1.42M6.35 6.35 4.93 4.93");
  displaySettingsIcon.append(displaySettingsPath);
  displaySettingsButton.append(displaySettingsIcon);
  const visibilityButton = document.createElement("button");
  visibilityButton.className = "visibility-button";
  visibilityButton.type = "button";
  visibilityButton.setAttribute("aria-expanded", "true");
  visibilityButton.setAttribute("aria-label", "隐藏回复框");
  visibilityButton.title = "隐藏回复框";
  visibilityButton.textContent = "−";
  header.append(spinner, title, displaySettingsButton, visibilityButton);
  const restoreButton = document.createElement("button");
  restoreButton.className = "restore-button";
  restoreButton.type = "button";
  restoreButton.setAttribute("aria-label", "显示 AI 回复框");
  restoreButton.title = "显示 AI 回复框";
  restoreButton.textContent = "+";
  restoreButton.hidden = true;

  const displaySettings = document.createElement("section");
  displaySettings.className = "display-settings";
  displaySettings.setAttribute("aria-label", "字体与显示风格");
  displaySettings.hidden = true;
  const fontSizeRow = document.createElement("div");
  fontSizeRow.className = "settings-row";
  const fontSizeLabel = document.createElement("label");
  fontSizeLabel.className = "settings-label";
  fontSizeLabel.htmlFor = "quick-ai-font-size";
  fontSizeLabel.textContent = "字体大小";
  const fontSizeSlider = document.createElement("input");
  fontSizeSlider.className = "font-size-slider";
  fontSizeSlider.id = "quick-ai-font-size";
  fontSizeSlider.type = "range";
  fontSizeSlider.min = "12";
  fontSizeSlider.max = "24";
  fontSizeSlider.step = "1";
  fontSizeSlider.setAttribute("aria-label", "回复字体大小");
  const fontSizeValue = document.createElement("output");
  fontSizeValue.className = "settings-value";
  fontSizeRow.append(fontSizeLabel, fontSizeSlider, fontSizeValue);
  const styleOptions = document.createElement("div");
  styleOptions.className = "style-options";
  styleOptions.setAttribute("role", "group");
  styleOptions.setAttribute("aria-label", "显示风格");
  const styleChoices = [
    { id: "paper", label: "清爽" },
    { id: "warm", label: "暖色" },
    { id: "dark", label: "深色" },
    { id: "mint", label: "薄荷" },
    { id: "slate", label: "蓝灰" }
  ];
  const styleButtons = new Map();
  for (const choice of styleChoices) {
    const button = document.createElement("button");
    button.className = "style-option";
    button.type = "button";
    button.dataset.themeChoice = choice.id;
    button.setAttribute("aria-pressed", "false");
    const swatch = document.createElement("span");
    swatch.className = "style-swatch";
    swatch.dataset.themeChoice = choice.id;
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = choice.label;
    button.append(swatch, label);
    styleButtons.set(choice.id, button);
    styleOptions.append(button);
  }
  displaySettings.append(fontSizeRow, styleOptions);

  const body = document.createElement("div");
  body.className = "body";
  body.setAttribute("aria-live", "polite");
  const contextArea = document.createElement("div");
  contextArea.className = "context-area";
  const requestDetails = document.createElement("details");
  requestDetails.className = "request-details";
  const requestSummary = document.createElement("summary");
  requestSummary.textContent = "提示词";
  const requestText = document.createElement("pre");
  requestText.className = "request-text";
  requestDetails.append(requestSummary, requestText);

  const selectedPanel = document.createElement("section");
  selectedPanel.className = "selected-panel";
  selectedPanel.setAttribute("aria-label", "选中的文字");
  const selectedText = document.createElement("pre");
  selectedText.className = "selected-text";
  selectedPanel.append(selectedText);
  contextArea.append(requestDetails, selectedPanel);

  const answerHeading = document.createElement("div");
  answerHeading.className = "answer-heading";
  const answerLabel = document.createElement("span");
  answerLabel.textContent = "回复";
  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", "复制回复");
  copyButton.title = "复制回复";
  const copyIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  copyIcon.setAttribute("viewBox", "0 0 24 24");
  copyIcon.setAttribute("fill", "none");
  copyIcon.setAttribute("stroke", "currentColor");
  copyIcon.setAttribute("stroke-width", "1.8");
  copyIcon.setAttribute("stroke-linecap", "round");
  copyIcon.setAttribute("stroke-linejoin", "round");
  copyIcon.setAttribute("aria-hidden", "true");
  const copyRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  copyRect.setAttribute("x", "8"); copyRect.setAttribute("y", "8");
  copyRect.setAttribute("width", "12"); copyRect.setAttribute("height", "12"); copyRect.setAttribute("rx", "2");
  const copyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  copyPath.setAttribute("d", "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2");
  copyIcon.append(copyRect, copyPath);
  copyButton.append(copyIcon);
  answerHeading.append(answerLabel, copyButton);
  const readingArea = document.createElement("div");
  readingArea.className = "reading-area";
  readingArea.append(answerHeading, body);
  const status = document.createElement("div");
  status.className = "status";
  const actions = document.createElement("div");
  actions.className = "actions";
  const retryButton = document.createElement("button");
  retryButton.className = "retry-button";
  retryButton.type = "button";
  retryButton.textContent = "重试";
  retryButton.hidden = true;
  const hideActionButton = document.createElement("button");
  hideActionButton.className = "hide-action-button";
  hideActionButton.type = "button";
  hideActionButton.textContent = "隐藏";
  hideActionButton.setAttribute("aria-label", "隐藏回复框");
  const settingsButton = document.createElement("button");
  settingsButton.className = "button";
  settingsButton.type = "button";
  settingsButton.textContent = "关闭";
  actions.append(retryButton, hideActionButton, settingsButton);
  card.append(header, displaySettings, contextArea, readingArea, status, actions);
  shadow.append(style, card, restoreButton);

  let currentRequestId = null;
  let fullText = "";
  let fullTextParts = [];
  let isCollapsed = false;
  let lastRequest = null;
  let streamRenderTimer = 0;
  let streamParser = null;
  let streamRenderedContent = null;
  let streamPlainTextNode = null;
  let streamParserUnavailable = false;
  let streamFinalized = false;
  let pendingStreamChunks = [];
  let pendingStreamChunkIndex = 0;
  let pendingStreamChunkOffset = 0;
  let pendingStreamCharacters = 0;
  let receivedStreamCharacters = 0;
  let responseTruncated = false;
  let streamDoneReceived = false;
  const STREAM_RENDER_INTERVAL_MS = 100;
  const MAX_STREAM_CHARS_PER_TICK = 2_048;
  const MAX_RESPONSE_CHARS = 250_000;
  const appearanceStorageKey = "quickAiOverlayAppearance";
  const appearanceDefaults = { fontSize: 16, theme: "paper" };
  let appearance = { ...appearanceDefaults };
  let appearanceTouchedBeforeLoad = false;
  let appearanceSaveTimer = 0;

  const normalizeAppearance = (value) => {
    const fontSize = Number(value?.fontSize);
    return {
      fontSize: Number.isFinite(fontSize) ? Math.min(24, Math.max(12, Math.round(fontSize))) : appearanceDefaults.fontSize,
      theme: styleButtons.has(value?.theme) ? value.theme : appearanceDefaults.theme
    };
  };

  const applyAppearance = () => {
    card.dataset.theme = appearance.theme;
    card.style.setProperty("--answer-font-size", `${appearance.fontSize}px`);
    fontSizeSlider.value = String(appearance.fontSize);
    fontSizeValue.textContent = `${appearance.fontSize}px`;
    for (const [theme, button] of styleButtons) {
      button.setAttribute("aria-pressed", String(theme === appearance.theme));
    }
  };

  const saveAppearance = () => {
    clearTimeout(appearanceSaveTimer);
    const value = { ...appearance };
    appearanceSaveTimer = window.setTimeout(() => {
      extensionApi.storage.local.set({ [appearanceStorageKey]: value }).catch(() => {});
    }, 180);
  };

  applyAppearance();
  extensionApi.storage.local.get(appearanceStorageKey).then((stored) => {
    if (!appearanceTouchedBeforeLoad) {
      appearance = normalizeAppearance(stored?.[appearanceStorageKey]);
      applyAppearance();
    }
  }).catch(() => {});
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[appearanceStorageKey]) return;
    appearance = normalizeAppearance(changes[appearanceStorageKey].newValue);
    applyAppearance();
  });

  fontSizeSlider.addEventListener("input", () => {
    appearanceTouchedBeforeLoad = true;
    appearance.fontSize = Number(fontSizeSlider.value);
    applyAppearance();
    saveAppearance();
  });
  for (const [theme, button] of styleButtons) {
    button.addEventListener("click", () => {
      appearanceTouchedBeforeLoad = true;
      appearance.theme = theme;
      applyAppearance();
      saveAppearance();
    });
  }
  displaySettingsButton.addEventListener("click", () => {
    displaySettings.hidden = !displaySettings.hidden;
    displaySettingsButton.setAttribute("aria-expanded", String(!displaySettings.hidden));
    displaySettingsButton.setAttribute("aria-label", displaySettings.hidden ? "显示样式设置" : "隐藏样式设置");
  });

  const resetStreamState = () => {
    clearTimeout(streamRenderTimer);
    streamRenderTimer = 0;
    fullText = "";
    fullTextParts = [];
    streamParser = null;
    streamRenderedContent = null;
    streamPlainTextNode = null;
    streamParserUnavailable = false;
    streamFinalized = false;
    pendingStreamChunks = [];
    pendingStreamChunkIndex = 0;
    pendingStreamChunkOffset = 0;
    pendingStreamCharacters = 0;
    receivedStreamCharacters = 0;
    responseTruncated = false;
    streamDoneReceived = false;
  };

  const appendPlainStreamingText = (value) => {
    if (!value) return;
    if (!streamPlainTextNode) {
      const container = document.createElement("div");
      container.className = "plain-text";
      streamPlainTextNode = document.createTextNode("");
      container.append(streamPlainTextNode);
      (streamRenderedContent || body).append(container);
    }
    streamPlainTextNode.appendData(value);
  };

  const switchToPlainText = (message) => {
    streamParserUnavailable = true;
    streamParser = null;
    streamRenderedContent = null;
    streamPlainTextNode = null;
    body.replaceChildren();
    body.classList.add("streaming");
    const container = document.createElement("div");
    container.className = "plain-text";
    streamPlainTextNode = document.createTextNode("");
    container.append(streamPlainTextNode);
    body.append(container);
    // 回退也分批追加，避免解析器异常时同步重建整篇长回复。
    pendingStreamChunks = fullTextParts.slice();
    pendingStreamChunkIndex = 0;
    pendingStreamChunkOffset = 0;
    pendingStreamCharacters = receivedStreamCharacters;
    if (message) status.textContent = message;
  };

  const ensureStreamingParser = () => {
    if (streamParser || streamParserUnavailable) return Boolean(streamParser);
    const parserApi = globalThis.__quickAiStreamingMarkdown;
    if (!parserApi) {
      switchToPlainText("Markdown 解析器无法加载，当前回复以纯文本显示。");
      return false;
    }

    body.replaceChildren();
    body.classList.add("streaming");
    streamRenderedContent = document.createElement("div");
    body.append(streamRenderedContent);
    try {
      streamParser = parserApi.parser(createSafeStreamingRenderer(streamRenderedContent, parserApi));
      return true;
    } catch {
      switchToPlainText("Markdown 解析器启动失败，当前回复以纯文本显示。");
      return false;
    }
  };

  const scheduleStreamingUpdate = () => {
    if (streamRenderTimer || streamFinalized) return;
    streamRenderTimer = window.setTimeout(() => {
      streamRenderTimer = 0;
      flushPendingStreamText();
    }, STREAM_RENDER_INTERVAL_MS);
  };

  const takePendingStreamText = (budget) => {
    const flushedParts = [];
    while (budget > 0 && pendingStreamChunkIndex < pendingStreamChunks.length) {
      const chunk = pendingStreamChunks[pendingStreamChunkIndex];
      let end = Math.min(chunk.length, pendingStreamChunkOffset + budget);
      if (end < chunk.length && end > pendingStreamChunkOffset) {
        const previous = chunk.charCodeAt(end - 1);
        const next = chunk.charCodeAt(end);
        if (previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--;
      }
      if (end === pendingStreamChunkOffset) end = Math.min(chunk.length, end + 2);
      const part = chunk.slice(pendingStreamChunkOffset, end);
      flushedParts.push(part);
      const count = part.length;
      pendingStreamChunkOffset = end;
      pendingStreamCharacters -= count;
      budget -= count;
      if (pendingStreamChunkOffset >= chunk.length) {
        pendingStreamChunkIndex++;
        pendingStreamChunkOffset = 0;
      }
    }

    if (pendingStreamChunkIndex > 128) {
      pendingStreamChunks = pendingStreamChunks.slice(pendingStreamChunkIndex);
      pendingStreamChunkIndex = 0;
    }
    return flushedParts.join("");
  };

  const flushPendingStreamText = () => {
    if (pendingStreamCharacters > 0) {
      const text = takePendingStreamText(MAX_STREAM_CHARS_PER_TICK);
      if (text) {
        const parserWasUnavailable = streamParserUnavailable;
        if (ensureStreamingParser()) {
          try {
            globalThis.__quickAiStreamingMarkdown.parser_write(streamParser, text);
          } catch {
            switchToPlainText("Markdown 解析遇到异常，后续内容以纯文本显示。");
          }
        } else if (parserWasUnavailable) {
          appendPlainStreamingText(text);
        }
      }
    }

    if (pendingStreamCharacters > 0) {
      scheduleStreamingUpdate();
    } else if (streamDoneReceived) {
      startFinalMarkdownRender();
    }
  };

  const queueStreamText = (value) => {
    if (!value || responseTruncated || streamFinalized) return;
    const remaining = MAX_RESPONSE_CHARS - receivedStreamCharacters;
    const accepted = value.slice(0, Math.max(0, remaining));
    if (accepted) {
      pendingStreamChunks.push(accepted);
      fullTextParts.push(accepted);
      pendingStreamCharacters += accepted.length;
      receivedStreamCharacters += accepted.length;
    }
    if (accepted.length < value.length) {
      responseTruncated = true;
      streamDoneReceived = true;
      status.textContent = "回复超过安全长度上限，正在整理已接收的内容…";
      if (currentRequestId) {
        void extensionApi.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId: currentRequestId }).catch(() => {});
      }
    }
    scheduleStreamingUpdate();
  };

  const startFinalMarkdownRender = () => {
    if (!streamDoneReceived || pendingStreamCharacters > 0 || streamFinalized) return;
    streamFinalized = true;
    clearTimeout(streamRenderTimer);
    streamRenderTimer = 0;
    fullText = fullTextParts.join("");
    spinner.hidden = true;
    retryButton.hidden = true;
    copyButton.hidden = !fullText;

    if (ensureStreamingParser()) {
      try {
        globalThis.__quickAiStreamingMarkdown.parser_end(streamParser);
      } catch {
        streamFinalized = false;
        switchToPlainText("Markdown 收尾遇到异常，正在以纯文本整理回复。");
        scheduleStreamingUpdate();
        return;
      }
    }
    streamParser = null;
    body.classList.remove("streaming");
    status.textContent = responseTruncated
      ? "已完成（回复过长，已安全截断）"
      : (fullText ? "生成完成" : "模型没有返回文字内容。");
  };
  const boundsStorageKey = "quickAiOverlayBounds";
  let boundsSaveTimer = 0;
  let activeDrag = null;

  const viewportLimits = () => ({
    maxWidth: Math.max(1, window.innerWidth - 32),
    maxHeight: Math.max(1, window.innerHeight - 40)
  });

  const syncRestoreButtonPosition = () => {
    const rect = card.getBoundingClientRect();
    const width = rect.width || Number.parseFloat(card.style.width) || Math.min(800, window.innerWidth - 32);
    const left = rect.width ? rect.left : Number.parseFloat(host.style.left);
    const top = rect.height ? rect.top : Number.parseFloat(host.style.top);
    const cardLeft = Number.isFinite(left) ? left : window.innerWidth - width - 20;
    const cardTop = Number.isFinite(top) ? top : 20;
    restoreButton.style.left = `${Math.min(Math.max(12, cardLeft + width - 44), Math.max(12, window.innerWidth - 42))}px`;
    restoreButton.style.right = "auto";
    restoreButton.style.top = `${Math.min(Math.max(12, cardTop + 13), Math.max(12, window.innerHeight - 42))}px`;
  };

  const clampPosition = () => {
    const rect = card.getBoundingClientRect();
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - rect.width - 12));
    const top = Math.min(Math.max(12, rect.top), Math.max(12, window.innerHeight - rect.height - 12));
    host.style.left = `${left}px`;
    host.style.right = "auto";
    host.style.top = `${top}px`;
    syncRestoreButtonPosition();
  };

  const saveBounds = () => {
    if (card.hidden) return;
    const rect = card.getBoundingClientRect();
    const bounds = { version: 2, width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = window.setTimeout(() => {
      extensionApi.storage.local.set({ [boundsStorageKey]: bounds }).catch(() => {});
    }, 120);
  };

  const constrainSize = () => {
    if (card.hidden) return;
    const { maxWidth, maxHeight } = viewportLimits();
    const rect = card.getBoundingClientRect();
    const width = Math.min(rect.width, maxWidth);
    const height = Math.min(rect.height, maxHeight);
    if (width !== rect.width) card.style.width = `${width}px`;
    if (height !== rect.height) card.style.height = `${height}px`;
    clampPosition();
    saveBounds();
  };

  // 原生缩放手柄在部分页面缩放比例下可能越过 max-width/max-height，观察并校正最终尺寸。
  const resizeObserver = new ResizeObserver(constrainSize);
  resizeObserver.observe(card);

  extensionApi.storage.local.get(boundsStorageKey).then((stored) => {
    const bounds = stored[boundsStorageKey];
    if (!bounds || ![bounds.width, bounds.height, bounds.left, bounds.top].every(Number.isFinite)) return;
    const { maxWidth, maxHeight } = viewportLimits();
    const restoredWidth = Math.min(Math.max(300, bounds.width), maxWidth);
    card.style.width = `${restoredWidth}px`;
    card.style.height = `${Math.min(Math.max(180, bounds.height), maxHeight)}px`;
    const maxLeft = Math.max(12, window.innerWidth - restoredWidth - 12);
    // 旧版误用最大宽度限制坐标，恢复时会把所有位置压到最左侧约 20px；迁移这类旧默认位置到右侧。
    const isLegacyLeftDefault = bounds.version !== 2 && bounds.left <= 20 && bounds.left < maxLeft - 40;
    const restoredLeft = isLegacyLeftDefault ? maxLeft : Math.min(Math.max(12, bounds.left), maxLeft);
    host.style.left = `${restoredLeft}px`;
    host.style.right = "auto";
    host.style.top = `${Math.min(Math.max(12, bounds.top), Math.max(12, window.innerHeight - 180 - 12))}px`;
    syncRestoreButtonPosition();
  }).catch(() => {});

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    const rect = card.getBoundingClientRect();
    activeDrag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener("pointermove", (event) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const left = Math.min(Math.max(12, event.clientX - activeDrag.offsetX), Math.max(12, window.innerWidth - card.offsetWidth - 12));
    const top = Math.min(Math.max(12, event.clientY - activeDrag.offsetY), Math.max(12, window.innerHeight - card.offsetHeight - 12));
    host.style.left = `${left}px`;
    host.style.right = "auto";
    host.style.top = `${top}px`;
    syncRestoreButtonPosition();
    saveBounds();
  });
  const endDrag = (event) => {
    if (activeDrag?.pointerId === event.pointerId) activeDrag = null;
  };
  header.addEventListener("pointerup", endDrag);
  header.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", () => {
    if (card.hidden) return;
    const { maxWidth, maxHeight } = viewportLimits();
    card.style.width = `${Math.min(card.getBoundingClientRect().width, maxWidth)}px`;
    card.style.height = `${Math.min(card.getBoundingClientRect().height, maxHeight)}px`;
    clampPosition();
    saveBounds();
  });

  const setCollapsed = (collapsed) => {
    if (collapsed) syncRestoreButtonPosition();
    isCollapsed = collapsed;
    if (collapsed) {
      displaySettings.hidden = true;
      displaySettingsButton.setAttribute("aria-expanded", "false");
      displaySettingsButton.setAttribute("aria-label", "显示样式设置");
    }
    card.hidden = collapsed;
    restoreButton.hidden = !collapsed;
    visibilityButton.textContent = collapsed ? "+" : "−";
    visibilityButton.setAttribute("aria-expanded", String(!collapsed));
    visibilityButton.setAttribute("aria-label", collapsed ? "显示回复框" : "隐藏回复框");
    visibilityButton.title = collapsed ? "显示回复框" : "隐藏回复框";
  };

  visibilityButton.addEventListener("click", () => {
    saveBounds();
    setCollapsed(true);
  });
  hideActionButton.addEventListener("click", () => {
    saveBounds();
    setCollapsed(true);
  });
  restoreButton.addEventListener("click", () => {
    setCollapsed(false);
    clampPosition();
  });

  retryButton.addEventListener("click", async () => {
    if (!lastRequest || retryButton.disabled) return;
    retryButton.disabled = true;
    retryButton.textContent = "正在重试…";
    try {
      await extensionApi.runtime.sendMessage({ type: "RETRY_REQUEST", ...lastRequest });
    } catch {
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      status.textContent = "无法发起重试，请重新加载页面后再试。";
    }
  });

  const closeOverlay = () => {
    saveBounds();
    if (currentRequestId && spinner.hidden === false) {
      extensionApi.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId: currentRequestId });
    }
    clearTimeout(streamRenderTimer);
    streamRenderTimer = 0;
    resetStreamState();
    currentRequestId = null;
    card.hidden = true;
    restoreButton.hidden = true;
    isCollapsed = false;
  };
  settingsButton.addEventListener("click", closeOverlay);

  copyButton.addEventListener("click", async () => {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = fullText;
        textarea.style.cssText = "position:fixed;left:-9999px;top:0";
        shadow.appendChild(textarea);
        textarea.select();
        if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
        textarea.remove();
      } catch {
        status.textContent = "复制失败，请检查浏览器剪贴板权限。";
        return;
      }
    }
    status.textContent = "已复制回复。";
    window.setTimeout(() => {
      if (currentRequestId) status.textContent = "";
    }, 1600);
  });

  extensionApi.runtime.onMessage.addListener((message) => {
    if (message?.type === "SHOW_LOADING") {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
      resetStreamState();
      currentRequestId = message.requestId;
      lastRequest = {
        selectedText: String(message.retrySelectedText ?? message.selectedText ?? ""),
        promptId: String(message.promptId ?? "")
      };
      requestDetails.open = false;
      requestSummary.textContent = `提示词${message.promptName ? ` · ${message.promptName}` : ""}`;
      requestText.textContent = message.promptText || "";
      const selectedTextValue = String(message.selectedText ?? "").replace(/\r\n?/g, "\n");
      selectedText.textContent = selectedTextValue;
      // 如果原始文本已带首行空格，就保留这些空格，避免再叠加 CSS 缩进。
      selectedText.style.textIndent = /^[\t \u3000]/.test(selectedTextValue) ? "0" : "2em";
      body.textContent = "";
      body.classList.remove("error");
      body.classList.remove("streaming");
      status.textContent = "正在生成 Markdown 回复…";
      spinner.hidden = false;
      copyButton.hidden = true;
      retryButton.hidden = true;
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      displaySettings.hidden = true;
      displaySettingsButton.setAttribute("aria-expanded", "false");
      displaySettingsButton.setAttribute("aria-label", "显示样式设置");
      setCollapsed(false);
      card.hidden = false;
      clampPosition();
      return;
    }

    if (message?.requestId !== currentRequestId) return;

    if (message.type === "APPEND_TEXT") {
      queueStreamText(String(message.text ?? ""));
    } else if (message.type === "STREAM_DONE") {
      streamDoneReceived = true;
      if (pendingStreamCharacters > 0) scheduleStreamingUpdate();
      else void startFinalMarkdownRender();
    } else if (message.type === "SHOW_ERROR") {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
      resetStreamState();
      spinner.hidden = true;
      body.textContent = message.message || "请求失败，请稍后重试。";
      body.classList.add("error");
      body.classList.remove("streaming");
      status.textContent = "";
      copyButton.hidden = true;
      retryButton.hidden = false;
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      settingsButton.textContent = "关闭";
      if (!isCollapsed) card.hidden = false;
    }
  });

  function createSafeStreamingRenderer(root, parserApi) {
    const renderer = parserApi.default_renderer(root);
    return {
      data: renderer.data,
      add_token(data, type) {
        renderer.add_token(data, type);
        const node = data.nodes[data.index];
        if (!node) return;

        if (type === parserApi.IMAGE) {
          // 不加载模型生成的远程图片；保留 alt 文本，避免额外网络请求。
          const placeholder = document.createElement("span");
          placeholder.className = "markdown-image-alt";
          node.replaceWith(placeholder);
          data.nodes[data.index] = placeholder;
        } else if (type === parserApi.EQUATION_BLOCK || type === parserApi.EQUATION_INLINE) {
          const equation = document.createElement(type === parserApi.EQUATION_BLOCK ? "pre" : "code");
          equation.className = type === parserApi.EQUATION_BLOCK ? "math-block" : "math-inline";
          node.replaceWith(equation);
          data.nodes[data.index] = equation;
        } else if (type === parserApi.LINK || type === parserApi.RAW_URL) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        } else if (type === parserApi.CHECKBOX) {
          node.disabled = true;
        }
      },
      end_token: renderer.end_token,
      add_text: renderer.add_text,
      set_attr(data, type, value) {
        const node = data.nodes[data.index];
        if (!node) return;
        if (type === parserApi.HREF) {
          const href = safeMarkdownHref(value);
          if (href) node.setAttribute("href", href);
          return;
        }
        if (type === parserApi.SRC) return;
        if (type === parserApi.LANG) {
          const language = String(value).trim();
          if (/^[a-z0-9_+-]{1,32}$/i.test(language)) node.className = `language-${language}`;
          return;
        }
        if (type === parserApi.CHECKED && node instanceof HTMLInputElement) {
          node.checked = value === "" || value === "true" || value === "checked";
          return;
        }
        if (type === parserApi.START) {
          const start = Number.parseInt(value, 10);
          if (Number.isSafeInteger(start) && start > 0 && start <= 100_000) node.setAttribute("start", String(start));
        }
      }
    };
  }
  function safeMarkdownHref(value) {
    try {
      const url = new URL(value, location.href);
      return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }
})();
