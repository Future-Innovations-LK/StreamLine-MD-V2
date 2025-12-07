// lib/loader.js
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export async function loadPlugins() {
  const pluginsDir = path.join(process.cwd(), "commands");
  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith(".js"));

  const plugins = {};

  for (const file of files) {
    const filePath = path.join(pluginsDir, file);
    const fileUrl = pathToFileURL(filePath).href;

    const module = await import(fileUrl);

    // ✅ Add default export if it exists
    if (module.default) {
      const name = module.default.name || file.replace(".js", "");
      plugins[name] = module.default;
    }

    // ✅ Add all named exports
    for (const [exportName, exportedValue] of Object.entries(module)) {
      if (exportName === "default") continue;

      plugins[exportName] = exportedValue;
    }
  }

  return plugins;
}
