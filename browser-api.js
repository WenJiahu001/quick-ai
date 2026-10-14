// Chromium 与 Firefox 在部分版本中分别提供 browser 或 chrome 命名空间。
(() => {
  if (globalThis.quickAiBrowserApi) return;

  const api = globalThis.browser ?? globalThis.chrome;
  if (!api) throw new Error("当前环境未提供浏览器扩展 API。");

  Object.defineProperty(globalThis, "quickAiBrowserApi", {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
