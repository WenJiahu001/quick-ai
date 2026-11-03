(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createDiagnostics) return;
  modules.createDiagnostics = ({ container, getRoot, isVisible }) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    label.append(checkbox, " 本页性能诊断（仅记录计数与耗时）");
    label.className = "diagnostics-toggle";
    const output = document.createElement("pre");
    output.className = "diagnostics-output";
    output.hidden = true;
    container.append(label, output);
    let observer = null;
    let timer = 0;
    let pageActive = true;
    let start = performance.now();
    let phase = "idle";
    let phases = {};
    let pending = 0;
    let maxBatch = 0;
    let longTasks = 0;
    let renderedNodes = 0;
    let treeWalker = null;
    let count = 0;
    const phaseNames = { idle: "空闲", connecting: "连接中", waiting: "等待首字", streaming: "生成中", draining: "整理显示", "draining-error": "错误收尾", stopping: "停止收尾", complete: "完成", stopped: "已停止", failed: "失败" };
    const stop = () => {
      clearInterval(timer);
      timer = 0;
      observer?.disconnect();
      observer = null;
      // 不保留指向已关闭或已替换回复的遍历游标。
      treeWalker = null;
      count = 0;
    };
    const refresh = () => {
      // 节点计数分片进行，诊断自身也遵循时间预算。
      treeWalker ||= document.createTreeWalker(getRoot(), NodeFilter.SHOW_ALL);
      const deadline = performance.now() + 2;
      let finished = false;
      while (performance.now() < deadline) {
        if (!treeWalker.nextNode()) { finished = true; break; }
        count++;
      }
      if (finished) { renderedNodes = count; count = 0; treeWalker = null; }
      output.textContent = `阶段：${phaseNames[phase] || phase}\n待渲染：${pending} 字符\n最长解析批次：${maxBatch.toFixed(1)} ms\n页面长任务：${longTasks}（包含宿主网页）\n回复区节点：${renderedNodes}\n阶段到达耗时（ms）：${Object.entries(phases).map(([key, value]) => `${phaseNames[key] || key}=${value}`).join("，")}`;
    };
    const refreshVisibility = () => {
      output.hidden = !checkbox.checked;
      if (!checkbox.checked || !pageActive || !isVisible()) {
        stop();
        if (!checkbox.checked) output.textContent = "";
        return;
      }
      if (timer) return;
      if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes("longtask")) {
        try {
          const current = new PerformanceObserver((entries) => {
            if (observer === current) longTasks += entries.getEntries().length;
          });
          observer = current;
          observer.observe({ type: "longtask" });
        } catch {
          observer?.disconnect();
          observer = null;
        }
      }
      if (!(phase in phases)) phases[phase] = Math.round(performance.now() - start);
      refresh();
      timer = setInterval(refresh, 1000);
    };
    checkbox.addEventListener("change", refreshVisibility);
    window.addEventListener("pagehide", () => {
      pageActive = false;
      stop();
    });
    window.addEventListener("pageshow", () => {
      pageActive = true;
      refreshVisibility();
    });
    return {
      refreshVisibility,
      reset() {
        start = performance.now(); phases = {}; pending = maxBatch = longTasks = renderedNodes = 0;
        treeWalker = null; count = 0; output.textContent = "";
      },
      phase(value) { phase = value; if (timer && !(value in phases)) phases[value] = Math.round(performance.now() - start); },
      batch(milliseconds, remaining) { if (timer) { maxBatch = Math.max(maxBatch, milliseconds); pending = remaining; } }
    };
  };
})();
