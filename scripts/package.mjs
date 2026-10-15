import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repositoryRoot, "dist");
const packageFiles = [
  "LICENSE",
  "background.js",
  "browser-api.js",
  "chat-completions.js",
  "config.js",
  "options.html",
  "options.css",
  "options.js",
  "options-prompts.js",
  "overlay.js",
  "vendor/streaming-markdown.js",
  "vendor/streaming-markdown.LICENSE",
  "vendor/streaming-markdown.NOTICE"
];
const requestedTargets = process.argv.slice(2);
if (requestedTargets.some((targetName) => targetName !== "chromium")) {
  throw new Error("当前仅支持 Chromium 浏览器，可选打包目标：chromium");
}

const targetName = "chromium";
const destination = resolve(outputRoot, targetName);
const destinationRelative = relative(outputRoot, destination);
if (!destinationRelative || destinationRelative.startsWith(`..${sep}`) || isAbsolute(destinationRelative)) {
  throw new Error("打包目标必须位于仓库 dist 目录中。");
}

// 只清理本脚本明确管理的 Chromium 输出目录，避免混入过期文件。
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

await cp(resolve(repositoryRoot, "manifest.json"), resolve(destination, "manifest.json"));
for (const file of packageFiles) {
  const source = resolve(repositoryRoot, file);
  const packagedFile = resolve(destination, file);
  await mkdir(dirname(packagedFile), { recursive: true });
  await cp(source, packagedFile);
}

const manifest = JSON.parse(await readFile(resolve(destination, "manifest.json"), "utf8"));
const backgroundFiles = [manifest.background?.service_worker].filter(Boolean);
const requiredFiles = [
  ...backgroundFiles,
  manifest.options_page,
  "browser-api.js",
  "overlay.js",
  "vendor/streaming-markdown.js"
].filter(Boolean);
for (const file of requiredFiles) {
  const packagedFile = resolve(destination, file);
  const fileRelative = relative(destination, packagedFile);
  if (!fileRelative || fileRelative.startsWith(`..${sep}`) || isAbsolute(fileRelative)) {
    throw new Error(`${targetName} 清单引用了打包目录之外的文件：${file}`);
  }
  await readFile(packagedFile);
}

console.log(`已生成 ${relative(repositoryRoot, destination)}（${targetName}）。`);
