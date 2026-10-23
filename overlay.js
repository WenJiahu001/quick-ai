// 由后台按 runtime-files.js 的顺序注入；重复打开不会重复安装事件监听。
(() => {
  if (globalThis.__selectionAiOverlayInstalled) return { ready: true, protocol: globalThis.__quickAiOverlayProtocol };
  const modules = globalThis.__quickAiOverlayModules;
  const required = ["summarize", "createOverlay", "createView", "createPreferencesClient", "createAppearanceController", "createGeometryController", "createStreamRenderer", "createSafeStreamingRenderer", "createScrollController", "createTurnView", "createRequestLifecycle", "createDiagnostics"];
  if (globalThis.__quickAiOverlayInitializationFailed || !modules || typeof modules.styles !== "string" || required.some((name) => typeof modules[name] !== "function") || !globalThis.quickAiProtocol) {
    console.warn("快捷AI模块加载不完整，请重新加载扩展并刷新网页。");
    return { ready: false };
  }
  try {
    modules.createOverlay();
  } catch (error) {
    // 半安装实例不能重复创建，否则会遗留多个浮层和事件监听。
    globalThis.__quickAiOverlayInitializationFailed = true;
    console.error("快捷AI初始化失败，请重新加载扩展并刷新网页。", error);
    return { ready: false };
  }
  globalThis.__selectionAiOverlayInstalled = true;
  globalThis.__quickAiOverlayProtocol = globalThis.quickAiProtocol.version;
  return { ready: true, protocol: globalThis.__quickAiOverlayProtocol };
})();
