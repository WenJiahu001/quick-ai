(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createAppearanceController) return;
  modules.createAppearanceController = ({
    extensionApi, card, editConfirmationDialog, fontSizeSlider,
    fontSizeValue, styleButtons, outsideDismissCheckbox, displaySettingsButton,
    displaySettings
  }) => {
    const appearanceStorageKey = "quickAiOverlayAppearance";
    const outsideClickDismissStorageKey = "quickAiOutsideClickDismiss";
    const appearanceDefaults = { fontSize: 16, theme: "paper" };
    let appearance = { ...appearanceDefaults };
    let appearanceTouchedBeforeLoad = false;
    let appearanceSaveTimer = 0;
    let dismissOnOutsideClick = false;
    let outsideClickDismissTouchedBeforeLoad = false;

    const normalizeAppearance = (value) => {
      const fontSize = Number(value?.fontSize);
      return {
        fontSize: Number.isFinite(fontSize) ? Math.min(24, Math.max(12, Math.round(fontSize))) : appearanceDefaults.fontSize,
        theme: styleButtons.has(value?.theme) ? value.theme : appearanceDefaults.theme
      };
    };

    const applyAppearance = () => {
      card.dataset.theme = appearance.theme;
      // 确认框是 card 的兄弟节点，显式同步其需要的主题变量。
      const colors = getComputedStyle(card);
      for (const name of ["--card-bg", "--card-text", "--muted-text", "--control-bg", "--control-border", "--accent"]) {
        editConfirmationDialog.style.setProperty(name, colors.getPropertyValue(name));
      }
      card.style.setProperty("--answer-font-size", `${appearance.fontSize}px`);
      fontSizeSlider.value = String(appearance.fontSize);
      fontSizeValue.textContent = `${appearance.fontSize}px`;
      for (const [theme, button] of styleButtons) {
        button.setAttribute("aria-pressed", String(theme === appearance.theme));
      }
    };

    const saveAppearance = () => {
      clearTimeout(appearanceSaveTimer);
      const value = { ...appearance };
      appearanceSaveTimer = window.setTimeout(() => {
        extensionApi.storage.local.set({ [appearanceStorageKey]: value }).catch(() => {});
      }, 180);
    };

    applyAppearance();
    extensionApi.storage.local.get([appearanceStorageKey, outsideClickDismissStorageKey]).then((stored) => {
      if (!appearanceTouchedBeforeLoad) {
        appearance = normalizeAppearance(stored?.[appearanceStorageKey]);
        applyAppearance();
      }
      if (!outsideClickDismissTouchedBeforeLoad) {
        dismissOnOutsideClick = stored?.[outsideClickDismissStorageKey] === true;
        outsideDismissCheckbox.checked = dismissOnOutsideClick;
      }
    }).catch(() => {});
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[appearanceStorageKey]) {
        appearance = normalizeAppearance(changes[appearanceStorageKey].newValue);
        applyAppearance();
      }
      if (changes[outsideClickDismissStorageKey]) {
        dismissOnOutsideClick = changes[outsideClickDismissStorageKey].newValue === true;
        outsideDismissCheckbox.checked = dismissOnOutsideClick;
      }
    });

    fontSizeSlider.addEventListener("input", () => {
      appearanceTouchedBeforeLoad = true;
      appearance.fontSize = Number(fontSizeSlider.value);
      applyAppearance();
      saveAppearance();
    });
    for (const [theme, button] of styleButtons) {
      button.addEventListener("click", () => {
        appearanceTouchedBeforeLoad = true;
        appearance.theme = theme;
        applyAppearance();
        saveAppearance();
      });
    }
    displaySettingsButton.addEventListener("click", () => {
      displaySettings.hidden = !displaySettings.hidden;
      displaySettingsButton.setAttribute("aria-expanded", String(!displaySettings.hidden));
      displaySettingsButton.setAttribute("aria-label", displaySettings.hidden ? "显示样式设置" : "隐藏样式设置");
    });
    outsideDismissCheckbox.addEventListener("change", () => {
      outsideClickDismissTouchedBeforeLoad = true;
      dismissOnOutsideClick = outsideDismissCheckbox.checked;
      extensionApi.storage.local.set({ [outsideClickDismissStorageKey]: dismissOnOutsideClick }).catch(() => {});
    });

    return { shouldDismissOutside: () => dismissOnOutsideClick };
  };
})();
