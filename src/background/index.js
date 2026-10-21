import { MENU_ITEM_PREFIX, refreshContextMenus } from "./context-menus.js";
import { readSelectedText } from "./selection.js";
import { beginRequest, beginFollowupRequest, cancelRequest } from "./requests.js";
import { handleConnectionCheck } from "./connection-check.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

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
  void readSelectedText(tab.id, info.frameId, fallbackText).then((selectedText) => {
    // 判空时忽略纯空白选区，但传给模型和界面时保留原始换行与首尾空白。
    if (!selectedText.trim()) return;
    return beginRequest(tab.id, selectedText, promptId);
  });
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    const tabId = sender.tab?.id;
    const selectedText = String(message.selectedText ?? "");
    const promptId = String(message.promptId ?? "");
    if (tabId && selectedText.trim() && promptId) {
      void beginRequest(tabId, selectedText, promptId, String(message.retryOf || ""));
    }
    return;
  }

  if (message?.type === "FOLLOWUP_REQUEST") {
    const tabId = sender.tab?.id;
    const requestId = String(message.requestId ?? "");
    if (tabId && requestId && requestId.length <= 100) {
      void beginFollowupRequest(
        tabId,
        requestId,
        String(message.systemPrompt ?? ""),
        message.messages
      );
    }
    return;
  }

  if (message?.type === "CANCEL_REQUEST") {
    cancelRequest(sender.tab?.id, message);
    return;
  }

  if (message?.type === "OPEN_OPTIONS") {
    void extensionApi.runtime.openOptionsPage();
  }
});

