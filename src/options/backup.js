import { normalizeBaseUrl, normalizeProviders, normalizePrompts, normalizeCleanupRules, getActiveProvider } from "../../config.js";
import { askBeforeLeaving } from "./dialogs.js";

export function createBackupController({ collectProviders, getActiveProviderId, promptEditor, cleanupEditor, importFileInput, showStatus, hasUnsavedChanges, applyImported }) {
  async function exportSettings() {
    try {
      const providers = collectProviders().map(({ id, name, model, baseUrl }) => ({
        id,
        name,
        model,
        // 只导出已校验的服务根地址，避免把 URL 查询串或内嵌凭据写入备份。
        baseUrl: normalizeBaseUrl(baseUrl)
      }));
      const backup = {
        format: "quick-ai-settings",
        version: 1,
        exportedAt: new Date().toISOString(),
        activeProviderId: getActiveProviderId(),
        providers,
        prompts: promptEditor.collectPrompts(),
        cleanupRules: cleanupEditor.collectCleanupRules()
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quick-ai-settings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus("配置已导出；文件不包含 API Key。导出的内容是当前页面中的设置。");
    } catch (error) {
      showStatus(error.message || "导出配置失败。", true);
    }
  }

  async function importSettings() {
    const file = importFileInput.files?.[0];
    importFileInput.value = "";
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (imported?.format !== "quick-ai-settings" || imported.version !== 1) {
        throw new Error("配置文件格式或版本不受支持。");
      }
      if (!Array.isArray(imported.providers) || !imported.providers.length || imported.providers.some((provider) =>
        !provider || typeof provider !== "object" || typeof provider.id !== "string" || !provider.id.trim() ||
        typeof provider.name !== "string" || typeof provider.model !== "string" || typeof provider.baseUrl !== "string"
      )) {
        throw new Error("配置文件中的 AI 服务商数据无效。");
      }
      const importedProviderIds = imported.providers.map((provider) => provider.id);
      if (new Set(importedProviderIds).size !== importedProviderIds.length ||
        typeof imported.activeProviderId !== "string" || !importedProviderIds.includes(imported.activeProviderId)) {
        throw new Error("配置文件中的服务商 ID 或当前服务商无效。");
      }
      if (!Array.isArray(imported.prompts) || !imported.prompts.length || imported.prompts.some((prompt) =>
        !prompt || typeof prompt !== "object" || typeof prompt.name !== "string" || !prompt.name.trim() ||
        typeof prompt.content !== "string" || !prompt.content.trim()
      )) {
        throw new Error("配置文件中的提示词数据无效。");
      }
      if (!Array.isArray(imported.cleanupRules) || imported.cleanupRules.some((rule) =>
        !rule || typeof rule !== "object" || typeof rule.find !== "string" || !rule.find.trim() ||
        typeof rule.replacement !== "string"
      )) {
        throw new Error("配置文件中的清理规则数据无效。");
      }
      const currentProviders = collectProviders();
      const existingById = new Map(currentProviders.map((provider) => [provider.id, provider]));
      let clearedKeyCount = 0;
      const providers = normalizeProviders(imported.providers).map((provider) => {
        const baseUrl = normalizeBaseUrl(provider.baseUrl);
        const existing = existingById.get(provider.id);
        let apiKey = "";
        try {
          if (existing && normalizeBaseUrl(existing.baseUrl) === baseUrl) apiKey = existing.apiKey;
        } catch { /* 无效旧地址不能作为密钥复用依据。 */ }
        if (existing?.apiKey && !apiKey) clearedKeyCount++;
        return { ...provider, baseUrl, apiKey };
      });
      const prompts = normalizePrompts(imported.prompts);
      const cleanupRules = normalizeCleanupRules(imported.cleanupRules);
      const active = getActiveProvider(providers, imported.activeProviderId);
      if (!active) throw new Error("配置文件中的当前服务商无效。");

      if (hasUnsavedChanges()) {
        const answer = await askBeforeLeaving("覆盖未保存的修改？", "导入会替换页面中的服务商、提示词和清理规则，尚未保存的修改将被覆盖。", [
          ["cancel", "取消"], ["replace", "覆盖并导入"]
        ]);
        if (answer !== "replace") return;
      }
      applyImported({ providers, activeProviderId: active.id, prompts, cleanupRules });
      showStatus(`配置已载入页面但尚未保存。请分别打开服务商、提示词和清理规则选项卡并保存；仅 ID 和 API 地址均相同的服务商沿用本机 API Key。${clearedKeyCount ? `已清空 ${clearedKeyCount} 个地址变更的服务商密钥，请重新填写。` : ""}`);
    } catch (error) {
      showStatus(error.message || "导入配置失败。", true);
    }
  }

  return { exportSettings, importSettings };
}
