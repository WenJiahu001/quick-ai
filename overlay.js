(() => {
  if (globalThis.__selectionAiOverlayInstalled) return;
  globalThis.__selectionAiOverlayInstalled = true;

  const host = document.createElement("div");
  host.id = "selection-ai-overlay-host";
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:20px;left:auto;right:20px";
  (document.documentElement || document.body).appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .card {
      box-sizing: border-box; width: min(800px, calc(100vw - 32px)); height: min(640px, calc(78vh - 24px));
      min-width: min(300px, calc(100vw - 32px)); min-height: min(240px, calc(100vh - 40px));
      max-width: calc(100vw - 32px); max-height: calc(100vh - 40px); resize: both;
      display: flex; flex-direction: column; overflow: hidden; color: #172033;
      background: #fff; border: 1px solid #dce2ec; border-radius: 14px;
      box-shadow: 0 16px 48px rgba(12, 24, 48, .24);
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .card[hidden] { display: none; }
    .header { display:flex; align-items:center; gap:10px; padding:13px 14px; border-bottom:1px solid #edf0f5; cursor:move; user-select:none; }
    .title { flex:1; font-weight:650; font-size:14px; }
    button { color:inherit; font:inherit; cursor:pointer; }
    .visibility-button { display:grid; place-items:center; flex:none; width:30px; height:30px; padding:0; border:1px solid #e3e8f0; border-radius:8px; background:#fff; color:#53627a; }
    .visibility-button:hover { background:#f0f3f8; }
    .visibility-button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .restore-button { position:fixed; top:20px; right:20px; display:grid; place-items:center; width:30px; height:30px; padding:0; border:1px solid #e3e8f0; border-radius:8px; color:#53627a; background:#fff; box-shadow:none; font-size:14px; line-height:1; cursor:pointer; }
    .restore-button[hidden] { display:none; }
    .restore-button:hover { background:#f0f3f8; }
    .restore-button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .context-area { flex:none; padding:10px 14px 0; }
    .request-details { padding:7px 9px; border:1px solid #edf0f5; border-radius:8px; background:#fafbfc; }
    .request-details summary { color:#778196; font-size:11px; font-weight:550; cursor:pointer; }
    .request-text { max-height:160px; overflow:auto; margin:7px 0 0; padding:7px 8px; border:1px solid #e8ecf2; border-radius:6px; color:#53627a; background:#fff; white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; font-size:12px; }
    .selected-panel { margin-top:9px; padding:10px 12px 12px; border:1px solid #dce6f6; border-radius:10px; background:#f5f8ff; }
    .selected-label { display:flex; align-items:center; gap:7px; margin-bottom:7px; color:#31528a; font-size:11px; font-weight:700; letter-spacing:.02em; }
    .question-mark { display:grid; place-items:center; width:19px; height:19px; border-radius:50%; color:#fff; background:#5378b8; font-size:12px; font-weight:700; line-height:1; }
    .selected-text { display:block; max-height:120px; overflow:auto; margin:0; padding:0; color:#202d43; white-space:pre-wrap; overflow-wrap:anywhere; tab-size:4; font:inherit; font-size:14px; font-weight:550; line-height:1.6; }
    .reading-area { flex:1; min-height:0; overflow:auto; border-top:1px solid #edf0f5; }
    .answer-heading { display:flex; align-items:center; gap:8px; margin:10px 16px 0; color:#53627a; font-size:12px; font-weight:650; }
    .answer-heading span { flex:1; }
    .copy-button { display:grid; place-items:center; width:36px; height:36px; padding:0; border:1px solid #d5dce7; border-radius:9px; background:#fff; }
    .copy-button[hidden] { display:none; }
    .copy-button:hover { background:#f0f3f8; }
    .copy-button:focus-visible, .button:focus-visible { outline:3px solid #82a8ff; outline-offset:2px; }
    .copy-button svg { width:17px; height:17px; }
    .body { padding:10px 16px 18px; overflow-wrap:anywhere; min-height:60px; line-height:1.65; }
    .body.streaming { white-space:pre-wrap; }
    .body:empty::before { content:"正在等待回复…"; color:#69758a; }
    .body h1, .body h2, .body h3, .body h4 { margin:1.1em 0 .5em; line-height:1.3; color:#172033; }
    .body h1 { font-size:1.45em; } .body h2 { font-size:1.3em; } .body h3 { font-size:1.15em; }
    .body p { margin:.55em 0; }
    .body ul, .body ol { margin:.55em 0; padding-left:1.6em; }
    .body li { padding-left:.15em; }
    .body blockquote { margin:.7em 0; padding:.2em .8em; border-left:3px solid #b9c9e5; color:#53627a; background:#f7f9fc; }
    .body pre { overflow:auto; margin:.75em 0; padding:12px; border-radius:9px; background:#f1f4f8; font:13px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .body code { padding:.12em .35em; border-radius:4px; background:#f1f4f8; font: .9em ui-monospace, SFMono-Regular, Consolas, monospace; }
    .body pre code { padding:0; background:transparent; }
    .body table { width:100%; margin:.8em 0; border-collapse:collapse; font-size:.95em; }
    .body th, .body td { padding:7px 9px; border:1px solid #dce2ec; text-align:left; vertical-align:top; }
    .body th { background:#f1f4f8; font-weight:650; }
    .body a { color:#2359d6; text-decoration:underline; }
    .body hr { border:0; border-top:1px solid #dce2ec; margin:1em 0; }
    .status { padding:0 16px 12px; color:#657187; font-size:12px; }
    .actions { display:flex; justify-content:center; padding:0 14px 14px; }
    .button { min-width:108px; min-height:40px; border:0; border-radius:9px; padding:7px 18px; background:#172033; color:white; font-weight:600; }
    .button:hover { background:#303d52; }
    .retry-button { min-width:108px; min-height:40px; border:1px solid #c8d5ea; border-radius:9px; padding:7px 18px; color:#254b88; background:#f4f7fc; font-weight:600; }
    .retry-button:hover { background:#eaf0fa; }
    .retry-button:disabled { opacity:.6; cursor:wait; }
    .hide-action-button { min-width:108px; min-height:40px; border:1px solid #d5dce7; border-radius:9px; padding:7px 18px; color:#303d52; background:#fff; font-weight:600; }
    .hide-action-button:hover { background:#f0f3f8; }
    .error { color:#9c2b20; }
    .spinner { width:14px; height:14px; border:2px solid #dbe3f1; border-top-color:#2359d6; border-radius:50%; animation:spin .8s linear infinite; }
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
  const visibilityButton = document.createElement("button");
  visibilityButton.className = "visibility-button";
  visibilityButton.type = "button";
  visibilityButton.setAttribute("aria-expanded", "true");
  visibilityButton.setAttribute("aria-label", "隐藏回复框");
  visibilityButton.title = "隐藏回复框";
  visibilityButton.textContent = "−";
  header.append(spinner, title, visibilityButton);
  const restoreButton = document.createElement("button");
  restoreButton.className = "restore-button";
  restoreButton.type = "button";
  restoreButton.setAttribute("aria-label", "显示 AI 回复框");
  restoreButton.title = "显示 AI 回复框";
  restoreButton.textContent = "+";
  restoreButton.hidden = true;

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
  selectedPanel.setAttribute("aria-label", "提问内容");
  const selectedHeading = document.createElement("div");
  selectedHeading.className = "selected-label";
  const questionMark = document.createElement("span");
  questionMark.className = "question-mark";
  questionMark.setAttribute("aria-hidden", "true");
  questionMark.textContent = "?";
  const selectedLabel = document.createElement("span");
  selectedLabel.textContent = "题目";
  selectedHeading.append(questionMark, selectedLabel);
  const selectedText = document.createElement("pre");
  selectedText.className = "selected-text";
  selectedPanel.append(selectedHeading, selectedText);
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
  card.append(header, contextArea, readingArea, status, actions);
  shadow.append(style, card, restoreButton);

  let currentRequestId = null;
  let fullText = "";
  let isCollapsed = false;
  let lastRequest = null;
  let streamRenderTimer = 0;
  let pendingStreamText = "";
  let pendingStreamBatches = 0;
  const STREAM_RENDER_INTERVAL_MS = 120;
  const STREAM_RENDER_EVERY_BATCHES = 3;
  const MAX_MARKDOWN_RENDER_CHARS = 30_000;

  const renderFinalResponse = () => {
    clearTimeout(streamRenderTimer);
    streamRenderTimer = 0;
    pendingStreamText = "";
    pendingStreamBatches = 0;
    if (fullText.length > MAX_MARKDOWN_RENDER_CHARS) {
      // 超长回复保留原文，避免构造大量 Markdown 节点阻塞网页主线程。
      body.classList.add("streaming");
      body.textContent = fullText;
      return false;
    }
    body.classList.remove("streaming");
    renderMarkdown(fullText, body);
    copyButton.hidden = !fullText;
    return true;
  };

  const scheduleStreamingUpdate = () => {
    if (streamRenderTimer) return;
    streamRenderTimer = window.setTimeout(() => {
      streamRenderTimer = 0;
      if (pendingStreamBatches < STREAM_RENDER_EVERY_BATCHES || !pendingStreamText) return;
      body.classList.add("streaming");
      body.append(document.createTextNode(pendingStreamText));
      pendingStreamText = "";
      pendingStreamBatches = 0;
      copyButton.hidden = !fullText;
    }, STREAM_RENDER_INTERVAL_MS);
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
    const bounds = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = window.setTimeout(() => {
      chrome.storage.local.set({ [boundsStorageKey]: bounds }).catch(() => {});
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

  chrome.storage.local.get(boundsStorageKey).then((stored) => {
    const bounds = stored[boundsStorageKey];
    if (!bounds || ![bounds.width, bounds.height, bounds.left, bounds.top].every(Number.isFinite)) return;
    const { maxWidth, maxHeight } = viewportLimits();
    card.style.width = `${Math.min(Math.max(300, bounds.width), maxWidth)}px`;
    card.style.height = `${Math.min(Math.max(180, bounds.height), maxHeight)}px`;
    host.style.left = `${Math.min(Math.max(12, bounds.left), Math.max(12, window.innerWidth - maxWidth - 12))}px`;
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
      await chrome.runtime.sendMessage({ type: "RETRY_REQUEST", ...lastRequest });
    } catch {
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      status.textContent = "无法发起重试，请重新加载页面后再试。";
    }
  });

  const closeOverlay = () => {
    saveBounds();
    if (currentRequestId && spinner.hidden === false) {
      chrome.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId: currentRequestId });
    }
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

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "SHOW_LOADING") {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
      currentRequestId = message.requestId;
      lastRequest = {
        selectedText: String(message.selectedText ?? ""),
        promptId: String(message.promptId ?? "")
      };
      fullText = "";
      pendingStreamText = "";
      pendingStreamBatches = 0;
      requestDetails.open = false;
      requestSummary.textContent = `提示词${message.promptName ? ` · ${message.promptName}` : ""}`;
      requestText.textContent = message.promptText || "";
      selectedText.textContent = message.selectedText ?? "";
      body.textContent = "";
      body.classList.remove("error");
      body.classList.remove("streaming");
      status.textContent = "正在生成…";
      spinner.hidden = false;
      copyButton.hidden = true;
      retryButton.hidden = true;
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      setCollapsed(false);
      card.hidden = false;
      clampPosition();
      return;
    }

    if (message?.requestId !== currentRequestId) return;

    if (message.type === "APPEND_TEXT") {
      fullText += message.text;
      pendingStreamText += message.text;
      pendingStreamBatches += 1;
      scheduleStreamingUpdate();
    } else if (message.type === "STREAM_DONE") {
      const markdownRendered = renderFinalResponse();
      spinner.hidden = true;
      status.textContent = fullText
        ? (markdownRendered ? "生成完成" : "生成完成（内容较长，已使用纯文本显示以保持页面流畅）")
        : "模型没有返回文字内容。";
      copyButton.hidden = !fullText;
      retryButton.hidden = true;
    } else if (message.type === "SHOW_ERROR") {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
      pendingStreamText = "";
      pendingStreamBatches = 0;
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

  function renderMarkdown(markdown, target) {
    target.replaceChildren();
    const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
      if (!lines[index].trim()) { index++; continue; }

      const fence = lines[index].match(/^\s*```\s*([\w+-]*)\s*$/);
      if (fence) {
        const codeLines = [];
        index++;
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) codeLines.push(lines[index++]);
        if (index < lines.length) index++;
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        if (fence[1]) code.className = `language-${fence[1]}`;
        code.textContent = codeLines.join("\n");
        pre.append(code);
        target.append(pre);
        continue;
      }

      const heading = lines[index].match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const element = document.createElement(`h${heading[1].length}`);
        appendInlineMarkdown(element, heading[2]);
        target.append(element);
        index++;
        continue;
      }

      if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(lines[index])) {
        target.append(document.createElement("hr"));
        index++;
        continue;
      }

      if (index + 1 < lines.length && lines[index].includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
        const table = document.createElement("table");
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        for (const cellText of parseTableRow(lines[index])) {
          const cell = document.createElement("th");
          appendInlineMarkdown(cell, cellText);
          headRow.append(cell);
        }
        head.append(headRow);
        table.append(head);
        index += 2;
        const tableBody = document.createElement("tbody");
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          const row = document.createElement("tr");
          for (const cellText of parseTableRow(lines[index++])) {
            const cell = document.createElement("td");
            appendInlineMarkdown(cell, cellText);
            row.append(cell);
          }
          tableBody.append(row);
        }
        table.append(tableBody);
        target.append(table);
        continue;
      }

      if (/^\s*>/.test(lines[index])) {
        const quote = document.createElement("blockquote");
        const quoteLines = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) quoteLines.push(lines[index++].replace(/^\s*>\s?/, ""));
        appendInlineMarkdown(quote, quoteLines.join("\n"));
        target.append(quote);
        continue;
      }

      const listMatch = lines[index].match(/^\s*(?:[-+*]|(\d+)\.)\s+(.+)$/);
      if (listMatch) {
        const ordered = Boolean(listMatch[1]);
        const list = document.createElement(ordered ? "ol" : "ul");
        while (index < lines.length) {
          const item = lines[index].match(/^\s*(?:[-+*]|(\d+)\.)\s+(.+)$/);
          if (!item || Boolean(item[1]) !== ordered) break;
          const li = document.createElement("li");
          appendInlineMarkdown(li, item[2]);
          list.append(li);
          index++;
        }
        target.append(list);
        continue;
      }

      const paragraphLines = [];
      while (index < lines.length && lines[index].trim() &&
        !/^\s*```/.test(lines[index]) &&
        !/^\s*#{1,6}\s/.test(lines[index]) &&
        !/^\s*>/.test(lines[index]) &&
        !/^\s*(?:[-+*]|\d+\.)\s+/.test(lines[index]) &&
        !/^\s*(---+|___+|\*\*\*+)\s*$/.test(lines[index])) {
        paragraphLines.push(lines[index++]);
      }
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, paragraphLines.join("\n"));
      target.append(paragraph);
    }
  }

  function appendInlineMarkdown(parent, source) {
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      appendTextWithBreaks(parent, source.slice(lastIndex, match.index));
      const token = match[0];
      let element;
      if (token.startsWith("`")) {
        element = document.createElement("code");
        element.textContent = token.slice(1, -1);
      } else if (token.startsWith("**") || token.startsWith("__")) {
        element = document.createElement("strong");
        appendInlineMarkdown(element, token.slice(2, -2));
      } else if (token.startsWith("~~")) {
        element = document.createElement("del");
        appendInlineMarkdown(element, token.slice(2, -2));
      } else if (token.startsWith("*") || token.startsWith("_")) {
        element = document.createElement("em");
        appendInlineMarkdown(element, token.slice(1, -1));
      } else {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const href = safeMarkdownHref(link[2]);
        if (!href) {
          parent.append(document.createTextNode(token));
          lastIndex = pattern.lastIndex;
          continue;
        }
        element = document.createElement("a");
        element.href = href;
        element.target = "_blank";
        element.rel = "noopener noreferrer";
        appendInlineMarkdown(element, link[1]);
      }
      parent.append(element);
      lastIndex = pattern.lastIndex;
    }
    appendTextWithBreaks(parent, source.slice(lastIndex));
  }

  function appendTextWithBreaks(parent, value) {
    const parts = value.split("\n");
    parts.forEach((part, index) => {
      if (index) parent.append(document.createElement("br"));
      if (part) parent.append(document.createTextNode(part));
    });
  }

  function parseTableRow(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
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
