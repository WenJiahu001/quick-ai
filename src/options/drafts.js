import { askBeforeLeaving } from "./dialogs.js";

export function createDraftController({ form, tabButtons, sectionCollectors, sectionSavers, activateTab, observedLists, onProvidersChanged }) {
  const savedSnapshots = new Map();
  const savingSections = new Set();
  let settingsLoaded = false;
  let switchingTab = false;
  function snapshot(section) {
    return JSON.stringify(sectionCollectors[section]?.());
  }

  function isDirty(section) {
    return settingsLoaded && savedSnapshots.has(section) && snapshot(section) !== savedSnapshots.get(section);
  }

  function updateDirtyState() {
    if (!settingsLoaded) return;
    for (const section of Object.keys(sectionSavers)) {
      const dirty = isDirty(section);
      document.querySelector(`#tab-${section}`).dataset.dirty = String(dirty);
      const footer = document.querySelector(`#panel-${section} .panel-footer`);
      let indicator = footer.querySelector(".dirty-indicator");
      if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = "dirty-indicator";
        indicator.setAttribute("role", "status");
        footer.insertBefore(indicator, footer.querySelector("button"));
      }
      indicator.textContent = dirty ? "未保存" : "";
    }
    onProvidersChanged();
  }

  // 按真实配置比较快照；列表展开、搜索以及 DOM 重绘不会被当作配置修改。
  form.addEventListener("input", updateDirtyState);
  form.addEventListener("change", updateDirtyState);
  const draftObserver = new MutationObserver(updateDirtyState);
  for (const element of observedLists) {
    draftObserver.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-favorite", "data-enabled"] });
  }
  window.addEventListener("beforeunload", (event) => {
    if (!Object.keys(sectionSavers).some(isDirty)) return;
    event.preventDefault();
    event.returnValue = "";
  });

  async function requestTab(tabId, focus = false) {
    if (switchingTab || savingSections.size || !settingsLoaded) return;
    const currentTab = tabButtons.find((tab) => tab.getAttribute("aria-selected") === "true");
    if (currentTab?.id === tabId) return;
    const section = currentTab?.id.replace("tab-", "");
    switchingTab = true;
    try {
      if (isDirty(section)) {
        const result = await askBeforeLeaving("当前配置尚未保存", "请选择保存当前区块，或保留页面中的修改后切换。", [
          ["cancel", "取消"], ["keep", "保留修改并切换"], ["save", "保存并切换"]
        ]);
        if (result !== "keep" && result !== "save") return;
        if (result === "save" && (!await sectionSavers[section]() || isDirty(section))) return;
      }
      activateTab(tabId, focus);
    } finally { switchingTab = false; }
  }

  return {
    snapshot, isDirty, update: updateDirtyState, requestTab,
    isSaving: (section) => savingSections.has(section),
    beginSave: (section) => savingSections.add(section),
    endSave: (section) => savingSections.delete(section),
    markSaved(section, value) { savedSnapshots.set(section, value); },
    initialize() {
      for (const section of Object.keys(sectionSavers)) savedSnapshots.set(section, snapshot(section));
      settingsLoaded = true;
      updateDirtyState();
    }
  };
}
