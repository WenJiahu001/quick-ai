import {
  DEFAULT_SETTINGS,
  baseUrlOriginPattern,
  normalizeBaseUrl,
  normalizePrompts,
  chatCompletionsEndpoint
} from "./config.js";

const MENU_ID = "quick-ai-root";
const MENU_ITEM_PREFIX = "quick-ai-prompt-";
const activeRequests = new Map();
const REQUEST_TIMEOUT_MS = 120_000;
let menuRefreshQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  void refreshContextMenus();
});

chrome.runtime.onStartup.addListener(() => void refreshContextMenus());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.prompts || changes.prompt)) {
    void refreshContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof info.menuItemId !== "string" || !info.menuItemId.startsWith(MENU_ITEM_PREFIX) || !tab?.id) return;

  // 判空时忽略纯空白选区，但传给模型和界面时保留原始换行与首尾空白。
  const selectedText = String(info.selectionText ?? "");
  if (!selectedText.trim()) return;

  const promptId = info.menuItemId.slice(MENU_ITEM_PREFIX.length);
  void beginRequest(tab.id, selectedText, promptId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
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
    void chrome.runtime.openOptionsPage();
  }
});

function refreshContextMenus() {
  menuRefreshQueue = menuRefreshQueue.then(buildContextMenus, buildContextMenus);
  return menuRefreshQueue;
}

async function buildContextMenus() {
  try {
    const stored = await chrome.storage.local.get(["prompts", "prompt"]);
    const prompts = normalizePrompts(stored.prompts, stored.prompt);
    await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "快捷AI",
      contexts: ["selection"]
    });
    for (const prompt of prompts) {
      chrome.contextMenus.create({
        id: `${MENU_ITEM_PREFIX}${prompt.id}`,
        parentId: MENU_ID,
        title: prompt.name,
        contexts: ["selection"]
      });
    }
  } catch {
    // 菜单会在下次扩展启动或设置变更时重新构建。
  }
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

    const stored = await chrome.storage.local.get(null);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    const settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      baseUrl: stored.baseUrl || stored.OPENAI_BASE_URL || DEFAULT_SETTINGS.baseUrl
    };
    const prompts = normalizePrompts(stored.prompts, stored.prompt);
    const selectedPrompt = prompts.find((prompt) => prompt.id === promptId);
    if (!selectedPrompt) {
      await sendToTab(tabId, {
        type: "SHOW_LOADING",
        requestId,
        selectedText,
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
      selectedText,
      promptId,
      promptName: selectedPrompt.name,
      promptText: selectedPrompt.content
    });
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;

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
      const allowed = await chrome.permissions.contains({ origins: [permission] });
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
      selectedText,
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
  void chrome.action.setBadgeBackgroundColor({ color: "#a12c20" });
  void chrome.action.setBadgeText({ text: "!" });
  void chrome.action.setTitle({ title: "快捷AI：无法在此页面显示回复；请在普通网页中重试" });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" });
    void chrome.action.setTitle({ title: "快捷AI" });
  }, 5000);
}

async function ensureOverlay(tabId) {
  // 只在用户点击右键菜单后注入当前标签页，避免读取或处理页面其他内容。
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["overlay.js"]
  });
}

function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
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
    let response;
    try {
      response = await fetch(chatCompletionsEndpoint(baseUrl), {
        method: "POST",
        cache: "no-store",
        headers: {
          "Authorization": `Bearer ${String(settings.apiKey).trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: String(settings.model).trim(),
          messages: [
            { role: "system", content: selectedPrompt.content },
            { role: "user", content: selectedText }
          ],
          stream: true
        }),
        signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new Error("连接 AI 服务失败，请检查网络和 Base URL。", { cause: error });
    }

    if (!response.ok) {
      throw new Error(await describeHttpError(response));
    }
    if (!response.body) throw new Error("API 未返回可读取的流式内容，请稍后重试。");

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

    await readEventStream(response.body, async (event) => {
      if (event.error) {
        const message = event.error?.message || "模型生成失败，请稍后重试。";
        throw new Error(message);
      } else {
        const delta = event.choices?.[0]?.delta?.content;
        const text = extractDeltaText(delta);
        if (text) {
          if (!isCurrentRequest(tabId, requestId)) return;
          pendingText += text;
          // 合并高频 token 分片，降低跨上下文消息数量；流结束时会立即刷新尾部内容。
          if (Date.now() - lastTextFlushAt >= 50) await flushText();
        }
      }
    }, signal);

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

function extractDeltaText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && (part.type === "text" || part.type === "output_text") && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

async function readEventStream(body, onEvent, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines = [];
  let completed = false;

  const dispatch = async () => {
    if (!dataLines.length) return;
    const data = dataLines.join("\n");
    dataLines = [];
    if (data === "[DONE]") return;

    let event;
    try {
      event = JSON.parse(data);
    } catch {
      throw new Error("AI 服务返回了无法识别的流式数据。");
    }
    await onEvent(event);
  };

  const consumeLines = async (flush = false) => {
    const lines = buffer.split(/\r?\n/);
    buffer = flush ? "" : lines.pop() ?? "";
    for (const line of lines) {
      if (line === "") {
        await dispatch();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (flush) await dispatch();
  };

  try {
    while (true) {
      if (signal.aborted) throw new DOMException("请求已取消", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      await consumeLines();
    }
    buffer += decoder.decode();
    await consumeLines(true);
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function describeHttpError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message || "";
  } catch {
    // 有些兼容接口错误时不返回 JSON，下面仍给出通用状态提示。
  }

  if (response.status === 401) return "API Key 无效或已失效，请检查扩展设置。";
  if (response.status === 429) return "请求次数或额度已达限制（429），请稍后重试并检查 API 额度。";
  if (response.status === 403) return `API 拒绝了请求（403）。${detail}`;
  return detail || `API 请求失败（HTTP ${response.status}）。`;
}
