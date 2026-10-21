import { readEventStream } from "./src/shared/event-stream.js";
import { chatCompletionsEndpoint } from "./config.js";

/**
 * 请求 OpenAI 兼容的 Chat Completions 接口，并逐段交付模型文本。
 * 标签页消息、请求生命周期和超时由后台协调器负责。
 */
export async function streamChatCompletion({ baseUrl, apiKey, model, systemPrompt, messages, signal, onText, onConnected }) {
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
  await onConnected?.();

  let finishReason = null;
  const doneMarkerReceived = await readEventStream(response.body, async (event) => {
    if (event.error) {
      const detail = event.error?.message || "模型生成失败，请稍后重试。";
      const code = event.error?.code || event.error?.type || "";
      throw new Error(isContextLimitError(code, detail)
        ? `${detail} 请重新选择题目开启新对话。`
        : detail);
    }

    const text = extractDeltaText(event.choices?.[0]?.delta?.content);
    if (text) await onText(text);
    const reason = event.choices?.[0]?.finish_reason;
    if (reason != null) finishReason = reason;
  }, signal);
  if (finishReason === "length") throw new Error("回复达到模型输出长度限制，当前内容不完整。可编辑问题缩小回答范围后重新生成。");
  if (finishReason === "content_filter") throw new Error("服务商因内容过滤中止了回复，当前内容不完整。请调整问题后重试。");
  if (finishReason && finishReason !== "stop") throw new Error(`服务商以 ${finishReason} 结束了回复，当前内容不会进入后续对话。请调整问题后重试。`);
  // 部分兼容接口用 stop 后关闭连接替代 [DONE]，二者都可作为正常完成的依据。
  if (!doneMarkerReceived && finishReason !== "stop") throw new Error("回复流提前结束，当前内容可能不完整，请重试。");
}

function extractDeltaText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && (part.type === "text" || part.type === "output_text") && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
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
