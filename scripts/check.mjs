import { readdir, readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { OVERLAY_SCRIPT_FILES } from "../src/shared/runtime-files.js";

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
const scripts = [
  "background.js", "browser-api.js", "chat-completions.js", "config.js",
  "options.js", "overlay.js", ...await collectScripts("src"), ...await collectScripts("scripts")
];
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
const html = await readFile(resolve(root, "options.html"), "utf8");
for (const [, file] of html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)) {
  await access(resolve(root, file));
}
console.log(`静态检查通过：${scripts.length} 个脚本，模块引用、导出名称及浮层资源均有效。`);
