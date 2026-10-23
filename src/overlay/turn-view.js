(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createTurnView) return;
  modules.createTurnView = ({ transcript, getSelectedText, onEdit, onCancelEdit, onSaveEdit }) => {
    const summarize = modules.summarize;
    const responses = new Map();
    let paused = false;
    const updateResponseVisibility = (record) => {
      if (!record.completed) return;
      if (!record.turn.open) {
        record.renderer?.reset();
        record.renderer = null;
        record.body.replaceChildren();
      } else if (!record.body.hasChildNodes() && !record.renderer) {
        // 旧回复只保存原文，展开时复用同一增量渲染器，避免同步重建长文。
        record.renderer = modules.createStreamRenderer({
          getBody: () => record.body, status: document.createElement("div"), spinner: {}, copyButton: {},
          onScroll() {}, onComplete() { record.renderer = null; }, onLimit() {}
        });
        record.renderer.setPaused(paused);
        record.renderer.append(record.text);
        record.renderer.finish();
      }
    };
    const createAssistantResponseBody = (followupTurn = null) => {
      const turn = document.createElement("details");
      turn.className = "assistant-turn";
      turn.open = true;
      const label = document.createElement("summary");
      label.className = "turn-label";
      const question = followupTurn?.message.textContent || getSelectedText();
      label.textContent = `AI · ${summarize(question)}`;
      label.title = question.slice(0, 240);
      const responseBody = document.createElement("div");
      responseBody.className = "body";
      responseBody.setAttribute("aria-live", "polite");
      turn.append(label, responseBody);
      transcript.append(turn);
      const record = { turn, body: responseBody, text: "", completed: false, renderer: null };
      responses.set(responseBody, record);
      turn.addEventListener("toggle", () => updateResponseVisibility(record));
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
      editButton.addEventListener("click", () => onEdit(followupTurn));
      cancelEditButton.addEventListener("click", () => onCancelEdit(followupTurn));
      saveEditButton.addEventListener("click", () => void onSaveEdit(followupTurn));
      editorInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void onSaveEdit(followupTurn);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancelEdit(followupTurn);
        }
      });
      return followupTurn;
    };

    return {
      createAssistantResponseBody, appendUserTurn,
      setPaused(value) {
        paused = value;
        for (const record of responses.values()) record.renderer?.setPaused(value);
      },
      beginResponse(body) {
        const record = responses.get(body);
        if (!record) return;
        record.renderer?.reset();
        record.renderer = null;
        record.completed = false;
        record.text = "";
      },
      finishResponse(body, text) {
        const record = responses.get(body);
        if (!record) return;
        record.text = text || body.textContent;
        record.completed = true;
        updateResponseVisibility(record);
      },
      removeResponse(element) {
        for (const [body, record] of responses) {
          if (record.turn !== element) continue;
          record.renderer?.reset();
          responses.delete(body);
          record.turn.remove();
          break;
        }
      },
      clear() {
        for (const record of responses.values()) record.renderer?.reset();
        responses.clear();
      }
    };
  };
})();
