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
      position:relative; min-width: min(300px, calc(100vw - 32px)); min-height: min(240px, calc(100vh - 40px));
      max-width: calc(100vw - 32px); max-height: calc(100vh - 40px);
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
    .restore-button { position:fixed; top:20px; right:12px; display:flex; align-items:center; justify-content:center; width:92px; height:34px; padding:0 10px; border:1px solid #e3e8f0; border-radius:9px; color:#53627a; background:#fff; box-shadow:0 2px 6px rgba(20,32,52,.12); font-size:13px; font-weight:600; line-height:1; white-space:nowrap; cursor:pointer; }
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
    .outside-dismiss-row { display:flex; align-items:flex-start; gap:9px; margin-top:11px; padding-top:10px; border-top:1px solid var(--divider); cursor:pointer; }
    .outside-dismiss-checkbox { flex:none; width:15px; height:15px; margin:1px 0 0; accent-color:var(--accent); }
    .outside-dismiss-copy { display:grid; gap:2px; }
    .outside-dismiss-label { color:var(--card-text); font-size:12px; font-weight:600; }
    .outside-dismiss-hint { color:var(--muted-text); font-size:11px; line-height:1.4; }
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
    .transcript { padding:0 0 8px; }
    .assistant-turn { padding-top:10px; }
    .assistant-turn > summary { cursor:pointer; list-style-position:inside; }
    .assistant-turn:not([open]) > summary::after { content:" · 点击展开回复"; font-weight:400; }
    .turn-label { margin:0 16px 2px; color:var(--muted-text); font-size:11px; font-weight:650; }
    .user-turn { margin:12px 16px 0; }
    .user-turn-heading { display:flex; align-items:center; justify-content:space-between; min-height:24px; margin-bottom:2px; }
    .user-turn-heading .turn-label { margin:0; }
    .user-message { padding:9px 11px; border:1px solid var(--control-border); border-radius:10px; background:var(--soft-bg); white-space:pre-wrap; overflow-wrap:anywhere; }
    .user-edit-button { display:grid; place-items:center; width:28px; height:26px; padding:0; border:1px solid transparent; border-radius:7px; color:var(--muted-text); background:transparent; }
    .user-edit-button:hover { border-color:var(--control-border); color:var(--accent); background:var(--soft-bg); }
    .user-edit-button:disabled { opacity:.45; cursor:not-allowed; }
    .user-edit-button[hidden], .user-editor[hidden] { display:none; }
    .user-edit-button svg { width:15px; height:15px; }
    .user-editor { display:grid; gap:8px; }
    .user-editor-input { box-sizing:border-box; width:100%; min-height:76px; max-height:200px; resize:vertical; padding:9px 11px; border:1px solid var(--control-border); border-radius:9px; color:var(--card-text); background:var(--control-bg); font:inherit; line-height:1.5; }
    .user-editor-input:focus-visible, .user-editor-actions button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .user-editor-warning { margin:0; color:var(--muted-text); font-size:11px; line-height:1.45; }
    .user-editor-warning[hidden] { display:none; }
    .user-editor-actions { display:flex; justify-content:flex-end; gap:7px; }
    .user-editor-actions button { min-height:32px; padding:5px 10px; border:1px solid var(--control-border); border-radius:8px; color:var(--muted-text); background:var(--control-bg); font-size:12px; font-weight:600; }
    .user-editor-actions .user-editor-save { border-color:var(--accent); color:var(--card-bg); background:var(--accent); }
    .edit-confirmation-dialog { width:min(400px, calc(100vw - 36px)); padding:0; border:1px solid var(--control-border); border-radius:13px; color:var(--card-text); background:var(--card-bg); box-shadow:0 18px 50px rgba(12,24,48,.28); }
    .edit-confirmation-dialog::backdrop { background:rgba(12,22,38,.42); }
    .edit-confirmation-content { display:grid; gap:13px; padding:20px; }
    .edit-confirmation-content h2 { margin:0; font-size:16px; }
    .edit-confirmation-content p { margin:0; color:var(--muted-text); font-size:13px; line-height:1.55; }
    .edit-confirmation-actions { display:flex; justify-content:flex-end; gap:8px; }
    .edit-confirmation-actions button { min-height:36px; padding:6px 12px; border:1px solid var(--control-border); border-radius:8px; color:var(--muted-text); background:var(--control-bg); font-size:12px; font-weight:600; }
    .edit-confirmation-actions .edit-confirmation-continue { border-color:var(--accent); color:var(--card-bg); background:var(--accent); }
    .answer-heading { display:flex; align-items:center; gap:8px; margin:10px 16px 0; color:var(--muted-text); font-size:12px; font-weight:650; }
    .answer-heading span { flex:1; }
    .copy-button { display:grid; place-items:center; width:36px; height:36px; padding:0; border:1px solid var(--control-border); border-radius:9px; background:var(--control-bg); }
    .copy-button[hidden] { display:none; }
    .copy-button:hover { filter:brightness(.96); }
    .copy-button:focus-visible, .button:focus-visible, .hide-action-button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
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
    .composer { flex:none; display:flex; align-items:flex-end; gap:9px; padding:10px 14px; border-top:1px solid var(--divider); background:var(--card-bg); }
    .composer[hidden] { display:none; }
    .composer-input { flex:1; min-width:0; min-height:40px; max-height:112px; resize:vertical; box-sizing:border-box; padding:8px 10px; border:1px solid var(--control-border); border-radius:9px; color:var(--card-text); background:var(--control-bg); font:inherit; line-height:1.45; }
    .composer-input:focus-visible, .send-button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .composer-input:disabled { opacity:.65; }
    .send-button { flex:none; min-width:66px; min-height:40px; border:0; border-radius:9px; padding:7px 14px; color:var(--card-bg); background:var(--accent); font-weight:600; }
    .send-button:disabled { opacity:.55; cursor:not-allowed; }
    .status { padding:8px 16px 0; color:var(--muted-text); font-size:12px; }
    .status:empty { display:none; }
    .actions { display:flex; align-items:center; justify-content:center; gap:10px; padding:8px 14px 14px; }
    .actions > button { flex:1; min-width:0; max-width:160px; padding-right:8px; padding-left:8px; white-space:nowrap; font-size:12px; }
    .button, .hide-action-button { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:42px; border-radius:10px; padding:7px 12px; font-weight:650; }
    .button { border:0; background:var(--answer-heading-text); color:var(--card-bg); box-shadow:0 2px 5px rgba(12,24,48,.16); }
    .button::before { content:"×"; font-size:19px; font-weight:400; line-height:1; }
    .button:hover { filter:brightness(1.12); }
    .retry-button { min-width:108px; min-height:40px; border:1px solid var(--control-border); border-radius:9px; padding:7px 18px; color:var(--accent); background:var(--soft-bg); font-weight:600; }
    .retry-button:hover { filter:brightness(.96); }
    .retry-button:disabled { opacity:.6; cursor:wait; }
    .hide-action-button { border:1px solid var(--control-border); color:var(--muted-text); background:var(--control-bg); }
    .hide-action-button::before { content:"−"; font-size:19px; font-weight:400; line-height:1; }
    .hide-action-button:hover { color:var(--card-text); border-color:var(--muted-text); background:var(--soft-bg); }
    .resize-handle { position:absolute; z-index:5; display:grid; place-items:center; width:24px; min-width:24px; height:24px; min-height:24px; padding:0; border:0; border-radius:0; color:var(--muted-text); background:transparent; touch-action:none; }
    .resize-handle:hover { background:transparent; }
    .resize-handle:focus-visible { outline:2px solid var(--accent); outline-offset:-3px; }
    .resize-handle::after { width:9px; height:9px; border-color:currentColor; border-style:solid; content:""; opacity:.6; }
    .resize-handle[data-corner="top-left"] { top:0; left:0; cursor:nwse-resize; }
    .resize-handle[data-corner="top-left"]::after { border-width:1.5px 0 0 1.5px; }
    .resize-handle[data-corner="top-right"] { top:0; right:0; cursor:nesw-resize; }
    .resize-handle[data-corner="top-right"]::after { border-width:1.5px 1.5px 0 0; }
    .resize-handle[data-corner="bottom-left"] { bottom:0; left:0; cursor:nesw-resize; }
    .resize-handle[data-corner="bottom-left"]::after { border-width:0 0 1.5px 1.5px; }
    .resize-handle[data-corner="bottom-right"] { right:0; bottom:0; cursor:nwse-resize; }
    .resize-handle[data-corner="bottom-right"]::after { border-width:0 1.5px 1.5px 0; }
    .error { color:var(--error); }
    .spinner { width:14px; height:14px; border:2px solid var(--control-border); border-top-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation:none; } }
  `;

  const card = document.createElement("section");
  card.className = "card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "快捷AI 回复");
  card.hidden = true;

  const header = document.createElement("header");
  header.className = "header";
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = "快捷AI";
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
  restoreButton.setAttribute("aria-label", "显示快捷AI回复框");
  restoreButton.title = "显示快捷AI回复框";
  restoreButton.textContent = "快捷AI +";
  restoreButton.hidden = true;

  const editConfirmationDialog = document.createElement("dialog");
  editConfirmationDialog.className = "edit-confirmation-dialog";
  const editConfirmationForm = document.createElement("form");
  editConfirmationForm.className = "edit-confirmation-content";
  editConfirmationForm.method = "dialog";
  const editConfirmationTitle = document.createElement("h2");
  editConfirmationTitle.textContent = "重新生成这条追问？";
  const editConfirmationMessage = document.createElement("p");
  const editConfirmationActions = document.createElement("div");
  editConfirmationActions.className = "edit-confirmation-actions";
  const editConfirmationCancel = document.createElement("button");
  editConfirmationCancel.type = "submit";
  editConfirmationCancel.value = "cancel";
  editConfirmationCancel.textContent = "返回编辑";
  const editConfirmationContinue = document.createElement("button");
  editConfirmationContinue.className = "edit-confirmation-continue";
  editConfirmationContinue.type = "submit";
  editConfirmationContinue.value = "confirm";
  editConfirmationContinue.textContent = "删除后续并重新生成";
  editConfirmationActions.append(editConfirmationCancel, editConfirmationContinue);
  editConfirmationForm.append(editConfirmationTitle, editConfirmationMessage, editConfirmationActions);
  editConfirmationDialog.append(editConfirmationForm);

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
  const outsideDismissRow = document.createElement("label");
  outsideDismissRow.className = "outside-dismiss-row";
  const outsideDismissCheckbox = document.createElement("input");
  outsideDismissCheckbox.className = "outside-dismiss-checkbox";
  outsideDismissCheckbox.type = "checkbox";
  outsideDismissCheckbox.setAttribute("aria-label", "点击网页空白处隐藏主界面");
  const outsideDismissCopy = document.createElement("span");
  outsideDismissCopy.className = "outside-dismiss-copy";
  const outsideDismissLabel = document.createElement("span");
  outsideDismissLabel.className = "outside-dismiss-label";
  outsideDismissLabel.textContent = "点击网页空白处隐藏主界面";
  const outsideDismissHint = document.createElement("span");
  outsideDismissHint.className = "outside-dismiss-hint";
  outsideDismissHint.textContent = "回复框外的网页区域会收起回复；链接、按钮和输入框不会触发。";
  outsideDismissCopy.append(outsideDismissLabel, outsideDismissHint);
  outsideDismissRow.append(outsideDismissCheckbox, outsideDismissCopy);
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
  displaySettings.append(fontSizeRow, styleOptions, outsideDismissRow);

  let body = document.createElement("div");
  body.className = "body";
  body.setAttribute("aria-live", "polite");
  const transcript = document.createElement("div");
  transcript.className = "transcript";
  const initialAssistantTurn = document.createElement("section");
  initialAssistantTurn.className = "assistant-turn";
  const initialAssistantLabel = document.createElement("div");
  initialAssistantLabel.className = "turn-label";
  initialAssistantLabel.textContent = "AI";
  initialAssistantTurn.append(initialAssistantLabel, body);
  transcript.append(initialAssistantTurn);
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
  readingArea.append(answerHeading, transcript);
  const composer = document.createElement("form");
  composer.className = "composer";
  composer.setAttribute("aria-label", "继续追问");
  composer.hidden = true;
  const composerInput = document.createElement("textarea");
  composerInput.className = "composer-input";
  composerInput.rows = 1;
  composerInput.placeholder = "继续追问…（Enter 发送，Shift+Enter 换行）";
  composerInput.setAttribute("aria-label", "输入追问内容");
  const sendButton = document.createElement("button");
  sendButton.className = "send-button";
  sendButton.type = "submit";
  sendButton.textContent = "发送";
  sendButton.disabled = true;
  composer.append(composerInput, sendButton);
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
  hideActionButton.title = "隐藏回复框，保留本次对话";
  const settingsButton = document.createElement("button");
  settingsButton.className = "button";
  settingsButton.type = "button";
  settingsButton.textContent = "关闭";
  settingsButton.setAttribute("aria-label", "关闭回复框并清除此轮对话");
  settingsButton.title = "关闭回复框并清除此轮对话";
  actions.append(retryButton, hideActionButton, settingsButton);
  card.append(header, displaySettings, contextArea, readingArea, status, composer, actions);

  const resizeCorners = [
    ["top-left", "左上角调整大小"],
    ["top-right", "右上角调整大小"],
    ["bottom-left", "左下角调整大小"],
    ["bottom-right", "右下角调整大小"]
  ];
  const resizeHandles = resizeCorners.map(([corner, label]) => {
    const handle = document.createElement("button");
    handle.className = "resize-handle";
    handle.type = "button";
    handle.dataset.corner = corner;
    handle.setAttribute("aria-label", label);
    handle.title = label;
    card.append(handle);
    return handle;
  });
  shadow.append(style, card, restoreButton, editConfirmationDialog);

  let currentRequestId = null;
  let fullText = "";
  let fullTextParts = [];
  let isCollapsed = false;
  let lastRequest = null;
  let currentSystemPrompt = "";
  let conversationMessages = [];
  const followupTurns = [];
  let pendingTurn = null;
  let editingTurn = null;
  let isConfirmingEdit = false;
  let conversationReady = false;
  let isGenerating = false;
  let followupAutoScroll = false;
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
  let streamFailureMessage = "";
  let followupScrollFrame = 0;
  const STREAM_RENDER_INTERVAL_MS = 100;
  const MAX_STREAM_CHARS_PER_TICK = 2_048;
  const MAX_RESPONSE_CHARS = 250_000;
  const appearanceStorageKey = "quickAiOverlayAppearance";
  const outsideClickDismissStorageKey = "quickAiOutsideClickDismiss";
  const appearanceDefaults = { fontSize: 16, theme: "paper" };
  let appearance = { ...appearanceDefaults };
  let appearanceTouchedBeforeLoad = false;
  let appearanceSaveTimer = 0;
  let dismissOnOutsideClick = false;
  let outsideClickDismissTouchedBeforeLoad = false;

  const normalizeAppearance = (value) => {
    const fontSize = Number(value?.fontSize);
    return {
      fontSize: Number.isFinite(fontSize) ? Math.min(24, Math.max(12, Math.round(fontSize))) : appearanceDefaults.fontSize,
      theme: styleButtons.has(value?.theme) ? value.theme : appearanceDefaults.theme
    };
  };

  const applyAppearance = () => {
    card.dataset.theme = appearance.theme;
    // 确认框是 card 的兄弟节点，显式同步其需要的主题变量。
    const colors = getComputedStyle(card);
    for (const name of ["--card-bg", "--card-text", "--muted-text", "--control-bg", "--control-border", "--accent"]) {
      editConfirmationDialog.style.setProperty(name, colors.getPropertyValue(name));
    }
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
  extensionApi.storage.local.get([appearanceStorageKey, outsideClickDismissStorageKey]).then((stored) => {
    if (!appearanceTouchedBeforeLoad) {
      appearance = normalizeAppearance(stored?.[appearanceStorageKey]);
      applyAppearance();
    }
    if (!outsideClickDismissTouchedBeforeLoad) {
      dismissOnOutsideClick = stored?.[outsideClickDismissStorageKey] === true;
      outsideDismissCheckbox.checked = dismissOnOutsideClick;
    }
  }).catch(() => {});
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[appearanceStorageKey]) {
      appearance = normalizeAppearance(changes[appearanceStorageKey].newValue);
      applyAppearance();
    }
    if (changes[outsideClickDismissStorageKey]) {
      dismissOnOutsideClick = changes[outsideClickDismissStorageKey].newValue === true;
      outsideDismissCheckbox.checked = dismissOnOutsideClick;
    }
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
  outsideDismissCheckbox.addEventListener("change", () => {
    outsideClickDismissTouchedBeforeLoad = true;
    dismissOnOutsideClick = outsideDismissCheckbox.checked;
    extensionApi.storage.local.set({ [outsideClickDismissStorageKey]: dismissOnOutsideClick }).catch(() => {});
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
    streamFailureMessage = "";
  };

  const scrollToFollowupBottom = () => {
    if (!followupAutoScroll || followupScrollFrame) return;
    followupScrollFrame = requestAnimationFrame(() => {
      followupScrollFrame = 0;
      if (followupAutoScroll && !card.hidden) readingArea.scrollTop = readingArea.scrollHeight;
    });
  };

  const createAssistantResponseBody = (followupTurn = null) => {
    const turn = document.createElement("details");
    turn.className = "assistant-turn";
    turn.open = true;
    const label = document.createElement("summary");
    label.className = "turn-label";
    label.textContent = "AI";
    const responseBody = document.createElement("div");
    responseBody.className = "body";
    responseBody.setAttribute("aria-live", "polite");
    turn.append(label, responseBody);
    transcript.append(turn);
    // 只自动展开最近两轮回复，旧轮保留在内存与上下文中，可手动展开。
    const assistantTurns = [...transcript.querySelectorAll(".assistant-turn")];
    for (const previous of assistantTurns.slice(0, -2)) previous.open = false;
    if (followupTurn) followupTurn.assistantElement = turn;
    return responseBody;
  };

  const appendUserTurn = (text) => {
    const turn = document.createElement("section");
    turn.className = "user-turn";
    const heading = document.createElement("div");
    heading.className = "user-turn-heading";
    const label = document.createElement("div");
    label.className = "turn-label";
    label.textContent = "你";
    const editButton = document.createElement("button");
    editButton.className = "user-edit-button";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "编辑这条追问");
    editButton.title = "编辑并重新生成";
    const editIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    editIcon.setAttribute("viewBox", "0 0 24 24");
    editIcon.setAttribute("fill", "none");
    editIcon.setAttribute("stroke", "currentColor");
    editIcon.setAttribute("stroke-width", "1.8");
    editIcon.setAttribute("stroke-linecap", "round");
    editIcon.setAttribute("stroke-linejoin", "round");
    editIcon.setAttribute("aria-hidden", "true");
    const editPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    editPath.setAttribute("d", "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z");
    editIcon.append(editPath);
    editButton.append(editIcon);
    const message = document.createElement("div");
    message.className = "user-message";
    message.textContent = text;

    const editor = document.createElement("div");
    editor.className = "user-editor";
    editor.hidden = true;
    const editorInput = document.createElement("textarea");
    editorInput.className = "user-editor-input";
    editorInput.setAttribute("aria-label", "编辑追问内容");
    const editorWarning = document.createElement("p");
    editorWarning.className = "user-editor-warning";
    editorWarning.hidden = true;
    const editorActions = document.createElement("div");
    editorActions.className = "user-editor-actions";
    const cancelEditButton = document.createElement("button");
    cancelEditButton.type = "button";
    cancelEditButton.textContent = "取消";
    const saveEditButton = document.createElement("button");
    saveEditButton.className = "user-editor-save";
    saveEditButton.type = "button";
    saveEditButton.textContent = "修改并重新生成";
    editorActions.append(cancelEditButton, saveEditButton);
    editor.append(editorInput, editorWarning, editorActions);

    const followupTurn = {
      element: turn,
      message,
      editButton,
      editor,
      editorInput,
      editorWarning,
      cancelEditButton,
      saveEditButton,
      assistantElement: null
    };
    heading.append(label, editButton);
    turn.append(heading, message, editor);
    transcript.append(turn);
    editButton.addEventListener("click", () => beginEditingTurn(followupTurn));
    cancelEditButton.addEventListener("click", () => cancelEditingTurn(followupTurn));
    saveEditButton.addEventListener("click", () => void saveEditedTurn(followupTurn));
    editorInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void saveEditedTurn(followupTurn);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditingTurn(followupTurn);
      }
    });
    return followupTurn;
  };

  const updateComposerState = () => {
    composer.hidden = !currentRequestId;
    const disabled = isGenerating || Boolean(pendingTurn) || Boolean(editingTurn);
    composerInput.disabled = Boolean(editingTurn);
    sendButton.disabled = !conversationReady || disabled || !composerInput.value.trim();
    retryButton.disabled = isGenerating || Boolean(editingTurn) || isConfirmingEdit;
    for (const turn of followupTurns) {
      turn.editButton.disabled = isGenerating || isConfirmingEdit || Boolean(editingTurn && editingTurn !== turn);
      turn.saveEditButton.disabled = isGenerating || isConfirmingEdit;
      turn.cancelEditButton.disabled = isGenerating || isConfirmingEdit;
    }
  };

  const clearConversation = () => {
    if (editConfirmationDialog.open) editConfirmationDialog.close("cancel");
    currentSystemPrompt = "";
    conversationMessages = [];
    followupTurns.length = 0;
    pendingTurn = null;
    editingTurn = null;
    isConfirmingEdit = false;
    conversationReady = false;
    isGenerating = false;
    followupAutoScroll = false;
    cancelAnimationFrame(followupScrollFrame);
    followupScrollFrame = 0;
    lastRequest = null;
    composerInput.value = "";
    updateComposerState();
    transcript.replaceChildren();
  };

  const beginEditingTurn = (turn) => {
    if (!conversationReady || isGenerating || isConfirmingEdit || (editingTurn && editingTurn !== turn)) return;
    const turnIndex = followupTurns.indexOf(turn);
    if (turnIndex < 0) return;

    editingTurn = turn;
    turn.editorInput.value = turn.message.textContent;
    const laterTurnCount = followupTurns.length - turnIndex - 1;
    turn.editorWarning.hidden = laterTurnCount === 0;
    turn.editorWarning.textContent = laterTurnCount
      ? `修改后需要重新生成回复，并删除之后的 ${laterTurnCount} 轮追问及回复。`
      : "修改后会重新生成这条追问对应的回复。";
    turn.message.hidden = true;
    turn.editButton.hidden = true;
    turn.editor.hidden = false;
    updateComposerState();
    turn.editorInput.focus();
    turn.editorInput.setSelectionRange(turn.editorInput.value.length, turn.editorInput.value.length);
  };

  const cancelEditingTurn = (turn) => {
    if (editingTurn !== turn || isGenerating || isConfirmingEdit) return;
    turn.message.hidden = false;
    turn.editButton.hidden = false;
    turn.editor.hidden = true;
    turn.editorWarning.hidden = true;
    editingTurn = null;
    updateComposerState();
    turn.editButton.focus();
  };

  const confirmLaterTurnRemoval = (count) => {
    editConfirmationMessage.textContent = `修改这条追问会替换本轮 AI 回复，并删除之后的 ${count} 轮追问及回复。确认后可从这里继续追问。`;
    return new Promise((resolve) => {
      // 对话框会复用；清除上次 returnValue，避免 Escape 继承之前的确认结果。
      editConfirmationDialog.returnValue = "";
      editConfirmationDialog.addEventListener("close", () => {
        resolve(editConfirmationDialog.returnValue === "confirm");
      }, { once: true });
      editConfirmationDialog.showModal();
      editConfirmationContinue.focus();
    });
  };

  const saveEditedTurn = async (turn) => {
    if (editingTurn !== turn || isGenerating || isConfirmingEdit) return;
    const editedText = turn.editorInput.value;
    if (!editedText.trim()) {
      status.textContent = "追问内容不能为空。";
      turn.editorInput.focus();
      return;
    }
    if (editedText === turn.message.textContent && !pendingTurn) {
      cancelEditingTurn(turn);
      return;
    }

    const turnIndex = followupTurns.indexOf(turn);
    if (turnIndex < 0) return;
    const laterTurnCount = followupTurns.length - turnIndex - 1;
    if (laterTurnCount) {
      isConfirmingEdit = true;
      updateComposerState();
      let confirmed = false;
      try {
        confirmed = await confirmLaterTurnRemoval(laterTurnCount);
      } finally {
        isConfirmingEdit = false;
        updateComposerState();
      }
      if (!confirmed) return;
    }
    if (editingTurn !== turn || isGenerating) return;

    // 每轮在消息历史中对应一条 user 和一条 assistant；保留被编辑轮之前的上下文。
    const prefixLength = 2 + turnIndex * 2;
    if (prefixLength > conversationMessages.length) {
      status.textContent = "无法定位这条追问的上下文，请重新选择题目后再试。";
      return;
    }
    const messages = [
      ...conversationMessages.slice(0, prefixLength),
      { role: "user", content: editedText }
    ];
    conversationMessages = conversationMessages.slice(0, prefixLength);

    for (let index = turnIndex; index < followupTurns.length; index += 1) {
      const affectedTurn = followupTurns[index];
      affectedTurn.assistantElement?.remove();
      if (index > turnIndex) affectedTurn.element.remove();
    }
    followupTurns.splice(turnIndex + 1);
    turn.message.textContent = editedText;
    turn.message.hidden = false;
    turn.editor.hidden = true;
    turn.editorWarning.hidden = true;
    turn.editButton.hidden = false;
    editingTurn = null;

    pendingTurn = { kind: "edit", turnIndex, messages };
    lastRequest = { kind: "edit", messages };
    body = createAssistantResponseBody(turn);
    copyButton.hidden = true;
    void dispatchFollowup(messages);
  };

  const commitPendingTurn = () => {
    if (!pendingTurn || !fullText || responseTruncated) return false;
    conversationMessages = [
      ...pendingTurn.messages,
      { role: "assistant", content: fullText }
    ];
    pendingTurn = null;
    conversationReady = true;
    return true;
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
        scrollToFollowupBottom();
      }
    }

    if (pendingStreamCharacters > 0) {
      scheduleStreamingUpdate();
    } else if (streamDoneReceived) {
      startFinalMarkdownRender();
    }
  };

  const queueStreamText = (value) => {
    if (!value || responseTruncated || streamFinalized || streamFailureMessage) return;
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
    scrollToFollowupBottom();
    streamParser = null;
    body.classList.remove("streaming");
    const completed = !streamFailureMessage && commitPendingTurn();
    if (completed) {
      retryButton.hidden = true;
      status.textContent = "生成完成";
      status.classList.remove("error");
    } else {
      retryButton.hidden = false;
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      if (responseTruncated || (streamFailureMessage && fullText)) {
        body.classList.remove("error");
      } else {
        body.classList.add("error");
        body.textContent = streamFailureMessage || "模型没有返回文字内容，请重试。";
      }
      status.classList.add("error");
      status.textContent = streamFailureMessage
        ? `${streamFailureMessage}${fullText ? " 已保留部分回复（未完成），不会进入后续对话。" : ""}`
        : responseTruncated
        ? "回复超过安全长度上限，当前不完整内容不会进入后续对话。"
        : "模型没有返回文字内容，请重试。";
    }
    isGenerating = false;
    updateComposerState();
  };
  const boundsStorageKey = "quickAiOverlayBounds";
  let boundsSaveTimer = 0;
  let activeDrag = null;
  let activeResize = null;

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
    const restoreWidth = restoreButton.offsetWidth || 92;
    const restoreHeight = restoreButton.offsetHeight || 34;
    const maxRestoreLeft = Math.max(12, window.innerWidth - restoreWidth - 12);
    const maxRestoreTop = Math.max(12, window.innerHeight - restoreHeight - 12);
    restoreButton.style.left = `${Math.min(Math.max(12, cardLeft + width - restoreWidth - 14), maxRestoreLeft)}px`;
    restoreButton.style.right = "auto";
    restoreButton.style.top = `${Math.min(Math.max(12, cardTop + 13), maxRestoreTop)}px`;
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

  const saveBounds = (immediate = false) => {
    if (card.hidden) return;
    clearTimeout(boundsSaveTimer);
    const persist = () => {
      if (card.hidden) return;
      const rect = card.getBoundingClientRect();
      const bounds = { version: 2, width: rect.width, height: rect.height, left: rect.left, top: rect.top };
      extensionApi.storage.local.set({ [boundsStorageKey]: bounds }).catch(() => {});
    };
    if (immediate) persist();
    else boundsSaveTimer = window.setTimeout(persist, 120);
  };

  const resizeFromCorner = (corner, start, deltaX, deltaY) => {
    const { maxWidth, maxHeight } = viewportLimits();
    const minWidth = Math.min(300, maxWidth);
    const minHeight = Math.min(240, maxHeight);
    const minX = 12;
    const minY = 12;
    const maxX = Math.max(minX, window.innerWidth - 12);
    const maxY = Math.max(minY, window.innerHeight - 12);
    let left = start.left;
    let right = start.right;
    let top = start.top;
    let bottom = start.bottom;

    if (corner.includes("left")) {
      const lower = Math.max(minX, right - maxWidth);
      const upper = Math.max(lower, right - minWidth);
      left = Math.min(Math.max(start.left + deltaX, lower), upper);
    } else {
      const lower = left + minWidth;
      const upper = Math.max(lower, Math.min(maxX, left + maxWidth));
      right = Math.min(Math.max(start.right + deltaX, lower), upper);
    }

    if (corner.includes("top")) {
      const lower = Math.max(minY, bottom - maxHeight);
      const upper = Math.max(lower, bottom - minHeight);
      top = Math.min(Math.max(start.top + deltaY, lower), upper);
    } else {
      const lower = top + minHeight;
      const upper = Math.max(lower, Math.min(maxY, top + maxHeight));
      bottom = Math.min(Math.max(start.bottom + deltaY, lower), upper);
    }

    host.style.left = `${left}px`;
    host.style.right = "auto";
    host.style.top = `${top}px`;
    card.style.width = `${right - left}px`;
    card.style.height = `${bottom - top}px`;
    saveBounds();
  };

  for (const handle of resizeHandles) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = card.getBoundingClientRect();
      activeResize = {
        pointerId: event.pointerId,
        corner: handle.dataset.corner,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!activeResize || activeResize.pointerId !== event.pointerId) return;
      event.preventDefault();
      const start = activeResize;
      // 使用按下时的边界和位移计算，避免连续布局测量造成抖动。
      const deltaX = event.clientX - start.startX;
      const deltaY = event.clientY - start.startY;
      resizeFromCorner(start.corner, start, deltaX, deltaY);
    });
    const finishResize = (event) => {
      if (activeResize?.pointerId !== event.pointerId) return;
      activeResize = null;
      saveBounds();
    };
    handle.addEventListener("pointerup", finishResize);
    handle.addEventListener("pointercancel", finishResize);
    handle.addEventListener("lostpointercapture", finishResize);
    handle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 50 : 10;
      const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const delta = deltas[event.key];
      if (!delta) return;
      event.preventDefault();
      const rect = card.getBoundingClientRect();
      resizeFromCorner(handle.dataset.corner, {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      }, delta[0], delta[1]);
    });
  }

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

  // 观察尺寸变化并校正边界，确保不同页面缩放比例下浮层都留在视口内。
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
    if (collapsed) {
      saveBounds(true);
      syncRestoreButtonPosition();
    }
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
    scrollToFollowupBottom();
  });
  document.addEventListener("click", (event) => {
    if (!dismissOnOutsideClick || card.hidden || isCollapsed || event.button !== 0) return;
    if (event.composedPath().includes(host)) return;

    const target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
    if (target?.closest("a, button, input, select, textarea, summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link'], [role='menuitem'], [role='textbox']")) return;

    saveBounds();
    setCollapsed(true);
  }, true);

  const showTurnError = (message) => {
    if (streamFinalized) return;
    streamFailureMessage = message || "请求失败，请重试。";
    streamDoneReceived = true;
    status.textContent = streamFailureMessage;
    status.classList.add("error");
    // 继续按预算渲染已收到的文本，避免错误时同步重建长回复。
    if (pendingStreamCharacters > 0) scheduleStreamingUpdate();
    else startFinalMarkdownRender();
  };

  const dispatchFollowup = async (messages) => {
    followupAutoScroll = true;
    const requestId = crypto.randomUUID();
    currentRequestId = requestId;
    isGenerating = true;
    spinner.hidden = false;
    retryButton.hidden = true;
    retryButton.disabled = false;
    retryButton.textContent = "重试";
    status.textContent = pendingTurn?.kind === "followup" || pendingTurn?.kind === "edit"
      ? "正在生成追问回复…"
      : "正在生成 Markdown 回复…";
    resetStreamState();
    body.replaceChildren();
    body.classList.remove("error");
    body.classList.add("streaming");
    copyButton.hidden = true;
    updateComposerState();
    scrollToFollowupBottom();

    try {
      await extensionApi.runtime.sendMessage({
        type: "FOLLOWUP_REQUEST",
        requestId,
        systemPrompt: currentSystemPrompt,
        messages
      });
    } catch {
      if (currentRequestId === requestId) showTurnError("无法发起追问，请重新加载页面后再试。");
    }
  };

  const submitFollowup = async () => {
    if (!conversationReady || isGenerating || pendingTurn || editingTurn) return;
    const userText = composerInput.value;
    if (!userText.trim()) return;

    const messages = [...conversationMessages, { role: "user", content: userText }];
    pendingTurn = { kind: "followup", messages };
    lastRequest = { kind: "followup", messages };
    const followupTurn = appendUserTurn(userText);
    followupTurns.push(followupTurn);
    composerInput.value = "";
    body = createAssistantResponseBody(followupTurn);
    void dispatchFollowup(messages);
  };

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitFollowup();
  });
  composerInput.addEventListener("input", updateComposerState);
  composerInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void submitFollowup();
  });

  retryButton.addEventListener("click", async () => {
    if (!lastRequest || retryButton.disabled) return;
    retryButton.disabled = true;
    retryButton.textContent = "正在重试…";
    if ((lastRequest.kind === "followup" || lastRequest.kind === "edit") && pendingTurn) {
      void dispatchFollowup(pendingTurn.messages);
      return;
    }
    try {
      await extensionApi.runtime.sendMessage({
        type: "RETRY_REQUEST",
        selectedText: lastRequest.selectedText,
        promptId: lastRequest.promptId
      });
    } catch {
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      status.textContent = "无法发起重试，请重新加载页面后再试。";
    }
  });

  const closeOverlay = () => {
    saveBounds(true);
    if (currentRequestId && spinner.hidden === false) {
      void extensionApi.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId: currentRequestId }).catch(() => {});
    }
    clearTimeout(streamRenderTimer);
    streamRenderTimer = 0;
    resetStreamState();
    currentRequestId = null;
    clearConversation();
    body.replaceChildren();
    body.classList.remove("error", "streaming");
    spinner.hidden = true;
    retryButton.hidden = true;
    copyButton.hidden = true;
    status.textContent = "";
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
      clearConversation();
      currentRequestId = message.requestId;
      currentSystemPrompt = String(message.promptText ?? "");
      lastRequest = {
        kind: "initial",
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
      body = createAssistantResponseBody();
      conversationMessages = [];
      pendingTurn = { kind: "initial", messages: [{ role: "user", content: selectedTextValue }] };
      conversationReady = false;
      isGenerating = true;
      body.classList.remove("error");
      body.classList.remove("streaming");
      status.classList.remove("error");
      status.textContent = "正在生成 Markdown 回复…";
      spinner.hidden = false;
      copyButton.hidden = true;
      retryButton.hidden = true;
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      composerInput.value = "";
      updateComposerState();
      displaySettings.hidden = true;
      displaySettingsButton.setAttribute("aria-expanded", "false");
      displaySettingsButton.setAttribute("aria-label", "显示样式设置");
      setCollapsed(false);
      card.hidden = false;
      clampPosition();
      return;
    }

    if (message?.requestId !== currentRequestId) return;

    if (message.type === "FOLLOWUP_LOADING") {
      resetStreamState();
      body.replaceChildren();
      body.classList.remove("error");
      body.classList.add("streaming");
      isGenerating = true;
      spinner.hidden = false;
      retryButton.hidden = true;
      retryButton.disabled = false;
      status.classList.remove("error");
      status.textContent = "正在生成追问回复…";
      updateComposerState();
    } else if (message.type === "APPEND_TEXT") {
      queueStreamText(String(message.text ?? ""));
    } else if (message.type === "STREAM_DONE") {
      streamDoneReceived = true;
      if (pendingStreamCharacters > 0) scheduleStreamingUpdate();
      else void startFinalMarkdownRender();
    } else if (message.type === "SHOW_ERROR" || message.type === "SHOW_TURN_ERROR") {
      showTurnError(message.message || "请求失败，请稍后重试。");
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
