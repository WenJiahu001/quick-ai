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
    let flushTimer = 0;
    let flushQueue = Promise.resolve();
    const flushText = () => {
      clearTimeout(flushTimer);
      flushTimer = 0;
      if (!pendingText) return flushQueue;
      const text = pendingText;
      pendingText = "";
      // 定时刷新和结束刷新共用队列，保证分片先于完成消息。
      flushQueue = flushQueue.then(async () => {
        if (!isCurrentRequest(tabId, requestId) || (signal.aborted && !timedOut)) return;
        await sendToTab(tabId, { type: "APPEND_TEXT", requestId, text });
      });
      return flushQueue;
    };
    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        void flushText().catch(() => {
          if (isCurrentRequest(tabId, requestId)) getRequest(tabId).controller.abort();
        });
      }, 50);
    };
    let receivedCharacters = 0;

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
          if (!isCurrentRequest(tabId, requestId) || signal.aborted) return;
          const accepted = text.slice(0, Math.max(0, 250_000 - receivedCharacters));
          receivedCharacters += accepted.length;
          for (let offset = 0; offset < accepted.length; offset += 4096) {
            pendingText += accepted.slice(offset, offset + 4096);
            if (pendingText.length >= 4096) await flushText();
            else scheduleFlush();
          }
          if (accepted.length < text.length) throw new Error("回复超过安全长度上限，已保留部分内容，请缩小回答范围后重试。");
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
      clearTimeout(flushTimer);
      await flushQueue.catch(() => {});
    }
  };
}
