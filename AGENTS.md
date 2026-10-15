# 仓库协作指南

## 项目结构

本项目是支持 Chromium 浏览器（Edge、Chrome、Brave、Vivaldi、Opera）的 Manifest V3 扩展，无需第三方依赖；运行打包脚本需 Node.js 18 或更新版本：

- `background.js`：右键菜单、请求生命周期、设置读取及权限检查。
- `browser-api.js`：统一浏览器 API 命名空间，供后台、设置页和注入脚本共用。
- `chat-completions.js`：OpenAI 兼容 Chat Completions 请求、SSE 解析和错误归一化。
- `overlay.js`：网页回复浮层、流式显示、Markdown 渲染和交互。
- `options.html`、`options.css`、`options.js`：设置页面结构、样式、服务商配置和页面协调。
- `options-prompts.js`：提示词与选中文字清理规则的编辑、列表交互和删除确认。
- `config.js`：默认配置、Base URL 和提示词处理。
- `manifest.json`：Chromium 扩展清单。
- `scripts/package.mjs`：使用 Node.js 内置模块生成 Chromium 安装目录；新增运行时资源时同步更新此脚本的文件清单，`dist/` 为可重建输出。
- `README.md`：说明打包、安装、接口和数据处理。
- `vendor/`：本地打包的流式 Markdown 解析器及其来源和许可证。
- `img/`：README 使用说明截图。

新增代码优先沿用现有原生 Web Extension API，不要擅自引入依赖。

## 开发与验证

运行 `node scripts/package.mjs` 生成 Chromium 扩展目录。Edge、Chrome、Brave、Vivaldi 和 Opera 从各自扩展管理页加载 `dist/chromium/`。修改后重新打包、加载扩展，并刷新已注入 `overlay.js` 的网页。可用 Node.js 检查脚本语法：

```sh
node --check background.js
node --check chat-completions.js
node --check overlay.js
node --check options.js
node --check options-prompts.js
node --check config.js
node --check browser-api.js
node --check scripts/package.mjs
```

没有自动化测试框架。按改动范围进行针对性验证；不要把语法或打包检查描述为浏览器行为测试。

## 协作与编码规则

- 所有任务描述、提问和反馈使用中文。先梳理目标、调用关系和边界；发现需求歧义时先向用户澄清。若有更合适的方案，说明取舍后再采用需用户决策的方案。
- JavaScript 遵循现有风格：两空格缩进、分号、双引号；变量和函数使用 `camelCase`，常量使用大写命名。关键逻辑添加简短注释。
- 修改前搜索相关调用方和关联文件，优先使用 CodeGraph；未初始化或不可用时使用 `rg` 等检索工具评估影响范围。保持改动局部，并处理错误、空值、取消和并发等边界。
- 未经用户明确同意，不添加第三方依赖。不要为常规任务添加数据库；如确需新增数据库字段，交付时必须提供对应 SQL。

## 架构与安全边界

请求链路为右键菜单 → `background.js` → 当前标签页浮层。只将用户选中文字和所选提示词发送给兼容 Chat Completions 的服务，不读取整页内容。API Key 仅保存在当前浏览器的扩展本地设置并由后台使用；不得传入网页脚本、提交到仓库或写入日志。不同浏览器之间不自动同步设置。保持权限最小化，主机访问权限按配置的 API 来源申请。HTTP 会明文传输密钥和请求内容，只用于可信的本机或内网服务。修改设置项、数据处理方式或权限时，同步检查 `config.js`、`options.js`、`background.js`、`manifest.json` 和 `README.md`。

## 交付要求

说明改了什么、原因、如何验证及重要限制。涉及数据库字段时附 SQL；涉及权限或敏感数据处理时明确指出影响。Git 提交历史当前不可用，提交信息使用简短、祈使式描述，例如 `fix: 保留浮层尺寸`。
