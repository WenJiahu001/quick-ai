import {
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS,
  baseUrlOriginPattern,
  getActiveProvider,
  normalizeBaseUrl,
  normalizeCleanupRules,
  normalizePrompts,
  normalizeProviders
} from "./config.js";
import { createPromptEditor } from "./options-prompts.js";
import "./browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;
const form = document.querySelector("#settings-form");
const apiKeyInput = document.querySelector("#api-key");
const modelInput = document.querySelector("#model");
const baseUrlInput = document.querySelector("#base-url");
const providerNameInput = document.querySelector("#provider-name");
const providerSelect = document.querySelector("#provider-select");
const providerCount = document.querySelector("#provider-count");
const addProviderButton = document.querySelector("#add-provider");
const removeProviderButton = document.querySelector("#remove-provider");
const providerDeleteDialog = document.querySelector("#delete-provider-dialog");
const providerDeleteMessage = document.querySelector("#delete-provider-message");
const httpWarning = document.querySelector("#http-warning");
const saveProvidersButton = document.querySelector("#save-providers");
const savePromptsButton = document.querySelector("#save-prompts");
const saveCleanupButton = document.querySelector("#save-cleanup");
const saveStatus = document.querySelector("#save-status");
const exportButton = document.querySelector("#export-settings");
const importButton = document.querySelector("#import-settings-button");
const importFileInput = document.querySelector("#import-settings-file");
const tabButtons = [...document.querySelectorAll('[role="tab"]')];
const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];

let providerProfiles = [];
let activeProviderId = "";
const promptEditor = createPromptEditor({
  promptsList: document.querySelector("#prompts-list"),
  promptCount: document.querySelector("#prompt-count"),
  promptSearchInput: document.querySelector("#prompt-search"),
  addPromptButton: document.querySelector("#add-prompt"),
  togglePromptsButton: document.querySelector("#toggle-prompts"),
  cleanupRulesList: document.querySelector("#cleanup-rules-list"),
  cleanupRuleCount: document.querySelector("#cleanup-rule-count"),
  cleanupRuleSearchInput: document.querySelector("#cleanup-rule-search"),
  addCleanupRuleButton: document.querySelector("#add-cleanup-rule"),
  toggleCleanupRulesButton: document.querySelector("#toggle-cleanup-rules"),
  promptDeleteDialog: document.querySelector("#delete-prompt-dialog"),
  promptDeleteMessage: document.querySelector("#delete-prompt-message"),
  skipPromptDeleteTodayCheckbox: document.querySelector("#skip-prompt-delete-today")
}, showStatus);

void loadSettings();
form.addEventListener("submit", (event) => event.preventDefault());
baseUrlInput.addEventListener("input", updateHttpWarning);
providerSelect.addEventListener("change", () => {
  providerProfiles = collectProviders();
  activeProviderId = providerSelect.value;
  renderProviderProfiles();
});
addProviderButton.addEventListener("click", () => {
  providerProfiles = collectProviders();
  const provider = {
    id: crypto.randomUUID(),
    name: `服务商 ${providerProfiles.length + 1}`,
    apiKey: "",
    model: DEFAULT_SETTINGS.model,
    baseUrl: DEFAULT_SETTINGS.baseUrl
  };
  providerProfiles.push(provider);
  activeProviderId = provider.id;
  renderProviderProfiles();
  providerNameInput.focus();
  providerNameInput.select();
});
removeProviderButton.addEventListener("click", async () => {
  if (providerProfiles.length <= 1) return;
  const current = getActiveProvider(collectProviders(), activeProviderId);
  if (!current || !await confirmProviderDeletion(current.name)) return;
  providerProfiles = collectProviders().filter((provider) => provider.id !== activeProviderId);
  activeProviderId = providerProfiles[0]?.id || "";
  renderProviderProfiles();
  showStatus("服务商已从页面移除；点击“保存服务商配置”后才会生效。");
});
saveProvidersButton.addEventListener("click", saveProviders);
savePromptsButton.addEventListener("click", savePrompts);
saveCleanupButton.addEventListener("click", saveCleanupRules);
exportButton.addEventListener("click", exportSettings);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", importSettings);
providerNameInput.addEventListener("input", () => {
  const option = [...providerSelect.options].find((item) => item.value === activeProviderId);
  if (option) option.textContent = providerNameInput.value.trim() || "未命名服务商";
});

for (const tab of tabButtons) {
  tab.addEventListener("click", () => activateTab(tab.id));
  tab.addEventListener("keydown", (event) => {
    const index = tabButtons.indexOf(tab);
    const nextIndex = event.key === "ArrowRight"
      ? (index + 1) % tabButtons.length
      : event.key === "ArrowLeft"
        ? (index - 1 + tabButtons.length) % tabButtons.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabButtons.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    activateTab(tabButtons[nextIndex].id, true);
  });
}

async function loadSettings() {
  try {
    const stored = await extensionApi.storage.local.get(null);
    providerProfiles = normalizeProviders(stored.providers, stored);
    activeProviderId = getActiveProvider(providerProfiles, stored.activeProviderId)?.id || providerProfiles[0]?.id || "";
    renderProviderProfiles();
    promptEditor.renderPrompts(normalizePrompts(stored.prompts, stored.prompt));
    promptEditor.renderCleanupRules(normalizeCleanupRules(stored.cleanupRules));
    updateHttpWarning();
  } catch {
    providerProfiles = normalizeProviders([], {});
    activeProviderId = providerProfiles[0].id;
    renderProviderProfiles();
    promptEditor.renderPrompts(DEFAULT_PROMPTS.map((prompt) => ({ ...prompt })));
    promptEditor.renderCleanupRules([]);
    showStatus("读取设置失败，请重新打开此页面。", true);
  }
}

async function saveProviders() {
  showStatus("");
  const providers = collectProviders();
  const invalidProvider = providers.find((provider) => !provider.name.trim() || !provider.model.trim() || !provider.baseUrl.trim());
  if (!providers.length || invalidProvider) {
    showStatus("每个 AI 服务商都需要填写名称、模型名称和 Base URL。", true);
    if (invalidProvider) {
      focusProvider(invalidProvider.id, !invalidProvider.name.trim() ? providerNameInput : !invalidProvider.model.trim() ? modelInput : baseUrlInput);
    }
    return;
  }
  for (const provider of providers) {
    try {
      provider.baseUrl = normalizeBaseUrl(provider.baseUrl);
    } catch (error) {
      showStatus(`${provider.name}：${error.message}`, true);
      focusProvider(provider.id, baseUrlInput);
      return;
    }
  }

  const activeProvider = getActiveProvider(providers, activeProviderId);
  if (!activeProvider) {
    showStatus("请至少配置一个 AI 服务商。", true);
    return;
  }

  saveProvidersButton.disabled = true;
  try {
    const permissionPattern = baseUrlOriginPattern(activeProvider.baseUrl);
    // 只为当前选中的服务商申请权限，其他服务商切换后保存时再授权。
    const granted = await extensionApi.permissions.request({ origins: [permissionPattern] });
    if (!granted) {
      showStatus("未授予此站点权限，服务商配置没有保存。", true);
      return;
    }

    const old = await extensionApi.storage.local.get(null);
    await extensionApi.storage.local.set({ providers, activeProviderId: activeProvider.id });
    await extensionApi.storage.local.remove(["apiKey", "model", "baseUrl", "OPENAI_BASE_URL"]);
    await removeUnusedProviderPermissions(old.providers, old);
    showStatus("AI 服务商配置已保存。");
  } catch (error) {
    showStatus(error.message || "保存 AI 服务商配置失败，请重试。", true);
  } finally {
    saveProvidersButton.disabled = false;
  }
}

async function savePrompts() {
  showStatus("");
  const prompts = promptEditor.collectPrompts();
  const invalidPrompt = prompts.find((prompt) => !prompt.name || !prompt.content);
  if (!prompts.length || invalidPrompt) {
    showStatus("至少保留一组提示词，且每组都需要填写名称和内容。", true);
    if (invalidPrompt) promptEditor.focusPrompt(invalidPrompt.id);
    return;
  }

  savePromptsButton.disabled = true;
  try {
    await extensionApi.storage.local.set({ prompts });
    await extensionApi.storage.local.remove("prompt").catch(() => {});
    // 显式通知后台重建菜单；storage.onChanged 同时作为其他写入来源的兜底。
    const refreshResult = await extensionApi.runtime.sendMessage({ type: "REFRESH_CONTEXT_MENUS" }).catch(() => null);
    showStatus(refreshResult?.ok
      ? "提示词已保存，右键菜单已刷新。禁用项不会出现在菜单中。"
      : "提示词已保存，但后台未确认菜单已刷新；请重新加载扩展后再试。", !refreshResult?.ok);
  } catch (error) {
    showStatus(error.message || "保存提示词失败，请重试。", true);
  } finally {
    savePromptsButton.disabled = false;
  }
}

async function saveCleanupRules() {
  showStatus("");
  const cleanupRules = promptEditor.collectCleanupRules();
  const invalidRule = cleanupRules.find((rule) => !rule.find.trim());
  if (invalidRule) {
    showStatus("每条清理规则都需要填写要查找的文字。", true);
    promptEditor.focusCleanupRule(invalidRule.id);
    return;
  }

  saveCleanupButton.disabled = true;
  try {
    await extensionApi.storage.local.set({ cleanupRules });
    showStatus("选中文字清理规则已保存。");
  } catch (error) {
    showStatus(error.message || "保存清理规则失败，请重试。", true);
  } finally {
    saveCleanupButton.disabled = false;
  }
}

function renderProviderProfiles() {
  providerSelect.replaceChildren();
  for (const [index, provider] of providerProfiles.entries()) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.name || `服务商 ${index + 1}`;
    providerSelect.append(option);
  }
  if (!providerProfiles.some((provider) => provider.id === activeProviderId)) {
    activeProviderId = providerProfiles[0]?.id || "";
  }
  providerSelect.value = activeProviderId;
  const active = getActiveProvider(providerProfiles, activeProviderId);
  providerNameInput.value = active?.name || "";
  apiKeyInput.value = active?.apiKey || "";
  modelInput.value = active?.model || DEFAULT_SETTINGS.model;
  baseUrlInput.value = active?.baseUrl || DEFAULT_SETTINGS.baseUrl;
  providerCount.textContent = `${providerProfiles.length} 组`;
  removeProviderButton.disabled = providerProfiles.length <= 1;
  updateHttpWarning();
}

function collectProviders() {
  const profiles = providerProfiles.map((provider) => ({ ...provider }));
  const active = profiles.find((provider) => provider.id === activeProviderId);
  if (active) {
    active.name = providerNameInput.value.trim();
    active.apiKey = apiKeyInput.value.trim();
    active.model = modelInput.value.trim();
    active.baseUrl = baseUrlInput.value.trim();
  }
  return profiles;
}

function focusProvider(providerId, input) {
  providerProfiles = collectProviders();
  activeProviderId = providerId;
  renderProviderProfiles();
  input.focus();
}

async function removeUnusedProviderPermissions(oldProviderValues, legacySettings) {
  const oldProviders = normalizeProviders(oldProviderValues, legacySettings);
  const currentProviders = collectProviders();
  const retainedPatterns = new Set();
  const oldPatterns = new Set();
  for (const provider of currentProviders) {
    try { retainedPatterns.add(baseUrlOriginPattern(normalizeBaseUrl(provider.baseUrl))); } catch { /* 保存前已校验；保留防御性处理。 */ }
  }
  for (const provider of oldProviders) {
    try { oldPatterns.add(baseUrlOriginPattern(normalizeBaseUrl(provider.baseUrl))); } catch { /* 忽略旧配置中的无效地址。 */ }
  }
  for (const oldPattern of oldPatterns) {
    if (!retainedPatterns.has(oldPattern)) {
      await extensionApi.permissions.remove({ origins: [oldPattern] }).catch(() => false);
    }
  }
}

async function exportSettings() {
  try {
    const providers = collectProviders().map(({ id, name, model, baseUrl }) => ({
      id,
      name,
      model,
      // 只导出已校验的服务根地址，避免把 URL 查询串或内嵌凭据写入备份。
      baseUrl: normalizeBaseUrl(baseUrl)
    }));
    const backup = {
      format: "quick-ai-settings",
      version: 1,
      exportedAt: new Date().toISOString(),
      activeProviderId,
      providers,
      prompts: promptEditor.collectPrompts(),
      cleanupRules: promptEditor.collectCleanupRules()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quick-ai-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus("配置已导出；文件不包含 API Key。导出的内容是当前页面中的设置。");
  } catch (error) {
    showStatus(error.message || "导出配置失败。", true);
  }
}

async function importSettings() {
  const file = importFileInput.files?.[0];
  importFileInput.value = "";
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (imported?.format !== "quick-ai-settings" || imported.version !== 1) {
      throw new Error("配置文件格式或版本不受支持。");
    }
    if (!Array.isArray(imported.providers) || !imported.providers.length || imported.providers.some((provider) =>
      !provider || typeof provider !== "object" || typeof provider.id !== "string" || !provider.id.trim() ||
      typeof provider.name !== "string" || typeof provider.model !== "string" || typeof provider.baseUrl !== "string"
    )) {
      throw new Error("配置文件中的 AI 服务商数据无效。");
    }
    const importedProviderIds = imported.providers.map((provider) => provider.id);
    if (new Set(importedProviderIds).size !== importedProviderIds.length ||
      typeof imported.activeProviderId !== "string" || !importedProviderIds.includes(imported.activeProviderId)) {
      throw new Error("配置文件中的服务商 ID 或当前服务商无效。");
    }
    if (!Array.isArray(imported.prompts) || !imported.prompts.length || imported.prompts.some((prompt) =>
      !prompt || typeof prompt !== "object" || typeof prompt.name !== "string" || !prompt.name.trim() ||
      typeof prompt.content !== "string" || !prompt.content.trim()
    )) {
      throw new Error("配置文件中的提示词数据无效。");
    }
    if (!Array.isArray(imported.cleanupRules) || imported.cleanupRules.some((rule) =>
      !rule || typeof rule !== "object" || typeof rule.find !== "string" || !rule.find.trim() ||
      typeof rule.replacement !== "string"
    )) {
      throw new Error("配置文件中的清理规则数据无效。");
    }
    const currentProviders = collectProviders();
    const existingById = new Map(currentProviders.map((provider) => [provider.id, provider]));
    let clearedKeyCount = 0;
    const providers = normalizeProviders(imported.providers).map((provider) => {
      const baseUrl = normalizeBaseUrl(provider.baseUrl);
      const existing = existingById.get(provider.id);
      let apiKey = "";
      try {
        if (existing && normalizeBaseUrl(existing.baseUrl) === baseUrl) apiKey = existing.apiKey;
      } catch { /* 无效旧地址不能作为密钥复用依据。 */ }
      if (existing?.apiKey && !apiKey) clearedKeyCount++;
      return { ...provider, baseUrl, apiKey };
    });
    const prompts = normalizePrompts(imported.prompts);
    const cleanupRules = normalizeCleanupRules(imported.cleanupRules);
    const active = getActiveProvider(providers, imported.activeProviderId);
    if (!active) throw new Error("配置文件中的当前服务商无效。");

    providerProfiles = providers;
    activeProviderId = active.id;
    renderProviderProfiles();
    promptEditor.renderPrompts(prompts);
    promptEditor.renderCleanupRules(cleanupRules);
    activateTab("tab-providers");
    showStatus(`配置已载入页面但尚未保存。请分别打开服务商、提示词和清理规则选项卡并保存；仅 ID 和 API 地址均相同的服务商沿用本机 API Key。${clearedKeyCount ? `已清空 ${clearedKeyCount} 个地址变更的服务商密钥，请重新填写。` : ""}`);
  } catch (error) {
    showStatus(error.message || "导入配置失败。", true);
  }
}

function confirmProviderDeletion(providerName) {
  providerDeleteMessage.textContent = `确定删除“${providerName}”吗？保存服务商配置后，此服务商才会从本机配置中移除。`;
  providerDeleteDialog.returnValue = "";
  return new Promise((resolve) => {
    providerDeleteDialog.addEventListener("close", () => {
      resolve(providerDeleteDialog.returnValue === "confirm");
    }, { once: true });
    providerDeleteDialog.showModal();
  });
}

function activateTab(tabId, focus = false) {
  const selectedTab = tabButtons.find((tab) => tab.id === tabId);
  if (!selectedTab) return;
  for (const tab of tabButtons) {
    const selected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of tabPanels) {
    panel.hidden = panel.id !== selectedTab.getAttribute("aria-controls");
  }
  if (focus) selectedTab.focus();
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
