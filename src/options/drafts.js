import { askBeforeLeaving } from "./dialogs.js";

export function createDraftController({ form, tabButtons, sectionCollectors, sectionSavers, activateTab, onProvidersChanged }) {
  const savedSnapshots = new Map();
  const savingSections = new Set();
  const pendingSections = new Set();
  const indicators = new Map();
  let timer = 0;
  let settingsLoaded = false;
  let switchingTab = false;
  const sections = Object.keys(sectionSavers);
  for (const section of sections) {
    const footer = document.querySelector(`#panel-${section} .panel-footer`);
    const indicator = document.createElement("span");
    indicator.className = "dirty-indicator";
    indicator.setAttribute("role", "status");
    footer.insertBefore(indicator, footer.querySelector("button"));
    indicators.set(section, { text: indicator, tab: document.querySelector(`#tab-${section}`) });
  }
  function snapshot(section) { return JSON.stringify(sectionCollectors[section]?.()); }
  function isDirty(section) { return settingsLoaded && savedSnapshots.has(section) && snapshot(section) !== savedSnapshots.get(section); }
  function update(section) {
    if (!settingsLoaded) return;
    for (const name of section ? [section] : sections) {
      const nodes = indicators.get(name);
      if (!nodes) continue;
      const dirty = isDirty(name);
      nodes.tab.dataset.dirty = String(dirty);
      nodes.text.textContent = dirty ? "未保存" : "";
    }
  }
  const schedule = (event) => {
    if (!settingsLoaded || event.target.matches("input[type=search]")) return;
    const section = event.target.closest(".tab-panel")?.id.replace("panel-", "");
    if (!sectionCollectors[section]) return;
    if (section === "providers") onProvidersChanged();
    pendingSections.add(section);
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      for (const name of pendingSections) update(name);
      pendingSections.clear();
    }, 80);
  };
  // 编辑器显式报告结构变化；展开、搜索和摘要重绘不扫描全部配置。
  for (const event of ["input", "change", "settingschange"]) form.addEventListener(event, schedule);
  window.addEventListener("beforeunload", (event) => {
    if (!sections.some(isDirty)) return;
    event.preventDefault();
    event.returnValue = "";
  });
  async function requestTab(tabId, focus = false) {
    if (switchingTab || savingSections.size || !settingsLoaded) return;
    const current = tabButtons.find((tab) => tab.getAttribute("aria-selected") === "true");
    if (current?.id === tabId) return;
    const section = current?.id.replace("tab-", "");
    switchingTab = true;
    try {
      if (isDirty(section)) {
        const result = await askBeforeLeaving("当前配置尚未保存", "请选择保存当前区块，或保留页面中的修改后切换。", [["cancel", "取消"], ["keep", "保留修改并切换"], ["save", "保存并切换"]]);
        if (result !== "keep" && result !== "save") return;
        if (result === "save" && (!await sectionSavers[section]() || isDirty(section))) return;
      }
      activateTab(tabId, focus);
    } finally { switchingTab = false; }
  }
  return {
    snapshot, isDirty, update, requestTab,
    isSaving: (section) => savingSections.has(section),
    beginSave: (section) => savingSections.add(section),
    endSave: (section) => savingSections.delete(section),
    markSaved(section, value) { savedSnapshots.set(section, value); },
    initialize() {
      clearTimeout(timer); timer = 0; pendingSections.clear();
      for (const section of sections) savedSnapshots.set(section, snapshot(section));
      settingsLoaded = true;
      update();
    }
  };
}
