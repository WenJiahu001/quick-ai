import "../../browser-api.js";

const extensionApi = globalThis.quickAiBrowserApi;

export async function readSelectedText(tabId, frameId, fallbackText) {
  try {
    const target = Number.isInteger(frameId) && frameId >= 0
      ? { tabId, frameIds: [frameId] }
      : { tabId };
    const results = await extensionApi.scripting.executeScript({
      target,
      // 只读取活动选区，弥补右键菜单文本丢失视觉换行的问题。
      func: () => {
        const activeElement = document.activeElement;
        if (
          activeElement &&
          typeof activeElement.selectionStart === "number" &&
          typeof activeElement.selectionEnd === "number" &&
          typeof activeElement.value === "string" &&
          activeElement.selectionStart !== activeElement.selectionEnd
        ) {
          return {
            text: activeElement.value.slice(activeElement.selectionStart, activeElement.selectionEnd),
            textIndent: getTextIndent(activeElement)
          };
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return { text: "", textIndent: 0 };

        // 浏览器按真实 CSS 布局提取选区，保留段落、BR 和预格式化空白。
        // 排版缩进单独传给显示层，不会拼入发送给 AI 的原文。
        const range = selection.getRangeAt(0);
        const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
        return { text: selection.toString(), textIndent: getTextIndent(startElement) };

        function getTextIndent(element) {
          let current = element;
          while (current && current !== document.documentElement) {
            const indent = Number.parseFloat(getComputedStyle(current).textIndent);
            if (Number.isFinite(indent) && indent !== 0) return Math.min(500, Math.max(-500, indent));
            current = current.parentElement;
          }
          return 0;
        }
      }
    });
    const result = results?.[0]?.result;
    const selectedText = String(result?.text ?? "");
    return selectedText.trim()
      ? { text: selectedText, textIndent: Number.isFinite(result?.textIndent) ? result.textIndent : 0 }
      : { text: fallbackText, textIndent: 0 };
  } catch {
    // 受限页面无法注入时，回退到浏览器提供的选中文字。
    return { text: fallbackText, textIndent: 0 };
  }
}

