export async function readEventStream(body, onEvent, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines = [];
  let completed = false;
  let doneMarkerReceived = false;

  const dispatch = async () => {
    if (!dataLines.length) return false;
    const data = dataLines.join("\n");
    dataLines = [];
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
        dataLines.push(line.slice(5).trimStart());
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
      buffer += decoder.decode(value, { stream: true });
      await consumeLines();
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

