(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createOverlay) return;
  modules.createOverlay = () => {
    const extensionApi = globalThis.quickAiBrowserApi;
    const view = modules.createView();
    const {
      host, shadow, card, header, spinner,
      displaySettingsButton, visibilityButton, restoreButton, editConfirmationDialog, editConfirmationMessage,
      editConfirmationContinue, displaySettings, fontSizeSlider, fontSizeValue, outsideDismissCheckbox,
      styleButtons, transcript, requestDetails, requestSummary, requestText,
      selectedPanel, selectedSummary, selectedText, readingArea, composer,
      composerInput, sendButton, status, retryButton, hideActionButton,
      closeButton, copyButton, copyFeedback, resizeHandles, latestButton
    } = view;
    let body = view.body;
    const preferences = modules.createPreferencesClient(extensionApi);
    const diagnostics = modules.createDiagnostics({ container: displaySettings, getRoot: () => transcript });
    const lifecycle = modules.createRequestLifecycle({
      api: extensionApi,
      onWaiting: () => { status.textContent = "暂未收到新内容，可继续等待或停止后重试"; },
      onLost: (message) => showTurnError(message),
      onPhase: (phase) => diagnostics.phase(phase)
    });
    let currentRequestId = null;
    let isCollapsed = false;
    let lastRequest = null;
    let currentSystemPrompt = "";
    let conversationMessages = [];
    const followupTurns = [];
    let pendingTurn = null;
    let editingTurn = null;
    let isConfirmingEdit = false;
    let conversationReady = false;
    let restoringInitialDraft = null;
    let copyNoticeToken = null;
    let retryLoadingTimer = 0;
    let turnControlsCache = null;
    const clearWaitTimer = () => lifecycle.stopWatching();
    const startWaiting = () => {
      diagnostics.reset();
      lifecycle.start(currentRequestId);
      status.classList.remove("error");
      status.textContent = "正在连接…";
    };
    const appearanceController = modules.createAppearanceController({ preferences, card, editConfirmationDialog, fontSizeSlider, fontSizeValue, styleButtons, outsideDismissCheckbox, displaySettingsButton, displaySettings });

    const resetStreamState = () => {
      stream.reset();
      lifecycle.reset();
      copyNoticeToken = null;
      copyFeedback.textContent = "";
      clearTimeout(retryLoadingTimer);
      turnView.beginResponse(body);
    };

    const scroll = modules.createScrollController({
      readingArea, latestButton, card, isInitial: () => lastRequest?.kind === "initial"
    });
    const scrollToFollowupBottom = () => scroll.update();

    const turnView = modules.createTurnView({
      transcript, getSelectedText: () => selectedText.textContent,
      onEdit: (turn) => beginEditingTurn(turn),
      onCancelEdit: (turn) => cancelEditingTurn(turn),
      onSaveEdit: (turn) => saveEditedTurn(turn)
    });
    const { createAssistantResponseBody, appendUserTurn } = turnView;

    const updateComposerState = () => {
      composer.hidden = !currentRequestId;
      const disabled = lifecycle.generating || Boolean(pendingTurn) || Boolean(editingTurn);
      composerInput.disabled = Boolean(editingTurn);
      sendButton.textContent = lifecycle.generating ? "停止" : "发送";
      sendButton.type = lifecycle.generating ? "button" : "submit";
      sendButton.disabled = lifecycle.generating ? lifecycle.stopped : !conversationReady || disabled || !composerInput.value.trim();
      retryButton.disabled = lifecycle.generating || Boolean(editingTurn) || isConfirmingEdit;
      const controlsKey = `${lifecycle.generating}:${isConfirmingEdit}:${followupTurns.length}`;
      if (turnControlsCache?.key === controlsKey && turnControlsCache.editing === editingTurn) return;
      turnControlsCache = { key: controlsKey, editing: editingTurn };
      for (const turn of followupTurns) {
        turn.editButton.disabled = lifecycle.generating || isConfirmingEdit || Boolean(editingTurn && editingTurn !== turn);
        turn.saveEditButton.disabled = lifecycle.generating || isConfirmingEdit;
        turn.cancelEditButton.disabled = lifecycle.generating || isConfirmingEdit;
      }
    };

    const clearConversation = () => {
      clearWaitTimer();
      if (editConfirmationDialog.open) editConfirmationDialog.close("cancel");
      currentSystemPrompt = "";
      conversationMessages = [];
      followupTurns.length = 0;
      pendingTurn = null;
      editingTurn = null;
      isConfirmingEdit = false;
      conversationReady = false;
      lifecycle.reset();
      scroll.reset();
      lastRequest = null;
      composerInput.value = "";
      updateComposerState();
      turnView.clear();
      transcript.replaceChildren();
    };

    const beginEditingTurn = (turn) => {
      if (!conversationReady || lifecycle.generating || isConfirmingEdit || (editingTurn && editingTurn !== turn)) return;
      const turnIndex = followupTurns.indexOf(turn);
      if (turnIndex < 0) return;

      editingTurn = turn;
      turn.editorInput.value = turn.message.textContent;
      const laterTurnCount = followupTurns.length - turnIndex - 1;
      turn.editorWarning.hidden = false;
      turn.editorWarning.textContent = laterTurnCount
        ? `修改后需要重新生成回复，并删除之后的 ${laterTurnCount} 轮追问及回复。`
        : "修改后将替换本轮 AI 回复，取消编辑会保留原内容。";
      turn.message.hidden = true;
      turn.editButton.hidden = true;
      turn.editor.hidden = false;
      updateComposerState();
      turn.editorInput.focus();
      turn.editorInput.setSelectionRange(turn.editorInput.value.length, turn.editorInput.value.length);
    };

    const cancelEditingTurn = (turn) => {
      if (editingTurn !== turn || lifecycle.generating || isConfirmingEdit) return;
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
      if (editingTurn !== turn || lifecycle.generating || isConfirmingEdit) return;
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
      if (editingTurn !== turn || lifecycle.generating) return;

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
        turnView.removeResponse(affectedTurn.assistantElement);
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
      if (!pendingTurn || !stream.text || stream.truncated) return false;
      conversationMessages = [
        ...pendingTurn.messages,
        { role: "assistant", content: stream.text }
      ];
      pendingTurn = null;
      conversationReady = true;
      return true;
    };

    const stream = modules.createStreamRenderer({
      getBody: () => body, status, spinner, copyButton,
      onScroll: () => scrollToFollowupBottom(),
      onComplete: () => finishTurn(),
      onBatch: (milliseconds, remaining) => diagnostics.batch(milliseconds, remaining),
      onLimit: () => {
        if (currentRequestId) void extensionApi.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId: currentRequestId }).catch(() => {});
      }
    });

    const finishTurn = () => {
      clearWaitTimer();
      const completed = !stream.failureMessage && commitPendingTurn();
      if (completed) {
        retryButton.hidden = true;
        status.textContent = "生成完成";
        status.classList.remove("error");
      } else {
        retryButton.hidden = lastRequest?.canRetry === false;
        retryButton.disabled = false;
        retryButton.textContent = lifecycle.stopped ? "重新生成" : "重试";
        if (stream.truncated || (stream.failureMessage && stream.text)) {
          body.classList.remove("error");
        } else {
          body.classList.add("error");
          body.textContent = stream.failureMessage || "模型没有返回文字内容，请重试。";
        }
        status.classList.add("error");
        status.textContent = stream.failureMessage
          ? `${stream.failureMessage}${stream.text ? " 已保留部分回复（未完成），不会进入后续对话。" : ""}`
          : stream.truncated
          ? "回复超过安全长度上限，当前不完整内容不会进入后续对话。"
          : "模型没有返回文字内容，请重试。";
      }
      lifecycle.finish(Boolean(completed));
      turnView.finishResponse(body, stream.text);
      updateComposerState();
    };

    const { saveBounds, clampPosition, syncRestoreButtonPosition } = modules.createGeometryController({ preferences, host, card, header, restoreButton, resizeHandles });

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
      stream.setPaused(collapsed || document.hidden);
      turnView.setPaused(collapsed || document.hidden);
      visibilityButton.textContent = collapsed ? "+" : "−";
      visibilityButton.setAttribute("aria-expanded", String(!collapsed));
      visibilityButton.setAttribute("aria-label", collapsed ? "显示回复框" : "隐藏回复框");
      visibilityButton.title = collapsed ? "显示回复框" : "隐藏回复框";
    };
    document.addEventListener("visibilitychange", () => {
      stream.setPaused(card.hidden || document.hidden);
      turnView.setPaused(card.hidden || document.hidden);
    });
    window.addEventListener("pagehide", () => closeOverlay());
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) void preferences.refresh().catch(() => {});
    });

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
      if (!appearanceController.shouldDismissOutside() || card.hidden || isCollapsed || event.button !== 0) return;
      if (event.composedPath().includes(host)) return;

      const target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      if (target?.closest("a, button, input, select, textarea, summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link'], [role='menuitem'], [role='textbox']")) return;

      saveBounds();
      setCollapsed(true);
    }, true);

    const showTurnError = (message) => {
      if (stream.finalized) return;
      clearWaitTimer();
      lifecycle.fail();
      const error = message || "请求失败，请重试。";
      status.textContent = error;
      status.classList.add("error");
      // 继续按预算渲染已收到的文本，避免错误时同步重建长回复。
      stream.finish(error);
    };

    const dispatchFollowup = async (messages) => {
      scroll.setFollowing(true);
      const requestId = crypto.randomUUID();
      currentRequestId = requestId;
      spinner.hidden = false;
      retryButton.hidden = true;
      retryButton.disabled = false;
      retryButton.textContent = "重试";
      resetStreamState();
      startWaiting();
      body.replaceChildren();
      body.classList.remove("error");
      body.classList.add("streaming");
      copyButton.hidden = true;
      updateComposerState();
      scrollToFollowupBottom();

      try {
        const result = await extensionApi.runtime.sendMessage({
          type: "FOLLOWUP_REQUEST",
          requestId,
          systemPrompt: currentSystemPrompt,
          messages
        });
        if (!result?.accepted) throw new Error("后台未确认追问。");
      } catch {
        if (currentRequestId === requestId) showTurnError("无法发起追问，请重新加载页面后再试。");
      }
    };

    const submitFollowup = async () => {
      if (!conversationReady || lifecycle.generating || pendingTurn || editingTurn) return;
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
    sendButton.addEventListener("click", () => {
      if (!lifecycle.generating || lifecycle.stopped || !currentRequestId) return;
      const requestId = currentRequestId;
      lifecycle.stop();
      clearWaitTimer();
      // 先在本地封住迟到分片，再异步取消后台；渲染队列仍按原预算收尾。
      showTurnError("已停止，回复未完成");
      updateComposerState();
      void extensionApi.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId, stop: true }).catch(() => {});
    });
    composerInput.addEventListener("input", updateComposerState);
    composerInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      void submitFollowup();
    });

    retryButton.addEventListener("click", async () => {
      if (!lastRequest || lastRequest.canRetry === false || retryButton.disabled) return;
      retryButton.disabled = true;
      retryButton.textContent = "正在重试…";
      if ((lastRequest.kind === "followup" || lastRequest.kind === "edit") && pendingTurn) {
        void dispatchFollowup(pendingTurn.messages);
        return;
      }
      try {
        restoringInitialDraft = { requestId: currentRequestId, value: composerInput.value };
        const retryRequestId = currentRequestId;
        const result = await extensionApi.runtime.sendMessage({
          type: "RETRY_REQUEST",
          retryOf: currentRequestId,
          selectedText: lastRequest.selectedText,
          promptId: lastRequest.promptId
        });
        if (!result?.accepted) throw new Error("后台未确认重试。");
        if (restoringInitialDraft && currentRequestId === retryRequestId) {
          retryLoadingTimer = setTimeout(() => {
            if (currentRequestId !== retryRequestId || !restoringInitialDraft) return;
            restoringInitialDraft = null;
            retryButton.disabled = false;
            retryButton.textContent = "重试";
            status.textContent = "后台未能启动重试，请重新加载扩展并刷新网页。";
          }, 15_000);
        }
      } catch {
        restoringInitialDraft = null;
        retryButton.disabled = false;
        retryButton.textContent = "重试";
        status.textContent = "无法发起重试，请重新加载页面后再试。";
      }
    });

    const closeOverlay = () => {
      clearWaitTimer();
      restoringInitialDraft = null;
      saveBounds(true);
      if (currentRequestId && spinner.hidden === false) {
        void extensionApi.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId: currentRequestId }).catch(() => {});
      }
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
    closeButton.addEventListener("click", closeOverlay);

    copyButton.addEventListener("click", async () => {
      if (!stream.text) return;
      const token = {};
      copyNoticeToken = token;
      const copiedRequestId = currentRequestId;
      const copiedText = stream.text;
      try {
        await navigator.clipboard.writeText(copiedText);
      } catch {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = copiedText;
          textarea.style.cssText = "position:fixed;left:-9999px;top:0";
          shadow.appendChild(textarea);
          textarea.select();
          try { if (!document.execCommand("copy")) throw new Error("Clipboard unavailable"); }
          finally { textarea.remove(); }
        } catch {
          if (copyNoticeToken === token && currentRequestId === copiedRequestId) status.textContent = "复制失败，请检查浏览器剪贴板权限。";
          return;
        }
      }
      if (copyNoticeToken !== token || currentRequestId !== copiedRequestId) return;
      copyFeedback.textContent = "已复制";
      window.setTimeout(() => {
        if (copyNoticeToken === token) copyFeedback.textContent = "";
      }, 1600);
    });

    extensionApi.runtime.onMessage.addListener((message) => {
      if (message?.type === "SHOW_LOADING") {
        resetStreamState();
        clearConversation();
        currentRequestId = message.requestId;
        currentSystemPrompt = String(message.promptText ?? "");
        lastRequest = {
          kind: "initial",
          canRetry: message.canRetry !== false,
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
        body.classList.remove("error");
        body.classList.remove("streaming");
        status.classList.remove("error");
        spinner.hidden = false;
        copyButton.hidden = true;
        retryButton.hidden = true;
        retryButton.disabled = false;
        retryButton.textContent = "重试";
        composerInput.value = restoringInitialDraft && restoringInitialDraft.requestId === message.retryOf ? restoringInitialDraft.value : "";
        restoringInitialDraft = null;
        selectedPanel.open = true;
        selectedSummary.textContent = "收起原题";
        startWaiting();
        updateComposerState();
        displaySettings.hidden = true;
        displaySettingsButton.setAttribute("aria-expanded", "false");
        displaySettingsButton.setAttribute("aria-label", "显示样式设置");
        setCollapsed(false);
        card.hidden = false;
        clampPosition();
        scroll.reset();
        return;
      }

      if (message?.requestId !== currentRequestId) return;
      if (lifecycle.stopped) return;
      if (stream.finalized && message.type !== "FOLLOWUP_LOADING") return;

      if (message.type === "FOLLOWUP_LOADING") {
        resetStreamState();
        body.replaceChildren();
        body.classList.remove("error");
        body.classList.add("streaming");
        spinner.hidden = false;
        retryButton.hidden = true;
        retryButton.disabled = false;
        status.classList.remove("error");
        startWaiting();
        updateComposerState();
      } else if (message.type === "REQUEST_PHASE") {
        lifecycle.connected();
        if (!lifecycle.networkFinished && !stream.failureMessage && stream.receivedCharacters === 0) status.textContent = "等待 AI 回复…";
      } else if (message.type === "STREAM_STOPPED") {
        lifecycle.stop();
        showTurnError("已停止，回复未完成");
        updateComposerState();
      } else if (message.type === "APPEND_TEXT") {
        if (lifecycle.networkFinished) return;
        if (message.text) {
          lifecycle.received();
          if (status.textContent !== "正在生成…") status.textContent = "正在生成…";
        }
        stream.append(String(message.text ?? ""));
      } else if (message.type === "STREAM_DONE") {
        clearWaitTimer();
        lifecycle.endNetwork();
        stream.finish();
      } else if (message.type === "SHOW_ERROR" || message.type === "SHOW_TURN_ERROR") {
        showTurnError(message.message || "请求失败，请稍后重试。");
        if (!isCollapsed) card.hidden = false;
      }
    });


  };
})();
