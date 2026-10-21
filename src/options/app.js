import { createProviderEditor } from "./provider-editor.js";
import { createCleanupEditor } from "./cleanup-editor.js";
import { createDraftController } from "./drafts.js";
import { createConnectionCheck } from "./connection-check.js";
import { createBackupController } from "./backup.js";
import {
  DEFAULT_PROMPTS,
  baseUrlOriginPattern,
  getActiveProvider,
  normalizeBaseUrl,
  normalizeCleanupRules,
  normalizePrompts,
  normalizeProviders
} from "../../config.js";
import { createPromptEditor } from "./prompt-editor.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;
const form = document.querySelector("#settings-form");
const saveProvidersButton = document.querySelector("#save-providers");
const savePromptsButton = document.querySelector("#save-prompts");
const saveCleanupButton = document.querySelector("#save-cleanup");
const saveStatus = document.querySelector("#save-status");
const exportButton = document.querySelector("#export-settings");
const importButton = document.querySelector("#import-settings-button");
const importFileInput = document.querySelector("#import-settings-file");
const tabButtons = [...document.querySelectorAll('[role="tab"]')];
const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];
const sectionSavers = { providers: saveProviders, prompts: savePrompts, cleanup: saveCleanupRules };

const providerEditor = createProviderEditor({ showStatus });
const promptEditor = createPromptEditor({
  promptsList: document.querySelector("#prompts-list"),
  promptCount: document.querySelector("#prompt-count"),
  promptSearchInput: document.querySelector("#prompt-search"),
  addPromptButton: document.querySelector("#add-prompt"),
  togglePromptsButton: document.querySelector("#toggle-prompts"),
  promptDeleteDialog: document.querySelector("#delete-prompt-dialog"),
  promptDeleteMessage: document.querySelector("#delete-prompt-message"),
  skipPromptDeleteTodayCheckbox: document.querySelector("#skip-prompt-delete-today")
}, showStatus);

const cleanupEditor = createCleanupEditor({
  cleanupRulesList: document.querySelector("#cleanup-rules-list"),
  cleanupRuleCount: document.querySelector("#cleanup-rule-count"),
  cleanupRuleSearchInput: document.querySelector("#cleanup-rule-search"),
  addCleanupRuleButton: document.querySelector("#add-cleanup-rule"),
  toggleCleanupRulesButton: document.querySelector("#toggle-cleanup-rules"),
});

const collectProviderSection = () => ({ providers: providerEditor.collect(), activeProviderId: providerEditor.activeId });
const connection = createConnectionCheck({
  extensionApi,
  connectionButton: document.querySelector("#check-connection"),
  connectionStatus: document.querySelector("#connection-status"),
  getProvider: () => providerEditor.current,
  snapshot: () => JSON.stringify(collectProviderSection())
});
const drafts = createDraftController({
  form, tabButtons, sectionSavers, activateTab,
  sectionCollectors: {
    providers: collectProviderSection,
    prompts: () => promptEditor.collectPrompts(),
    cleanup: () => cleanupEditor.collectCleanupRules()
  },
  observedLists: [document.querySelector("#provider-select"), document.querySelector("#prompts-list"), document.querySelector("#cleanup-rules-list")],
  onProvidersChanged: () => connection.invalidate()
});
const backup = createBackupController({
  collectProviders: () => providerEditor.collect(), getActiveProviderId: () => providerEditor.activeId, promptEditor, cleanupEditor, importFileInput, showStatus,
  hasUnsavedChanges: () => Object.keys(sectionSavers).some(drafts.isDirty),
  applyImported(value) {
    providerEditor.load(value.providers, value.activeProviderId);
    promptEditor.renderPrompts(value.prompts);
    cleanupEditor.renderCleanupRules(value.cleanupRules);
    activateTab("tab-providers");
    drafts.update();
  }
});

void loadSettings();
form.addEventListener("submit", (event) => event.preventDefault());
saveProvidersButton.addEventListener("click", saveProviders);
savePromptsButton.addEventListener("click", savePrompts);
saveCleanupButton.addEventListener("click", saveCleanupRules);
exportButton.addEventListener("click", backup.exportSettings);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", backup.importSettings);
for (const tab of tabButtons) {
  tab.addEventListener("click", () => void drafts.requestTab(tab.id));
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
    void drafts.requestTab(tabButtons[nextIndex].id, true);
  });
}

async function loadSettings() {
  try {
    const stored = await extensionApi.storage.local.get(null);
    providerEditor.load(normalizeProviders(stored.providers, stored), stored.activeProviderId);
    promptEditor.renderPrompts(normalizePrompts(stored.prompts, stored.prompt));
    cleanupEditor.renderCleanupRules(normalizeCleanupRules(stored.cleanupRules));
  } catch {
    providerEditor.load(normalizeProviders([], {}));
    promptEditor.renderPrompts(DEFAULT_PROMPTS.map((prompt) => ({ ...prompt })));
    cleanupEditor.renderCleanupRules([]);
    showStatus("读取设置失败，请重新打开此页面。", true);
  } finally {
    drafts.initialize();
    connection.enable();
  }
}

async function saveProviders() {
  if (drafts.isSaving("providers")) return false;
  const submittedSnapshot = drafts.snapshot("providers");
  showStatus("");
  const providers = providerEditor.collect();
  const invalidProvider = providers.find((provider) => !provider.name.trim() || !provider.model.trim() || !provider.baseUrl.trim());
  if (!providers.length || invalidProvider) {
    showStatus("每个 AI 服务商都需要填写名称、模型名称和 Base URL。", true);
    if (invalidProvider) {
      providerEditor.focus(invalidProvider.id, !invalidProvider.name.trim() ? "name" : !invalidProvider.model.trim() ? "model" : "baseUrl");
    }
    return;
  }
  for (const provider of providers) {
    try {
      provider.baseUrl = normalizeBaseUrl(provider.baseUrl);
    } catch (error) {
      showStatus(`${provider.name}：${error.message}`, true);
      providerEditor.focus(provider.id, "baseUrl");
      return;
    }
  }

  const activeProvider = getActiveProvider(providers, providerEditor.activeId);
  if (!activeProvider) {
    showStatus("请至少配置一个 AI 服务商。", true);
    return;
  }

  saveProvidersButton.disabled = true;
  drafts.beginSave("providers");
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
    drafts.markSaved("providers", submittedSnapshot);
    await extensionApi.storage.local.remove(["apiKey", "model", "baseUrl", "OPENAI_BASE_URL"]);
    await removeUnusedProviderPermissions(old.providers, old, providers);
    showStatus("AI 服务商配置已保存。");
    return true;
  } catch (error) {
    showStatus(error.message || "保存 AI 服务商配置失败，请重试。", true);
  } finally {
    saveProvidersButton.disabled = false;
    drafts.endSave("providers");
    drafts.update();
  }
}

async function savePrompts() {
  if (drafts.isSaving("prompts")) return false;
  const submittedSnapshot = drafts.snapshot("prompts");
  showStatus("");
  const prompts = promptEditor.collectPrompts();
  const invalidPrompt = prompts.find((prompt) => !prompt.name || !prompt.content);
  if (!prompts.length || invalidPrompt) {
    showStatus("至少保留一组提示词，且每组都需要填写名称和内容。", true);
    if (invalidPrompt) promptEditor.focusPrompt(invalidPrompt.id);
    return;
  }

  savePromptsButton.disabled = true;
  drafts.beginSave("prompts");
  try {
    await extensionApi.storage.local.set({ prompts });
    drafts.markSaved("prompts", submittedSnapshot);
    await extensionApi.storage.local.remove("prompt").catch(() => {});
    // 显式通知后台重建菜单；storage.onChanged 同时作为其他写入来源的兜底。
    const refreshResult = await extensionApi.runtime.sendMessage({ type: "REFRESH_CONTEXT_MENUS" }).catch(() => null);
    showStatus(refreshResult?.ok
      ? "提示词已保存，右键菜单已刷新。禁用项不会出现在菜单中。"
      : "提示词已保存，但后台未确认菜单已刷新；请重新加载扩展后再试。", !refreshResult?.ok);
    return true;
  } catch (error) {
    showStatus(error.message || "保存提示词失败，请重试。", true);
  } finally {
    savePromptsButton.disabled = false;
    drafts.endSave("prompts");
    drafts.update();
  }
}

async function saveCleanupRules() {
  if (drafts.isSaving("cleanup")) return false;
  const submittedSnapshot = drafts.snapshot("cleanup");
  showStatus("");
  const cleanupRules = cleanupEditor.collectCleanupRules();
  const invalidRule = cleanupRules.find((rule) => !rule.find.trim());
  if (invalidRule) {
    showStatus("每条清理规则都需要填写要查找的文字。", true);
    cleanupEditor.focusCleanupRule(invalidRule.id);
    return;
  }

  saveCleanupButton.disabled = true;
  drafts.beginSave("cleanup");
  try {
    await extensionApi.storage.local.set({ cleanupRules });
    drafts.markSaved("cleanup", submittedSnapshot);
    showStatus("选中文字清理规则已保存。");
    return true;
  } catch (error) {
    showStatus(error.message || "保存清理规则失败，请重试。", true);
  } finally {
    saveCleanupButton.disabled = false;
    drafts.endSave("cleanup");
    drafts.update();
  }
}

async function removeUnusedProviderPermissions(oldProviderValues, legacySettings, currentProviders) {
  const oldProviders = normalizeProviders(oldProviderValues, legacySettings);
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

function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.style.color = isError ? "#a12c20" : "#2d6845";
}

