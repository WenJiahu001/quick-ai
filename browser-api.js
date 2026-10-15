// Chromium 浏览器提供 chrome 扩展 API 命名空间。
(() => {
  if (globalThis.quickAiBrowserApi) return;

  const api = globalThis.chrome;
  if (!api) throw new Error("当前 Chromium 环境未提供扩展 API。");

  Object.defineProperty(globalThis, "quickAiBrowserApi", {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
