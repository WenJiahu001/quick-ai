import {
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS,
  baseUrlOriginPattern,
  normalizeBaseUrl,
  normalizePrompts
} from "./config.js";

const form = document.querySelector("#settings-form");
const apiKeyInput = document.querySelector("#api-key");
const modelInput = document.querySelector("#model");
const baseUrlInput = document.querySelector("#base-url");
const promptsList = document.querySelector("#prompts-list");
const addPromptButton = document.querySelector("#add-prompt");
const httpWarning = document.querySelector("#http-warning");
const saveButton = document.querySelector("#save-button");
const saveStatus = document.querySelector("#save-status");

void loadSettings();
baseUrlInput.addEventListener("input", updateHttpWarning);
addPromptButton.addEventListener("click", () => {
  const prompts = collectPrompts();
  prompts.push({ id: crypto.randomUUID(), name: "新提示词", content: "" });
  renderPrompts(prompts);
  promptsList.lastElementChild?.querySelector("input")?.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "";

  let baseUrl;
  try {
    baseUrl = normalizeBaseUrl(baseUrlInput.value);
  } catch (error) {
    showStatus(error.message, true);
    baseUrlInput.focus();
    return;
  }

  const model = modelInput.value.trim();
  const prompts = collectPrompts();
  if (!model) {
    showStatus("模型名称不能为空。", true);
    modelInput.focus();
    return;
  }
  if (!prompts.length || prompts.some((prompt) => !prompt.name || !prompt.content)) {
    showStatus("每组提示词都需要填写名称和内容。", true);
    return;
  }

  saveButton.disabled = true;
  try {
    const permissionPattern = baseUrlOriginPattern(baseUrl);
    // 仅在保存所选服务地址时申请精确的站点权限。
    const granted = await chrome.permissions.request({ origins: [permissionPattern] });
    if (!granted) {
      showStatus("未授予此站点权限，设置没有保存。", true);
      return;
    }

    const old = await chrome.storage.local.get(null);
    await chrome.storage.local.set({
      apiKey: apiKeyInput.value.trim(),
      model,
      baseUrl,
      prompts
    });
    await chrome.storage.local.remove(["prompt", "OPENAI_BASE_URL"]);

    const previousBaseUrl = old.baseUrl || old.OPENAI_BASE_URL;
    if (previousBaseUrl) {
      const oldBaseUrl = normalizeBaseUrl(previousBaseUrl);
      const oldPattern = baseUrlOriginPattern(oldBaseUrl);
      if (oldPattern !== permissionPattern) {
        await chrome.permissions.remove({ origins: [oldPattern] }).catch(() => false);
      }
    }
    showStatus("设置已保存。右键菜单已更新。");
  } catch (error) {
    showStatus(error.message || "保存设置失败，请重试。", true);
  } finally {
    saveButton.disabled = false;
  }
});

promptsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-prompt]");
  if (!button || promptsList.children.length <= 1) return;
  const prompts = collectPrompts().filter((prompt) => prompt.id !== button.dataset.removePrompt);
  renderPrompts(prompts);
});

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(null);
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    apiKeyInput.value = settings.apiKey || "";
    modelInput.value = settings.model || DEFAULT_SETTINGS.model;
    baseUrlInput.value = settings.baseUrl || settings.OPENAI_BASE_URL || DEFAULT_SETTINGS.baseUrl;
    renderPrompts(normalizePrompts(stored.prompts, stored.prompt));
    updateHttpWarning();
  } catch {
    renderPrompts(DEFAULT_PROMPTS.map((prompt) => ({ ...prompt })));
    showStatus("读取设置失败，请重新打开此页面。", true);
  }
}

function renderPrompts(prompts) {
  promptsList.replaceChildren();

  for (const [index, prompt] of prompts.entries()) {
    const card = document.createElement("section");
    card.className = "prompt-card";
    card.dataset.promptId = prompt.id || crypto.randomUUID();

    const header = document.createElement("div");
    header.className = "prompt-card-header";
    const title = document.createElement("span");
    title.className = "prompt-card-title";
    title.textContent = `提示词 ${index + 1}`;
    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "删除";
    remove.dataset.removePrompt = card.dataset.promptId;
    remove.disabled = prompts.length <= 1;
    header.append(title, remove);

    const nameLabel = document.createElement("label");
    nameLabel.className = "field";
    const nameText = document.createElement("span");
    nameText.textContent = "菜单名称";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 60;
    nameInput.dataset.promptName = "true";
    nameInput.value = prompt.name;
    nameLabel.append(nameText, nameInput);

    const contentLabel = document.createElement("label");
    contentLabel.className = "field";
    const contentText = document.createElement("span");
    contentText.textContent = "提示词内容";
    const contentInput = document.createElement("textarea");
    contentInput.required = true;
    contentInput.rows = 4;
    contentInput.dataset.promptContent = "true";
    contentInput.value = prompt.content;
    contentLabel.append(contentText, contentInput);

    card.append(header, nameLabel, contentLabel);
    promptsList.append(card);
  }
}

function collectPrompts() {
  return [...promptsList.querySelectorAll(".prompt-card")].map((card) => ({
    id: card.dataset.promptId,
    name: card.querySelector("[data-prompt-name]").value.trim(),
    content: card.querySelector("[data-prompt-content]").value.trim()
  }));
}

function updateHttpWarning() {
  let isHttp = false;
  try {
    isHttp = new URL(baseUrlInput.value.trim()).protocol === "http:";
  } catch {
    // 输入尚未构成完整 URL 时不显示协议提示。
  }
  httpWarning.hidden = !isHttp;
}

function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.style.color = isError ? "#a12c20" : "#2d6845";
}
