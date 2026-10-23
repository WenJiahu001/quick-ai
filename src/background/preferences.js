import "../../browser-api.js";

const api = globalThis.quickAiBrowserApi;
const keys = ["quickAiOverlayBounds", "quickAiOverlayAppearance", "quickAiOutsideClickDismiss"];
const subscribers = new Map();
const subscriberKey = "quickAiPreferenceSubscribers";
const subscribersReady = api.storage.session.get(subscriberKey).then((stored) => {
  for (const [tabId, documentId] of Object.entries(stored[subscriberKey] || {})) {
    if (typeof documentId === "string") subscribers.set(Number(tabId), documentId);
  }
});
let subscriberWrites = subscribersReady.catch(() => {});
function updateSubscribers(update) {
  subscriberWrites = subscriberWrites.then(async () => {
    if (update() === false) return;
    // 只保存文档路由，不含题目、对话或密钥；后台休眠后仍可同步外观。
    await api.storage.session.set({ [subscriberKey]: Object.fromEntries(subscribers) });
  }).catch(() => {});
  return subscriberWrites;
}
// 失败时禁止注入浮层；不能静默退回可读取密钥的访问级别。
export const storageReady = api.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void storageReady.catch(() => {});

export function forgetPreferenceSubscriber(tabId, documentId) {
  void updateSubscribers(() => {
    if (!documentId || subscribers.get(tabId) === documentId) return subscribers.delete(tabId);
    return false;
  });
}

export function handlePreferences(message, sender, sendResponse) {
  if (!sender.tab || sender.frameId !== 0 || !sender.documentId) return;
  const tabId = sender.tab.id;
  const documentId = sender.documentId;
  void storageReady.then(async () => {
    if (message.type === "GET_OVERLAY_PREFERENCES") {
      await updateSubscribers(() => {
        if (subscribers.get(tabId) === documentId) return false;
        subscribers.set(tabId, documentId);
        return true;
      });
      return { ok: true, values: await api.storage.local.get(keys) };
    }
    const values = validatePreferences(message.values);
    await api.storage.local.set(values);
    return { ok: true };
  }).then(sendResponse, () => sendResponse({ ok: false, message: "无法读写浮层设置，请重新加载扩展。" }));
  return true;
}

function validatePreferences(value) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new Error("不允许访问此设置。");
  }
  const result = {};
  if ("quickAiOutsideClickDismiss" in value) result.quickAiOutsideClickDismiss = value.quickAiOutsideClickDismiss === true;
  if ("quickAiOverlayAppearance" in value) {
    const appearance = value.quickAiOverlayAppearance;
    if (!appearance || !Number.isFinite(appearance.fontSize) || !["paper", "warm", "dark", "mint", "slate"].includes(appearance.theme)) throw new Error("外观无效。");
    result.quickAiOverlayAppearance = { fontSize: Math.min(24, Math.max(12, Math.round(appearance.fontSize))), theme: appearance.theme };
  }
  if ("quickAiOverlayBounds" in value) {
    const bounds = value.quickAiOverlayBounds;
    if (!bounds || ![bounds.width, bounds.height, bounds.left, bounds.top].every((number) => Number.isFinite(number) && Math.abs(number) <= 100_000)) throw new Error("窗口边界无效。");
    result.quickAiOverlayBounds = { version: 2, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), left: bounds.left, top: bounds.top };
  }
  return result;
}

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // 窗口尺寸由各浮层自行恢复，不需要每次拖动都向所有页面广播。
  const values = Object.fromEntries(keys.filter((key) => key !== "quickAiOverlayBounds" && key in changes).map((key) => [key, changes[key].newValue ?? null]));
  if (!Object.keys(values).length) return;
  void subscriberWrites.then(() => {
    for (const [tabId, documentId] of subscribers) {
      void api.tabs.sendMessage(tabId, { type: "OVERLAY_PREFERENCES_CHANGED", values }, { documentId }).catch(() => forgetPreferenceSubscriber(tabId, documentId));
    }
  });
});
