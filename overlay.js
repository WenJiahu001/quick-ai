// 由后台按 runtime-files.js 的顺序注入；重复打开不会重复安装事件监听。
(() => {
  if (globalThis.__selectionAiOverlayInstalled) return;
  globalThis.__quickAiOverlayModules.createOverlay();
  globalThis.__selectionAiOverlayInstalled = true;
})();
