export const DEFAULT_PROMPT = "请用清晰易懂的中文解释以下文字，概括核心意思，并补充必要背景；如果存在歧义，请指出。";

export const DEFAULT_PROMPTS = Object.freeze([
  Object.freeze({ id: "default", name: "默认解释", content: DEFAULT_PROMPT })
]);

export const DEFAULT_SETTINGS = Object.freeze({
  apiKey: "",
  model: "gpt-6-luna",
  baseUrl: "https://api.openai.com/v1"
});

export const DEFAULT_PROVIDER_ID = "provider-default";

export function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("请填写 AI 服务商 API Base URL。");

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Base URL 格式无效，请填写完整的 HTTP 或 HTTPS 地址。");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Base URL 只支持 HTTP 或 HTTPS 地址。");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL 不能包含用户名、密码、查询参数或片段。");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/chat/completions")) {
    throw new Error("请填写 API 根地址，不要把 /chat/completions 写入 Base URL。");
  }
  return `${url.origin}${pathname}`;
}

export function normalizePrompts(value, legacyPrompt) {
  const source = Array.isArray(value)
    ? value
    : [{ id: "default", name: "默认解释", content: legacyPrompt || DEFAULT_PROMPT }];
  const seenIds = new Set();
  const prompts = source
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const name = String(item.name ?? "").trim();
      const content = String(item.content ?? "").trim();
      let id = String(item.id ?? "").trim();
      if (!id || seenIds.has(id)) id = `prompt-${index}`;
      while (seenIds.has(id)) id = `${id}-copy`;
      seenIds.add(id);
      return {
        id,
        name,
        content,
        favorite: item.favorite === true,
        enabled: item.enabled !== false
      };
    })
    .filter((item) => item.name && item.content);

  return prompts.length ? prompts : DEFAULT_PROMPTS.map((prompt) => ({ ...prompt, enabled: true }));
}

export function normalizeProviders(value, legacySettings = {}) {
  const fallback = {
    id: DEFAULT_PROVIDER_ID,
    name: "默认服务商",
    apiKey: String(legacySettings.apiKey ?? DEFAULT_SETTINGS.apiKey),
    model: String(legacySettings.model ?? DEFAULT_SETTINGS.model),
    baseUrl: String(legacySettings.baseUrl || legacySettings.OPENAI_BASE_URL || DEFAULT_SETTINGS.baseUrl)
  };
  const source = Array.isArray(value) && value.length ? value : [fallback];
  const seenIds = new Set();
  return source
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      let id = String(item.id ?? "").trim();
      if (!id || seenIds.has(id)) id = `provider-${index + 1}`;
      while (seenIds.has(id)) id = `${id}-copy`;
      seenIds.add(id);
      const configuredName = String(item.name ?? "").trim();
      return {
        id,
        name: id === DEFAULT_PROVIDER_ID && configuredName === "默认服务"
          ? "默认服务商"
          : configuredName || `服务商 ${index + 1}`,
        apiKey: String(item.apiKey ?? ""),
        model: String(item.model ?? "").trim(),
        baseUrl: String(item.baseUrl ?? "").trim()
      };
    });
}

export function getActiveProvider(providers, providerId) {
  return providers.find((provider) => provider.id === providerId) || providers[0];
}

export function normalizeCleanupRules(value) {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set();
  return value
    .filter((rule) => rule && typeof rule === "object")
    .map((rule, index) => {
      let id = String(rule.id ?? "").trim();
      if (!id || seenIds.has(id)) id = `cleanup-${index}`;
      while (seenIds.has(id)) id = `${id}-copy`;
      seenIds.add(id);
      return {
        id,
        find: String(rule.find ?? ""),
        replacement: String(rule.replacement ?? "")
      };
    })
    .filter((rule) => rule.find.trim());
}

export function applyCleanupRules(value, rules) {
  let cleanedText = String(value ?? "");
  for (const rule of rules) {
    if (!rule.find) continue;
    // split/join 进行字面替换，避免把用户配置内容解释成正则或替换表达式。
    cleanedText = cleanedText.split(rule.find).join(rule.replacement);
  }
  return cleanedText;
}

export function baseUrlOriginPattern(baseUrl) {
  return `${new URL(baseUrl).origin}/*`;
}

export function chatCompletionsEndpoint(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}
