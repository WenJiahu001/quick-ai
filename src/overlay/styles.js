(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.styles) return;
  modules.styles = `
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
    .selected-summary { color:var(--muted-text); font-size:11px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .selected-panel[open] .selected-summary { margin-bottom:6px; }
    .reading-pane { display:flex; position:relative; flex:1; min-height:0; }
    .latest-button { position:absolute; right:14px; bottom:8px; padding:4px 12px; border:1px solid var(--control-border); border-radius:14px; color:var(--accent); background:var(--soft-bg); font-size:12px; box-shadow:0 2px 8px #0001; }
    .latest-button[hidden] { display:none; }
    .assistant-turn > summary { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .reading-area { flex:1; min-width:0; min-height:0; overflow:auto; overflow-anchor:none; border-top:1px solid var(--divider); }
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
})();
