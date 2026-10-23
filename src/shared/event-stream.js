import { MAX_EVENT_CHARS } from "./limits.js";

export async function readEventStream(body, onEvent, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines = [];
  let dataCharacters = 0;
  let completed = false;
  let doneMarkerReceived = false;

  const dispatch = async () => {
    if (!dataLines.length) return false;
    const data = dataLines.join("\n");
    dataLines = [];
    dataCharacters = 0;
    if (data === "[DONE]") {
      doneMarkerReceived = true;
      return true;
    }

    let event;
    try {
      event = JSON.parse(data);
    } catch {
      throw new Error("AI 服务商返回了无法识别的流式数据。");
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("AI 服务商返回了无效的流式事件。");
    await onEvent(event);
    return false;
  };

  const consumeLines = async (flush = false) => {
    const lines = buffer.split(/\r?\n/);
    buffer = flush ? "" : lines.pop() ?? "";
    for (const line of lines) {
      if (line === "") {
        await dispatch();
        if (doneMarkerReceived) return true;
      } else if (line.startsWith("data:")) {
        const data = line.slice(5).trimStart();
        dataCharacters += data.length + 1;
        if (dataCharacters > MAX_EVENT_CHARS) throw new Error("AI 服务商返回的单条事件过大，已停止接收。");
        dataLines.push(data);
      }
    }
    if (flush) await dispatch();
    return doneMarkerReceived;
  };

  try {
    while (!doneMarkerReceived) {
      if (signal.aborted) throw new DOMException("请求已取消", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      // 网络块也分段处理，避免一次解码或 split 巨型响应。
      for (let offset = 0; offset < value.length && !doneMarkerReceived; offset += 16_384) {
        buffer += decoder.decode(value.subarray(offset, offset + 16_384), { stream: true });
        if (buffer.length > MAX_EVENT_CHARS) throw new Error("AI 服务商返回的流式行过长，已停止接收。");
        await consumeLines();
      }
    }
    if (!doneMarkerReceived) {
      buffer += decoder.decode();
      await consumeLines(true);
    }
    completed = true;
    return doneMarkerReceived;
  } finally {
    // 收到 [DONE] 后尽快关闭响应体，避免继续读取无关数据。
    if (!completed || doneMarkerReceived) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

