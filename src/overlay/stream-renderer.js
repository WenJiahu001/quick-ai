(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  // 每轮独享渲染队列；完成回调只在队列排空后触发，reset 取消旧任务且不触发回调。
  if (modules.createStreamRenderer) return;
  modules.createStreamRenderer = ({ getBody, status, spinner, copyButton, onScroll, onComplete, onLimit }) => {
    const createSafeStreamingRenderer = modules.createSafeStreamingRenderer;
    let fullText = "";
    let fullTextParts = [];
    let streamRenderTimer = 0;
    let streamParser = null;
    let streamRenderedContent = null;
    let streamPlainTextNode = null;
    let streamParserUnavailable = false;
    let streamFinalized = false;
    let pendingStreamChunks = [];
    let pendingStreamChunkIndex = 0;
    let pendingStreamChunkOffset = 0;
    let pendingStreamCharacters = 0;
    let receivedStreamCharacters = 0;
    let responseTruncated = false;
    let streamDoneReceived = false;
    let streamFailureMessage = "";
    const STREAM_RENDER_INTERVAL_MS = 100;
    const MAX_STREAM_CHARS_PER_TICK = 2_048;
    const MAX_RESPONSE_CHARS = 250_000;
    const resetStreamState = () => {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
      fullText = "";
      fullTextParts = [];
      streamParser = null;
      streamRenderedContent = null;
      streamPlainTextNode = null;
      streamParserUnavailable = false;
      streamFinalized = false;
      pendingStreamChunks = [];
      pendingStreamChunkIndex = 0;
      pendingStreamChunkOffset = 0;
      pendingStreamCharacters = 0;
      receivedStreamCharacters = 0;
      responseTruncated = false;
      streamDoneReceived = false;
      streamFailureMessage = "";
    };

    const appendPlainStreamingText = (value) => {
      if (!value) return;
      if (!streamPlainTextNode) {
        const container = document.createElement("div");
        container.className = "plain-text";
        streamPlainTextNode = document.createTextNode("");
        container.append(streamPlainTextNode);
        (streamRenderedContent || getBody()).append(container);
      }
      streamPlainTextNode.appendData(value);
    };

    const switchToPlainText = (message) => {
      streamParserUnavailable = true;
      streamParser = null;
      streamRenderedContent = null;
      streamPlainTextNode = null;
      getBody().replaceChildren();
      getBody().classList.add("streaming");
      const container = document.createElement("div");
      container.className = "plain-text";
      streamPlainTextNode = document.createTextNode("");
      container.append(streamPlainTextNode);
      getBody().append(container);
      // 回退也分批追加，避免解析器异常时同步重建整篇长回复。
      pendingStreamChunks = fullTextParts.slice();
      pendingStreamChunkIndex = 0;
      pendingStreamChunkOffset = 0;
      pendingStreamCharacters = receivedStreamCharacters;
      if (message) status.textContent = message;
    };

    const ensureStreamingParser = () => {
      if (streamParser || streamParserUnavailable) return Boolean(streamParser);
      const parserApi = globalThis.__quickAiStreamingMarkdown;
      if (!parserApi) {
        switchToPlainText("Markdown 解析器无法加载，当前回复以纯文本显示。");
        return false;
      }

      getBody().replaceChildren();
      getBody().classList.add("streaming");
      streamRenderedContent = document.createElement("div");
      getBody().append(streamRenderedContent);
      try {
        streamParser = parserApi.parser(createSafeStreamingRenderer(streamRenderedContent, parserApi));
        return true;
      } catch {
        switchToPlainText("Markdown 解析器启动失败，当前回复以纯文本显示。");
        return false;
      }
    };

    const scheduleStreamingUpdate = () => {
      if (streamRenderTimer || streamFinalized) return;
      streamRenderTimer = window.setTimeout(() => {
        streamRenderTimer = 0;
        flushPendingStreamText();
      }, STREAM_RENDER_INTERVAL_MS);
    };

    const takePendingStreamText = (budget) => {
      const flushedParts = [];
      while (budget > 0 && pendingStreamChunkIndex < pendingStreamChunks.length) {
        const chunk = pendingStreamChunks[pendingStreamChunkIndex];
        let end = Math.min(chunk.length, pendingStreamChunkOffset + budget);
        if (end < chunk.length && end > pendingStreamChunkOffset) {
          const previous = chunk.charCodeAt(end - 1);
          const next = chunk.charCodeAt(end);
          if (previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--;
        }
        if (end === pendingStreamChunkOffset) end = Math.min(chunk.length, end + 2);
        const part = chunk.slice(pendingStreamChunkOffset, end);
        flushedParts.push(part);
        const count = part.length;
        pendingStreamChunkOffset = end;
        pendingStreamCharacters -= count;
        budget -= count;
        if (pendingStreamChunkOffset >= chunk.length) {
          pendingStreamChunkIndex++;
          pendingStreamChunkOffset = 0;
        }
      }

      if (pendingStreamChunkIndex > 128) {
        pendingStreamChunks = pendingStreamChunks.slice(pendingStreamChunkIndex);
        pendingStreamChunkIndex = 0;
      }
      return flushedParts.join("");
    };

    const flushPendingStreamText = () => {
      if (pendingStreamCharacters > 0) {
        const text = takePendingStreamText(MAX_STREAM_CHARS_PER_TICK);
        if (text) {
          const parserWasUnavailable = streamParserUnavailable;
          if (ensureStreamingParser()) {
            try {
              globalThis.__quickAiStreamingMarkdown.parser_write(streamParser, text);
            } catch {
              switchToPlainText("Markdown 解析遇到异常，后续内容以纯文本显示。");
            }
          } else if (parserWasUnavailable) {
            appendPlainStreamingText(text);
          }
          onScroll();
        }
      }

      if (pendingStreamCharacters > 0) {
        scheduleStreamingUpdate();
      } else if (streamDoneReceived) {
        startFinalMarkdownRender();
      }
    };

    const queueStreamText = (value) => {
      if (!value || responseTruncated || streamFinalized || streamFailureMessage) return;
      const remaining = MAX_RESPONSE_CHARS - receivedStreamCharacters;
      const accepted = value.slice(0, Math.max(0, remaining));
      if (accepted) {
        pendingStreamChunks.push(accepted);
        fullTextParts.push(accepted);
        pendingStreamCharacters += accepted.length;
        receivedStreamCharacters += accepted.length;
      }
      if (accepted.length < value.length) {
        responseTruncated = true;
        streamDoneReceived = true;
        status.textContent = "回复超过安全长度上限，正在整理已接收的内容…";
        onLimit();
      }
      scheduleStreamingUpdate();
    };

    const startFinalMarkdownRender = () => {
      if (!streamDoneReceived || pendingStreamCharacters > 0 || streamFinalized) return;
      streamFinalized = true;
      clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
      fullText = fullTextParts.join("");
      spinner.hidden = true;
      copyButton.hidden = !fullText;

      if (ensureStreamingParser()) {
        try {
          globalThis.__quickAiStreamingMarkdown.parser_end(streamParser);
        } catch {
          streamFinalized = false;
          switchToPlainText("Markdown 收尾遇到异常，正在以纯文本整理回复。");
          scheduleStreamingUpdate();
          return;
        }
      }
      onScroll();
      streamParser = null;
      getBody().classList.remove("streaming");
      onComplete();
    };
    return {
      reset: resetStreamState,
      append: queueStreamText,
      finish(error = "") {
        if (streamFinalized) return;
        // 失败不可被迟到的完成消息覆盖；只有新一轮 reset 才清除错误。
        if (error) streamFailureMessage = error;
        streamDoneReceived = true;
        if (pendingStreamCharacters > 0) scheduleStreamingUpdate();
        else startFinalMarkdownRender();
      },
      get text() { return fullText; },
      get receivedCharacters() { return receivedStreamCharacters; },
      get truncated() { return responseTruncated; },
      get finalized() { return streamFinalized; },
      get failureMessage() { return streamFailureMessage; }
    };
  };
})();
