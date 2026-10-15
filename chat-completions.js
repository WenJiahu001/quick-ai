import { chatCompletionsEndpoint } from "./config.js";

/**
 * 请求 OpenAI 兼容的 Chat Completions 接口，并逐段交付模型文本。
 * 标签页消息、请求生命周期和超时由后台协调器负责。
 */
export async function streamChatCompletion({ baseUrl, apiKey, model, systemPrompt, messages, signal, onText }) {
  let response;
  try {
    response = await fetch(chatCompletionsEndpoint(baseUrl), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Authorization": `Bearer ${String(apiKey).trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: String(model).trim(),
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        stream: true
      }),
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error("连接 AI 服务商失败，请检查网络和 Base URL。", { cause: error });
  }

  if (!response.ok) throw new Error(await describeHttpError(response));
  if (!response.body) throw new Error("API 未返回可读取的流式内容，请稍后重试。");

  await readEventStream(response.body, async (event) => {
    if (event.error) {
      const detail = event.error?.message || "模型生成失败，请稍后重试。";
      const code = event.error?.code || event.error?.type || "";
      throw new Error(isContextLimitError(code, detail)
        ? `${detail} 请重新选择题目开启新对话。`
        : detail);
    }

    const text = extractDeltaText(event.choices?.[0]?.delta?.content);
    if (text) await onText(text);
  }, signal);
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
  } finally {
    // 收到 [DONE] 后尽快关闭响应体，避免继续读取无关数据。
    if (!completed || doneMarkerReceived) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function describeHttpError(response) {
  let detail = "";
  let code = "";
  try {
    const body = await response.json();
    detail = body?.error?.message || "";
    code = body?.error?.code || body?.error?.type || "";
  } catch {
    // 兼容服务商可能返回非 JSON 错误正文的情况。
  }

  if (response.status === 401) return "API Key 无效或已失效，请检查扩展设置。";
  if (response.status === 429) return "请求次数或额度已达限制（429），请稍后重试并检查 API 额度。";
  if (response.status === 403) return `API 拒绝了请求（403）。${detail}`;
  if (isContextLimitError(code, detail)) {
    return `${detail || "对话超出模型上下文限制。"} 请重新选择题目开启新对话。`;
  }
  return detail || `API 请求失败（HTTP ${response.status}）。`;
}

function isContextLimitError(code, detail) {
  return /context.?length|maximum context|too many tokens|prompt.{0,20}too long/i.test(`${code} ${detail}`);
}
