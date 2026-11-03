import { MENU_ITEM_PREFIX, refreshContextMenus } from "./context-menus.js";
import { readSelectedText } from "./selection.js";
import { beginRequest, beginFollowupRequest, cancelRequest, cancelTabRequests, getRequestStatus } from "./requests.js";
import { handleConnectionCheck } from "./connection-check.js";
import { handlePreferences, forgetPreferenceSubscriber } from "./preferences.js";
import { handleSettings } from "./settings.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;
const selectionOperations = new Map();
const forgetTab = (tabId) => {
  selectionOperations.delete(tabId);
  cancelTabRequests(tabId);
  forgetPreferenceSubscriber(tabId);
};
extensionApi.tabs.onRemoved.addListener(forgetTab);
extensionApi.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading") forgetTab(tabId);
});

extensionApi.runtime.onInstalled.addListener(() => {
  void refreshContextMenus();
});

extensionApi.runtime.onStartup.addListener(() => void refreshContextMenus());

extensionApi.action.onClicked.addListener(() => {
  void Promise.resolve().then(() => extensionApi.runtime.openOptionsPage()).catch(() => {});
});

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.prompts || changes.prompt)) {
    void refreshContextMenus();
  }
});

extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof info.menuItemId !== "string" || !info.menuItemId.startsWith(MENU_ITEM_PREFIX) || !tab?.id) return;

  const promptId = info.menuItemId.slice(MENU_ITEM_PREFIX.length);
  const fallbackText = String(info.selectionText ?? "");
  const operation = Symbol();
  selectionOperations.set(tab.id, operation);
  void readSelectedText(tab.id, info.frameId, fallbackText).then((selection) => {
    // 判空时忽略纯空白选区，但传给模型和界面时保留原始换行与首尾空白。
    if (!selection.text.trim() || selectionOperations.get(tab.id) !== operation) return;
    return beginRequest(tab.id, selection.text, promptId, "", undefined, selection.textIndent);
  });
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "READ_SETTINGS" || message?.type === "SAVE_SETTINGS_SECTION") return handleSettings(message, sender, sendResponse);
  if (message?.type === "GET_OVERLAY_PREFERENCES" || message?.type === "SET_OVERLAY_PREFERENCES") {
    return handlePreferences(message, sender, sendResponse);
  }
  if (message?.type === "REQUEST_STATUS") {
    if (sender.tab && sender.frameId === 0) sendResponse(getRequestStatus(sender.tab.id, message.requestId, sender.documentId));
    return;
  }
  if (message?.type === "CHECK_CONNECTION" || message?.type === "CANCEL_CONNECTION_CHECK") {
    return handleConnectionCheck(message, sender, sendResponse);
  }
  if (message?.type === "REFRESH_CONTEXT_MENUS") {
    void refreshContextMenus().then(
      (ok) => sendResponse({ ok }),
      () => sendResponse({ ok: false })
    );
    return true;
  }

  if (message?.type === "RETRY_REQUEST") {
    if (sender.frameId !== 0 || !sender.documentId) return;
    const tabId = sender.tab?.id;
    const selectedText = String(message.selectedText ?? "");
    const promptId = String(message.promptId ?? "");
    if (tabId && selectedText.trim() && promptId) {
      void beginRequest(tabId, selectedText, promptId, String(message.retryOf || ""), sender.documentId, Number(message.selectedIndent) || 0);
      sendResponse({ accepted: true });
    }
    return;
  }

  if (message?.type === "FOLLOWUP_REQUEST") {
    if (sender.frameId !== 0 || !sender.documentId) return;
    const tabId = sender.tab?.id;
    const requestId = String(message.requestId ?? "");
    if (tabId && requestId && requestId.length <= 100) {
      void beginFollowupRequest(
        tabId,
        requestId,
        String(message.systemPrompt ?? ""),
        message.messages,
        sender.documentId
      );
      sendResponse({ accepted: true });
    }
    return;
  }

  if (message?.type === "CANCEL_REQUEST") {
    cancelRequest(sender.tab?.id, message, sender.documentId);
    return;
  }

  if (message?.type === "OPEN_OPTIONS") {
    void extensionApi.runtime.openOptionsPage();
  }
});

