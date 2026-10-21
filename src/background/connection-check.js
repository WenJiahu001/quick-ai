import { normalizeBaseUrl, baseUrlOriginPattern } from "../../config.js";
import { streamChatCompletion } from "../../chat-completions.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

const connectionChecks = new Map();

export function handleConnectionCheck(message, sender, sendResponse) {
  // 仅设置页可提交含密钥的配置草稿；网页内容脚本不可调用。
  if (sender.url !== extensionApi.runtime.getURL("options.html")) return;
  const checkKey = sender.documentId || sender.url;
  if (message.type === "CANCEL_CONNECTION_CHECK") {
    const current = connectionChecks.get(checkKey);
    if (current?.requestId === message.requestId) current.controller.abort();
    return;
  }
  void checkConnection(checkKey, message).then(sendResponse, () => sendResponse({ ok: false, message: "连接检查失败，请重试。" }));
  return true;
}

async function checkConnection(checkKey, message) {
  connectionChecks.get(checkKey)?.controller.abort();
  const controller = new AbortController();
  const requestId = String(message.requestId || "");
  connectionChecks.set(checkKey, { requestId, controller });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
  try {
    const settings = message.settings || {};
    const baseUrl = normalizeBaseUrl(settings.baseUrl);
    if (!String(settings.apiKey || "").trim()) throw new Error("请填写 API Key。");
    if (!String(settings.model || "").trim()) throw new Error("请填写模型名称。");
    if (!await extensionApi.permissions.contains({ origins: [baseUrlOriginPattern(baseUrl)] })) {
      throw new Error("未授予此 API 地址的访问权限，请重新检查并授权。");
    }
    if (controller.signal.aborted) throw new DOMException("已取消", "AbortError");
    let receivedText = false;
    await streamChatCompletion({
      baseUrl, apiKey: settings.apiKey, model: settings.model,
      systemPrompt: "请仅回复 OK。", messages: [{ role: "user", content: "连接检查" }],
      signal: controller.signal, onText: (text) => { receivedText ||= Boolean(text.trim()); }
    });
    if (!receivedText) throw new Error("已连接，但模型没有返回文字内容。");
    return { ok: true, requestId, message: "连接成功，模型已正常回复。" };
  } catch (error) {
    return { ok: false, requestId, message: timedOut ? "连接检查超时（30 秒）。" : controller.signal.aborted ? "连接检查已取消。" : error.message || "连接检查失败。" };
  } finally {
    clearTimeout(timer);
    if (connectionChecks.get(checkKey)?.controller === controller) connectionChecks.delete(checkKey);
  }
}

