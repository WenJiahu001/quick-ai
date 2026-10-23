import { readdir, readFile, access, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { OVERLAY_SCRIPT_FILES, PACKAGE_FILES } from "../src/shared/runtime-files.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function collectScripts(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await collectScripts(path));
    else if (/\.m?js$/.test(entry.name)) files.push(path);
  }
  return files;
}

// 仅做静态检查，不执行扩展业务代码，也不访问 AI 服务商。
const scripts = [...new Set([
  "background.js", "browser-api.js", "chat-completions.js", "config.js",
  "options.js", "overlay.js", ...OVERLAY_SCRIPT_FILES, ...await collectScripts("src"), ...await collectScripts("scripts")
])];
for (const script of scripts) {
  const path = resolve(root, script);
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} 语法错误：\n${result.stderr}`);
  const source = await readFile(path, "utf8");
  const imports = source.matchAll(/^\s*import\s+(?:[\w*{},\s]+?\s+from\s+)?["']([^"']+)["']/gm);
  for (const [, specifier] of imports) {
    if (specifier.startsWith(".")) await access(resolve(dirname(path), specifier));
  }
  const namedImports = source.matchAll(/^\s*import\s+\{([^}]+)\}\s+from\s+["'](\.[^"']+)["']/gm);
  for (const [, bindings, specifier] of namedImports) {
    const importedSource = await readFile(resolve(dirname(path), specifier), "utf8");
    const exports = new Set([...importedSource.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm)].map((match) => match[1]));
    for (const binding of bindings.split(",").map((value) => value.trim()).filter(Boolean)) {
      const name = binding.split(/\s+as\s+/)[0];
      if (!exports.has(name)) throw new Error(`${script} 引用了未导出的名称：${specifier} → ${name}`);
    }
  }
}
for (const script of OVERLAY_SCRIPT_FILES) await access(resolve(root, script));
if (OVERLAY_SCRIPT_FILES.at(-1) !== "overlay.js") throw new Error("浮层入口必须最后注入。");
const registered = new Set();
const referenced = new Set();
for (const script of OVERLAY_SCRIPT_FILES) {
  const source = await readFile(resolve(root, script), "utf8");
  for (const [, name] of source.matchAll(/modules\.(create\w+)\s*=/g)) registered.add(name);
  for (const [, name] of source.matchAll(/modules\.(create\w+)\s*\(/g)) referenced.add(name);
  if (script.startsWith("src/overlay/") && /\b(?:extensionApi|api)\.storage\b/.test(source)) throw new Error(`浮层不可直接访问扩展存储：${script}`);
}
for (const name of referenced) if (!registered.has(name)) throw new Error(`浮层工厂未注册：${name}`);
const html = await readFile(resolve(root, "options.html"), "utf8");
for (const [, file] of html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)) {
  await access(resolve(root, file));
}
console.log(`静态检查通过：${scripts.length} 个脚本，模块引用、导出名称及浮层资源均有效。`);

if (process.argv.includes("--package")) {
  const expected = [];
  async function collectFiles(path) {
    if ((await stat(resolve(root, path))).isDirectory()) {
      for (const name of await readdir(resolve(root, path))) await collectFiles(`${path}/${name}`);
    } else expected.push(path);
  }
  for (const path of ["manifest.json", ...PACKAGE_FILES]) await collectFiles(path);
  for (const path of expected) {
    const [source, packaged] = await Promise.all([readFile(resolve(root, path)), readFile(resolve(root, "dist/chromium", path))]);
    if (!source.equals(packaged)) throw new Error(`安装目录与当前源码不一致，请重新打包：${path}`);
  }
  const manifest = JSON.parse(await readFile(resolve(root, "dist/chromium/manifest.json"), "utf8"));
  console.log(`发布目录检查通过：版本 ${manifest.version}，${expected.length} 个文件与源码逐字节一致。`);
}
