import { isCardOpen, setCardOpen, updateListControls, toggleCards } from "./list-controls.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

export function createPromptEditor(elements, showStatus) {
  const {
    promptsList,
    promptCount,
    promptSearchInput,
    addPromptButton,
    togglePromptsButton,
    promptDeleteDialog,
    promptDeleteMessage,
    skipPromptDeleteTodayCheckbox
  } = elements;

  const promptDeleteSkipDateKey = "quickAiPromptDeleteSkipDate";
  let isPromptDeletePending = false;
  const PROMPT_ICON_PATHS = Object.freeze({
    favorite: "M12 3.5 14.6 8.8l5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3.5Z",
    enabled: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    disabled: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a13.8 13.8 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.2-1",
    copy: "M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3M5 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
    "move-up": "M12 19V5m-7 7 7-7 7 7",
    "move-down": "M12 5v14m7-7-7 7-7-7",
    delete: "M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6",
    chevron: "m6 9 6 6 6-6"
  });

  addPromptButton.addEventListener("click", () => {
    const prompts = collectPrompts();
    const prompt = { id: crypto.randomUUID(), name: "新提示词", content: "", enabled: true };
    prompts.push(prompt);
    promptSearchInput.value = "";
    renderPrompts(prompts, prompt.id);
    [...promptsList.querySelectorAll(".prompt-card")]
      .find((card) => card.dataset.promptId === prompt.id)
      ?.querySelector("input")
      ?.focus();
  });
  togglePromptsButton.addEventListener("click", () => toggleCards(promptsList, updatePromptListControls));
  promptSearchInput.addEventListener("input", () => updatePromptListControls(true));
  promptsList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button || isPromptDeletePending) return;
    if (button.hasAttribute("data-toggle-prompt")) {
      const card = button.closest(".prompt-card");
      setCardOpen(card, !isCardOpen(card));
      updatePromptListControls();
      return;
    }

    const prompts = collectPrompts();
    const index = prompts.findIndex((prompt) => prompt.id === button.dataset.promptActionId);
    if (index < 0) return;

    if (button.hasAttribute("data-remove-prompt")) {
      if (prompts.length <= 1) return;
      isPromptDeletePending = true;
      try {
        const skipConfirmation = await shouldSkipPromptDeleteConfirmationToday();
        if (!skipConfirmation) {
          const confirmation = await confirmPromptDeletion(prompts[index].name);
          if (!confirmation.confirmed) return;
          if (confirmation.skipToday) {
            try {
              await extensionApi.storage.local.set({ [promptDeleteSkipDateKey]: getLocalDateKey() });
            } catch {
              showStatus("提示词已删除，但无法保存“今日不再提示”选项。", true);
            }
          }
        }

        const currentPrompts = collectPrompts();
        const currentIndex = currentPrompts.findIndex((prompt) => prompt.id === button.dataset.promptActionId);
        if (currentIndex < 0 || currentPrompts.length <= 1) return;
        currentPrompts.splice(currentIndex, 1);
        renderPrompts(currentPrompts);
      } finally {
        isPromptDeletePending = false;
      }
      return;
    }

    if (button.hasAttribute("data-toggle-favorite")) {
      prompts[index].favorite = !prompts[index].favorite;
    } else if (button.hasAttribute("data-toggle-enabled")) {
      prompts[index].enabled = !prompts[index].enabled;
    } else if (button.hasAttribute("data-copy-prompt")) {
      const source = prompts[index];
      const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} 副本`.slice(0, 60), favorite: false, enabled: true };
      prompts.splice(index + 1, 0, copy);
    } else if (button.hasAttribute("data-move-prompt")) {
      const offset = Number(button.dataset.movePrompt);
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= prompts.length) return;
      [prompts[index], prompts[targetIndex]] = [prompts[targetIndex], prompts[index]];
    } else {
      return;
    }
    renderPrompts(prompts);
  });
  promptsList.addEventListener("input", (event) => {
    const card = event.target.closest(".prompt-card");
    if (card) updatePromptSummary(card);
  });

  function renderPrompts(prompts, openId = "") {
    const previouslyOpen = new Set([...promptsList.querySelectorAll('.prompt-card[data-open="true"]')].map((card) => card.dataset.promptId));
    promptsList.replaceChildren();

    for (const [index, prompt] of prompts.entries()) {
      const card = document.createElement("section");
      card.className = "prompt-card";
      card.dataset.promptId = prompt.id || crypto.randomUUID();
      card.dataset.promptIndex = String(index + 1);
      card.dataset.favorite = String(prompt.favorite === true);
      card.dataset.enabled = String(prompt.enabled !== false);
      card.classList.toggle("is-disabled", prompt.enabled === false);
      const header = document.createElement("div");
      header.className = "prompt-card-header";
      const heading = document.createElement("button");
      heading.className = "prompt-card-heading";
      heading.type = "button";
      heading.dataset.togglePrompt = "true";
      heading.dataset.promptActionId = card.dataset.promptId;
      const headingText = document.createElement("span");
      headingText.className = "prompt-card-heading-text";
      const title = document.createElement("span");
      title.className = "prompt-card-title";
      title.dataset.promptSummaryTitle = "true";
      const namePreview = document.createElement("span");
      namePreview.className = "prompt-card-name";
      namePreview.dataset.promptSummaryName = "true";
      const contentPreview = document.createElement("span");
      contentPreview.className = "prompt-card-preview";
      contentPreview.dataset.promptSummaryContent = "true";
      headingText.append(title, namePreview, contentPreview);
      const chevron = createPromptIcon("chevron");
      chevron.classList.add("prompt-card-chevron");
      heading.append(headingText, chevron);

      const editor = document.createElement("div");
      editor.className = "prompt-editor";
      editor.id = `prompt-editor-${index}`;
      heading.setAttribute("aria-controls", editor.id);

      const actions = document.createElement("div");
      actions.className = "prompt-card-actions";
      actions.setAttribute("role", "group");
      actions.setAttribute("aria-label", "提示词操作");
      actions.append(
        createPromptAction(prompt.enabled === false ? "disabled" : "enabled", prompt.enabled === false ? "启用提示词" : "禁用提示词", card.dataset.promptId, { active: prompt.enabled !== false }),
        createPromptAction("favorite", prompt.favorite ? "取消常用" : "设为常用", card.dataset.promptId, { active: prompt.favorite }),
        createPromptAction("copy", "复制提示词", card.dataset.promptId),
        createPromptAction("move-up", "上移提示词", card.dataset.promptId, { disabled: index === 0 }),
        createPromptAction("move-down", "下移提示词", card.dataset.promptId, { disabled: index === prompts.length - 1 }),
        createPromptAction("delete", "删除提示词", card.dataset.promptId, { disabled: prompts.length <= 1 })
      );
      header.append(heading, actions);

      const nameLabel = document.createElement("label");
      nameLabel.className = "field";
      const nameText = document.createElement("span");
      nameText.textContent = "菜单名称";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.maxLength = 60;
      nameInput.dataset.promptName = "true";
      nameInput.value = prompt.name;
      nameLabel.append(nameText, nameInput);

      const contentLabel = document.createElement("label");
      contentLabel.className = "field";
      const contentText = document.createElement("span");
      contentText.textContent = "提示词内容";
      const contentInput = document.createElement("textarea");
      contentInput.rows = 4;
      contentInput.dataset.promptContent = "true";
      contentInput.value = prompt.content;
      contentLabel.append(contentText, contentInput);

      editor.append(nameLabel, contentLabel);
      card.append(header, editor);
      setCardOpen(card, card.dataset.promptId === openId || previouslyOpen.has(card.dataset.promptId));
      promptsList.append(card);
      updatePromptSummary(card);
    }
    updatePromptListControls(true);
  }

  function createPromptAction(iconName, label, promptId, options = {}) {
    const button = document.createElement("button");
    button.className = "prompt-icon-button";
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.dataset.promptActionId = promptId;
    button.disabled = options.disabled === true;
    if (iconName === "favorite") button.setAttribute("aria-pressed", String(options.active === true));
    if (iconName === "enabled" || iconName === "disabled") {
      button.setAttribute("aria-pressed", String(options.active === true));
      button.dataset.toggleEnabled = "true";
    }
    if (options.active) button.classList.add("is-active");

    if (iconName === "favorite") button.dataset.toggleFavorite = "true";
    if (iconName === "copy") button.dataset.copyPrompt = "true";
    if (iconName === "move-up") button.dataset.movePrompt = "-1";
    if (iconName === "move-down") button.dataset.movePrompt = "1";
    if (iconName === "delete") button.dataset.removePrompt = promptId;

    button.append(createPromptIcon(iconName, options.active));
    return button;
  }

  function createPromptIcon(name, active = false) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", PROMPT_ICON_PATHS[name]);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("fill", name === "favorite" && active ? "currentColor" : "none");
    svg.append(path);
    return svg;
  }

  function updatePromptSummary(card) {
    const name = card.querySelector("[data-prompt-name]").value.trim();
    const content = card.querySelector("[data-prompt-content]").value.slice(0, 160).replace(/\s+/g, " ").trim();
    const stateLabel = `${card.dataset.enabled === "false" ? "已禁用 · " : ""}${card.dataset.favorite === "true" ? "常用 · " : ""}`;
    card.querySelector("[data-prompt-summary-title]").textContent = `${stateLabel}提示词 ${card.dataset.promptIndex}`;
    card.querySelector("[data-prompt-summary-name]").textContent = name || "未命名提示词";
    card.querySelector("[data-prompt-summary-content]").textContent = content || "尚未填写内容";
  }

  function updatePromptListControls(filter = false) {
    updateListControls(promptsList, promptCount, togglePromptsButton, promptSearchInput, "组", filter);
  }

  function collectPrompts() {
    return [...promptsList.querySelectorAll(".prompt-card")].map((card) => ({
      id: card.dataset.promptId,
      name: card.querySelector("[data-prompt-name]").value.trim(),
      content: card.querySelector("[data-prompt-content]").value.trim(),
      favorite: card.dataset.favorite === "true",
      enabled: card.dataset.enabled !== "false"
    }));
  }

  function focusPrompt(promptId) {
    promptSearchInput.value = "";
    updatePromptListControls(true);
    const card = [...promptsList.querySelectorAll(".prompt-card")].find((item) => item.dataset.promptId === promptId);
    setCardOpen(card, true);
    const nameInput = card?.querySelector("[data-prompt-name]");
    (nameInput?.value.trim() ? card.querySelector("[data-prompt-content]") : nameInput)?.focus();
  }

  async function shouldSkipPromptDeleteConfirmationToday() {
    const today = getLocalDateKey();
    try {
      const stored = await extensionApi.storage.local.get(promptDeleteSkipDateKey);
      if (stored[promptDeleteSkipDateKey] === today) return true;
      if (stored[promptDeleteSkipDateKey]) {
        await extensionApi.storage.local.remove(promptDeleteSkipDateKey).catch(() => {});
      }
    } catch {
      // 读取失败时默认显示确认，避免静默删除。
    }
    return false;
  }

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function confirmPromptDeletion(promptName) {
    promptDeleteMessage.textContent = `确定删除“${promptName}”吗？删除后需要重新添加才能恢复。`;
    skipPromptDeleteTodayCheckbox.checked = false;
    promptDeleteDialog.returnValue = "";
    return new Promise((resolve) => {
      promptDeleteDialog.addEventListener("close", () => {
        resolve({
          confirmed: promptDeleteDialog.returnValue === "confirm",
          skipToday: skipPromptDeleteTodayCheckbox.checked
        });
      }, { once: true });
      promptDeleteDialog.showModal();
    });
  }

  return {
    renderPrompts,
    collectPrompts,
    focusPrompt,
  };
}
