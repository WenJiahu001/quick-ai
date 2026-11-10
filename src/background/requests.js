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
import { storageReady } from "./preferences.js";
import { MAX_CONVERSATION_CHARS, MAX_INPUT_CHARS } from "../shared/limits.js";
import "../shared/protocol.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

const activeRequests = new Map();
const streamResponse = createResponseStreamer({ getRequest: (tabId) => activeRequests.get(tabId), isCurrentRequest, sendToTab });

export function cancelRequest(tabId, message, documentId) {
  const request = activeRequests.get(tabId);
  if (documentId && request?.documentId !== documentId) return;
  if (request && request.requestId === message.requestId) {
    request.controller.abort();
  }
  if (message.stop && tabId) {
    void sendToTab(tabId, { type: "STREAM_STOPPED", requestId: message.requestId }).catch(() => {});
  }
}

export function cancelTabRequests(tabId) {
  activeRequests.get(tabId)?.controller.abort();
  activeRequests.delete(tabId);
}

export function getRequestStatus(tabId, requestId, documentId) {
  const request = activeRequests.get(tabId);
  return { active: Boolean(request && request.requestId === requestId && request.documentId === documentId && !request.controller.signal.aborted), protocol: globalThis.quickAiProtocol.version };
}

export async function beginRequest(tabId, selectedText, promptId, retryOf = "", documentId, selectedIndent = 0) {
  const previous = activeRequests.get(tabId);
  previous?.controller.abort();

  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const request = { requestId, tabId, controller, documentId };
  activeRequests.set(tabId, request);
  let providerSummary = { providerName: "", model: "" };

  try {
    await storageReady;
    await ensureOverlay(request);
    if (!isCurrentRequest(tabId, requestId)) return;

    const stored = await extensionApi.storage.local.get(null);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    providerSummary = resolveProviderSummary(stored);
    if (selectedText.length > MAX_INPUT_CHARS) throw new Error("选中文字超过 50 万字符，请缩小选区后重试。");
    const cleanedSelectedText = applyCleanupRules(selectedText, normalizeCleanupRules(stored.cleanupRules));
    const prompts = normalizePrompts(stored.prompts, stored.prompt);
    const selectedPrompt = prompts.find((prompt) => prompt.id === promptId && prompt.enabled);
    if (selectedPrompt?.content.length > MAX_INPUT_CHARS) throw new Error("提示词超过 50 万字符，请精简后重试。");
    if (!selectedPrompt) {
      await sendToTab(tabId, {
        type: "SHOW_LOADING",
        requestId,
        retryOf,
        selectedIndent,
        selectedText: cleanedSelectedText,
        retrySelectedText: selectedText,
        promptId,
        promptText: "",
        ...providerSummary
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
      selectedIndent,
      selectedText: cleanedSelectedText,
      retrySelectedText: selectedText,
      promptId,
      promptName: selectedPrompt.name,
      promptText: selectedPrompt.content,
      ...providerSummary
    });
    request.shown = true;
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
      if (!request.shown && request.documentId && isCurrentRequest(tabId, requestId)) {
        const canRetry = selectedText.length <= MAX_INPUT_CHARS && Boolean(selectedText.trim());
        await sendToTab(tabId, { type: "SHOW_LOADING", requestId, selectedText: "", retrySelectedText: canRetry ? selectedText : "", selectedIndent, canRetry, promptText: "", promptId, retryOf, ...providerSummary }).catch(() => {});
      }
      const delivered = await sendToTab(tabId, {
        type: "SHOW_ERROR",
        requestId,
        message: error?.message || "请求失败，请稍后重试。"
      }).then(() => true, () => false);
      if (!delivered && isCurrentRequest(tabId, requestId)) showPageAccessError(tabId, error.message);
    }
  } finally {
    const current = activeRequests.get(tabId);
    if (current?.requestId === requestId) activeRequests.delete(tabId);
  }
}

export async function beginFollowupRequest(tabId, requestId, systemPrompt, rawMessages, documentId) {
  const previous = activeRequests.get(tabId);
  previous?.controller.abort();

  const controller = new AbortController();
  const request = { requestId, tabId, controller, documentId };
  activeRequests.set(tabId, request);

  try {
    await storageReady;
    await ensureOverlay(request);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    const stored = await extensionApi.storage.local.get(null);
    if (controller.signal.aborted || !isCurrentRequest(tabId, requestId)) return;
    await sendToTab(tabId, { type: "FOLLOWUP_LOADING", requestId, ...resolveProviderSummary(stored) });

    const messages = normalizeConversationMessages(rawMessages, systemPrompt);
    if (!messages) {
      await sendToTab(tabId, {
        type: "SHOW_TURN_ERROR",
        requestId,
        message: "对话上下文无效，请重新选择题目开启新对话。"
      });
      return;
    }

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

function normalizeConversationMessages(value, systemPrompt) {
  if (!Array.isArray(value) || value.length === 0 || value.length % 2 === 0) return null;
  let totalCharacters = systemPrompt.length;
  if (totalCharacters > MAX_INPUT_CHARS) throw new Error("提示词过长，请精简后开启新对话。");
  const messages = [];
  for (let index = 0; index < value.length; index++) {
    const message = value[index];
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (message?.role !== expectedRole || typeof message.content !== "string") return null;
    totalCharacters += message.content.length;
    if (message.content.length > MAX_INPUT_CHARS || totalCharacters > MAX_CONVERSATION_CHARS) {
      throw new Error("完整对话超过本机安全长度上限（400 万字符），请重新选择题目开启新对话；历史未被自动裁剪。");
    }
    messages.push({ role: expectedRole, content: message.content });
  }
  return messages;
}

function resolveProviderSummary(stored) {
  const providers = normalizeProviders(stored?.providers, stored);
  const provider = getActiveProvider(providers, stored?.activeProviderId) || DEFAULT_SETTINGS;
  return {
    providerName: String(provider.name ?? "").trim(),
    model: String(provider.model ?? "").trim()
  };
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

function showPageAccessError(tabId, detail = "") {
  void extensionApi.action.setBadgeBackgroundColor({ tabId, color: "#a12c20" }).catch(() => {});
  void extensionApi.action.setBadgeText({ tabId, text: "!" }).catch(() => {});
  void extensionApi.action.setTitle({ tabId, title: `快捷AI：${detail || "无法在此页面显示回复；请在普通网页中重试"}` }).catch(() => {});
  setTimeout(() => {
    void extensionApi.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    void extensionApi.action.setTitle({ tabId, title: "快捷AI" }).catch(() => {});
  }, 5000);
}

async function ensureOverlay(request) {
  const { tabId, requestId, controller } = request;
  const target = request.documentId ? { tabId, documentIds: [request.documentId] } : { tabId };
  // 轻量探测只访问扩展隔离世界；已安装的浮层不会再次注入所有脚本。
  const [probe] = await extensionApi.scripting.executeScript({
    target,
    func: () => ({ installed: Boolean(globalThis.__selectionAiOverlayInstalled), protocol: globalThis.__quickAiOverlayProtocol, failed: Boolean(globalThis.__quickAiOverlayInitializationFailed), attached: Boolean(document.getElementById("selection-ai-overlay-host")) })
  });
  if (!isCurrentRequest(tabId, requestId) || controller.signal.aborted) throw new DOMException("已取消", "AbortError");
  if (!probe?.documentId) throw new Error("无法确认网页文档，请刷新页面后重试。");
  request.documentId = probe.documentId;
  const updateMessage = "扩展文件或网页中的版本不一致，请重新加载快捷AI扩展并刷新网页。";
  if (probe.result?.failed) throw new Error("浮层初始化失败，请重新加载扩展并刷新网页。");
  if (probe.result?.installed) {
    if (probe.result.protocol !== globalThis.quickAiProtocol.version || !probe.result.attached) throw new Error(updateMessage);
    return;
  }
  const [installed] = await extensionApi.scripting.executeScript({
    target: { tabId, documentIds: [request.documentId] },
    files: OVERLAY_SCRIPT_FILES
  });
  if (!installed?.result?.ready || installed.result.protocol !== globalThis.quickAiProtocol.version) throw new Error(updateMessage);
}

function sendToTab(tabId, message) {
  const request = activeRequests.get(tabId);
  if (!request?.documentId || request.requestId !== message.requestId) return Promise.reject(new DOMException("请求已失效", "AbortError"));
  return extensionApi.tabs.sendMessage(tabId, message, { documentId: request.documentId });
}

function isCurrentRequest(tabId, requestId) {
  return activeRequests.get(tabId)?.requestId === requestId;
}

