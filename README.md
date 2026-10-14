# 快捷AI

快捷AI 是一款 Manifest V3 浏览器扩展：选中网页文字后，从右键菜单选择提示词，将选中文字发送给你配置的 AI 服务商，并在网页中查看流式 Markdown 回复。

支持 Chromium 121+（Edge、Chrome、Brave、Vivaldi、Opera）和 Firefox 140+ 桌面版。项目不依赖 npm 第三方包。

## 下载与安装

发布包会放在 [GitHub Releases](https://github.com/WenJiahu001/quick-ai/releases)。Chromium 用户下载并解压 `quick-ai-chromium-v版本号.zip`，Firefox 用户下载 AMO 签名后的 `quick-ai-firefox-v版本号.xpi`。

### Edge、Chrome、Brave、Vivaldi 和 Opera

1. 解压 Chromium ZIP。
2. 打开扩展管理页：Edge 使用 `edge://extensions`，Chrome 使用 `chrome://extensions`，Brave 使用 `brave://extensions`，Vivaldi 使用 `vivaldi://extensions`，Opera 使用 `opera://extensions`。
3. 开启开发人员模式，选择“加载解压缩的扩展”，并选中解压后的目录。
4. 打开快捷AI选项页，配置 AI 服务商。

此安装方式通过浏览器开发者模式加载，不是 Chrome Web Store 或 Edge Add-ons 商店安装。

![浏览器扩展管理页面加载本地扩展的示意图](img/安装示例.svg)

### Firefox 桌面版

快捷AI 的 Firefox 发布包通过 Mozilla Add-ons（AMO）签名后自行分发，不公开列在 AMO 商店中。Firefox 140 或更高版本中打开“附加组件和主题”，从设置菜单选择“从文件安装附加组件”，再选中下载的 XPI 文件。Firefox 安装时会说明扩展发送给 AI 服务商的数据类型。

如需从源码试用：先运行下方打包命令，再打开 `about:debugging#/runtime/this-firefox`，选择“临时载入附加组件”，载入 `dist/firefox/manifest.json`。临时扩展在 Firefox 关闭后会移除。每个正式发布版本都需要重新提交 AMO 签名，再将签名返回的 XPI 附到 GitHub Release。

### 从源码构建

需要安装 Node.js。运行下列命令生成 Chromium 和 Firefox 扩展目录：

```sh
node scripts/package.mjs
```

生成目录为 `dist/chromium/` 和 `dist/firefox/`。也可只生成一个目标，例如 `node scripts/package.mjs firefox`。维护者可在 Windows PowerShell 中运行 `scripts/create-release-assets.ps1`，生成 Chromium 发布 ZIP 和提交 AMO 签名用的 Firefox ZIP；签名后的 XPI 需从 AMO 手动下载。

修改源码后重新构建，在浏览器扩展管理页重新加载，并刷新已打开的网页。

## 配置

在选项页添加或选择 AI 服务商，填写服务商名称、API Key、模型名称和 API Base URL，然后保存。保存时浏览器会请求访问该 Base URL 对应站点的权限。更换服务商后，新请求使用当前选中的配置。

快捷AI 使用 OpenAI 兼容的 Chat Completions 接口（`/chat/completions`），要求服务商支持 Bearer Key 认证、Chat Completions 消息格式和 SSE 流式响应。默认模型为 `gpt-6-luna`，默认地址为 `https://api.openai.com/v1`。原生 Anthropic、Gemini 等非兼容协议暂不支持。Base URL 可使用 HTTP 或 HTTPS；HTTP 会明文传输 API Key 和请求内容，只应连接可信的本机或内网服务。

![AI 服务商和提示词配置示意图](img/配置示例.svg)

提示词可以添加、编辑、复制、排序、设为常用或禁用；禁用项不会出现在右键菜单中。清理规则按列表顺序进行区分大小写的字面匹配，可删除匹配文字，或替换为空格、换行及自定义内容。没有配置清理规则时，选中文字保持原样。

设置页支持导入或导出 JSON 配置备份。导出文件包含提示词、清理规则和服务商配置，但不包含 API Key。不同浏览器的扩展存储相互独立；迁移到另一个浏览器后，需要重新填写 API Key。

## 使用

1. 在普通网页中选中要提问的文字。
2. 右键打开“快捷AI”菜单。
3. 选择提示词，等待回复浮层显示流式结果。

![选中文字并从右键菜单选择快捷AI提示词](img/使用.png)

扩展只读取选中的文字，不读取整页内容。清理后的选中文字固定显示在回复浮层顶部，便于对照；浮层可拖动、调整大小、隐藏或关闭，回复可单独滚动。

![快捷AI 在网页中显示流式 Markdown 回复](img/效果.png)

## 数据与隐私

API Key 保存在当前浏览器配置的扩展本地存储中，由扩展后台用于请求，不会传给网页脚本，也不包含在导出的配置 JSON 中。浏览器扩展本地存储不提供额外加密。每次请求仅在用户选择提示词后，将清理后的选中文字、提示词、模型以及用于鉴权的 API Key 发送给所选 AI 服务商。扩展不读取整页内容、不向快捷AI自有服务器发送数据，也不保存回复历史。不同服务商的数据处理和保留方式由其各自的隐私政策决定。

更多数据处理细节见[隐私说明](PRIVACY.md)。流式 Markdown 解析器随扩展本地打包；其来源、许可证和修改说明见 `vendor/`。

项目自有代码采用 MIT 许可证，详见 [LICENSE](LICENSE)；`vendor/` 中的流式 Markdown 解析器保留其原始许可证和来源说明。
