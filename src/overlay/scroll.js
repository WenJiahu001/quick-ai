(() => {
  const modules = globalThis.__quickAiOverlayModules ||= {};
  if (modules.createScrollController) return;
  modules.createScrollController = ({ readingArea, latestButton, card, isInitial }) => {
    let programmaticScrollTop = null;
    let userScrollUntil = 0;
    let lastScrollTop = 0;
    let followupScrollFrame = 0;
    let followupAutoScroll = false;
    const updateLatestButton = () => {
      latestButton.hidden = readingArea.scrollHeight - readingArea.clientHeight - readingArea.scrollTop <= 48;
    };
    // 程序跟随不会设置用户操作标记；只在实际的用户滚动后暂停跟随。
    for (const type of ["wheel", "touchstart", "touchmove", "pointerdown", "pointermove", "keydown"]) {
      readingArea.addEventListener(type, (event) => {
        if (type === "pointermove" && !event.buttons) return;
        if (type === "keydown" && !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
        userScrollUntil = Date.now() + 1200;
      }, { passive: true });
    }
    readingArea.tabIndex = 0;
    readingArea.addEventListener("scroll", () => {
      const atBottom = readingArea.scrollHeight - readingArea.clientHeight - readingArea.scrollTop <= 48;
      const programmatic = programmaticScrollTop !== null && Math.abs(readingArea.scrollTop - programmaticScrollTop) < 1;
      programmaticScrollTop = null;
      if (!programmatic && Date.now() < userScrollUntil && Math.abs(readingArea.scrollTop - lastScrollTop) > 0.5) {
        if (!isInitial()) followupAutoScroll = atBottom;
      }
      lastScrollTop = readingArea.scrollTop;
      updateLatestButton();
    }, { passive: true });
    latestButton.addEventListener("click", () => {
      followupAutoScroll = !isInitial();
      userScrollUntil = 0;
      readingArea.scrollTop = readingArea.scrollHeight;
      lastScrollTop = readingArea.scrollTop;
      programmaticScrollTop = readingArea.scrollTop;
      updateLatestButton();
    });
    const scrollToFollowupBottom = () => {
      if (followupScrollFrame || card.hidden) return;
      followupScrollFrame = requestAnimationFrame(() => {
        followupScrollFrame = 0;
        if (card.hidden) return;
        if (followupAutoScroll) {
          readingArea.scrollTop = readingArea.scrollHeight;
          lastScrollTop = readingArea.scrollTop;
          programmaticScrollTop = readingArea.scrollTop;
        }
        updateLatestButton();
      });
    };

    return {
      update: scrollToFollowupBottom,
      setFollowing(value) { followupAutoScroll = value; },
      reset() {
        followupAutoScroll = false;
        cancelAnimationFrame(followupScrollFrame);
        followupScrollFrame = 0;
        userScrollUntil = 0;
        programmaticScrollTop = null;
        readingArea.scrollTop = 0;
        lastScrollTop = 0;
        latestButton.hidden = true;
      }
    };
  };
})();
