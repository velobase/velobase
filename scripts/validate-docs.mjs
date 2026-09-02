import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

const failures = [];
for (const file of await markdownFiles(repository)) {
  const markdown = await readFile(file, "utf8");
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const localTarget = decodeURIComponent(target.split("#", 1)[0]);
    if (!localTarget) continue;
    try {
      await access(resolve(dirname(file), localTarget));
    } catch {
      failures.push(`${file.slice(repository.length + 1)} -> ${localTarget}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`broken local documentation links:\n${failures.join("\n")}`);
}

console.log("all local documentation links resolve");
