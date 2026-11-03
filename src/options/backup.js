import { normalizeBaseUrl, normalizeProviders, normalizePrompts, normalizeCleanupRules, getActiveProvider } from "../../config.js";
import { askBeforeLeaving } from "./dialogs.js";
import { MAX_BACKUP_BYTES, assertConfigurationSize } from "../shared/limits.js";

function backupBaseUrl(value) {
  // 草稿地址可以不完整；仍移除显式凭据、查询串和片段，避免随备份泄露。
  return String(value ?? "").replace(/[?#][\s\S]*$/, "")
    .replace(/(^[a-z][a-z\d+.-]*:\/\/|^\/\/|^)[^/]*@/i, "$1");
}

function assertBackupSections(value) {
  assertConfigurationSize({ providers: value.providers });
  assertConfigurationSize({ prompts: value.prompts });
  assertConfigurationSize({ cleanup: value.cleanupRules });
}

function hasUniqueIds(items) {
  const ids = items.map((item) => item?.id);
  return ids.every((id) => typeof id === "string" && id.trim() === id && id.length > 0)
    && new Set(ids).size === ids.length;
}

export function createBackupController({ collectProviders, getActiveProviderId, promptEditor, cleanupEditor, importFileInput, showStatus, hasUnsavedChanges, applyImported }) {
  async function exportSettings() {
    try {
      let sanitizedAddressCount = 0;
      const providers = collectProviders().map(({ id, name, model, baseUrl }) => {
        const address = backupBaseUrl(baseUrl);
        if (address !== baseUrl) sanitizedAddressCount++;
        return { id, name, model, baseUrl: address };
      });
      const backup = {
        format: "quick-ai-settings",
        version: 1,
        draft: true,
        exportedAt: new Date().toISOString(),
        activeProviderId: getActiveProviderId(),
        providers,
        prompts: promptEditor.collectPrompts(),
        cleanupRules: cleanupEditor.collectCleanupRules()
      };
      assertBackupSections(backup);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      if (blob.size > MAX_BACKUP_BYTES) throw new Error("完整备份超过 8 MB，请精简后导出。");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quick-ai-settings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus(`当前配置草稿已导出，不包含 API Key；未填写完整的内容也可导入继续编辑。${sanitizedAddressCount ? `已移除 ${sanitizedAddressCount} 个地址中的内嵌凭据、查询参数或片段。` : ""}`);
    } catch (error) {
      showStatus(error.message || "导出配置失败。", true);
    }
  }

  async function importSettings() {
    const file = importFileInput.files?.[0];
    importFileInput.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("完整备份超过 8 MB，请精简后导入。");
      const imported = JSON.parse(await file.text());
      if (imported?.format !== "quick-ai-settings" || imported.version !== 1) {
        throw new Error("配置文件格式或版本不受支持。");
      }
      assertBackupSections(imported);
      const isDraft = imported.draft === true;
      if (!Array.isArray(imported.providers) || !imported.providers.length || imported.providers.some((provider) =>
        !provider || typeof provider !== "object" || typeof provider.id !== "string" || !provider.id.trim() ||
        typeof provider.name !== "string" || typeof provider.model !== "string" || typeof provider.baseUrl !== "string"
      )) {
        throw new Error("配置文件中的 AI 服务商数据无效。");
      }
      const importedProviderIds = imported.providers.map((provider) => provider.id);
      if (!hasUniqueIds(imported.providers) ||
        typeof imported.activeProviderId !== "string" || !importedProviderIds.includes(imported.activeProviderId)) {
        throw new Error("配置文件中的服务商 ID 或当前服务商无效。");
      }
      if (!Array.isArray(imported.prompts) || !imported.prompts.length || imported.prompts.some((prompt) =>
        !prompt || typeof prompt !== "object" || typeof prompt.name !== "string" || (!isDraft && !prompt.name.trim()) ||
        typeof prompt.content !== "string" || (!isDraft && !prompt.content.trim())
      )) {
        throw new Error("配置文件中的提示词数据无效。");
      }
      if (!Array.isArray(imported.cleanupRules) || imported.cleanupRules.some((rule) =>
        !rule || typeof rule !== "object" || typeof rule.find !== "string" || (!isDraft && !rule.find.trim()) ||
        typeof rule.replacement !== "string"
      )) {
        throw new Error("配置文件中的清理规则数据无效。");
      }
      if (isDraft && (!hasUniqueIds(imported.prompts) || !hasUniqueIds(imported.cleanupRules))) {
        throw new Error("配置草稿中的提示词或清理规则 ID 无效。");
      }
      const currentProviders = collectProviders();
      const existingById = new Map(currentProviders.map((provider) => [provider.id, provider]));
      let clearedKeyCount = 0;
      const providerSource = isDraft ? imported.providers : normalizeProviders(imported.providers);
      const providers = providerSource.map((provider) => {
        const baseUrl = isDraft ? backupBaseUrl(provider.baseUrl) : normalizeBaseUrl(provider.baseUrl);
        const existing = existingById.get(provider.id);
        let apiKey = "";
        try {
          if (existing && normalizeBaseUrl(existing.baseUrl) === normalizeBaseUrl(baseUrl)) apiKey = existing.apiKey;
        } catch { /* 无效旧地址不能作为密钥复用依据。 */ }
        if (existing?.apiKey && !apiKey) clearedKeyCount++;
        return { id: provider.id, name: provider.name, model: provider.model, baseUrl, apiKey };
      });
      // 草稿必须保留空白项，不能经正常配置的规范化流程静默过滤。
      const prompts = isDraft ? imported.prompts.map(({ id, name, content, favorite, enabled }) => ({
        id, name, content, favorite: favorite === true, enabled: enabled !== false
      })) : normalizePrompts(imported.prompts);
      const cleanupRules = isDraft ? imported.cleanupRules.map(({ id, find, replacement }) => ({
        id, find, replacement
      })) : normalizeCleanupRules(imported.cleanupRules);
      const active = getActiveProvider(providers, imported.activeProviderId);
      if (!active) throw new Error("配置文件中的当前服务商无效。");

      if (hasUnsavedChanges()) {
        const answer = await askBeforeLeaving("覆盖未保存的修改？", "导入会替换页面中的服务商、提示词和清理规则，尚未保存的修改将被覆盖。", [
          ["cancel", "取消"], ["replace", "覆盖并导入"]
        ]);
        if (answer !== "replace") return;
      }
      applyImported({ providers, activeProviderId: active.id, prompts, cleanupRules });
      showStatus(`${isDraft ? "配置草稿" : "配置"}已载入页面但尚未保存。${isDraft ? "未完成的内容已保留，请补全后分别保存。" : "请分别打开服务商、提示词和清理规则选项卡并保存。"}仅 ID 和有效 API 地址均相同的服务商沿用本机 API Key。${clearedKeyCount ? `已清空 ${clearedKeyCount} 个地址变更或无效的服务商密钥，请重新填写。` : ""}`);
    } catch (error) {
      showStatus(error.message || "导入配置失败。", true);
    }
  }

  return { exportSettings, importSettings };
}
