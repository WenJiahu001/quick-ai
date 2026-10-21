import { updateListControls, toggleCards } from "./list-controls.js";

export function createCleanupEditor({ cleanupRulesList, cleanupRuleCount, cleanupRuleSearchInput, addCleanupRuleButton, toggleCleanupRulesButton }) {
  addCleanupRuleButton.addEventListener("click", () => {
    const rules = collectCleanupRules();
    const rule = { id: crypto.randomUUID(), find: "", replacement: "" };
    rules.push(rule);
    cleanupRuleSearchInput.value = "";
    renderCleanupRules(rules, rule.id);
    cleanupRulesList.lastElementChild?.querySelector("[data-cleanup-find]")?.focus();
  });
  toggleCleanupRulesButton.addEventListener("click", () => toggleCards(cleanupRulesList, updateCleanupRuleListControls));
  cleanupRuleSearchInput.addEventListener("input", () => updateCleanupRuleListControls(true));

  cleanupRulesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-cleanup-rule]");
    if (!button) return;
    renderCleanupRules(collectCleanupRules().filter((rule) => rule.id !== button.dataset.removeCleanupRule));
  });
  cleanupRulesList.addEventListener("change", (event) => {
    const select = event.target.closest("[data-cleanup-replacement-mode]");
    const card = event.target.closest(".cleanup-rule-card");
    if (select) card.querySelector(".cleanup-custom-field").hidden = select.value !== "custom";
    if (card) updateCleanupRuleSummary(card);
  });
  cleanupRulesList.addEventListener("input", (event) => {
    const card = event.target.closest(".cleanup-rule-card");
    if (card) updateCleanupRuleSummary(card);
  });

  function renderCleanupRules(rules, openId = "") {
    const previouslyOpen = new Set([...cleanupRulesList.querySelectorAll(".cleanup-rule-card[open]")].map((card) => card.dataset.cleanupRuleId));
    cleanupRulesList.replaceChildren();

    if (!rules.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "list-empty";
      emptyState.textContent = "还没有清理规则。添加规则后，可以移除题目中的版权说明、网站介绍等固定文字。";
      cleanupRulesList.append(emptyState);
    }

    for (const [index, rule] of rules.entries()) {
      const card = document.createElement("details");
      card.className = "prompt-card cleanup-rule-card";
      card.dataset.cleanupRuleId = rule.id || crypto.randomUUID();
      card.open = card.dataset.cleanupRuleId === openId || previouslyOpen.has(card.dataset.cleanupRuleId);

      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.className = "prompt-card-title";
      title.textContent = `规则 ${index + 1}`;
      const findPreview = document.createElement("span");
      findPreview.className = "cleanup-match-preview";
      findPreview.dataset.cleanupSummaryFind = "true";
      const replacementPreview = document.createElement("span");
      replacementPreview.className = "cleanup-replacement-preview";
      replacementPreview.dataset.cleanupSummaryReplacement = "true";
      summary.append(title, findPreview, replacementPreview);

      const findLabel = document.createElement("label");
      findLabel.className = "field";
      const findText = document.createElement("span");
      findText.textContent = "要查找的文字";
      const findInput = document.createElement("input");
      findInput.type = "text";
      findInput.dataset.cleanupFind = "true";
      findInput.value = rule.find;
      findLabel.append(findText, findInput);

      const replacementLabel = document.createElement("label");
      replacementLabel.className = "field";
      const replacementText = document.createElement("span");
      replacementText.textContent = "替换为";
      const replacementSelect = document.createElement("select");
      replacementSelect.dataset.cleanupReplacementMode = "true";
      const replacement = String(rule.replacement ?? "");
      const mode = replacement === "" ? "delete" : replacement === " " ? "space" : replacement === "\n" ? "newline" : "custom";
      for (const [value, label] of [["delete", "删除"], ["space", "空格"], ["newline", "换行"], ["custom", "自定义"]]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        replacementSelect.append(option);
      }
      replacementSelect.value = mode;
      replacementLabel.append(replacementText, replacementSelect);

      const customLabel = document.createElement("label");
      customLabel.className = "field cleanup-custom-field";
      customLabel.hidden = mode !== "custom";
      const customText = document.createElement("span");
      customText.textContent = "自定义替换内容";
      const customInput = document.createElement("textarea");
      customInput.rows = 2;
      customInput.dataset.cleanupReplacementCustom = "true";
      customInput.value = mode === "custom" ? replacement : "";
      customLabel.append(customText, customInput);

      const editor = document.createElement("div");
      editor.className = "prompt-editor";
      editor.append(findLabel, replacementLabel, customLabel);
      const editorActions = document.createElement("div");
      editorActions.className = "prompt-editor-actions";
      const remove = document.createElement("button");
      remove.className = "remove-button";
      remove.type = "button";
      remove.textContent = "删除规则";
      remove.dataset.removeCleanupRule = card.dataset.cleanupRuleId;
      editorActions.append(remove);
      editor.append(editorActions);

      card.append(summary, editor);
      card.addEventListener("toggle", () => updateCleanupRuleListControls());
      cleanupRulesList.append(card);
      updateCleanupRuleSummary(card);
    }
    updateCleanupRuleListControls(true);
  }

  function updateCleanupRuleSummary(card) {
    const find = card.querySelector("[data-cleanup-find]").value.trim().replace(/\s+/g, " ");
    const mode = card.querySelector("[data-cleanup-replacement-mode]").value;
    const replacement = mode === "delete"
      ? "删除匹配内容"
      : mode === "space"
        ? "替换为空格"
        : mode === "newline"
          ? "替换为换行"
          : `替换为：${card.querySelector("[data-cleanup-replacement-custom]").value.trim().replace(/\s+/g, " ") || "自定义内容未填写"}`;
    card.querySelector("[data-cleanup-summary-find]").textContent = find ? `查找：${find}` : "尚未填写匹配文字";
    card.querySelector("[data-cleanup-summary-replacement]").textContent = replacement;
  }

  function updateCleanupRuleListControls(filter = false) {
    updateListControls(cleanupRulesList, cleanupRuleCount, toggleCleanupRulesButton, cleanupRuleSearchInput, "条", filter);
  }

  function collectCleanupRules() {
    return [...cleanupRulesList.querySelectorAll(".cleanup-rule-card")].map((card) => {
      const mode = card.querySelector("[data-cleanup-replacement-mode]").value;
      const replacement = mode === "space"
        ? " "
        : mode === "newline"
          ? "\n"
          : mode === "custom"
            ? card.querySelector("[data-cleanup-replacement-custom]").value
            : "";
      return {
        id: card.dataset.cleanupRuleId,
        find: card.querySelector("[data-cleanup-find]").value,
        replacement
      };
    });
  }

  function focusCleanupRule(ruleId) {
    cleanupRuleSearchInput.value = "";
    updateCleanupRuleListControls(true);
    const card = [...cleanupRulesList.querySelectorAll(".cleanup-rule-card")].find((item) => item.dataset.cleanupRuleId === ruleId);
    if (!card) return;
    card.open = true;
    card.querySelector("[data-cleanup-find]").focus();
  }

  return { renderCleanupRules, collectCleanupRules, focusCleanupRule };
}
