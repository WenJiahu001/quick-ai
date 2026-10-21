(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createSafeStreamingRenderer) return;
  modules.createSafeStreamingRenderer = function(root, parserApi) {
    const renderer = parserApi.default_renderer(root);
    return {
      data: renderer.data,
      add_token(data, type) {
        renderer.add_token(data, type);
        const node = data.nodes[data.index];
        if (!node) return;

        if (type === parserApi.IMAGE) {
          // 不加载模型生成的远程图片；保留 alt 文本，避免额外网络请求。
          const placeholder = document.createElement("span");
          placeholder.className = "markdown-image-alt";
          node.replaceWith(placeholder);
          data.nodes[data.index] = placeholder;
        } else if (type === parserApi.EQUATION_BLOCK || type === parserApi.EQUATION_INLINE) {
          const equation = document.createElement(type === parserApi.EQUATION_BLOCK ? "pre" : "code");
          equation.className = type === parserApi.EQUATION_BLOCK ? "math-block" : "math-inline";
          node.replaceWith(equation);
          data.nodes[data.index] = equation;
        } else if (type === parserApi.LINK || type === parserApi.RAW_URL) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        } else if (type === parserApi.CHECKBOX) {
          node.disabled = true;
        }
      },
      end_token: renderer.end_token,
      add_text: renderer.add_text,
      set_attr(data, type, value) {
        const node = data.nodes[data.index];
        if (!node) return;
        if (type === parserApi.HREF) {
          const href = safeMarkdownHref(value);
          if (href) node.setAttribute("href", href);
          return;
        }
        if (type === parserApi.SRC) return;
        if (type === parserApi.LANG) {
          const language = String(value).trim();
          if (/^[a-z0-9_+-]{1,32}$/i.test(language)) node.className = `language-${language}`;
          return;
        }
        if (type === parserApi.CHECKED && node instanceof HTMLInputElement) {
          node.checked = value === "" || value === "true" || value === "checked";
          return;
        }
        if (type === parserApi.START) {
          const start = Number.parseInt(value, 10);
          if (Number.isSafeInteger(start) && start > 0 && start <= 100_000) node.setAttribute("start", String(start));
        }
      }
    };
  };

  function safeMarkdownHref(value) {
    try {
      const url = new URL(value, location.href);
      return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }
})();
