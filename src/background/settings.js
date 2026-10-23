import { assertConfigurationSize } from "../shared/limits.js";
import { normalizeBaseUrl, normalizeProviders, normalizePrompts, normalizeCleanupRules, baseUrlOriginPattern } from "../../config.js";
import { storageReady } from "./preferences.js";

const api = globalThis.quickAiBrowserApi;
let writes = Promise.resolve();
const revisionKey = "quickAiSettingsRevisions";

export function handleSettings(message, sender, sendResponse) {
  if (sender.url !== api.runtime.getURL("options.html")) return;
  const operation = async () => {
    await storageReady;
    const stored = await api.storage.local.get(null);
    const revisions = stored[revisionKey] || {};
    if (message.type === "READ_SETTINGS") return { ok: true, values: stored, revisions };
    const section = message.section;
    if (!["providers", "prompts", "cleanup"].includes(section)) throw new Error("未知配置区块。");
    if ((revisions[section] || 0) !== message.revision) return { ok: false, conflict: true, message: "该区块已在其他设置页更新。请先导出当前草稿，再重新读取配置后合并修改。" };
    const value = message.value;
    assertConfigurationSize({ [section]: value?.providers || value });
    let changes;
    if (section === "providers") {
      if (!Array.isArray(value?.providers) || !value.providers.length) throw new Error("至少保留一个 AI 服务商。");
      const providers = normalizeProviders(value.providers).map((provider) => ({ ...provider, baseUrl: normalizeBaseUrl(provider.baseUrl) }));
      const active = providers.find((provider) => provider.id === value.activeProviderId);
      if (!active || providers.some((provider) => !provider.name || !provider.model)) throw new Error("服务商配置不完整。");
      if (!await api.permissions.contains({ origins: [baseUrlOriginPattern(active.baseUrl)] })) throw new Error("尚未授权访问当前 AI 服务商，请重新保存并授权。");
      changes = { providers, activeProviderId: active.id };
    } else if (section === "prompts") {
      if (!Array.isArray(value) || !value.length || value.some((item) => typeof item?.name !== "string" || typeof item?.content !== "string" || !item.name.trim() || !item.content.trim())) throw new Error("提示词不能为空。");
      changes = { prompts: normalizePrompts(value) };
    } else {
      if (!Array.isArray(value) || value.some((item) => typeof item?.find !== "string" || !item.find.trim())) throw new Error("清理规则无效。");
      changes = { cleanupRules: normalizeCleanupRules(value) };
    }
    const revision = (revisions[section] || 0) + 1;
    await api.storage.local.set({ ...changes, [revisionKey]: { ...revisions, [section]: revision } });
    // 清理失败不应把已经成功的保存报告为失败。
    if (section === "providers") {
      await api.storage.local.remove(["apiKey", "model", "baseUrl", "OPENAI_BASE_URL"]).catch(() => {});
      const retained = new Set(changes.providers.map((item) => baseUrlOriginPattern(item.baseUrl)));
      for (const item of normalizeProviders(stored.providers, stored)) {
        try {
          const origin = baseUrlOriginPattern(normalizeBaseUrl(item.baseUrl));
          if (!retained.has(origin)) await api.permissions.remove({ origins: [origin] });
        } catch { /* 旧地址或权限清理失败不影响配置保存。 */ }
      }
    } else if (section === "prompts") await api.storage.local.remove("prompt").catch(() => {});
    return { ok: true, revision };
  };
  // 不同设置页的校验和写入排队执行，避免先检查后覆盖的竞态。
  const result = writes.then(operation);
  writes = result.catch(() => {});
  void result.then(sendResponse, (error) => sendResponse({ ok: false, message: error.message || "配置读写失败。" }));
  return true;
}
