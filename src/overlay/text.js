(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  modules.summarize = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, 60);
})();
