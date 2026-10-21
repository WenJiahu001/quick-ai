import { DEFAULT_SETTINGS, getActiveProvider } from "../../config.js";

export function createProviderEditor({ showStatus }) {
  const apiKeyInput = document.querySelector("#api-key");
  const modelInput = document.querySelector("#model");
  const baseUrlInput = document.querySelector("#base-url");
  const providerNameInput = document.querySelector("#provider-name");
  const providerSelect = document.querySelector("#provider-select");
  const providerCount = document.querySelector("#provider-count");
  const addProviderButton = document.querySelector("#add-provider");
  const removeProviderButton = document.querySelector("#remove-provider");
  const providerDeleteDialog = document.querySelector("#delete-provider-dialog");
  const providerDeleteMessage = document.querySelector("#delete-provider-message");
  const httpWarning = document.querySelector("#http-warning");
  const fields = { name: providerNameInput, model: modelInput, baseUrl: baseUrlInput };
  let providerProfiles = [];
  let activeProviderId = "";
  baseUrlInput.addEventListener("input", updateHttpWarning);
  providerSelect.addEventListener("change", () => {
    providerProfiles = collectProviders();
    activeProviderId = providerSelect.value;
    renderProviderProfiles();
  });
  addProviderButton.addEventListener("click", () => {
    providerProfiles = collectProviders();
    const provider = {
      id: crypto.randomUUID(),
      name: `服务商 ${providerProfiles.length + 1}`,
      apiKey: "",
      model: DEFAULT_SETTINGS.model,
      baseUrl: DEFAULT_SETTINGS.baseUrl
    };
    providerProfiles.push(provider);
    activeProviderId = provider.id;
    renderProviderProfiles();
    providerNameInput.focus();
    providerNameInput.select();
  });
  removeProviderButton.addEventListener("click", async () => {
    if (providerProfiles.length <= 1) return;
    const current = getActiveProvider(collectProviders(), activeProviderId);
    if (!current || !await confirmProviderDeletion(current.name)) return;
    providerProfiles = collectProviders().filter((provider) => provider.id !== activeProviderId);
    activeProviderId = providerProfiles[0]?.id || "";
    renderProviderProfiles();
    showStatus("服务商已从页面移除；点击“保存服务商配置”后才会生效。");
  });
  providerNameInput.addEventListener("input", () => {
    const option = [...providerSelect.options].find((item) => item.value === activeProviderId);
    if (option) option.textContent = providerNameInput.value.trim() || "未命名服务商";
  });

  function renderProviderProfiles() {
    providerSelect.replaceChildren();
    for (const [index, provider] of providerProfiles.entries()) {
      const option = document.createElement("option");
      option.value = provider.id;
      option.textContent = provider.name || `服务商 ${index + 1}`;
      providerSelect.append(option);
    }
    if (!providerProfiles.some((provider) => provider.id === activeProviderId)) {
      activeProviderId = providerProfiles[0]?.id || "";
    }
    providerSelect.value = activeProviderId;
    const active = getActiveProvider(providerProfiles, activeProviderId);
    providerNameInput.value = active?.name || "";
    apiKeyInput.value = active?.apiKey || "";
    modelInput.value = active?.model || DEFAULT_SETTINGS.model;
    baseUrlInput.value = active?.baseUrl || DEFAULT_SETTINGS.baseUrl;
    providerCount.textContent = `${providerProfiles.length} 组`;
    removeProviderButton.disabled = providerProfiles.length <= 1;
    updateHttpWarning();
  }

  function collectProviders() {
    const profiles = providerProfiles.map((provider) => ({ ...provider }));
    const active = profiles.find((provider) => provider.id === activeProviderId);
    if (active) {
      active.name = providerNameInput.value.trim();
      active.apiKey = apiKeyInput.value.trim();
      active.model = modelInput.value.trim();
      active.baseUrl = baseUrlInput.value.trim();
    }
    return profiles;
  }

  function focusProvider(providerId, input) {
    providerProfiles = collectProviders();
    activeProviderId = providerId;
    renderProviderProfiles();
    fields[input].focus();
  }

  function confirmProviderDeletion(providerName) {
    providerDeleteMessage.textContent = `确定删除“${providerName}”吗？保存服务商配置后，此服务商才会从本机配置中移除。`;
    providerDeleteDialog.returnValue = "";
    return new Promise((resolve) => {
      providerDeleteDialog.addEventListener("close", () => {
        resolve(providerDeleteDialog.returnValue === "confirm");
      }, { once: true });
      providerDeleteDialog.showModal();
    });
  }

  function updateHttpWarning() {
    let isHttp = false;
    try {
      isHttp = new URL(baseUrlInput.value.trim()).protocol === "http:";
    } catch {
      // 输入尚未构成完整 URL 时不显示协议提示。
    }
    httpWarning.hidden = !isHttp;
  }

  return {
    collect: collectProviders, focus: focusProvider,
    get activeId() { return activeProviderId; },
    get current() { return getActiveProvider(collectProviders(), activeProviderId); },
    load(providers, selectedId) {
      providerProfiles = providers;
      activeProviderId = getActiveProvider(providers, selectedId)?.id || "";
      renderProviderProfiles();
    }
  };
}
