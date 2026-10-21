(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createView) return;
  modules.createView = () => {
    const summarize = modules.summarize;
    const initialCardWidth = Math.min(800, Math.max(1, window.innerWidth - 32));
    const initialLeft = Math.max(12, window.innerWidth - initialCardWidth - 12);
    const host = document.createElement("div");
    host.id = "selection-ai-overlay-host";
    // 显式计算左坐标，避免宿主自动宽度影响首次显示时的右侧对齐。
    host.style.cssText = `all:initial;position:fixed;z-index:2147483647;top:20px;left:${initialLeft}px;right:auto`;
    (document.documentElement || document.body).appendChild(host);

    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = modules.styles;

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

    const body = document.createElement("div");
    body.className = "body";
    body.setAttribute("aria-live", "polite");
    const transcript = document.createElement("div");
    transcript.className = "transcript";
    transcript.append(body);
    const contextArea = document.createElement("div");
    contextArea.className = "context-area";
    const requestDetails = document.createElement("details");
    requestDetails.className = "request-details";
    const requestSummary = document.createElement("summary");
    requestSummary.textContent = "提示词";
    const requestText = document.createElement("pre");
    requestText.className = "request-text";
    requestDetails.append(requestSummary, requestText);

    const selectedPanel = document.createElement("details");
    selectedPanel.className = "selected-panel";
    selectedPanel.open = true;
    const selectedSummary = document.createElement("summary");
    selectedSummary.className = "selected-summary";
    selectedSummary.textContent = "收起原题";
    selectedPanel.addEventListener("toggle", () => {
      selectedSummary.textContent = selectedPanel.open ? "收起原题" : `原题 · ${summarize(selectedText.textContent)}`;
    });
    selectedPanel.setAttribute("aria-label", "选中的文字");
    const selectedText = document.createElement("pre");
    selectedText.className = "selected-text";
    selectedPanel.append(selectedSummary, selectedText);
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
    const closeButton = document.createElement("button");
    closeButton.className = "button";
    closeButton.type = "button";
    closeButton.textContent = "关闭";
    closeButton.setAttribute("aria-label", "关闭回复框并清除此轮对话");
    closeButton.title = "关闭回复框并清除此轮对话";
    actions.append(retryButton, hideActionButton, closeButton);
    const latestButton = document.createElement("button");
    latestButton.className = "latest-button";
    latestButton.type = "button";
    latestButton.textContent = "回到最新回复 ↓";
    latestButton.hidden = true;
    const readingPane = document.createElement("div");
    readingPane.className = "reading-pane";
    readingPane.append(readingArea, latestButton);
    card.append(header, displaySettings, contextArea, readingPane, status, composer, actions);

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

    return {
      host, shadow, card, header, spinner,
      displaySettingsButton, visibilityButton, restoreButton, editConfirmationDialog, editConfirmationMessage,
      editConfirmationContinue, displaySettings, fontSizeSlider, fontSizeValue, outsideDismissCheckbox,
      styleButtons, body, transcript, requestDetails, requestSummary,
      requestText, selectedPanel, selectedSummary, selectedText, readingArea,
      composer, composerInput, sendButton, status, retryButton,
      hideActionButton, closeButton, copyButton, resizeHandles, latestButton
    };
  };
})();
