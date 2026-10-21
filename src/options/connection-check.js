import { normalizeBaseUrl, baseUrlOriginPattern } from "../../config.js";

export function createConnectionCheck({ extensionApi, connectionButton, connectionStatus, getProvider, snapshot }) {
  let ready = false;
  connectionButton.disabled = true;
  let checkingConnectionId = null;
  let checkingConnectionSnapshot = "";
  function clearConnectionResult() {
    const requestId = checkingConnectionId;
    checkingConnectionId = null;
    checkingConnectionSnapshot = "";
    connectionButton.disabled = false;
    connectionStatus.textContent = "";
    if (requestId) void extensionApi.runtime.sendMessage({ type: "CANCEL_CONNECTION_CHECK", requestId }).catch(() => {});
  }

  connectionButton.addEventListener("click", async () => {
    if (!ready || checkingConnectionId) return;
    const requestId = crypto.randomUUID();
    checkingConnectionId = requestId;
    checkingConnectionSnapshot = snapshot();
    connectionButton.disabled = true;
    connectionStatus.style.color = "#657187";
    connectionStatus.textContent = "正在检查连接…";
    try {
      const settings = { ...getProvider() };
      settings.baseUrl = normalizeBaseUrl(settings.baseUrl);
      if (!settings.apiKey || !settings.model) throw new Error("请填写 API Key 和模型名称。");
      // 保留用户点击的权限申请上下文；只有后台会使用草稿密钥发起 AI 请求。
      const granted = await extensionApi.permissions.request({ origins: [baseUrlOriginPattern(settings.baseUrl)] });
      if (checkingConnectionId !== requestId) return;
      if (!granted) throw new Error("未授予此 API 地址的访问权限。");
      const result = await extensionApi.runtime.sendMessage({ type: "CHECK_CONNECTION", requestId, settings });
      if (checkingConnectionId !== requestId || snapshot() !== checkingConnectionSnapshot) return;
      connectionStatus.textContent = result?.message || "后台未返回连接检查结果，请重新加载扩展。";
      connectionStatus.style.color = result?.ok ? "#2d6845" : "#a12c20";
    } catch (error) {
      if (checkingConnectionId === requestId) {
        connectionStatus.textContent = error.message || "连接检查失败。";
        connectionStatus.style.color = "#a12c20";
      }
    } finally {
      if (checkingConnectionId === requestId) {
        checkingConnectionId = null;
        connectionButton.disabled = false;
      }
    }
  });
  window.addEventListener("pagehide", clearConnectionResult);

  return {
    enable() { ready = true; connectionButton.disabled = false; },
    invalidate() {
      if (checkingConnectionSnapshot && snapshot() !== checkingConnectionSnapshot) clearConnectionResult();
    }
  };
}
