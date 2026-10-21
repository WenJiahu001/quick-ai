import {
  DEFAULT_SETTINGS,
  applyCleanupRules,
  baseUrlOriginPattern,
  normalizeBaseUrl,
  normalizeCleanupRules,
  normalizePrompts,
  normalizeProviders,
  getActiveProvider
} from "../../config.js";
import { OVERLAY_SCRIPT_FILES } from "../shared/runtime-files.js";
import { createResponseStreamer } from "./response-stream.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

const activeRequests = new Map();
const streamResponse = createResponseStreamer({ getRequest: (tabId) => activeRequests.get(tabId), isCurrentRequest, sendToTab });

export function cancelRequest(tabId, message) {
  const request = activeRequests.get(tabId);
  if (request?.requestId === message.requestId) {
    request.controller.abort();
  }
  if (message.stop && tabId) {
    void sendToTab(tabId, { type: "STREAM_STOPPED", requestId: message.requestId }).catch(() => {});
  }
}

export async function beginRequest(tabId, selectedText, promptId, retryOf = "") {
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
    const cleanedSelectedText = applyCleanupRules(selectedText, normalizeCleanupRules(stored.cleanupRules));
    const prompts = normalizePrompts(stored.prompts, stored.prompt);
    const selectedPrompt = prompts.find((prompt) => prompt.id === promptId && prompt.enabled);
    if (!selectedPrompt) {
      await sendToTab(tabId, {
        type: "SHOW_LOADING",
        requestId,
        retryOf,
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
      retryOf,
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

    try {
      const { settings, baseUrl } = await resolveRequestConfiguration(tabId, stored, requestId, controller.signal);
      if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
      await streamResponse({
        tabId,
        requestId,
        systemPrompt: selectedPrompt.content,
        messages: [{ role: "user", content: cleanedSelectedText }],
        settings,
        baseUrl,
        signal: controller.signal,
        isFollowup: false
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: error.message || "请求失败，请稍后重试。",
        canOpenSettings: Boolean(error.canOpenSettings)
      });
    }
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

export async function beginFollowupRequest(tabId, requestId, systemPrompt, rawMessages) {
  const previous = activeRequests.get(tabId);
  previous?.controller.abort();

  const controller = new AbortController();
  activeRequests.set(tabId, { requestId, tabId, controller });

  try {
    await ensureOverlay(tabId);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    await sendToTab(tabId, { type: "FOLLOWUP_LOADING", requestId });

    const messages = normalizeConversationMessages(rawMessages);
    if (!messages) {
      await sendToTab(tabId, {
        type: "SHOW_TURN_ERROR",
        requestId,
        message: "对话上下文无效，请重新选择题目开启新对话。"
      });
      return;
    }

    const stored = await extensionApi.storage.local.get(null);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    const { settings, baseUrl } = await resolveRequestConfiguration(tabId, stored, requestId, controller.signal);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;

    await streamResponse({
      tabId,
      requestId,
      systemPrompt,
      messages,
      settings,
      baseUrl,
      signal: controller.signal,
      isFollowup: true
    });
  } catch (error) {
    if (error?.name !== "AbortError") {
      await sendToTab(tabId, {
        type: "SHOW_TURN_ERROR",
        requestId,
        message: error.message || "追问失败，请稍后重试。",
        canOpenSettings: Boolean(error.canOpenSettings)
      }).catch(() => {});
    }
  } finally {
    const current = activeRequests.get(tabId);
    if (current?.requestId === requestId) activeRequests.delete(tabId);
  }
}

function normalizeConversationMessages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length % 2 === 0) return null;
  const messages = [];
  for (let index = 0; index < value.length; index++) {
    const message = value[index];
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (message?.role !== expectedRole || typeof message.content !== "string") return null;
    messages.push({ role: expectedRole, content: message.content });
  }
  return messages;
}

async function resolveRequestConfiguration(tabId, stored, requestId, signal) {
  const providers = normalizeProviders(stored.providers, stored);
  const settings = getActiveProvider(providers, stored.activeProviderId) || {
    ...DEFAULT_SETTINGS,
    baseUrl: stored.baseUrl || stored.OPENAI_BASE_URL || DEFAULT_SETTINGS.baseUrl
  };
  if (!String(settings.apiKey).trim()) {
    throw createSettingsError("尚未设置 API Key。请先在扩展设置中填写。");
  }
  if (!String(settings.model).trim()) {
    throw createSettingsError("模型名称为空，请检查扩展设置。");
  }

  let baseUrl;
  try {
    baseUrl = normalizeBaseUrl(settings.baseUrl);
    const permission = baseUrlOriginPattern(baseUrl);
    const allowed = await extensionApi.permissions.contains({ origins: [permission] });
    if (signal.aborted || !isCurrentRequest(tabId, requestId)) return { settings, baseUrl };
    if (!allowed) {
      throw new Error("尚未授权访问此 API 地址。请打开扩展设置并重新保存，以授予该站点访问权限。");
    }
  } catch (error) {
    error.canOpenSettings = true;
    throw error;
  }
  return { settings, baseUrl };
}

function createSettingsError(message) {
  const error = new Error(message);
  error.canOpenSettings = true;
  return error;
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
    files: OVERLAY_SCRIPT_FILES
  });
}

function sendToTab(tabId, message) {
  return extensionApi.tabs.sendMessage(tabId, message);
}

function isCurrentRequest(tabId, requestId) {
  return activeRequests.get(tabId)?.requestId === requestId;
}

