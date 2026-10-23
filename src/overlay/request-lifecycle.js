(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createRequestLifecycle) return;
  modules.createRequestLifecycle = ({ api, onWaiting, onLost, onPhase }) => {
    let phase = "idle";
    let requestId = null;
    let timer = 0;
    let startedAt = 0;
    let lastTextAt = 0;
    let lastProbeAt = 0;
    let probeToken = null;
    const stopWatching = () => { clearInterval(timer); timer = 0; probeToken = null; };
    const transition = (next) => { phase = next; onPhase(next); };
    const fail = (message) => {
      stopWatching();
      transition(phase === "stopping" ? "stopping" : "draining-error");
      onLost(message);
    };
    const tick = () => {
      const now = Date.now();
      if (now - startedAt >= 125_000) {
        void api.runtime.sendMessage({ type: "CANCEL_REQUEST", requestId }).catch(() => {});
        fail("等待已超过 2 分钟，请重试；已接收的内容会保留。");
        return;
      }
      if (now - lastTextAt >= 15_000) onWaiting();
      if (probeToken || now - lastProbeAt < 10_000) return;
      lastProbeAt = now;
      const token = {};
      const probedId = requestId;
      probeToken = token;
      // 只在请求期间通信；同时避免后台空闲回收，停止后不再保持后台运行。
      void api.runtime.sendMessage({ type: "REQUEST_STATUS", requestId }).then((result) => {
        if (probeToken !== token || requestId !== probedId) return;
        if (!result?.active || result.protocol !== globalThis.quickAiProtocol.version) {
          fail("后台请求已中断或扩展已更新，请重试；若仍失败，请重新加载扩展并刷新网页。");
        }
      }, () => {
        if (probeToken === token && requestId === probedId) fail("与扩展后台的连接已断开，请重新加载扩展并刷新网页。");
      }).finally(() => { if (probeToken === token) probeToken = null; });
    };
    return {
      start(id) {
        stopWatching();
        requestId = id;
        startedAt = lastTextAt = lastProbeAt = Date.now();
        transition("connecting");
        timer = setInterval(tick, 1000);
      },
      connected() { if (phase === "connecting") transition("waiting"); },
      received() { lastTextAt = Date.now(); if (phase !== "streaming") transition("streaming"); },
      endNetwork() { stopWatching(); if (["connecting", "waiting", "streaming"].includes(phase)) transition("draining"); },
      fail() { stopWatching(); if (phase !== "stopping") transition("draining-error"); },
      stop() { stopWatching(); transition("stopping"); },
      finish(success) { stopWatching(); transition(success ? "complete" : phase === "stopping" ? "stopped" : "failed"); },
      reset() { stopWatching(); requestId = null; transition("idle"); },
      stopWatching,
      get phase() { return phase; },
      get generating() { return ["connecting", "waiting", "streaming", "draining", "draining-error", "stopping"].includes(phase); },
      get networkFinished() { return !["connecting", "waiting", "streaming"].includes(phase); },
      get stopped() { return phase === "stopping" || phase === "stopped"; }
    };
  };
})();
