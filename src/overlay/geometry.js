(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createGeometryController) return;
  modules.createGeometryController = ({ extensionApi, host, card, header, restoreButton, resizeHandles }) => {
    const boundsStorageKey = "quickAiOverlayBounds";
    let boundsSaveTimer = 0;
    let activeDrag = null;
    let activeResize = null;

    const viewportLimits = () => ({
      maxWidth: Math.max(1, window.innerWidth - 32),
      maxHeight: Math.max(1, window.innerHeight - 40)
    });

    const syncRestoreButtonPosition = () => {
      const rect = card.getBoundingClientRect();
      const width = rect.width || Number.parseFloat(card.style.width) || Math.min(800, window.innerWidth - 32);
      const left = rect.width ? rect.left : Number.parseFloat(host.style.left);
      const top = rect.height ? rect.top : Number.parseFloat(host.style.top);
      const cardLeft = Number.isFinite(left) ? left : window.innerWidth - width - 20;
      const cardTop = Number.isFinite(top) ? top : 20;
      const restoreWidth = restoreButton.offsetWidth || 92;
      const restoreHeight = restoreButton.offsetHeight || 34;
      const maxRestoreLeft = Math.max(12, window.innerWidth - restoreWidth - 12);
      const maxRestoreTop = Math.max(12, window.innerHeight - restoreHeight - 12);
      restoreButton.style.left = `${Math.min(Math.max(12, cardLeft + width - restoreWidth - 14), maxRestoreLeft)}px`;
      restoreButton.style.right = "auto";
      restoreButton.style.top = `${Math.min(Math.max(12, cardTop + 13), maxRestoreTop)}px`;
    };

    const clampPosition = () => {
      const rect = card.getBoundingClientRect();
      const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - rect.width - 12));
      const top = Math.min(Math.max(12, rect.top), Math.max(12, window.innerHeight - rect.height - 12));
      host.style.left = `${left}px`;
      host.style.right = "auto";
      host.style.top = `${top}px`;
      syncRestoreButtonPosition();
    };

    const saveBounds = (immediate = false) => {
      if (card.hidden) return;
      clearTimeout(boundsSaveTimer);
      const persist = () => {
        if (card.hidden) return;
        const rect = card.getBoundingClientRect();
        const bounds = { version: 2, width: rect.width, height: rect.height, left: rect.left, top: rect.top };
        extensionApi.storage.local.set({ [boundsStorageKey]: bounds }).catch(() => {});
      };
      if (immediate) persist();
      else boundsSaveTimer = window.setTimeout(persist, 120);
    };

    const resizeFromCorner = (corner, start, deltaX, deltaY) => {
      const { maxWidth, maxHeight } = viewportLimits();
      const minWidth = Math.min(300, maxWidth);
      const minHeight = Math.min(240, maxHeight);
      const minX = 12;
      const minY = 12;
      const maxX = Math.max(minX, window.innerWidth - 12);
      const maxY = Math.max(minY, window.innerHeight - 12);
      let left = start.left;
      let right = start.right;
      let top = start.top;
      let bottom = start.bottom;

      if (corner.includes("left")) {
        const lower = Math.max(minX, right - maxWidth);
        const upper = Math.max(lower, right - minWidth);
        left = Math.min(Math.max(start.left + deltaX, lower), upper);
      } else {
        const lower = left + minWidth;
        const upper = Math.max(lower, Math.min(maxX, left + maxWidth));
        right = Math.min(Math.max(start.right + deltaX, lower), upper);
      }

      if (corner.includes("top")) {
        const lower = Math.max(minY, bottom - maxHeight);
        const upper = Math.max(lower, bottom - minHeight);
        top = Math.min(Math.max(start.top + deltaY, lower), upper);
      } else {
        const lower = top + minHeight;
        const upper = Math.max(lower, Math.min(maxY, top + maxHeight));
        bottom = Math.min(Math.max(start.bottom + deltaY, lower), upper);
      }

      host.style.left = `${left}px`;
      host.style.right = "auto";
      host.style.top = `${top}px`;
      card.style.width = `${right - left}px`;
      card.style.height = `${bottom - top}px`;
      saveBounds();
    };

    for (const handle of resizeHandles) {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = card.getBoundingClientRect();
        activeResize = {
          pointerId: event.pointerId,
          corner: handle.dataset.corner,
          startX: event.clientX,
          startY: event.clientY,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!activeResize || activeResize.pointerId !== event.pointerId) return;
        event.preventDefault();
        const start = activeResize;
        // 使用按下时的边界和位移计算，避免连续布局测量造成抖动。
        const deltaX = event.clientX - start.startX;
        const deltaY = event.clientY - start.startY;
        resizeFromCorner(start.corner, start, deltaX, deltaY);
      });
      const finishResize = (event) => {
        if (activeResize?.pointerId !== event.pointerId) return;
        activeResize = null;
        saveBounds();
      };
      handle.addEventListener("pointerup", finishResize);
      handle.addEventListener("pointercancel", finishResize);
      handle.addEventListener("lostpointercapture", finishResize);
      handle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 50 : 10;
        const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const delta = deltas[event.key];
        if (!delta) return;
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        resizeFromCorner(handle.dataset.corner, {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        }, delta[0], delta[1]);
      });
    }

    const constrainSize = () => {
      if (card.hidden) return;
      const { maxWidth, maxHeight } = viewportLimits();
      const rect = card.getBoundingClientRect();
      const width = Math.min(rect.width, maxWidth);
      const height = Math.min(rect.height, maxHeight);
      if (width !== rect.width) card.style.width = `${width}px`;
      if (height !== rect.height) card.style.height = `${height}px`;
      clampPosition();
      saveBounds();
    };

    // 观察尺寸变化并校正边界，确保不同页面缩放比例下浮层都留在视口内。
    const resizeObserver = new ResizeObserver(constrainSize);
    resizeObserver.observe(card);

    extensionApi.storage.local.get(boundsStorageKey).then((stored) => {
      const bounds = stored[boundsStorageKey];
      if (!bounds || ![bounds.width, bounds.height, bounds.left, bounds.top].every(Number.isFinite)) return;
      const { maxWidth, maxHeight } = viewportLimits();
      const restoredWidth = Math.min(Math.max(300, bounds.width), maxWidth);
      card.style.width = `${restoredWidth}px`;
      card.style.height = `${Math.min(Math.max(180, bounds.height), maxHeight)}px`;
      const maxLeft = Math.max(12, window.innerWidth - restoredWidth - 12);
      // 旧版误用最大宽度限制坐标，恢复时会把所有位置压到最左侧约 20px；迁移这类旧默认位置到右侧。
      const isLegacyLeftDefault = bounds.version !== 2 && bounds.left <= 20 && bounds.left < maxLeft - 40;
      const restoredLeft = isLegacyLeftDefault ? maxLeft : Math.min(Math.max(12, bounds.left), maxLeft);
      host.style.left = `${restoredLeft}px`;
      host.style.right = "auto";
      host.style.top = `${Math.min(Math.max(12, bounds.top), Math.max(12, window.innerHeight - 180 - 12))}px`;
      syncRestoreButtonPosition();
    }).catch(() => {});

    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const rect = card.getBoundingClientRect();
      activeDrag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener("pointermove", (event) => {
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
      const left = Math.min(Math.max(12, event.clientX - activeDrag.offsetX), Math.max(12, window.innerWidth - card.offsetWidth - 12));
      const top = Math.min(Math.max(12, event.clientY - activeDrag.offsetY), Math.max(12, window.innerHeight - card.offsetHeight - 12));
      host.style.left = `${left}px`;
      host.style.right = "auto";
      host.style.top = `${top}px`;
      syncRestoreButtonPosition();
      saveBounds();
    });
    const endDrag = (event) => {
      if (activeDrag?.pointerId === event.pointerId) activeDrag = null;
    };
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", () => {
      if (card.hidden) return;
      const { maxWidth, maxHeight } = viewportLimits();
      card.style.width = `${Math.min(card.getBoundingClientRect().width, maxWidth)}px`;
      card.style.height = `${Math.min(card.getBoundingClientRect().height, maxHeight)}px`;
      clampPosition();
      saveBounds();
    });

    return { saveBounds, clampPosition, syncRestoreButtonPosition };
  };
})();
