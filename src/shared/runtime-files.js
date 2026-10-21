// 注入与打包共用此清单；工厂脚本先注册，overlay.js 最后安装浮层。
export const OVERLAY_SCRIPT_FILES = Object.freeze([
  "browser-api.js",
  "vendor/streaming-markdown.js",
  "src/overlay/text.js",
  "src/overlay/styles.js",
  "src/overlay/view.js",
  "src/overlay/appearance.js",
  "src/overlay/geometry.js",
  "src/overlay/markdown-renderer.js",
  "src/overlay/stream-renderer.js",
  "src/overlay/scroll.js",
  "src/overlay/turn-view.js",
  "src/overlay/app.js",
  "overlay.js"
]);

export const PACKAGE_FILES = Object.freeze([
  "LICENSE", "PRIVACY.md", "background.js", "browser-api.js",
  "chat-completions.js", "config.js", "options.html", "options.css",
  "options.js", "overlay.js", "src",
  "vendor/streaming-markdown.js",
  "vendor/streaming-markdown.LICENSE",
  "vendor/streaming-markdown.NOTICE"
]);
