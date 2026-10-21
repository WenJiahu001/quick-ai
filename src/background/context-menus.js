import { normalizePrompts } from "../../config.js";
import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

const MENU_ID = "quick-ai-root";
export const MENU_ITEM_PREFIX = "quick-ai-prompt-";
let menuRefreshQueue = Promise.resolve();
let menuRefreshPending = false;
let menuRefreshInProgress = false;

export function refreshContextMenus() {
  menuRefreshPending = true;
  if (menuRefreshInProgress) return menuRefreshQueue;

  menuRefreshInProgress = true;
  menuRefreshQueue = menuRefreshQueue.then(async () => {
    let succeeded = true;
    try {
      // 合并构建期间到达的存储事件与显式刷新请求，避免旧菜单在新菜单之后落地。
      while (menuRefreshPending) {
        menuRefreshPending = false;
        succeeded = await buildContextMenus();
      }
    } finally {
      menuRefreshInProgress = false;
      if (menuRefreshPending) void refreshContextMenus();
    }
    return succeeded;
  });
  return menuRefreshQueue;
}

async function buildContextMenus() {
  try {
    const stored = await extensionApi.storage.local.get(["prompts", "prompt"]);
    const prompts = normalizePrompts(stored.prompts, stored.prompt).filter((prompt) => prompt.enabled);
    await extensionApi.contextMenus.removeAll();
    if (!prompts.length) return true;
    const orderedPrompts = [
      ...prompts.filter((prompt) => prompt.favorite),
      ...prompts.filter((prompt) => !prompt.favorite)
    ];
    await createContextMenu({
      id: MENU_ID,
      title: "快捷AI",
      contexts: ["selection"]
    });
    for (const prompt of orderedPrompts) {
      await createContextMenu({
        id: `${MENU_ITEM_PREFIX}${prompt.id}`,
        parentId: MENU_ID,
        title: prompt.favorite ? `常用 · ${prompt.name}` : prompt.name,
        contexts: ["selection"]
      });
    }
    return true;
  } catch {
    // 菜单会在下次扩展启动或设置变更时重新构建。
    return false;
  }
}

function createContextMenu(properties) {
  // Chromium 的 callback API 可确认菜单创建已完成后再处理下一次刷新。
  return new Promise((resolve, reject) => {
    extensionApi.contextMenus.create(properties, () => {
      const error = extensionApi.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

