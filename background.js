import {
  DEFAULT_SETTINGS,
  applyCleanupRules,
  baseUrlOriginPattern,
  normalizeBaseUrl,
  normalizeCleanupRules,
  normalizePrompts,
  normalizeProviders,
  getActiveProvider
} from "./config.js";
import { streamChatCompletion } from "./chat-completions.js";
import "./browser-api.js";

const MENU_ID = "quick-ai-root";
const MENU_ITEM_PREFIX = "quick-ai-prompt-";
const activeRequests = new Map();
const REQUEST_TIMEOUT_MS = 120_000;
const extensionApi = globalThis.quickAiBrowserApi;
let menuRefreshQueue = Promise.resolve();
let menuRefreshPending = false;
let menuRefreshInProgress = false;

extensionApi.runtime.onInstalled.addListener(() => {
  void refreshContextMenus();
});

extensionApi.runtime.onStartup.addListener(() => void refreshContextMenus());

extensionApi.action.onClicked.addListener(() => {
  void Promise.resolve().then(() => extensionApi.runtime.openOptionsPage()).catch(() => {});
});

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.prompts || changes.prompt)) {
    void refreshContextMenus();
  }
});

extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof info.menuItemId !== "string" || !info.menuItemId.startsWith(MENU_ITEM_PREFIX) || !tab?.id) return;

  // 判空时忽略纯空白选区，但传给模型和界面时保留原始换行与首尾空白。
  const selectedText = String(info.selectionText ?? "");
  if (!selectedText.trim()) return;

  const promptId = info.menuItemId.slice(MENU_ITEM_PREFIX.length);
  void beginRequest(tab.id, selectedText, promptId);
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "REFRESH_CONTEXT_MENUS") {
    void refreshContextMenus().then(
      (ok) => sendResponse({ ok }),
      () => sendResponse({ ok: false })
    );
    return true;
  }

  if (message?.type === "RETRY_REQUEST") {
    const tabId = sender.tab?.id;
    const selectedText = String(message.selectedText ?? "");
    const promptId = String(message.promptId ?? "");
    if (tabId && selectedText.trim() && promptId) {
      void beginRequest(tabId, selectedText, promptId);
    }
    return;
  }

  if (message?.type === "CANCEL_REQUEST") {
    const request = activeRequests.get(message.requestId);
    if (request && request.tabId === sender.tab?.id) request.controller.abort();
    return;
  }

  if (message?.type === "OPEN_OPTIONS") {
    void extensionApi.runtime.openOptionsPage();
  }
});

function refreshContextMenus() {
  menuRefreshPending = true;
  if (menuRefreshInProgress) return menuRefreshQueue;

  menuRefreshInProgress = true;
  menuRefreshQueue = menuRefreshQueue.then(async () => {
    let succeeded = true;
    try {
      // 合并构建期间到达的存储事件与显式刷新请求，避免旧菜单在新菜单之后落地。
      while (menuRefreshPending) {
        menuRefreshPending = false;
        succeeded = await buildContextMenus();
      }
    } finally {
      menuRefreshInProgress = false;
      if (menuRefreshPending) void refreshContextMenus();
    }
    return succeeded;
  });
  return menuRefreshQueue;
}

async function buildContextMenus() {
  try {
    const stored = await extensionApi.storage.local.get(["prompts", "prompt"]);
    const prompts = normalizePrompts(stored.prompts, stored.prompt).filter((prompt) => prompt.enabled);
    await extensionApi.contextMenus.removeAll();
    if (!prompts.length) return true;
    const orderedPrompts = [
      ...prompts.filter((prompt) => prompt.favorite),
      ...prompts.filter((prompt) => !prompt.favorite)
    ];
    await createContextMenu({
      id: MENU_ID,
      title: "快捷AI",
      contexts: ["selection"]
    });
    for (const prompt of orderedPrompts) {
      await createContextMenu({
        id: `${MENU_ITEM_PREFIX}${prompt.id}`,
        parentId: MENU_ID,
        title: prompt.favorite ? `常用 · ${prompt.name}` : prompt.name,
        contexts: ["selection"]
      });
    }
    return true;
  } catch {
    // 菜单会在下次扩展启动或设置变更时重新构建。
    return false;
  }
}

function createContextMenu(properties) {
  if (globalThis.browser?.contextMenus === extensionApi.contextMenus) {
    return extensionApi.contextMenus.create(properties);
  }

  // Chromium 的 callback API 可确认菜单创建已完成后再处理下一次刷新。
  return new Promise((resolve, reject) => {
    extensionApi.contextMenus.create(properties, () => {
      const error = extensionApi.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function beginRequest(tabId, selectedText, promptId) {
  const previous = activeRequests.get(tabId);
  previous?.controller.abort();

  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  activeRequests.set(tabId, { requestId, tabId, controller });

  try {
    await ensureOverlay(tabId);
    if (!isCurrentRequest(tabId, requestId)) return;

    const stored = await extensionApi.storage.local.get(null);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    const providers = normalizeProviders(stored.providers, stored);
    const settings = getActiveProvider(providers, stored.activeProviderId) || {
      ...DEFAULT_SETTINGS,
      baseUrl: stored.baseUrl || stored.OPENAI_BASE_URL || DEFAULT_SETTINGS.baseUrl
    };
    const cleanedSelectedText = applyCleanupRules(selectedText, normalizeCleanupRules(stored.cleanupRules));
    const prompts = normalizePrompts(stored.prompts, stored.prompt);
    const selectedPrompt = prompts.find((prompt) => prompt.id === promptId && prompt.enabled);
    if (!selectedPrompt) {
      await sendToTab(tabId, {
        type: "SHOW_LOADING",
        requestId,
        selectedText: cleanedSelectedText,
        retrySelectedText: selectedText,
        promptId,
        promptText: ""
      });
      await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: "所选提示词已不存在，请重新打开右键菜单选择。"
      });
      return;
    }
    await sendToTab(tabId, {
      type: "SHOW_LOADING",
      requestId,
      selectedText: cleanedSelectedText,
      retrySelectedText: selectedText,
      promptId,
      promptName: selectedPrompt.name,
      promptText: selectedPrompt.content
    });
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;

    if (!cleanedSelectedText.trim()) {
      await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: "清理规则处理后题目为空，请调整规则或重新选择文字。"
      });
      return;
    }

    if (!String(settings.apiKey).trim()) {
      await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: "尚未设置 API Key。请先在扩展设置中填写。",
        canOpenSettings: true
      });
      return;
    }
    if (!String(settings.model).trim()) {
      await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: "模型名称为空，请检查扩展设置。",
        canOpenSettings: true
      });
      return;
    }

    let baseUrl;
    try {
      baseUrl = normalizeBaseUrl(settings.baseUrl);
      const permission = baseUrlOriginPattern(baseUrl);
      const allowed = await extensionApi.permissions.contains({ origins: [permission] });
      if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
      if (!allowed) {
        throw new Error("尚未授权访问此 API 地址。请打开扩展设置并重新保存，以授予该站点访问权限。");
      }
    } catch (error) {
      await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: error.message || "Base URL 配置无效。",
        canOpenSettings: true
      });
      return;
    }

    await streamResponse({
      tabId,
      requestId,
      selectedText: cleanedSelectedText,
      selectedPrompt,
      settings,
      baseUrl,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name !== "AbortError") {
      const delivered = await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: error?.message || "请求失败，请稍后重试。"
      }).then(() => true, () => false);
      if (!delivered) showPageAccessError();
    }
  } finally {
    const current = activeRequests.get(tabId);
    if (current?.requestId === requestId) activeRequests.delete(tabId);
  }
}

function showPageAccessError() {
  void extensionApi.action.setBadgeBackgroundColor({ color: "#a12c20" });
  void extensionApi.action.setBadgeText({ text: "!" });
  void extensionApi.action.setTitle({ title: "快捷AI：无法在此页面显示回复；请在普通网页中重试" });
  setTimeout(() => {
    void extensionApi.action.setBadgeText({ text: "" });
    void extensionApi.action.setTitle({ title: "快捷AI" });
  }, 5000);
}

async function ensureOverlay(tabId) {
  // 只在用户点击右键菜单后注入当前标签页，避免读取或处理页面其他内容。
  await extensionApi.scripting.executeScript({
    target: { tabId },
    files: ["browser-api.js", "vendor/streaming-markdown.js", "overlay.js"]
  });
}

function sendToTab(tabId, message) {
  return extensionApi.tabs.sendMessage(tabId, message);
}

function isCurrentRequest(tabId, requestId) {
  return activeRequests.get(tabId)?.requestId === requestId;
}

async function streamResponse({ tabId, requestId, selectedText, selectedPrompt, settings, baseUrl, signal }) {
  let timedOut = false;
  const timeout = setTimeout(() => {
    const current = activeRequests.get(tabId);
    if (current?.requestId === requestId) {
      timedOut = true;
      current.controller.abort();
    }
  }, REQUEST_TIMEOUT_MS);

  try {
    let pendingText = "";
    let lastTextFlushAt = Date.now();
    const flushText = async () => {
      if (!pendingText) return;
      const text = pendingText;
      pendingText = "";
      lastTextFlushAt = Date.now();
      if (!isCurrentRequest(tabId, requestId)) return;
      await sendToTab(tabId, { type: "APPEND_TEXT", requestId, text });
    };

    await streamChatCompletion({
      baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt: selectedPrompt.content,
      userText: selectedText,
      signal,
      onText: async (text) => {
        if (!isCurrentRequest(tabId, requestId)) return;
        pendingText += text;
        // 合并高频 token 分片，降低跨上下文消息数量；流结束时会立即刷新尾部内容。
        if (Date.now() - lastTextFlushAt >= 50) await flushText();
      }
    });

    await flushText();
    await sendToTab(tabId, { type: "STREAM_DONE", requestId });
  } catch (error) {
    if (!timedOut) throw error;
    await sendToTab(tabId, {
      type: "SHOW_ERROR",
      requestId,
      message: "请求超时（2 分钟），请重试。"
    }).catch(() => {});
  } finally {
    clearTimeout(timeout);
  }
}
