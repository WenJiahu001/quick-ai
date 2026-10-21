import { streamChatCompletion } from "../../chat-completions.js";

const REQUEST_TIMEOUT_MS = 120_000;

// 生命周期由请求管理器拥有；传输层只合并文本、转发状态和处理超时。
export function createResponseStreamer({ getRequest, isCurrentRequest, sendToTab }) {
  return async function streamResponse({ tabId, requestId, systemPrompt, messages, settings, baseUrl, signal, isFollowup }) {
    let timedOut = false;
    const timeout = setTimeout(() => {
      const current = getRequest(tabId);
      if (current?.requestId === requestId) {
        timedOut = true;
        current.controller.abort();
      }
    }, REQUEST_TIMEOUT_MS);

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

    try {
      await streamChatCompletion({
        baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        systemPrompt,
        messages,
        signal,
        onConnected: async () => {
          if (!signal.aborted && isCurrentRequest(tabId, requestId)) {
            await sendToTab(tabId, { type: "REQUEST_PHASE", requestId, phase: "waiting" });
          }
        },
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
      // 报错前交付尚未达到合并间隔的尾部文本，浮层可保留已生成内容。
      if ((timedOut || !signal.aborted) && isCurrentRequest(tabId, requestId)) await flushText().catch(() => {});
      if (!timedOut) throw error;
      await sendToTab(tabId, {
        type: isFollowup ? "SHOW_TURN_ERROR" : "SHOW_ERROR",
        requestId,
        message: "请求超时（2 分钟），请重试。"
      }).catch(() => {});
    } finally {
      clearTimeout(timeout);
    }
  };
}
