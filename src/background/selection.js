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
          typeof activeElement.value === "string"
        ) {
          return activeElement.value.slice(activeElement.selectionStart, activeElement.selectionEnd);
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return "";

        const range = selection.getRangeAt(0);
        const blockTags = new Set([
          "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "CAPTION", "DD", "DETAILS", "DIALOG",
          "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
          "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "MENU",
          "NAV", "OL", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "TBODY", "TD", "TFOOT",
          "TH", "THEAD", "TR", "UL"
        ]);
        let text = "";
        let pendingBlockBreak = false;

        const appendText = (value) => {
          if (!value) return;
          if (pendingBlockBreak && text && !text.endsWith("\n")) text += "\n";
          pendingBlockBreak = false;
          text += value;
        };
        const visit = (node) => {
          if (!range.intersectsNode(node)) return;
          if (node.nodeType === 3) {
            const value = node.nodeValue ?? "";
            const start = node === range.startContainer ? range.startOffset : 0;
            const end = node === range.endContainer ? range.endOffset : value.length;
            const selected = value.slice(start, end);
            const whiteSpace = getComputedStyle(node.parentElement).whiteSpace;
            appendText(/^(pre|break-spaces)/.test(whiteSpace)
              ? selected
              : selected.replace(/[\t\r\n ]+/g, " "));
            return;
          }
          if (node.nodeType !== 1 && node.nodeType !== 11) return;

          const element = node.nodeType === 1 ? node : null;
          if (element) {
            if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(element.tagName)) return;
            const computed = getComputedStyle(element);
            if (computed.display === "none" || computed.visibility === "hidden" || computed.contentVisibility === "hidden") return;
          }
          if (element?.tagName === "BR") {
            if (pendingBlockBreak && text && !text.endsWith("\n")) text += "\n";
            pendingBlockBreak = false;
            text += "\n";
            return;
          }

          const isBlock = element && blockTags.has(element.tagName);
          if (isBlock) pendingBlockBreak = true;
          for (const child of node.childNodes) visit(child);
          if (isBlock) pendingBlockBreak = true;
        };
        // 在原始选区内遍历，才能判断真实可见性；文本节点只读取选中的偏移范围。
        visit(range.commonAncestorContainer);
        return text;
      }
    });
    const selectedText = String(results?.[0]?.result ?? "");
    return selectedText.trim() ? selectedText : fallbackText;
  } catch {
    // 受限页面无法注入时，回退到浏览器提供的选中文字。
    return fallbackText;
  }
}

