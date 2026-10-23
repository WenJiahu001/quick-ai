(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createPreferencesClient) return;
  modules.createPreferencesClient = (api) => {
    const listeners = new Set();
    let loading = null;
    const notify = (values) => {
      const changes = Object.fromEntries(Object.entries(values || {}).map(([key, value]) => [key, { newValue: value }]));
      for (const listener of listeners) listener(changes, "local");
    };
    api.runtime.onMessage.addListener((message) => {
      if (message?.type !== "OVERLAY_PREFERENCES_CHANGED") return;
      notify(message.values);
    });
    return {
      async get() {
        loading ||= api.runtime.sendMessage({ type: "GET_OVERLAY_PREFERENCES" }).then((result) => {
          if (!result?.ok) throw new Error("无法读取浮层设置。");
          return result.values;
        }).finally(() => { loading = null; });
        return loading;
      },
      async set(values) {
        const result = await api.runtime.sendMessage({ type: "SET_OVERLAY_PREFERENCES", values });
        if (!result?.ok) throw new Error("无法保存浮层设置。");
      },
      async refresh() { notify(await this.get()); },
      subscribe(listener) { listeners.add(listener); }
    };
  };
})();
